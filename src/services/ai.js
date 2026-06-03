const fs   = require('fs');
const path = require('path');
const { TASK_TYPES } = require('../constants');
const templates = require('../templates');
const testCaseTemplate = require('../templates/testCase');
const logger = require('../utils/logger');

// ── App context — read dynamically so merges via /conocimiento take effect immediately ──
function getAppContext() {
  try {
    return fs.readFileSync(path.join(__dirname, '../context/app-context.md'), 'utf-8');
  } catch (err) {
    logger.warn(`[ai] Could not read app-context.md: ${err.message}`);
    return '';
  }
}

// ── Provider setup ────────────────────────────────────────────────────────────
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
const CLAUDE_MODEL  = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

let geminiClient = null;
let claudeClient = null;

if (AI_PROVIDER === 'gemini') {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else if (AI_PROVIDER === 'claude') {
  const Anthropic = require('@anthropic-ai/sdk');
  claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} else {
  throw new Error(`[ai] Unknown AI_PROVIDER: "${AI_PROVIDER}". Valid values: "gemini", "claude".`);
}

logger.info(`[ai] Provider: ${AI_PROVIDER}`);

// ── Response parser (shared) ──────────────────────────────────────────────────
function parseAIResponse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error(`Non-JSON response: ${rawText.slice(0, 200)}`);
  }
}

// ── Low-level call: routes to active provider ─────────────────────────────────
async function callAI(systemPrompt, userMessage) {
  if (AI_PROVIDER === 'gemini') {
    return callGemini(systemPrompt, userMessage);
  }
  return callClaude(systemPrompt, userMessage);
}

async function callGemini(systemPrompt, userMessage) {
  let lastError;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = geminiClient.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userMessage);
      return result.response.text().trim();
    } catch (err) {
      logger.warn(`[ai] Gemini model "${modelName}" failed: ${err.message}`);
      lastError = err;
    }
  }
  throw new Error(`All Gemini models failed. Last error: ${lastError.message}`);
}

async function callClaude(systemPrompt, userMessage) {
  const response = await claudeClient.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content[0].text.trim();
}

// ── generateBugReport ─────────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string|null} params.taskId
 * @param {string}      params.tipo
 * @param {string}      params.ambiente
 * @param {string}      params.descripcion
 * @param {boolean}     params.useContext       - include app-context.md
 * @param {object|null} params.previousReport   - current-session draft (for in-session adjustments)
 * @param {string|null} params.adjustment       - user feedback on previousReport
 * @param {object|null} params.contextReport    - cross-session reference report (style/context only)
 */
async function generateBugReport({
  taskId         = null,
  tipo,
  ambiente,
  descripcion,
  evidencia      = null,
  useContext     = true,
  previousReport = null,
  adjustment     = null,
  contextReport  = null,
}) {
  const templateId = TASK_TYPES[tipo.toLowerCase()] ?? 0;
  const template   = templates[templateId] ?? templates[0];
  const appContext = getAppContext();

  const systemPrompt = useContext && appContext
    ? `## Application Context\n${appContext}\n\n---\n\n## Your Task\n${template.systemPrompt}`
    : `## Your Task\n${template.systemPrompt}`;

  const userMessage = [
    taskId        ? `Task ID: ${taskId}`                                                                                                  : null,
    `Type: ${tipo}`,
    `Environment: ${ambiente}`,
    `Description: ${descripcion}`,
    evidencia     ? `Evidence: ${evidencia}`                                                                                              : null,
    contextReport ? `\n## Style & Context Reference (previous related bug — use for tone and context only)\n${JSON.stringify(contextReport, null, 2)}\nIMPORTANT: This is a REFERENCE only. Generate a completely new, independent report for the description above.` : null,
    previousReport ? `\n## Previously Generated Report\n${JSON.stringify(previousReport, null, 2)}`                                      : null,
    adjustment     ? `\n## User Adjustment Request\n${adjustment}\n\nUpdate the report based on this feedback. Keep everything else intact.` : null,
  ].filter(Boolean).join('\n');

  const rawText = await callAI(systemPrompt, userMessage);
  return parseAIResponse(rawText);
}

// ── generateTestCases ─────────────────────────────────────────────────────────
async function generateTestCases({ huName, huDescription, ambiente, useContext = true, previousReport = null, adjustment = null }) {
  const appContext = getAppContext();

  const systemPrompt = useContext && appContext
    ? `## Application Context\n${appContext}\n\n---\n\n## Your Task\n${testCaseTemplate.systemPromptFromHU}`
    : `## Your Task\n${testCaseTemplate.systemPromptFromHU}`;

  const userMessage = [
    `User Story: ${huName}`,
    `Environment: ${ambiente}`,
    `Description:\n${huDescription}`,
    previousReport ? `\n## Previously Generated Test Cases\n${JSON.stringify(previousReport, null, 2)}`                       : null,
    adjustment     ? `\n## User Adjustment Request\n${adjustment}\n\nUpdate the test cases based on this feedback. Keep everything else intact.` : null,
  ].filter(Boolean).join('\n');

  const rawText = await callAI(systemPrompt, userMessage);
  return parseAIResponse(rawText);
}

// ── extractLearnings ──────────────────────────────────────────────────────────
/**
 * Extract a concise knowledge summary from a completed bug report.
 * Returns a markdown bullet-point string, or null on failure.
 * Designed to run fire-and-forget (errors are caught internally).
 *
 * @param {{ tipo: string, ambiente: string, descripcion: string, report: object }} params
 * @returns {Promise<string|null>}
 */
async function extractLearnings({ tipo, ambiente, descripcion, report }) {
  const systemPrompt = `You are a QA knowledge extractor. Given a completed bug report, extract a concise knowledge summary using 3-5 bullet points. Focus on:
- Which module, feature, or screen was being tested
- What specific UI elements, actions, or flows were involved (button names, field names, navigation paths)
- Any technical context (endpoints, states, conditions) relevant to understanding the app
- Patterns or terminology specific to this application

Rules:
- Write in English
- Be factual and specific — use the exact names mentioned in the report
- No introductions, no conclusions — output ONLY the bullet points
- Each bullet starts with "- "`;

  const userMessage = `Type: ${tipo}
Environment: ${ambiente}
Original description: ${descripcion}
Report title: ${report.title}
Report excerpt: ${(report.description ?? '').slice(0, 600)}`;

  try {
    const raw = await callAI(systemPrompt, userMessage);
    // Ensure it looks like bullet points
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const bullets = lines.filter(l => l.startsWith('-') || l.startsWith('*') || l.startsWith('•'));
    return bullets.length > 0 ? bullets.join('\n') : raw.slice(0, 800);
  } catch (err) {
    logger.warn(`[ai] extractLearnings failed: ${err.message}`);
    return null;
  }
}

module.exports = { generateBugReport, generateTestCases, extractLearnings };
