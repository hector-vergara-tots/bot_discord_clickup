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
const { generateBugReport } = require('../services/ai');
const { getWorkspaceMembers, getTask, createSubtask, getCurrentSprint } = require('../services/clickup');
const { resolveClickUpAssignee } = require('../utils/parser');
const logger = require('../utils/logger');

const IMPACT_COLORS = { Alto: 0xff0000, Medio: 0xffa500, Bajo: 0x00b0f4 };
const IMPACT_EMOJIS = { Alto: '🔴', Medio: '🟠', Bajo: '🔵' };
const COLLECTOR_TIMEOUT_MS = 60_000;
const PREVIEW_TIMEOUT_MS = 120_000;

const command = new SlashCommandBuilder()
  .setName('bug')
  .setDescription('Reporta un bug o tarea en ClickUp con ayuda de IA')
  .addStringOption((opt) =>
    opt
      .setName('tipo')
      .setDescription('Tipo de subtarea')
      .setRequired(true)
      .addChoices(
        { name: '🐛 Bug', value: 'bug' },
        { name: '✨ Improvement', value: 'improvement' },
        { name: '📋 Task', value: 'task' },
        { name: '🧪 Test Case', value: 'test case' },
        { name: '📑 Test Plan', value: 'test plan' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('ambiente')
      .setDescription('Ambiente donde ocurre')
      .setRequired(true)
      .addChoices(
        { name: '💻 Development', value: 'development' },
        { name: '🧪 Staging', value: 'staging' },
        { name: '🚀 Production', value: 'production' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('descripcion')
      .setDescription('Descripción informal de qué pasa y qué debería pasar')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('task_id')
      .setDescription('ID de la tarea padre (opcional — si no se indica se ofrecerá crear en el sprint actual)')
      .setRequired(false)
  )
  .addUserOption((opt) =>
    opt
      .setName('asignado')
      .setDescription('Usuario de Discord a quien asignar la tarea')
      .setRequired(false)
  )
  .addBooleanOption((opt) =>
    opt
      .setName('contexto_app')
      .setDescription('Usar contexto de la aplicación (desactivar para features nuevas no documentadas)')
      .setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply();

  const tipo             = interaction.options.getString('tipo');
  const ambiente         = interaction.options.getString('ambiente');
  const descripcion      = interaction.options.getString('descripcion');
  const taskId           = interaction.options.getString('task_id')?.trim() ?? null;
  const discordAssignee  = interaction.options.getUser('asignado');
  const useContext       = interaction.options.getBoolean('contexto_app') ?? true;

  if (taskId) {
    await handleWithParentTask(interaction, { taskId, tipo, ambiente, descripcion, discordAssignee, useContext });
  } else {
    await showDestinationChoice(interaction, { tipo, ambiente, descripcion, discordAssignee, useContext });
  }
}

// ── Flow A: task_id provided — create subtask under parent ───────────────────
async function handleWithParentTask(interaction, { taskId, tipo, ambiente, descripcion, discordAssignee, useContext = true }) {
  try {
    // Step 1: Fetch parent task
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

    // Space validation
    const allowedSpaceId = process.env.CLICKUP_SPACE_ID;
    const taskSpaceId = String(parentTask.space?.id ?? '');
    if (allowedSpaceId && taskSpaceId !== allowedSpaceId) {
      return interaction.editReply({
        content:
          `❌ La tarea \`${taskId}\` no pertenece al space autorizado.\n` +
          `Space de la tarea: \`${taskSpaceId || 'desconocido'}\` · Space permitido: \`${allowedSpaceId}\``,
        embeds: [],
        components: [],
      });
    }

    // Step 2: Resolve assignee
    const assigneeId = await resolveAssignee(interaction, discordAssignee);

    // Step 3: Generate report
    await interaction.editReply({ content: '🤖 Redactando reporte con IA...', embeds: [], components: [] });
    let report;
    try {
      report = await generateBugReport({ taskId, tipo, ambiente, descripcion, useContext });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al generar el reporte con Gemini: ${err.message}`, embeds: [], components: [] });
    }

    // Step 4: Preview loop
    const generateParams = { taskId, tipo, ambiente, descripcion, useContext };
    const confirmed = await runBugPreviewLoop(interaction, report, generateParams, tipo, ambiente);
    if (!confirmed) return;

    // Step 5: Create subtask
    await interaction.editReply({ content: '📝 Creando subtarea en ClickUp...', embeds: [], components: [] });
    let createdTask;
    try {
      createdTask = await createSubtask({ parentTaskId: taskId, listId, tipo, ambiente, assigneeId, report: confirmed });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al crear la subtarea en ClickUp: ${err.response?.data?.err || err.message}`, embeds: [], components: [] });
    }

    // Step 6: Success embed
    await sendSuccessEmbed(interaction, { report: confirmed, createdTask, tipo, ambiente, discordAssignee, assigneeId, parentLabel: `[${parentTask.name}](${parentTask.url})`, parentKey: '🔗 Tarea padre' });
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

  await interaction.editReply({
    content: '¿Dónde deseas crear la tarea?',
    embeds: [],
    components: [row],
  });

  const collector = interaction.channel.createMessageComponentCollector({
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
        const modal = new ModalBuilder()
          .setCustomId('bug_task_id_modal')
          .setTitle('ID de la Tarea Padre');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('task_id_input')
              .setLabel('ID de la tarea en ClickUp')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('ej: abc123xyz')
              .setRequired(true)
          )
        );

        await i.showModal(modal);

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

  const collector = interaction.channel.createMessageComponentCollector({
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
async function proceedWithSprint(interaction, sprint, { tipo, ambiente, descripcion, discordAssignee, useContext = true }) {
  try {
    const assigneeId = await resolveAssignee(interaction, discordAssignee);

    await interaction.editReply({ content: '🤖 Redactando reporte con IA...', embeds: [], components: [] });
    let report;
    try {
      report = await generateBugReport({ tipo, ambiente, descripcion, useContext });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al generar el reporte con Gemini: ${err.message}`, embeds: [], components: [] });
    }

    // Preview loop
    const generateParams = { tipo, ambiente, descripcion, useContext };
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
        assigneeId,
        report: confirmed,
      });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al crear la tarea en el sprint: ${err.response?.data?.err || err.message}`, embeds: [], components: [] });
    }

    await sendSuccessEmbed(interaction, { report: confirmed, createdTask, tipo, ambiente, discordAssignee, assigneeId, parentLabel: sprint.name, parentKey: '🏃 Sprint' });
  } catch (err) {
    logger.error('[bug] Sprint task creation error:', err);
    await interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, embeds: [], components: [] });
  }
}

// ── Preview loop: show generated report, allow Adjust / Confirm / Cancel ─────
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

  const collector = interaction.channel.createMessageComponentCollector({
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

// ── Build preview embed ───────────────────────────────────────────────────────
function buildBugPreviewEmbed(report, tipo, ambiente) {
  const color = IMPACT_COLORS[report.impact] ?? 0x7289da;
  const impactEmoji = IMPACT_EMOJIS[report.impact] ?? '⚪';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`👁️ ${report.title}`)
    .addFields(
      { name: '📌 Tipo',              value: tipo,          inline: true },
      { name: '🌍 Ambiente',          value: ambiente,       inline: true },
      { name: `${impactEmoji} Impacto`, value: report.impact, inline: true },
    );

  const desc = report.description ?? '';
  embed.addFields({
    name: '📝 Descripción',
    value: desc.length > 1020 ? desc.slice(0, 1020) + '...' : desc || '*(vacío)*',
  });

  if (report.notes) {
    const notes = report.notes;
    embed.addFields({
      name: '🗒️ Notas internas',
      value: notes.length > 1020 ? notes.slice(0, 1020) + '...' : notes,
    });
  }

  embed.setFooter({ text: '👁️ Vista previa — aún no se ha creado en ClickUp' });
  return embed;
}

// ── Build success embed ───────────────────────────────────────────────────────
async function sendSuccessEmbed(interaction, { report, createdTask, tipo, ambiente, discordAssignee, assigneeId, parentLabel, parentKey }) {
  const color = IMPACT_COLORS[report.impact] ?? 0x7289da;
  const impactEmoji = IMPACT_EMOJIS[report.impact] ?? '⚪';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`✅ Tarea creada: ${report.title}`)
    .setURL(createdTask.url)
    .addFields(
      { name: '📌 Tipo',                value: tipo,          inline: true },
      { name: '🌍 Ambiente',            value: ambiente,       inline: true },
      { name: `${impactEmoji} Impacto`, value: report.impact,  inline: true },
      {
        name: '👤 Asignado',
        value: discordAssignee
          ? (assigneeId ? `<@${discordAssignee.id}>` : `${discordAssignee.username} *(no encontrado en ClickUp)*`)
          : 'Sin asignar',
        inline: true,
      },
      { name: parentKey, value: parentLabel, inline: false },
      {
        name: '📝 Descripción generada',
        value: report.description.slice(0, 300) + (report.description.length > 300 ? '...' : ''),
        inline: false,
      }
    )
    .setFooter({ text: `Reportado por ${interaction.user.username} · ClickUp ID: ${createdTask.id}` })
    .setTimestamp();

  await interaction.editReply({ content: `🎉 Tarea creada exitosamente: ${createdTask.url}`, embeds: [embed], components: [] });
}

// ── Helper: resolve Discord user → ClickUp assignee ID ───────────────────────
async function resolveAssignee(interaction, discordAssignee) {
  if (!discordAssignee) return null;

  await interaction.editReply({ content: '⏳ Buscando usuario en ClickUp...', embeds: [], components: [] });
  try {
    const members = await getWorkspaceMembers();
    const assigneeId = resolveClickUpAssignee(discordAssignee.username, members);
    if (!assigneeId) {
      logger.warn(`[bug] No ClickUp member found for Discord user: ${discordAssignee.username}`);
    }
    return assigneeId;
  } catch (err) {
    logger.error('[bug] Failed to fetch workspace members:', err.message);
    return null;
  }
}

module.exports = { data: command, execute };
