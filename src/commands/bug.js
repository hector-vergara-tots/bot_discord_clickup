const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { generateBugReport, extractLearnings } = require('../services/ai');
const { getTask, createSubtask, getCurrentSprint } = require('../services/clickup');
const contextStore  = require('../services/contextStore');
const knowledgeBase = require('../services/knowledgeBase');
const logger = require('../utils/logger');

const IMPACT_COLORS = { Alto: 0xff0000, Medio: 0xffa500, Bajo: 0x00b0f4 };
const IMPACT_EMOJIS = { Alto: '🔴', Medio: '🟠', Bajo: '🔵' };
const COLLECTOR_TIMEOUT_MS = 60_000;
const PREVIEW_TIMEOUT_MS   = 120_000;

// Stores params from execute() until handleBugModal() picks them up
// Key: userId, Value: { tipo, ambiente, useContext }
const pendingExecutions = new Map();

const CONTEXT_KEYWORDS = [
  'anterior', 'bug anterior', 'issue anterior', 'reporte anterior',
  'similar al anterior', 'basado en el anterior', 'basado en el bug anterior',
  'como el anterior', 'igual que antes', 'mismo que antes',
  'el bug de antes', 'bug previo', 'el anterior',
];

function detectsContextReference(text) {
  const lower = text.toLowerCase();
  return CONTEXT_KEYWORDS.some((kw) => lower.includes(kw));
}

const command = new SlashCommandBuilder()
  .setName('bug')
  .setDescription('Reporta un bug o tarea en ClickUp con ayuda de IA')
  .addStringOption((opt) =>
    opt
      .setName('tipo')
      .setDescription('Tipo de subtarea')
      .setRequired(true)
      .addChoices(
        { name: '🐛 Bug',        value: 'bug' },
        { name: '✨ Improvement', value: 'improvement' },
        { name: '📋 Task',        value: 'task' },
        { name: '🧪 Test Case',   value: 'test case' },
        { name: '📑 Test Plan',   value: 'test plan' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('ambiente')
      .setDescription('Ambiente donde ocurre')
      .setRequired(true)
      .addChoices(
        { name: '💻 Development', value: 'development' },
        { name: '🧪 Staging',     value: 'staging' },
        { name: '🚀 Production',  value: 'production' }
      )
  )
  .addBooleanOption((opt) =>
    opt
      .setName('contexto_app')
      .setDescription('Usar contexto de la aplicación (desactivar para features nuevas no documentadas)')
      .setRequired(false)
  );

async function execute(interaction) {
  const tipo       = interaction.options.getString('tipo');
  const ambiente   = interaction.options.getString('ambiente');
  const useContext = interaction.options.getBoolean('contexto_app') ?? true;

  // Store params so handleBugModal() can pick them up when the modal is submitted
  pendingExecutions.set(interaction.user.id, { tipo, ambiente, useContext });

  const modal = new ModalBuilder()
    .setCustomId('bug_main_modal')
    .setTitle('Reportar Bug / Tarea');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('descripcion_input')
        .setLabel('Descripción')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Qué pasa y qué debería pasar...')
        .setRequired(true)
        .setMaxLength(4000)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('evidencia_input')
        .setLabel('Evidencia — JAM, screenshot, link (opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://jam.dev/...')
        .setRequired(false)
        .setMaxLength(500)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('task_id_input')
        .setLabel('ID de tarea padre (opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ej: abc123xyz — vacío para usar el sprint actual')
        .setRequired(false)
        .setMaxLength(100)
    ),
  );

  await interaction.showModal(modal);
  // Flow continues in handleBugModal() when index.js routes the modal submit
}

