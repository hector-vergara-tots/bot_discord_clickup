/**
 * knowledgeBase — accumulates QA learnings extracted from bug reports
 *
 * After each successful bug creation, the AI extracts what was learned
 * (module, behaviors, terminology) and appends it to learned-context.md.
 *
 * The /conocimiento command lets the user:
 *   - ver      → inspect what has been learned so far
 *   - aprobar  → merge learnings into app-context.md (updates live AI context)
 *   - limpiar  → clear learned-context.md
 */

const fs     = require('fs');
const path   = require('path');
const logger = require('../utils/logger');

const LEARNED_PATH     = path.join(__dirname, '../context/learned-context.md');
const APP_CONTEXT_PATH = path.join(__dirname, '../context/app-context.md');

const PLACEHOLDER = '_No entries yet. Knowledge will be extracted automatically after each bug report is created._';

// ── Internal helpers ──────────────────────────────────────────────────────────

function ensureFile() {
  if (!fs.existsSync(LEARNED_PATH)) {
    fs.writeFileSync(LEARNED_PATH, `# Learned Context\n\n${PLACEHOLDER}\n`, 'utf-8');
  }
}

function isEmpty(content) {
  return content.includes(PLACEHOLDER) || content.replace(/^#.*\n+/, '').trim() === '';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Append a new learning entry to learned-context.md.
 * @param {{ date: string, tipo: string, ambiente: string, summary: string }} entry
 */
function appendLearning({ date, tipo, ambiente, summary }) {
  try {
    ensureFile();
    let current = fs.readFileSync(LEARNED_PATH, 'utf-8');

    // Remove placeholder on first real entry
    current = current.replace(PLACEHOLDER, '').trimEnd();

    const entry = `\n\n---\n\n**[${date}]** · Tipo: \`${tipo}\` · Ambiente: \`${ambiente}\`\n\n${summary}`;
    fs.writeFileSync(LEARNED_PATH, current + entry + '\n', 'utf-8');
    logger.info('[knowledgeBase] Appended new learning entry.');
  } catch (err) {
    logger.warn(`[knowledgeBase] Failed to append learning: ${err.message}`);
  }
}

/**
 * Read the full contents of learned-context.md.
 * @returns {string}
 */
function read() {
  ensureFile();
  return fs.readFileSync(LEARNED_PATH, 'utf-8');
}

/**
 * Returns true if there are real entries (not just the placeholder).
 * @returns {boolean}
 */
function hasEntries() {
  ensureFile();
  return !isEmpty(fs.readFileSync(LEARNED_PATH, 'utf-8'));
}

/**
 * Merge learned-context.md into app-context.md as a new section.
 * Clears learned-context.md afterward.
 * The AI service reads app-context.md dynamically, so changes take effect immediately.
 */
function mergeIntoAppContext() {
  ensureFile();
  const learned    = fs.readFileSync(LEARNED_PATH, 'utf-8');
  const appContext = fs.readFileSync(APP_CONTEXT_PATH, 'utf-8');
  const date       = new Date().toISOString().split('T')[0];

  // Extract just the entries (skip the "# Learned Context" header and placeholder)
  const entriesOnly = learned
    .replace(/^# Learned Context\n+/, '')
    .replace(PLACEHOLDER, '')
    .trim();

  if (!entriesOnly) {
    throw new Error('No hay entradas para aprobar.');
  }

  const section = `\n\n---\n\n## Observed QA Behaviors (merged ${date})\n\n${entriesOnly}`;
  fs.writeFileSync(APP_CONTEXT_PATH, appContext + section, 'utf-8');

  // Reset learned-context.md
  fs.writeFileSync(LEARNED_PATH, `# Learned Context\n\n${PLACEHOLDER}\n`, 'utf-8');
  logger.info('[knowledgeBase] Merged learned context into app-context.md.');
}

/**
 * Clear learned-context.md (reset to placeholder state).
 */
function clear() {
  fs.writeFileSync(LEARNED_PATH, `# Learned Context\n\n${PLACEHOLDER}\n`, 'utf-8');
  logger.info('[knowledgeBase] Cleared learned context.');
}

module.exports = { appendLearning, read, hasEntries, mergeIntoAppContext, clear };
