const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateBugReport } = require('../services/gemini');
const { getWorkspaceMembers, getTask, createSubtask } = require('../services/clickup');
const { resolveClickUpAssignee } = require('../utils/parser');
const logger = require('../utils/logger');

const IMPACT_COLORS = { Alto: 0xff0000, Medio: 0xffa500, Bajo: 0x00b0f4 };
const IMPACT_EMOJIS = { Alto: '🔴', Medio: '🟠', Bajo: '🔵' };

const command = new SlashCommandBuilder()
  .setName('bug')
  .setDescription('Reporta un bug o tarea en ClickUp con ayuda de IA')
  .addStringOption((opt) =>
    opt
      .setName('task_id')
      .setDescription('ID de la tarea padre en ClickUp (ej: abc123xyz)')
      .setRequired(true)
  )
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
  .addUserOption((opt) =>
    opt
      .setName('asignado')
      .setDescription('Usuario de Discord a quien asignar la tarea')
      .setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply();

  const taskId = interaction.options.getString('task_id').trim();
  const tipo = interaction.options.getString('tipo');
  const ambiente = interaction.options.getString('ambiente');
  const descripcion = interaction.options.getString('descripcion');
  const discordAssignee = interaction.options.getUser('asignado');

  try {
    // Step 1: Fetch parent task to get its list ID
    await interaction.editReply('⏳ Obteniendo tarea padre en ClickUp...');
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
      return interaction.editReply(`❌ ${msg}`);
    }

    const listId = parentTask.list?.id;
    if (!listId) {
      return interaction.editReply('❌ No se pudo obtener el ID de la lista de la tarea padre.');
    }

    // Space validation: reject tasks outside the allowed space
    const allowedSpaceId = process.env.CLICKUP_SPACE_ID;
    const taskSpaceId = String(parentTask.space?.id ?? '');
    if (allowedSpaceId && taskSpaceId !== allowedSpaceId) {
      return interaction.editReply(
        `❌ La tarea \`${taskId}\` no pertenece al space autorizado.\n` +
        `Space de la tarea: \`${taskSpaceId || 'desconocido'}\` · Space permitido: \`${allowedSpaceId}\``
      );
    }

    // Step 2: Resolve Discord user → ClickUp assignee
    let assigneeId = null;
    if (discordAssignee) {
      await interaction.editReply('⏳ Buscando usuario en ClickUp...');
      try {
        const members = await getWorkspaceMembers();
        assigneeId = resolveClickUpAssignee(discordAssignee.username, members);
        if (!assigneeId) {
          logger.warn(`[bug] No ClickUp member found for Discord user: ${discordAssignee.username}`);
        }
      } catch (err) {
        logger.error('[bug] Failed to fetch workspace members:', err.message);
      }
    }

    // Step 3: Generate structured report via Gemini
    await interaction.editReply('🤖 Redactando reporte con IA...');
    let report;
    try {
      report = await generateBugReport({ taskId, tipo, ambiente, descripcion });
    } catch (err) {
      return interaction.editReply(`❌ Error al generar el reporte con Gemini: ${err.message}`);
    }

    // Step 4: Create subtask in ClickUp
    await interaction.editReply('📝 Creando subtarea en ClickUp...');
    let createdTask;
    try {
      createdTask = await createSubtask({
        parentTaskId: taskId,
        listId,
        tipo,
        ambiente,
        assigneeId,
        report,
      });
    } catch (err) {
      const errMsg = err.response?.data?.err || err.message;
      return interaction.editReply(`❌ Error al crear la subtarea en ClickUp: ${errMsg}`);
    }

    // Step 5: Reply with success embed
    const taskUrl = createdTask.url;
    const color = IMPACT_COLORS[report.impact] ?? 0x7289da;
    const impactEmoji = IMPACT_EMOJIS[report.impact] ?? '⚪';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`✅ Subtarea creada: ${report.title}`)
      .setURL(taskUrl)
      .addFields(
        { name: '📌 Tipo', value: tipo, inline: true },
        { name: '🌍 Ambiente', value: ambiente, inline: true },
        { name: `${impactEmoji} Impacto`, value: report.impact, inline: true },
        { name: '👤 Asignado', value: discordAssignee ? (assigneeId ? `<@${discordAssignee.id}>` : `${discordAssignee.username} *(no encontrado en ClickUp)*`) : 'Sin asignar', inline: true },
        { name: '🔗 Tarea padre', value: `[${parentTask.name}](${parentTask.url})`, inline: false },
        { name: '📝 Descripción generada', value: report.description.slice(0, 300) + (report.description.length > 300 ? '...' : ''), inline: false }
      )
      .setFooter({ text: `Reportado por ${interaction.user.username} · ClickUp ID: ${createdTask.id}` })
      .setTimestamp();

    await interaction.editReply({ content: `🎉 Subtarea creada exitosamente: ${taskUrl}`, embeds: [embed] });
  } catch (err) {
    logger.error('[bug] Unexpected error:', err);
    await interaction.editReply(`❌ Error inesperado: ${err.message}`);
  }
}

module.exports = { data: command, execute };