// ── Modal submit handler (called from index.js) ───────────────────────────────
async function handleBugModal(interaction) {
  // Acknowledge immediately — Discord requires a response within 3 seconds
  await interaction.deferReply();

  const pending = pendingExecutions.get(interaction.user.id);
  pendingExecutions.delete(interaction.user.id);

  if (!pending) {
    return interaction.editReply({ content: '❌ No se encontró contexto del comando. Ejecuta `/bug` de nuevo.', embeds: [], components: [] });
  }

  const { tipo, ambiente, useContext } = pending;

  // getTextInputValue with required=false returns null when optional field is blank
  const descripcion = interaction.fields.getTextInputValue('descripcion_input').trim();
  const evidencia   = interaction.fields.getTextInputValue('evidencia_input', false)?.trim() || null;
  const taskId      = interaction.fields.getTextInputValue('task_id_input', false)?.trim() || null;

  const autoDetected    = detectsContextReference(descripcion);
  const previousContext = autoDetected ? contextStore.getRecent(interaction.user.id) : null;

  if (autoDetected && previousContext) {
    logger.info(`[bug] Auto-detected context reference for user ${interaction.user.id}, injecting previous report.`);
  } else if (autoDetected && !previousContext) {
    logger.info(`[bug] Context reference detected but no recent entry found for user ${interaction.user.id}.`);
  }

  const params = { tipo, ambiente, descripcion, evidencia, useContext, previousContext };

  if (taskId) {
    await handleWithParentTask(interaction, { ...params, taskId });
  } else {
    await showDestinationChoice(interaction, params);
  }
}

// ── Post-creation side effects (non-blocking) ─────────────────────────────────
function afterTaskCreated(userId, { tipo, ambiente, descripcion, report }) {
  contextStore.save(userId, { tipo, ambiente, descripcion, report });

  const date = new Date().toISOString().split('T')[0];
  extractLearnings({ tipo, ambiente, descripcion, report })
    .then((summary) => {
      if (summary) knowledgeBase.appendLearning({ date, tipo, ambiente, summary });
    })
    .catch((err) => logger.warn(`[bug] Learning extraction failed: ${err.message}`));
}

// ── Flow A: task_id provided — create subtask under parent ───────────────────
async function handleWithParentTask(interaction, { taskId, tipo, ambiente, descripcion, evidencia = null, useContext = true, previousContext = null }) {
  try {
    await interaction.editReply({ content: '⏳ Obteniendo tarea padre en ClickUp...', embeds: [], components: [] });

    let parentTask;
    try {
      parentTask = await getTask(taskId);
    } catch (err) {
      const status = err.response?.status;
      const msg = status === 401
        ? 'Token de ClickUp inválido.'
        : status === 404
        ? `No se encontró la tarea \`${taskId}\` en ClickUp.`
        : `Error al obtener la tarea: ${err.response?.data?.err || err.message}`;
      return interaction.editReply({ content: `❌ ${msg}`, embeds: [], components: [] });
    }

    const listId = parentTask.list?.id;
    if (!listId) {
      return interaction.editReply({ content: '❌ No se pudo obtener el ID de la lista de la tarea padre.', embeds: [], components: [] });
    }

    const allowedSpaceId = process.env.CLICKUP_SPACE_ID;
    const taskSpaceId    = String(parentTask.space?.id ?? '');
    if (allowedSpaceId && taskSpaceId !== allowedSpaceId) {
      return interaction.editReply({
        content:
          `❌ La tarea \`${taskId}\` no pertenece al space autorizado.\n` +
          `Space de la tarea: \`${taskSpaceId || 'desconocido'}\` · Space permitido: \`${allowedSpaceId}\``,
        embeds: [],
        components: [],
      });
    }

    const contextHint = previousContext ? ' _(usando contexto del bug anterior)_' : '';
    await interaction.editReply({ content: `🤖 Redactando reporte con IA...${contextHint}`, embeds: [], components: [] });

    let report;
    try {
      report = await generateBugReport({
        taskId,
        tipo,
        ambiente,
        descripcion,
        evidencia,
        useContext,
        contextReport: previousContext?.report ?? null,
      });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al generar el reporte con IA: ${err.message}`, embeds: [], components: [] });
    }

    const generateParams = { taskId, tipo, ambiente, descripcion, evidencia, useContext };
    const confirmed = await runBugPreviewLoop(interaction, report, generateParams, tipo, ambiente);
    if (!confirmed) return;

    await interaction.editReply({ content: '📝 Creando subtarea en ClickUp...', embeds: [], components: [] });

    let createdTask;
    try {
      createdTask = await createSubtask({ parentTaskId: taskId, listId, tipo, ambiente, assigneeId: null, report: confirmed });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al crear la subtarea en ClickUp: ${err.response?.data?.err || err.message}`, embeds: [], components: [] });
    }

    await sendSuccessEmbed(interaction, { report: confirmed, createdTask, tipo, ambiente, parentLabel: `[${parentTask.name}](${parentTask.url})`, parentKey: '🔗 Tarea padre' });
    afterTaskCreated(interaction.user.id, { tipo, ambiente, descripcion, report: confirmed });
  } catch (err) {
    logger.error('[bug] Unexpected error:', err);
    await interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, embeds: [], components: [] });
  }
}

