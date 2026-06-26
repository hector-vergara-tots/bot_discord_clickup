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

/**
 * Scans JSON character-by-character and repairs the two failure modes most
 * common in AI-generated JSON:
 *   1. Control characters (newlines, carriage returns, tabs) inside strings.
 *   2. Unescaped double quotes inside string values — e.g. when the model
 *      writes the "Apply for permit" button verbatim inside a description.
 *
 * For (2) it uses a lookahead heuristic: a `"` inside a string is treated as
 * the closing quote only when the next non-whitespace character is a JSON
 * structural token (: , } ]) or end-of-input; otherwise it is content and
 * gets escaped. More reliable than regex for multi-line content.
 */
function repairJson(jsonStr) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      if (!inString) {
        inString = true;
        result += char;
        continue;
      }

      // Inside a string: decide whether this quote closes it or is content.
      let j = i + 1;
      while (j < jsonStr.length && (jsonStr[j] === ' ' || jsonStr[j] === '\n' || jsonStr[j] === '\r' || jsonStr[j] === '\t')) {
        j++;
      }
      const next = jsonStr[j];
      const isClosing = next === undefined || next === ':' || next === ',' || next === '}' || next === ']';

      if (isClosing) {
        inString = false;
        result += char;
      } else {
        result += '\\"'; // content quote — escape it
      }
      continue;
    }

    if (inString) {
      if (char === '\n') { result += '\\n'; continue; }
      if (char === '\r') { result += '\\r'; continue; }
      if (char === '\t') { result += '\\t'; continue; }
    }

    result += char;
  }

  return result;
}

/**
 * Safety net for native-JSON output (Claude tool-use / Gemini JSON mode):
 * models sometimes write the literal characters \n / \t / \r into field values
 * out of habit, even though the API already serializes the JSON. We only fix
 * the unambiguous broken case — a string that has NO real line break but does
 * contain a literal "\n" — so correctly-formatted multi-line content (which
 * already has real breaks) and legitimate literal backslash-n are left alone.
 */
function unescapeLiteralWhitespace(value) {
  if (typeof value === 'string') {
    if (!value.includes('\n') && /\\[nrt]/.test(value)) {
      return value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(unescapeLiteralWhitespace);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = unescapeLiteralWhitespace(value[key]);
    }
    return value;
  }
  return value;
}

function parseAIResponse(rawText) {
  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // 2. Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 3. Extract first {...} block (handles leading/trailing text)
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  // 4. Repair control characters and unescaped quotes inside JSON strings
  const candidate = jsonMatch?.[0] ?? cleaned;
  try {
    return JSON.parse(repairJson(candidate));
  } catch (err) {
    logger.error(`[ai] JSON parse failed. Raw response (first 500 chars):\n${rawText.slice(0, 500)}`);
    throw new Error(`Expected ',' or '}' after property value in JSON: ${err.message}`);
  }
}

// ── Low-level call: routes to active provider (plain text) ────────────────────
async function callAI(systemPrompt, userMessage, maxTokens = 8192) {
  if (AI_PROVIDER === 'gemini') {
    return callGemini(systemPrompt, userMessage);
  }
  return callClaude(systemPrompt, userMessage, maxTokens);
}

// ── Structured-JSON call: returns a parsed object, never a raw string ─────────
// Eliminates JSON.parse errors at the source:
//   • Claude → tool-use; the SDK hands back an already-parsed object.
//   • Gemini → native JSON output mode (responseMimeType), then parse (with
//     repairJson as a safety net).
async function callAIJson(systemPrompt, userMessage, maxTokens = 8192) {
  if (AI_PROVIDER === 'gemini') {
    const raw = await callGemini(systemPrompt, userMessage, true);
    return unescapeLiteralWhitespace(parseAIResponse(raw));
  }
  return unescapeLiteralWhitespace(await callClaudeJson(systemPrompt, userMessage, maxTokens));
}

async function callGemini(systemPrompt, userMessage, jsonMode = false) {
  let lastError;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = geminiClient.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
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

async function callClaude(systemPrompt, userMessage, maxTokens = 8192) {
  const response = await claudeClient.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content[0].text.trim();
}

// Forces Claude to emit its answer through a tool call. The SDK returns
// tool_use.input as a native JS object, so we never parse model text — the
// "Expected ',' or '}'" class of errors cannot occur here.
async function callClaudeJson(systemPrompt, userMessage, maxTokens = 8192) {
  const response = await claudeClient.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: [{
      name: 'submit_report',
      description: 'Submit the structured report. Provide every field exactly as specified in the system prompt.',
      input_schema: { type: 'object' },
    }],
    tool_choice: { type: 'tool', name: 'submit_report' },
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse?.input) {
    throw new Error('Claude did not return a structured tool response.');
  }
  return toolUse.input;
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

  return callAIJson(systemPrompt, userMessage);
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

  return callAIJson(systemPrompt, userMessage);
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
