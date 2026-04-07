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
const { generateBugReport } = require('../services/gemini');
const { getWorkspaceMembers, getTask, createSubtask, getCurrentSprint } = require('../services/clickup');
const { resolveClickUpAssignee } = require('../utils/parser');
const logger = require('../utils/logger');

const IMPACT_COLORS = { Alto: 0xff0000, Medio: 0xffa500, Bajo: 0x00b0f4 };
const IMPACT_EMOJIS = { Alto: '🔴', Medio: '🟠', Bajo: '🔵' };
const COLLECTOR_TIMEOUT_MS = 60_000;

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
  );

async function execute(interaction) {
  await interaction.deferReply();

  const tipo           = interaction.options.getString('tipo');
  const ambiente       = interaction.options.getString('ambiente');
  const descripcion    = interaction.options.getString('descripcion');
  const taskId         = interaction.options.getString('task_id')?.trim() ?? null;
  const discordAssignee = interaction.options.getUser('asignado');

  if (taskId) {
    await handleWithParentTask(interaction, { taskId, tipo, ambiente, descripcion, discordAssignee });
  } else {
    await showDestinationChoice(interaction, { tipo, ambiente, descripcion, discordAssignee });
  }
}

// ── Flow A: task_id provided — create subtask under parent ───────────────────
async function handleWithParentTask(interaction, { taskId, tipo, ambiente, descripcion, discordAssignee }) {
  try {
    // Step 1: Fetch parent task
    await interaction.editReply({ content: '⏳ Obteniendo tarea padre en ClickUp...', components: [] });
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
      return interaction.editReply({ content: `❌ ${msg}`, components: [] });
    }

    const listId = parentTask.list?.id;
    if (!listId) {
      return interaction.editReply({ content: '❌ No se pudo obtener el ID de la lista de la tarea padre.', components: [] });
    }

    // Space validation
    const allowedSpaceId = process.env.CLICKUP_SPACE_ID;
    const taskSpaceId = String(parentTask.space?.id ?? '');
    if (allowedSpaceId && taskSpaceId !== allowedSpaceId) {
      return interaction.editReply({
        content:
          `❌ La tarea \`${taskId}\` no pertenece al space autorizado.\n` +
          `Space de la tarea: \`${taskSpaceId || 'desconocido'}\` · Space permitido: \`${allowedSpaceId}\``,
        components: [],
      });
    }

    // Step 2: Resolve assignee
    const assigneeId = await resolveAssignee(interaction, discordAssignee);

    // Step 3: Generate report
    await interaction.editReply({ content: '🤖 Redactando reporte con IA...', components: [] });
    let report;
    try {
      report = await generateBugReport({ taskId, tipo, ambiente, descripcion });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al generar el reporte con Gemini: ${err.message}`, components: [] });
    }

    // Step 4: Create subtask
    await interaction.editReply({ content: '📝 Creando subtarea en ClickUp...', components: [] });
    let createdTask;
    try {
      createdTask = await createSubtask({ parentTaskId: taskId, listId, tipo, ambiente, assigneeId, report });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al crear la subtarea en ClickUp: ${err.response?.data?.err || err.message}`, components: [] });
    }

    // Step 5: Success embed
    const color = IMPACT_COLORS[report.impact] ?? 0x7289da;
    const impactEmoji = IMPACT_EMOJIS[report.impact] ?? '⚪';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`✅ Subtarea creada: ${report.title}`)
      .setURL(createdTask.url)
      .addFields(
        { name: '📌 Tipo',    value: tipo,    inline: true },
        { name: '🌍 Ambiente', value: ambiente, inline: true },
        { name: `${impactEmoji} Impacto`, value: report.impact, inline: true },
        {
          name: '👤 Asignado',
          value: discordAssignee
            ? (assigneeId ? `<@${discordAssignee.id}>` : `${discordAssignee.username} *(no encontrado en ClickUp)*`)
            : 'Sin asignar',
          inline: true,
        },
        { name: '🔗 Tarea padre', value: `[${parentTask.name}](${parentTask.url})`, inline: false },
        {
          name: '📝 Descripción generada',
          value: report.description.slice(0, 300) + (report.description.length > 300 ? '...' : ''),
          inline: false,
        }
      )
      .setFooter({ text: `Reportado por ${interaction.user.username} · ClickUp ID: ${createdTask.id}` })
      .setTimestamp();

    await interaction.editReply({ content: `🎉 Subtarea creada exitosamente: ${createdTask.url}`, embeds: [embed], components: [] });
  } catch (err) {
    logger.error('[bug] Unexpected error:', err);
    await interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, components: [] });
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
        // Show modal — button interaction must NOT be deferred to call showModal()
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

        // Wait for the user to submit the modal (2 min timeout)
        try {
          const modalSubmit = await interaction.awaitModalSubmit({
            time: 120_000,
            filter: (m) => m.user.id === interaction.user.id && m.customId === 'bug_task_id_modal',
          });
          await modalSubmit.deferUpdate();
          const taskId = modalSubmit.fields.getTextInputValue('task_id_input').trim();
          await handleWithParentTask(interaction, { ...params, taskId });
        } catch {
          // awaitModalSubmit throws on timeout
          await interaction.editReply({ content: '⏱️ Tiempo agotado. Ejecuta el comando de nuevo.', components: [] }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error('[bug] Destination choice error:', err);
      interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, components: [] }).catch(() => {});
    }
  });

  collector.on('end', (_c, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        content: `⏱️ Tiempo agotado (${COLLECTOR_TIMEOUT_MS / 1000}s). Ejecuta el comando de nuevo.`,
        components: [],
      }).catch(() => {});
    }
  });
}

