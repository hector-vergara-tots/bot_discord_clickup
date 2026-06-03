const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const knowledgeBase = require('../services/knowledgeBase');
const logger        = require('../utils/logger');

const COLLECTOR_TIMEOUT_MS = 60_000;
const DISCORD_MAX_FIELD    = 1024;
const DISCORD_MAX_DESC     = 4096;

const command = new SlashCommandBuilder()
  .setName('conocimiento')
  .setDescription('Gestiona la base de conocimiento aprendida por el bot')
  .addStringOption((opt) =>
    opt
      .setName('accion')
      .setDescription('Qué quieres hacer')
      .setRequired(true)
      .addChoices(
        { name: '👁️ Ver — revisar lo que el bot ha aprendido',    value: 'ver'     },
        { name: '✅ Aprobar — fusionar con app-context.md',        value: 'aprobar' },
        { name: '🗑️ Limpiar — borrar el contexto aprendido',      value: 'limpiar' },
      )
  );

async function execute(interaction) {
  await interaction.deferReply();

  const accion = interaction.options.getString('accion');

  if (accion === 'ver')     return handleVer(interaction);
  if (accion === 'aprobar') return handleAprobar(interaction);
  if (accion === 'limpiar') return handleLimpiar(interaction);
}

// ── /conocimiento ver ─────────────────────────────────────────────────────────

async function handleVer(interaction) {
  try {
    const content = knowledgeBase.read();
    const hasData = knowledgeBase.hasEntries();

    const embed = new EmbedBuilder()
      .setColor(hasData ? 0x00b0f4 : 0x888888)
      .setTitle('🧠 Base de conocimiento aprendida');

    if (!hasData) {
      embed
        .setDescription('No hay entradas todavía.\n\nEl bot acumulará conocimiento automáticamente cada vez que se cree un bug con `/bug`.')
        .setFooter({ text: 'Usa /conocimiento aprobar cuando tengas suficiente contexto acumulado.' });
    } else {
      // Truncate if needed — Discord embed description limit is 4096 chars
      const preview = content.length > DISCORD_MAX_DESC
        ? content.slice(0, DISCORD_MAX_DESC - 100) + '\n\n_... (contenido truncado — revisa el archivo directamente)_'
        : content;

      embed
        .setDescription(preview)
        .setFooter({ text: 'Usa /conocimiento aprobar para fusionar esto con app-context.md, o /conocimiento limpiar para borrar.' });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('[conocimiento] ver error:', err);
    await interaction.editReply({ content: `❌ Error al leer la base de conocimiento: ${err.message}` });
  }
}

// ── /conocimiento aprobar ─────────────────────────────────────────────────────

async function handleAprobar(interaction) {
  try {
    if (!knowledgeBase.hasEntries()) {
      return interaction.editReply({
        content: '⚠️ No hay entradas en la base de conocimiento para aprobar todavía.',
      });
    }

    const content = knowledgeBase.read();
    const preview = content.length > DISCORD_MAX_FIELD
      ? content.slice(0, DISCORD_MAX_FIELD - 80) + '\n_... (truncado)_'
      : content;

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('⚠️ Confirmar fusión con app-context.md')
      .setDescription(
        'El siguiente contenido se **agregará permanentemente** a `app-context.md`.\n' +
        'El bot comenzará a usar este contexto en los próximos reportes **de inmediato** (sin reinicio).\n\n' +
        '¿Deseas continuar?'
      )
      .addFields({ name: '📋 Contenido a fusionar', value: preview })
      .setFooter({ text: 'Esta acción no se puede deshacer fácilmente.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('conocimiento_aprobar_confirm').setLabel('✅ Sí, fusionar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('conocimiento_aprobar_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time:   COLLECTOR_TIMEOUT_MS,
      max:    1,
    });

    collector.on('collect', async (i) => {
      await i.deferUpdate();
      if (i.customId === 'conocimiento_aprobar_confirm') {
        try {
          knowledgeBase.mergeIntoAppContext();
          const successEmbed = new EmbedBuilder()
            .setColor(0x00c853)
            .setTitle('✅ Conocimiento fusionado correctamente')
            .setDescription(
              'El contexto aprendido ha sido agregado a `app-context.md`.\n' +
              'El bot ya está usando el nuevo contexto en los próximos reportes.\n\n' +
              '`learned-context.md` fue limpiado y está listo para acumular nuevo conocimiento.'
            );
          await interaction.editReply({ embeds: [successEmbed], components: [] });
        } catch (err) {
          await interaction.editReply({ content: `❌ Error al fusionar: ${err.message}`, embeds: [], components: [] });
        }
      } else {
        await interaction.editReply({ content: '❌ Fusión cancelada.', embeds: [], components: [] });
      }
    });

    collector.on('end', (_c, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          content: `⏱️ Tiempo agotado (${COLLECTOR_TIMEOUT_MS / 1000}s). La fusión fue cancelada.`,
          embeds:  [],
          components: [],
        }).catch(() => {});
      }
    });
  } catch (err) {
    logger.error('[conocimiento] aprobar error:', err);
    await interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, embeds: [], components: [] });
  }
}

// ── /conocimiento limpiar ─────────────────────────────────────────────────────

async function handleLimpiar(interaction) {
  try {
    if (!knowledgeBase.hasEntries()) {
      return interaction.editReply({
        content: 'ℹ️ La base de conocimiento ya está vacía.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('⚠️ Confirmar limpieza')
      .setDescription(
        'Se **borrarán todas las entradas** de `learned-context.md`.\n' +
        '`app-context.md` no se verá afectado.\n\n' +
        '¿Deseas continuar?'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('conocimiento_limpiar_confirm').setLabel('🗑️ Sí, limpiar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('conocimiento_limpiar_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time:   COLLECTOR_TIMEOUT_MS,
      max:    1,
    });

    collector.on('collect', async (i) => {
      await i.deferUpdate();
      if (i.customId === 'conocimiento_limpiar_confirm') {
        knowledgeBase.clear();
        await interaction.editReply({
          content:    '🗑️ Base de conocimiento limpiada correctamente.',
          embeds:     [],
          components: [],
        });
      } else {
        await interaction.editReply({ content: '❌ Limpieza cancelada.', embeds: [], components: [] });
      }
    });

    collector.on('end', (_c, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          content:    `⏱️ Tiempo agotado (${COLLECTOR_TIMEOUT_MS / 1000}s). Limpieza cancelada.`,
          embeds:     [],
          components: [],
        }).catch(() => {});
      }
    });
  } catch (err) {
    logger.error('[conocimiento] limpiar error:', err);
    await interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, embeds: [], components: [] });
  }
}

module.exports = { data: command, execute };
