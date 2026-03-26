require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const logger = require('./utils/logger');
const bugCommand = require('./commands/bug');
const testcaseCommand = require('./commands/testcase');

// ── Validate required env vars ──────────────────────────────────────────────
const REQUIRED_ENV = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'CLICKUP_API_TOKEN',
  'CLICKUP_WORKSPACE_ID',
  'CLICKUP_SPACE_ID',
  'CLICKUP_QA_LIST_ID',
  'GEMINI_API_KEY',
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  logger.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// ── Discord client ───────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ── Command registry ─────────────────────────────────────────────────────────
client.commands = new Collection();
client.commands.set(bugCommand.data.name, bugCommand);
client.commands.set(testcaseCommand.data.name, testcaseCommand);

// ── Register slash commands with Discord ─────────────────────────────────────
async function registerCommands() {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const commands = [...client.commands.values()].map((cmd) => cmd.data.toJSON());

  try {
    logger.info(`[startup] Registering ${commands.length} slash command(s)...`);
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    logger.info('[startup] Slash commands registered globally.');
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
  if (!interaction.isChatInputCommand()) return;

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
});

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  logger.error('[startup] Failed to login:', err.message);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', () => { client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