// ── Flow B1: show sprint and confirm ─────────────────────────────────────────
async function handleSprintFlow(interaction, params) {
  await interaction.editReply({ content: '⏳ Obteniendo sprint actual...', components: [] });

  let sprint;
  try {
    sprint = await getCurrentSprint();
  } catch (err) {
    return interaction.editReply({ content: `❌ Error al obtener el sprint: ${err.response?.data?.err || err.message}`, components: [] });
  }

  if (!sprint) {
    return interaction.editReply({ content: '❌ No se encontró un sprint activo. Usa `task_id` para asociar a una tarea.', components: [] });
  }

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bug_sprint_confirm').setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bug_sprint_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({
    content: `📌 Sprint actual detectado:\n> **${sprint.name}**\n\nLa tarea se creará directamente en este sprint. ¿Confirmas?`,
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
      await interaction.editReply({ content: '❌ Operación cancelada.', components: [] });
    }
  });

  collector.on('end', (_c, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        content: `⏱️ Tiempo agotado (${COLLECTOR_TIMEOUT_MS / 1000}s). Ejecuta el comando de nuevo.`,
        components: [],
      }).catch(() => {});
    }
  });
}

// ── Flow B1 final: generate report and create directly in sprint ──────────────
async function proceedWithSprint(interaction, sprint, { tipo, ambiente, descripcion, discordAssignee }) {
  try {
    // Resolve assignee
    const assigneeId = await resolveAssignee(interaction, discordAssignee);

    // Generate report (no parent task_id in this flow)
    await interaction.editReply({ content: '🤖 Redactando reporte con IA...', components: [] });
    let report;
    try {
      report = await generateBugReport({ tipo, ambiente, descripcion });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al generar el reporte con Gemini: ${err.message}`, components: [] });
    }

    // Create task directly in sprint list (no parent task)
    await interaction.editReply({ content: '📝 Creando tarea en el sprint...', components: [] });
    let createdTask;
    try {
      createdTask = await createSubtask({
        parentTaskId: null,
        listId: sprint.id,
        tipo,
        ambiente,
        assigneeId,
        report,
      });
    } catch (err) {
      return interaction.editReply({ content: `❌ Error al crear la tarea en el sprint: ${err.response?.data?.err || err.message}`, components: [] });
    }

    // Success embed
    const color = IMPACT_COLORS[report.impact] ?? 0x7289da;
    const impactEmoji = IMPACT_EMOJIS[report.impact] ?? '⚪';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`✅ Tarea creada: ${report.title}`)
      .setURL(createdTask.url)
      .addFields(
        { name: '📌 Tipo',    value: tipo,    inline: true },
        { name: '🌍 Ambiente', value: ambiente, inline: true },
        { name: `${impactEmoji} Impacto`, value: report.impact, inline: true },
        {
          name: '👤 Asignado',
          value: discordAssignee
            ? (assigneeId ? `<@${discordAssignee.id}>` : `${discordAssignee.username} *(no encontrado en ClickUp)*`)
            : 'Sin asignar',
          inline: true,
        },
        { name: '🏃 Sprint', value: sprint.name, inline: false },
        {
          name: '📝 Descripción generada',
          value: report.description.slice(0, 300) + (report.description.length > 300 ? '...' : ''),
          inline: false,
        }
      )
      .setFooter({ text: `Reportado por ${interaction.user.username} · ClickUp ID: ${createdTask.id}` })
      .setTimestamp();

    await interaction.editReply({ content: `🎉 Tarea creada en el sprint: ${createdTask.url}`, embeds: [embed], components: [] });
  } catch (err) {
    logger.error('[bug] Sprint task creation error:', err);
    await interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, components: [] });
  }
}

// ── Helper: resolve Discord user → ClickUp assignee ID ───────────────────────
async function resolveAssignee(interaction, discordAssignee) {
  if (!discordAssignee) return null;

  await interaction.editReply({ content: '⏳ Buscando usuario en ClickUp...', components: [] });
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
