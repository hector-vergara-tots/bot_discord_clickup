const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { generateTestCases } = require('../services/ai');
const { getTask, getTasksInList, createTestPlan, createTestCase, linkTasks } = require('../services/clickup');
const logger = require('../utils/logger');

const MIN_HU_CONTENT_LENGTH = 50;
const COLLECTOR_TIMEOUT_MS = 60_000;
const PREVIEW_TIMEOUT_MS = 120_000;

const command = new SlashCommandBuilder()
  .setName('testcase')
  .setDescription('Genera test cases a partir de una HU de ClickUp usando IA')
  .addStringOption((opt) =>
    opt
      .setName('hu_id')
      .setDescription('ID de la HU (User Story) en ClickUp')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('ambiente')
      .setDescription('Ambiente de prueba')
      .setRequired(true)
      .addChoices(
        { name: '💻 Development', value: 'development' },
        { name: '🧪 Staging', value: 'staging' },
        { name: '🚀 Production', value: 'production' }
      )
  )
  .addBooleanOption((opt) =>
    opt
      .setName('contexto_app')
      .setDescription('Usar contexto de la aplicación (desactivar para features nuevas no documentadas)')
      .setRequired(false)
  );

async function execute(interaction) {
  await interaction.deferReply();

  const huId       = interaction.options.getString('hu_id').trim();
  const ambiente   = interaction.options.getString('ambiente');
  const useContext = interaction.options.getBoolean('contexto_app') ?? true;

  // ── Step 1: Fetch HU ───────────────────────────────────────────────────────
  await interaction.editReply('⏳ Obteniendo HU de ClickUp...');
  let huTask;
  try {
    huTask = await getTask(huId);
  } catch (err) {
    const status = err.response?.status;
    const msg =
      status === 401 ? 'Token de ClickUp inválido.' :
      status === 404 ? `No se encontró la HU \`${huId}\` en ClickUp.` :
      `Error al obtener la HU: ${err.response?.data?.err || err.message}`;
    return interaction.editReply(`❌ ${msg}`);
  }

  // ── Step 2: Validate HU content ────────────────────────────────────────────
  const huContent = (huTask.text_content || huTask.description || '').trim();
  if (huContent.length < MIN_HU_CONTENT_LENGTH) {
    return interaction.editReply(
      `❌ La HU **${huTask.name}** no tiene suficiente contenido para generar test cases.\n` +
      `Asegúrate de que tenga una descripción detallada (mínimo ${MIN_HU_CONTENT_LENGTH} caracteres) antes de ejecutar este comando.`
    );
  }

  // ── Step 3: Generate test cases with Gemini ────────────────────────────────
  await interaction.editReply('🤖 Generando test cases con Gemini...');
  let tcResult;
  try {
    tcResult = await generateTestCases({ huName: huTask.name, huDescription: huContent, ambiente, useContext });
  } catch (err) {
    return interaction.editReply(`❌ Error al generar test cases con Gemini: ${err.message}`);
  }

  if (!tcResult.test_cases?.length) {
    return interaction.editReply('❌ Gemini no generó test cases. Revisa la descripción de la HU e intenta de nuevo.');
  }

  // ── Step 4: Preview loop ───────────────────────────────────────────────────
  const generateParams = { huName: huTask.name, huDescription: huContent, ambiente, useContext };
  const confirmed = await runTCPreviewLoop(interaction, tcResult, generateParams);
  if (!confirmed) return;

  // ── Step 5: Ask for Test Plan destination ──────────────────────────────────
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tc_new_plan')
      .setLabel('✨ Nuevo Test Plan')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tc_existing_plan')
      .setLabel('📋 Test Plan existente')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    content:
      `✅ Se generaron **${confirmed.test_cases.length} test cases** para:\n` +
      `> **${huTask.name}**\n\n` +
      `¿Dónde deseas crearlos?`,
    embeds: [],
    components: [buttonRow],
  });

  // ── Step 6: Collector ──────────────────────────────────────────────────────
  const collector = interaction.channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: COLLECTOR_TIMEOUT_MS,
  });

  collector.on('collect', async (i) => {
    try {
      if (i.customId === 'tc_new_plan') {
        collector.stop('handled');
        await i.deferUpdate();
        await finalize(interaction, huTask, confirmed, ambiente, null);

      } else if (i.customId === 'tc_existing_plan') {
        await i.deferUpdate();

        let tasks;
        try {
          tasks = await getTasksInList(process.env.CLICKUP_QA_LIST_ID);
        } catch (err) {
          collector.stop('handled');
          return interaction.editReply({
            content: `❌ Error al cargar la lista de QA: ${err.response?.data?.err || err.message}`,
            components: [],
          });
        }

        // ClickUp may return custom_type as number or string depending on how the task was created.
        const testPlans = tasks.filter(
          (t) => Number(t.custom_type) === 1011 || Number(t.custom_item_id) === 1011
        );

        if (!testPlans.length) {
          collector.stop('handled');
          return interaction.editReply({
            content: '❌ No se encontraron Test Plans en la lista de QA. Usa **Nuevo Test Plan** para crear uno.',
            components: [],
          });
        }

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('tc_select_plan')
            .setPlaceholder('Selecciona un Test Plan...')
            .addOptions(
              testPlans.slice(0, 25).map((tp) => ({
                label: tp.name.slice(0, 100),
                value: tp.id,
              }))
            )
        );

        await interaction.editReply({
          content: '📋 Selecciona el Test Plan donde agregar los test cases:',
          components: [selectRow],
        });

      } else if (i.customId === 'tc_select_plan') {
        collector.stop('handled');
        await i.deferUpdate();
        await finalize(interaction, huTask, confirmed, ambiente, i.values[0]);
      }
    } catch (err) {
      logger.error('[testcase] Collector error:', err);
      collector.stop('handled');
      interaction.editReply({ content: `❌ Error inesperado: ${err.message}`, components: [] }).catch(() => {});
    }
  });

  collector.on('end', (_collected, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        content: `⏱️ Tiempo agotado (${COLLECTOR_TIMEOUT_MS / 1000}s). Ejecuta el comando de nuevo.`,
        components: [],
      }).catch(() => {});
    }
  });
}

