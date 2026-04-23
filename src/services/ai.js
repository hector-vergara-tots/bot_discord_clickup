const fs = require('fs');
const path = require('path');
const { TASK_TYPES } = require('../constants');
const templates = require('../templates');
const testCaseTemplate = require('../templates/testCase');
const logger = require('../utils/logger');

const appContext = fs.readFileSync(
  path.join(__dirname, '../context/app-context.md'),
  'utf-8'
);

// ── Provider setup ────────────────────────────────────────────────────────────
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
const CLAUDE_MODEL  = 'claude-haiku-4-5-20251001';

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
async function generateBugReport({ taskId = null, tipo, ambiente, descripcion, useContext = true, previousReport = null, adjustment = null }) {
  const templateId = TASK_TYPES[tipo.toLowerCase()] ?? 0;
  const template   = templates[templateId] ?? templates[0];

  const systemPrompt = useContext
    ? `## Application Context\n${appContext}\n\n---\n\n## Your Task\n${template.systemPrompt}`
    : `## Your Task\n${template.systemPrompt}`;

  const userMessage = [
    taskId     ? `Task ID: ${taskId}`                                                                                          : null,
    `Type: ${tipo}`,
    `Environment: ${ambiente}`,
    `Description: ${descripcion}`,
    previousReport ? `\n## Previously Generated Report\n${JSON.stringify(previousReport, null, 2)}`                           : null,
    adjustment     ? `\n## User Adjustment Request\n${adjustment}\n\nUpdate the report based on this feedback. Keep everything else intact.` : null,
  ].filter(Boolean).join('\n');

  const rawText = await callAI(systemPrompt, userMessage);
  return parseAIResponse(rawText);
}

// ── generateTestCases ─────────────────────────────────────────────────────────
async function generateTestCases({ huName, huDescription, ambiente, useContext = true, previousReport = null, adjustment = null }) {
  const systemPrompt = useContext
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

module.exports = { generateBugReport, generateTestCases };