// ── Flow B: no task_id — ask Sprint or Tarea ─────────────────────────────────
async function showDestinationChoice(interaction, params) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bug_sprint').setLabel('📌 Sprint actual').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bug_task').setLabel('🔗 Asociar a tarea').setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ content: '¿Dónde deseas crear la tarea?', embeds: [], components: [row] });

  const channel = await resolveChannel(interaction);
  if (!channel) return interaction.editReply({ content: '❌ No se pudo resolver el canal.', embeds: [], components: [] });

  const collector = channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: COLLECTOR_TIMEOUT_MS,
    max: 1,
  });

  collector.on('collect', async (i) => {
    try {
      if (i.customId === 'bug_sprint') {
        await i.deferUpdate();
        await handleSprintFlow(interaction, params);

      } else if (i.customId === 'bug_task') {
        const taskModal = new ModalBuilder()
          .setCustomId('bug_task_id_modal')
          .setTitle('ID de la Tarea Padre');

        taskModal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('task_id_input')
              .setLabel('ID de la tarea en ClickUp')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('ej: abc123xyz')
              .setRequired(true)
          )
        );

        await i.showModal(taskModal);

        try {
          const modalSubmit = await interaction.awaitModalSubmit({
            time: 120_000,
            filter: (m) => m.user.id === interaction.user.id && m.customId === 'bug_task_id_modal',
          });
          await modalSubmit.deferUpdate();
          const taskId = modalSubmit.fields.getTextInputValue('task_id_input').trim();
          await handleWithParentTask(interaction, { ...params, taskId });
        } catch {
          await interaction.editReply({ content: '⏱️ Tiempo agotado. Ejecuta el comando de nuevo.', embeds: [], components: [] }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error('[bug] Destination choice error:', err);
      interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, embeds: [], components: [] }).catch(() => {});
    }
  });

  collector.on('end', (_c, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        content: `⏱️ Tiempo agotado (${COLLECTOR_TIMEOUT_MS / 1000}s). Ejecuta el comando de nuevo.`,
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  });
}

// ── Flow B1: show sprint and confirm ─────────────────────────────────────────
async function handleSprintFlow(interaction, params) {
  await interaction.editReply({ content: '⏳ Obteniendo sprint actual...', embeds: [], components: [] });

  let sprint;
  try {
    sprint = await getCurrentSprint();
  } catch (err) {
    return interaction.editReply({ content: `❌ Error al obtener el sprint: ${err.response?.data?.err || err.message}`, embeds: [], components: [] });
  }

  if (!sprint) {
    return interaction.editReply({ content: '❌ No se encontró un sprint activo. Usa `task_id` para asociar a una tarea.', embeds: [], components: [] });
  }

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bug_sprint_confirm').setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bug_sprint_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({
    content: `📌 Sprint actual detectado:\n> **${sprint.name}**\n\nLa tarea se creará directamente en este sprint. ¿Confirmas?`,
    embeds: [],
    components: [confirmRow],
  });

  const channel = await resolveChannel(interaction);
  if (!channel) return interaction.editReply({ content: '❌ No se pudo resolver el canal.', embeds: [], components: [] });

  const collector = channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: COLLECTOR_TIMEOUT_MS,
    max: 1,
  });

  collector.on('collect', async (i) => {
    await i.deferUpdate();
    if (i.customId === 'bug_sprint_confirm') {
      await proceedWithSprint(interaction, sprint, params);
    } else {
      await interaction.editReply({ content: '❌ Operación cancelada.', embeds: [], components: [] });
    }
  });

  collector.on('end', (_c, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        content: `⏱️ Tiempo agotado (${COLLECTOR_TIMEOUT_MS / 1000}s). Ejecuta el comando de nuevo.`,
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  });
}

