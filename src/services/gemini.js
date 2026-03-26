const { GoogleGenerativeAI } = require('@google/generative-ai');
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
];

/**
 * Parses a raw string from Gemini into a JSON object.
 * First attempts strict JSON.parse; falls back to extracting the first {...} block.
 * @param {string} rawText
 * @returns {Object}
 */
function parseGeminiResponse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error(`Non-JSON response: ${rawText.slice(0, 200)}`);
  }
}

/**
 * Calls Gemini to convert an informal description into a structured report.
 * Selects the system prompt based on the task type, then tries each model
 * in MODELS order, falling back to the next on error.
 * @param {{ taskId: string, tipo: string, ambiente: string, descripcion: string }} params
 * @returns {Promise<Object>} Parsed JSON report
 */
async function generateBugReport({ taskId, tipo, ambiente, descripcion }) {
  const templateId = TASK_TYPES[tipo.toLowerCase()] ?? 0;
  const template = templates[templateId] ?? templates[0];

  const userMessage = `Task ID: ${taskId}
Type: ${tipo}
Environment: ${ambiente}
Description: ${descripcion}`;

  let lastError;
  for (const modelName of MODELS) {
    try {
      const fullSystemPrompt = `## Application Context\n${appContext}\n\n---\n\n## Your Task\n${template.systemPrompt}`;

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: fullSystemPrompt,
      });

      const result = await model.generateContent(userMessage);
      return parseGeminiResponse(result.response.text().trim());
    } catch (err) {
      logger.warn(`[gemini] Model "${modelName}" failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError.message}`);
}

/**
 * Calls Gemini to generate multiple test cases from a User Story (HU).
 * Returns { test_plan_title, test_cases: [...] }
 * @param {{ huName: string, huDescription: string, ambiente: string }} params
 * @returns {Promise<Object>}
 */
async function generateTestCases({ huName, huDescription, ambiente }) {
  const fullSystemPrompt = `## Application Context\n${appContext}\n\n---\n\n## Your Task\n${testCaseTemplate.systemPromptFromHU}`;

  const userMessage = `User Story: ${huName}
Environment: ${ambiente}
Description:
${huDescription}`;

  let lastError;
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: fullSystemPrompt,
      });

      const result = await model.generateContent(userMessage);
      return parseGeminiResponse(result.response.text().trim());
    } catch (err) {
      logger.warn(`[gemini] Model "${modelName}" failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError.message}`);
}

module.exports = { generateBugReport, generateTestCases };
