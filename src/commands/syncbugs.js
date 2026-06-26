const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs   = require('fs');
const path = require('path');
const { getTask } = require('../services/clickup');
const logger = require('../utils/logger');

const LEARNED_CONTEXT_PATH = path.join(__dirname, '../context/learned-context.md');

// Statuses that count as resolved (compared case-insensitively)
const DONE_STATUSES = ['done', 'ready for staging'];

const command = new SlashCommandBuilder()
  .setName('sync-bugs')
  .setDescription('Valida el estado de los bugs en ClickUp y actualiza learned-context.md');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts a ClickUp task ID from a URL.
 * Supports the standard format: https://app.clickup.com/t/{taskId}
 * @param {string} url
 * @returns {string|null}
 */
function extractTaskId(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts.at(-1) ?? null;
  } catch {
    return null;
  }
}

// ── Command handler ───────────────────────────────────────────────────────────

async function execute(interaction) {
  await interaction.deferReply();

  try {
    const raw = fs.readFileSync(LEARNED_CONTEXT_PATH, 'utf-8');

    // Find all header lines that have a real ClickUp link and are still Open.
    // Header format: · Status: `Open` · Link: `https://...`
    const headerRegex = /Status: `Open` · Link: `([^`]+)`/g;

    const toCheck = [];
    let match;
    while ((match = headerRegex.exec(raw)) !== null) {
      const link = match[1].trim();
      if (link === '—') continue;
      const taskId = extractTaskId(link);
      if (!taskId) {
        logger.warn(`[sync-bugs] Could not extract task ID from: ${link}`);
        continue;
      }
      toCheck.push({ link, taskId });
    }

    if (toCheck.length === 0) {
      return interaction.editReply({
        content: 'ℹ️ No hay entradas con link de ClickUp en estado `Open` para validar.',
      });
    }

    logger.info(`[sync-bugs] Checking ${toCheck.length} task(s)…`);

    const updated   = [];
    const unchanged = [];
    const failed    = [];

    let updatedContent = raw;

    for (const entry of toCheck) {
      try {
        const task       = await getTask(entry.taskId);
        const rawStatus  = task.status?.status ?? '';
        const normalized = rawStatus.toLowerCase().trim();
        const isResolved = DONE_STATUSES.includes(normalized);

        if (isResolved) {
          // Swap Status: `Open` → `Done` only for this specific entry
          updatedContent = updatedContent.replace(
            `Status: \`Open\` · Link: \`${entry.link}\``,
            `Status: \`Done\` · Link: \`${entry.link}\``
          );
          updated.push({ link: entry.link, taskId: entry.taskId, status: rawStatus });
          logger.info(`[sync-bugs] ✅ ${entry.taskId} → "${rawStatus}" → marked Done`);
        } else {
          unchanged.push({ link: entry.link, taskId: entry.taskId, status: rawStatus });
          logger.info(`[sync-bugs] 🔵 ${entry.taskId} → "${rawStatus}" → still Open`);
        }
      } catch (err) {
        logger.warn(`[sync-bugs] ⚠️ Could not fetch ${entry.taskId}: ${err.message}`);
        failed.push({ link: entry.link, taskId: entry.taskId, error: err.message });
      }
    }

    // Only write to disk if something actually changed
    if (updated.length > 0) {
      fs.writeFileSync(LEARNED_CONTEXT_PATH, updatedContent, 'utf-8');
      logger.info(`[sync-bugs] learned-context.md updated — ${updated.length} bug(s) marked Done`);
    }

    // ── Build Discord embed ───────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setTitle('🔄 Sync de bugs con ClickUp')
      .setColor(updated.length > 0 ? 0x00c853 : 0x00b0f4)
      .setFooter({
        text: `${toCheck.length} bug(s) verificado(s) · ${new Date().toLocaleDateString('es-MX')}`,
      });

    const lines = [];

    if (updated.length > 0) {
      lines.push(`**✅ Cerrados y marcados Done (${updated.length})**`);
      for (const u of updated) {
        lines.push(`• [\`${u.taskId}\`](${u.link}) — \`${u.status}\``);
      }
    }

    if (unchanged.length > 0) {
      if (lines.length) lines.push('');
      lines.push(`**🔵 Aún abiertos (${unchanged.length})**`);
      for (const u of unchanged) {
        lines.push(`• [\`${u.taskId}\`](${u.link}) — \`${u.status}\``);
      }
    }

    if (failed.length > 0) {
      if (lines.length) lines.push('');
      lines.push(`**⚠️ No se pudo consultar (${failed.length})**`);
      for (const f of failed) {
        lines.push(`• \`${f.taskId}\` — ${f.error}`);
      }
    }

    embed.setDescription(lines.join('\n') || 'Sin cambios.');

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('[sync-bugs] Unexpected error:', err);
    await interaction.editReply({ content: `❌ Error al sincronizar: ${err.message}` });
  }
}

module.exports = { data: command, execute };