// ── Flow B1 final: generate report and create directly in sprint ──────────────
async function proceedWithSprint(interaction, sprint, { tipo, ambiente, descripcion, evidencia = null, useContext = true, previousContext = null }) {
  try {
    const contextHint = previousContext ? ' _(usando contexto del bug anterior)_' : '';
    await interaction.editReply({ content: `🤖 Redactando reporte con IA...${contextHint}`, embeds: [], components: [] });

    let report;
    try {
      report = await generateBugReport({
        tipo,
        ambiente,
        descripcion,
        evidencia,
        useContext,
        contextReport: previousContext?.report ?? null,
      });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al generar el reporte con IA: ${err.message}`, embeds: [], components: [] });
    }

    const generateParams = { tipo, ambiente, descripcion, evidencia, useContext };
    const confirmed = await runBugPreviewLoop(interaction, report, generateParams, tipo, ambiente);
    if (!confirmed) return;

    await interaction.editReply({ content: '📝 Creando tarea en el sprint...', embeds: [], components: [] });

    let createdTask;
    try {
      createdTask = await createSubtask({
        parentTaskId: null,
        listId: sprint.id,
        tipo,
        ambiente,
        assigneeId: null,
        report: confirmed,
      });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al crear la tarea en el sprint: ${err.response?.data?.err || err.message}`, embeds: [], components: [] });
    }

    await sendSuccessEmbed(interaction, { report: confirmed, createdTask, tipo, ambiente, parentLabel: sprint.name, parentKey: '🏃 Sprint' });
    afterTaskCreated(interaction.user.id, { tipo, ambiente, descripcion, report: confirmed });
  } catch (err) {
    logger.error('[bug] Sprint task creation error:', err);
    await interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, embeds: [], components: [] });
  }
}

// ── Preview loop ──────────────────────────────────────────────────────────────
async function runBugPreviewLoop(interaction, report, generateParams, tipo, ambiente) {
  return new Promise((resolve) => {
    _showBugPreview(interaction, report, generateParams, tipo, ambiente, resolve);
  });
}

async function _showBugPreview(interaction, report, generateParams, tipo, ambiente, resolve) {
  const embed = buildBugPreviewEmbed(report, tipo, ambiente);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('preview_confirm').setLabel('✅ Crear en ClickUp').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('preview_adjust').setLabel('✏️ Ajustar').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('preview_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({ content: '', embeds: [embed], components: [row] });

  const channel = await resolveChannel(interaction);
  if (!channel) { resolve(null); return; }

  const collector = channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: PREVIEW_TIMEOUT_MS,
    max: 1,
  });

  collector.on('collect', async (i) => {
    try {
      if (i.customId === 'preview_confirm') {
        await i.deferUpdate();
        resolve(report);

      } else if (i.customId === 'preview_cancel') {
        await i.deferUpdate();
        await interaction.editReply({ content: '❌ Operación cancelada.', embeds: [], components: [] });
        resolve(null);

      } else if (i.customId === 'preview_adjust') {
        const modal = new ModalBuilder()
          .setCustomId('preview_adjust_modal')
          .setTitle('Ajustar reporte');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('adjustment_input')
              .setLabel('¿Qué quieres ajustar?')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Ej: El expected behavior no es correcto, debería ser...\nAgrega que esto solo pasa en iOS.')
              .setRequired(true)
          )
        );

        await i.showModal(modal);

        try {
          const modalSubmit = await interaction.awaitModalSubmit({
            time: PREVIEW_TIMEOUT_MS,
            filter: (m) => m.user.id === interaction.user.id && m.customId === 'preview_adjust_modal',
          });
          await modalSubmit.deferUpdate();
          const adjustment = modalSubmit.fields.getTextInputValue('adjustment_input').trim();

          await interaction.editReply({ content: '🤖 Ajustando reporte con IA...', embeds: [], components: [] });

          let newReport;
          try {
            newReport = await generateBugReport({ ...generateParams, previousReport: report, adjustment });
          } catch (err) {
            await interaction.editReply({ content: `❌ Error al ajustar el reporte: ${err.message}`, embeds: [], components: [] });
            return resolve(null);
          }

          _showBugPreview(interaction, newReport, generateParams, tipo, ambiente, resolve);
        } catch {
          await interaction.editReply({ content: '⏱️ Tiempo agotado. Ejecuta el comando de nuevo.', embeds: [], components: [] }).catch(() => {});
          resolve(null);
        }
      }
    } catch (err) {
      logger.error('[bug] Preview loop error:', err);
      resolve(null);
    }
  });

  collector.on('end', (_c, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        content: `⏱️ Tiempo agotado (${PREVIEW_TIMEOUT_MS / 1000}s). Ejecuta el comando de nuevo.`,
        embeds: [],
        components: [],
      }).catch(() => {});
      resolve(null);
    }
  });
}

