require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const logger = require('./utils/logger');
const bugCommand         = require('./commands/bug');
const testcaseCommand    = require('./commands/testcase');
const conocimientoCommand = require('./commands/conocimiento');

// ── Validate required env vars ──────────────────────────────────────────────
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

const VALID_PROVIDERS = ['gemini', 'claude'];
if (!VALID_PROVIDERS.includes(AI_PROVIDER)) {
  logger.error(`[startup] Invalid AI_PROVIDER: "${AI_PROVIDER}". Valid values: ${VALID_PROVIDERS.join(', ')}`);
  process.exit(1);
}

const BASE_ENV = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'CLICKUP_API_TOKEN',
  'CLICKUP_WORKSPACE_ID',
  'CLICKUP_SPACE_ID',
  'CLICKUP_QA_LIST_ID',
];

const PROVIDER_ENV = {
  gemini: ['GEMINI_API_KEY'],
  claude: ['ANTHROPIC_API_KEY'],
};

const REQUIRED_ENV = [...BASE_ENV, ...PROVIDER_ENV[AI_PROVIDER]];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  logger.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

logger.info(`[startup] AI provider: ${AI_PROVIDER}`);

// ── Discord client ───────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ── Command registry ─────────────────────────────────────────────────────────
client.commands = new Collection();
client.commands.set(bugCommand.data.name, bugCommand);
client.commands.set(testcaseCommand.data.name, testcaseCommand);
client.commands.set(conocimientoCommand.data.name, conocimientoCommand);

// ── Register slash commands with Discord ─────────────────────────────────────
async function registerCommands() {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const commands = [...client.commands.values()].map((cmd) => cmd.data.toJSON());

  try {
    const guildId = process.env.GUILD_ID;
    if (guildId) {
      logger.info(`[startup] Registering ${commands.length} slash command(s) in guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
        { body: commands }
      );
      logger.info('[startup] Slash commands registered for guild (instant).');
    } else {
      logger.info(`[startup] Registering ${commands.length} slash command(s) globally...`);
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands }
      );
      logger.info('[startup] Slash commands registered globally.');
    }
  } catch (err) {
    logger.error('[startup] Failed to register slash commands:', err);
    process.exit(1);
  }
}

// ── Event: ready ─────────────────────────────────────────────────────────────
client.once('ready', async (c) => {
  logger.info(`[bot] Logged in as ${c.user.tag}`);
  await registerCommands();
});

// ── Event: interaction ────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // ── Slash commands ───────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`[bot] Unknown command: ${interaction.commandName}`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`[bot] Error executing /${interaction.commandName}:`, err);
      const reply = { content: '❌ Ocurrió un error inesperado.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
    return;
  }

  // ── Modal submits ────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    let handler = null;

    if (interaction.customId === 'bug_main_modal') {
      handler = () => bugCommand.handleBugModal(interaction);
    } else if (interaction.customId === 'tc_adjust_modal') {
      handler = () => testcaseCommand.handleTCAdjustModal(interaction);
    }

    if (handler) {
      try {
        await handler();
      } catch (err) {
        logger.error(`[bot] Error handling modal ${interaction.customId}:`, err);
        const reply = { content: '❌ Ocurrió un error inesperado al procesar el formulario.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }
    // otros modals (preview_adjust_modal, bug_task_id_modal) los manejan
    // sus propios awaitModalSubmit dentro de cada comando — no necesitan routing aquí
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  logger.error('[startup] Failed to login:', err.message);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', () => { client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
