// ── Task type IDs (custom_item_id in ClickUp) ─────────────────────────────────
// Single source of truth — referenced by clickup.js, gemini.js, and templates/index.js
const TASK_TYPES = {
  'task':        0,
  'bug':         1004,
  'improvement': 1005,
  'test case':   1002,
  'test plan':   1011,
};

module.exports = { TASK_TYPES };