// ── Channel helper ────────────────────────────────────────────────────────────
// ModalSubmitInteraction.channel can be null if the channel isn't cached yet
async function resolveChannel(interaction) {
  return interaction.channel
    ?? interaction.client.channels.cache.get(interaction.channelId)
    ?? await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
}

// ── Embed helpers ─────────────────────────────────────────────────────────────
function addDescriptionChunks(embed, text, label) {
  const CHUNK = 1020;
  if (!text) {
    embed.addFields({ name: label, value: '*(vacío)*' });
    return;
  }
  let remaining = text;
  let index = 0;
  while (remaining.length > 0) {
    embed.addFields({
      name: index === 0 ? label : `${label} (cont.)`,
      value: remaining.slice(0, CHUNK),
    });
    remaining = remaining.slice(CHUNK);
    index++;
  }
}

function buildBugPreviewEmbed(report, tipo, ambiente) {
  const color       = IMPACT_COLORS[report.impact] ?? 0x7289da;
  const impactEmoji = IMPACT_EMOJIS[report.impact] ?? '⚪';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`👁️ ${report.title}`)
    .addFields(
      { name: '📌 Tipo',                value: tipo,          inline: true },
      { name: '🌍 Ambiente',            value: ambiente,       inline: true },
      { name: `${impactEmoji} Impacto`, value: report.impact,  inline: true },
    );

  // Show Spanish preview if available, fall back to English
  const previewText = report.descripcion_preview ?? report.description ?? '';
  addDescriptionChunks(embed, previewText, '📝 Descripción');

  if (report.notes) {
    addDescriptionChunks(embed, report.notes, '🗒️ Notas internas');
  }

  embed.setFooter({ text: '👁️ Vista previa en español · El reporte se creará en inglés en ClickUp' });
  return embed;
}

async function sendSuccessEmbed(interaction, { report, createdTask, tipo, ambiente, parentLabel, parentKey }) {
  const color       = IMPACT_COLORS[report.impact] ?? 0x7289da;
  const impactEmoji = IMPACT_EMOJIS[report.impact] ?? '⚪';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`✅ Tarea creada: ${report.title}`)
    .setURL(createdTask.url)
    .addFields(
      { name: '📌 Tipo',                value: tipo,          inline: true },
      { name: '🌍 Ambiente',            value: ambiente,       inline: true },
      { name: `${impactEmoji} Impacto`, value: report.impact,  inline: true },
      { name: parentKey, value: parentLabel, inline: false },
    )
    .setFooter({ text: `Reportado por ${interaction.user.username} · ClickUp ID: ${createdTask.id}` })
    .setTimestamp();

  addDescriptionChunks(embed, report.description ?? '', '📝 Descripción generada');

  await interaction.editReply({ content: `🎉 Tarea creada exitosamente: ${createdTask.url}`, embeds: [embed], components: [] });
}

module.exports = { data: command, execute, handleBugModal };