// ── Preview loop: show generated TCs, allow Adjust / Confirm / Cancel ─────────
async function runTCPreviewLoop(interaction, tcResult, generateParams) {
  return new Promise((resolve) => {
    _showTCPreview(interaction, tcResult, generateParams, resolve);
  });
}

async function _showTCPreview(interaction, tcResult, generateParams, resolve) {
  const embed = buildTCPreviewEmbed(tcResult);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tc_preview_confirm').setLabel('✅ Continuar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tc_preview_adjust').setLabel('✏️ Ajustar').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tc_preview_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({ content: '', embeds: [embed], components: [row] });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: PREVIEW_TIMEOUT_MS,
    max: 1,
  });

  collector.on('collect', async (i) => {
    try {
      if (i.customId === 'tc_preview_confirm') {
        await i.deferUpdate();
        resolve(tcResult);

      } else if (i.customId === 'tc_preview_cancel') {
        await i.deferUpdate();
        await interaction.editReply({ content: '❌ Operación cancelada.', embeds: [], components: [] });
        resolve(null);

      } else if (i.customId === 'tc_preview_adjust') {
        const modal = new ModalBuilder()
          .setCustomId('tc_adjust_modal')
          .setTitle('Ajustar test cases');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('adjustment_input')
              .setLabel('¿Qué quieres ajustar?')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Ej: Falta un TC para el caso offline.\nEl TC #2 no tiene sentido, debería verificar...')
              .setRequired(true)
          )
        );

        await i.showModal(modal);

        try {
          const modalSubmit = await interaction.awaitModalSubmit({
            time: PREVIEW_TIMEOUT_MS,
            filter: (m) => m.user.id === interaction.user.id && m.customId === 'tc_adjust_modal',
          });
          await modalSubmit.deferUpdate();
          const adjustment = modalSubmit.fields.getTextInputValue('adjustment_input').trim();

          await interaction.editReply({ content: '🤖 Ajustando test cases con IA...', embeds: [], components: [] });

          let newTcResult;
          try {
            newTcResult = await generateTestCases({ ...generateParams, previousReport: tcResult, adjustment });
          } catch (err) {
            await interaction.editReply({ content: `❌ Error al ajustar los test cases: ${err.message}`, embeds: [], components: [] });
            return resolve(null);
          }

          _showTCPreview(interaction, newTcResult, generateParams, resolve);
        } catch {
          await interaction.editReply({ content: '⏱️ Tiempo agotado. Ejecuta el comando de nuevo.', embeds: [], components: [] }).catch(() => {});
          resolve(null);
        }
      }
    } catch (err) {
      logger.error('[testcase] Preview loop error:', err);
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

// ── Build TC preview embed ────────────────────────────────────────────────────
function buildTCPreviewEmbed(tcResult) {
  const tcs = tcResult.test_cases ?? [];

  const titleList = tcs
    .map((tc, idx) => `${idx + 1}. ${tc.title}`)
    .join('\n');

  const firstTc = tcs[0];
  const firstTcPreview = firstTc?.description ?? '';

  const embed = new EmbedBuilder()
    .setColor(0x00b0f4)
    .setTitle(`👁️ Test Plan: ${tcResult.test_plan_title ?? 'Sin título'}`)
    .addFields({
      name: `🧪 Test Cases (${tcs.length})`,
      value: titleList.length > 1020 ? titleList.slice(0, 1020) + '...' : titleList || '*(ninguno)*',
    });

  if (firstTc) {
    embed.addFields({
      name: `📋 Muestra — TC #1: ${firstTc.title}`,
      value: firstTcPreview.length > 1020 ? firstTcPreview.slice(0, 1020) + '...' : firstTcPreview || '*(sin descripción)*',
    });
  }

  embed.setFooter({ text: `👁️ Vista previa · ${tcs.length} test cases — aún no se han creado en ClickUp` });
  return embed;
}

// ── Finalize: create TCs and link to HU ─────────────────────────────────────
async function finalize(interaction, huTask, tcResult, ambiente, existingPlanId) {
  await interaction.editReply({ content: '📝 Creando test cases en ClickUp...', components: [] });

  let testPlan;
  try {
    if (existingPlanId) {
      testPlan = await getTask(existingPlanId);
    } else {
      testPlan = await createTestPlan(
        process.env.CLICKUP_QA_LIST_ID,
        tcResult.test_plan_title || `Test Plan — ${huTask.name}`
      );
    }
  } catch (err) {
    return interaction.editReply(
      `❌ Error al obtener/crear el Test Plan: ${err.response?.data?.err || err.message}`
    );
  }

  const listId = testPlan.list?.id || process.env.CLICKUP_QA_LIST_ID;

  const created = [];
  const failed = [];

  for (const tc of tcResult.test_cases) {
    try {
      const createdTc = await createTestCase(listId, testPlan.id, tc, ambiente);
      await linkTasks(huTask.id, createdTc.id);
      created.push(createdTc);
    } catch (err) {
      logger.error(`[testcase] Failed to create TC "${tc.title}":`, err.response?.data?.err || err.message);
      failed.push(tc.title);
    }
  }

  const allOk = failed.length === 0;
  const embed = new EmbedBuilder()
    .setColor(allOk ? 0x00b0f4 : 0xffa500)
    .setTitle(`🧪 Test Cases creados: ${created.length}/${tcResult.test_cases.length}`)
    .setURL(testPlan.url)
    .addFields(
      { name: '📋 Test Plan', value: `[${testPlan.name}](${testPlan.url})`, inline: false },
      { name: '🔗 HU vinculada', value: `[${huTask.name}](${huTask.url})`, inline: false },
      { name: '🌍 Ambiente', value: ambiente, inline: true },
      { name: '✅ Creados', value: String(created.length), inline: true },
      { name: '🔗 Vinculados a HU', value: String(created.length), inline: true }
    );

  if (failed.length) {
    embed.addFields({
      name: '❌ Fallaron',
      value: failed.join('\n').slice(0, 1024),
      inline: false,
    });
  }

  embed
    .setFooter({ text: `Ejecutado por ${interaction.user.username}` })
    .setTimestamp();

  await interaction.editReply({
    content: allOk
      ? `🎉 Todos los test cases fueron creados y vinculados a la HU.`
      : `⚠️ ${created.length} de ${tcResult.test_cases.length} test cases fueron creados.`,
    embeds: [embed],
    components: [],
  });
}

module.exports = { data: command, execute };
