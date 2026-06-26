const axios = require('axios');
const { TASK_TYPES } = require('../constants');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.clickup.com/api/v2';
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 500;

const http = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Authorization: process.env.CLICKUP_API_TOKEN,
    'Content-Type': 'application/json',
  },
});

// ── Retry interceptor: retries on 429 and 5xx with exponential back-off ───────
http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    const status = err.response?.status;
    const retriable = status === 429 || (status >= 500 && status < 600);

    config._retryCount = config._retryCount ?? 0;

    if (!retriable || config._retryCount >= RETRY_ATTEMPTS) {
      return Promise.reject(err);
    }

    config._retryCount += 1;
    const delay = RETRY_BASE_DELAY_MS * config._retryCount;
    logger.warn(`[clickup] ${status} on ${config.method?.toUpperCase()} ${config.url} — retry ${config._retryCount}/${RETRY_ATTEMPTS} in ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    return http(config);
  }
);

/**
 * Fetches all members of the workspace.
 * @returns {Promise<Array>} Array of workspace members
 */
async function getWorkspaceMembers() {
  const workspaceId = process.env.CLICKUP_WORKSPACE_ID;
  const { data } = await http.get(`/team/${workspaceId}/member`);
  return data.members.map((m) => m.user);
}

/**
 * Fetches a task by ID.
 * @param {string} taskId
 * @returns {Promise<Object>} Task object from ClickUp
 */
async function getTask(taskId) {
  const { data } = await http.get(`/task/${taskId}`);
  return data;
}

const ENVIRONMENT_OPTIONS = {
  'feature branch': 'ef20f782-eb3a-44cd-8ad8-28f78b5eac63',
  'development':    'db536008-9ce5-4e3e-8e84-e94d66e9fa44',
  'staging':        'e5ebd00c-19ae-4bb5-a0b4-f73fc687e1ff',
  'production':     'd5a52f6c-30e4-42ec-a420-30b1f5bb117b',
  'metabase':       '78df52ff-b77a-47f2-8fa0-aeae5995554d',
};

const ENVIRONMENT_FIELD_ID = '831a2fc4-e6c7-4aee-89a4-8f58dabfa28a';

const SEVERITY_FIELD_ID = 'e84f184b-67b1-4c8b-85f6-fe3b66a256d2';
const SEVERITY_OPTIONS = {
  'Critical': 'b0ceb522-ce32-4a0c-85c5-d563c7318b0f',
  'High':     '8844530d-a866-4ae6-b2b0-f05e225ce30f',
  'Medium':   '6dea5cd3-53ec-4265-b094-d39522489bb3',
  'Low':      'a8012547-ef16-4fd2-8ddc-142480655783',
};

const TARGET_VERSION_FIELD_ID = '904bdb5b-e453-4359-ae9f-31e90c8b5e0d';

/**
 * Creates a task (or subtask) in ClickUp.
 * When parentTaskId is provided the task is created as a child of that task.
 * When parentTaskId is null/undefined the task is created directly in the list (e.g. a sprint).
 * @param {Object} params
 * @param {string|null} params.parentTaskId - Parent task ID, or null to create at list level
 * @param {string} params.listId - The list ID where the task lives
 * @param {string} params.tipo - bug | improvement | task | etc.
 * @param {string} params.ambiente - staging | production | development
 * @param {number|null} params.assigneeId - ClickUp user ID
 * @param {Object} params.report - Structured report from Gemini
 * @returns {Promise<Object>} Created task object
 */
async function createSubtask({ parentTaskId = null, listId, tipo, ambiente, assigneeId, report }) {
  const description = report.description;
  const environmentOptionId = ENVIRONMENT_OPTIONS[ambiente.toLowerCase()];
  const isBug = tipo.toLowerCase() === 'bug';

  const customFields = [
    { id: ENVIRONMENT_FIELD_ID, value: environmentOptionId },
  ];

  if (isBug) {
    customFields.push({ id: SEVERITY_FIELD_ID, value: SEVERITY_OPTIONS[impactToSeverity(report.impact)] });

    if (parentTaskId) {
      const parentTask = await getTask(parentTaskId);
      const targetVersionField = parentTask.custom_fields?.find(f => f.id === TARGET_VERSION_FIELD_ID);
      const targetVersionValue = targetVersionField?.value;
      if (targetVersionValue) {
        customFields.push({ id: TARGET_VERSION_FIELD_ID, value: targetVersionValue });
      }
    }
  }

  const payload = {
    name: report.title,
    content: description,
    markdown_content: description,
    custom_item_id: TASK_TYPES[tipo.toLowerCase()] ?? 0,
    tags: [tipo],
    custom_fields: customFields,
  };

  if (!isBug) payload.priority = impactToPriority(report.impact);

  if (parentTaskId) payload.parent = parentTaskId;
  if (assigneeId)   payload.assignees = [assigneeId];

  const { data } = await http.post(`/list/${listId}/task`, payload);
  return data;
}

/**
 * Parses a sprint date range from its name, e.g. "Sprint 37 (3/25 - 4/14)".
 * Uses the current calendar year; handles December→January year wraps.
 * @param {string} name - Sprint list name
 * @returns {{ start: Date, end: Date } | null}
 */
function parseSprintDates(name) {
  const match = name.match(/\((\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})\)/);
  if (!match) return null;

  const year = new Date().getFullYear();
  const [, sm, sd, em, ed] = match.map(Number);

  const start = new Date(year, sm - 1, sd, 0,  0,  0);
  const end   = new Date(year, em - 1, ed, 23, 59, 59);

  // Handle year wrap (e.g. sprint spanning Dec → Jan)
  if (end < start) end.setFullYear(year + 1);

  return { start, end };
}

/**
 * Returns the active sprint list by scanning all folders in the ClickUp space
 * whose names contain "Sprint". Detects the active sprint by matching today's
 * date against each sprint list's date range (parsed from names like
 * "Sprint N (M/D - M/D)"). No env var needed — fully automatic.
 *
 * Resolution order:
 *   1. First sprint list whose date range contains today
 *   2. If no date match: the last list across all sprint folders (most recent sprint)
 *
 * @returns {Promise<Object|null>} ClickUp list object representing the active sprint
 */
async function getCurrentSprint() {
  const spaceId = process.env.CLICKUP_SPACE_ID;

  // Fetch all folders in the space (not archived)
  const { data: folderData } = await http.get(`/space/${spaceId}/folder`, { params: { archived: false } });
  const sprintFolders = folderData.folders.filter((f) =>
    f.name.toLowerCase().includes('sprint')
  );

  if (!sprintFolders.length) return null;

  // Collect all sprint lists across every sprint folder
  const allLists = [];
  for (const folder of sprintFolders) {
    const { data: listData } = await http.get(`/folder/${folder.id}/list`, { params: { archived: false } });
    allLists.push(...listData.lists);
  }

  if (!allLists.length) return null;

  const today = new Date();

  // Return the first list whose date range contains today
  for (const list of allLists) {
    const dates = parseSprintDates(list.name);
    if (dates && today >= dates.start && today <= dates.end) {
      return list;
    }
  }

  // Fallback: last list in the collection (most recent sprint)
  return allLists.at(-1);
}

/**
 * Maps impact level to ClickUp priority number.
 * 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
 */
function impactToPriority(impact) {
  switch (impact) {
    case 'Alto':  return 1;
    case 'Medio': return 2;
    case 'Bajo':  return 3;
    default:      return 3;
  }
}

/**
 * Maps impact level to ClickUp Severity option name.
 * Used for bugs — Severity reflects complexity/impact, not development speed.
 */
function impactToSeverity(impact) {
  switch (impact) {
    case 'Alto':  return 'High';
    case 'Medio': return 'Medium';
    case 'Bajo':  return 'Low';
    default:      return 'Medium';
  }
}

/**
 * Fetches all tasks in a list, paginating through all pages (100 per page).
 * @param {string} listId
 * @returns {Promise<Array>} Array of task objects
 */
async function getTasksInList(listId) {
  const tasks = [];
  let page = 0;

  while (true) {
    const { data } = await http.get(`/list/${listId}/task`, {
      params: { include_closed: false, page },
    });
    tasks.push(...data.tasks);
    if (data.tasks.length < 100) break;
    page++;
  }

  return tasks;
}

/**
 * Creates a Test Plan task in a list.
 * @param {string} listId
 * @param {string} name
 * @returns {Promise<Object>} Created task object
 */
async function createTestPlan(listId, name) {
  const { data } = await http.post(`/list/${listId}/task`, {
    name,
    custom_item_id: TASK_TYPES['test plan'],
  });
  return data;
}

/**
 * Creates a Test Case as a subtask of a Test Plan.
 * @param {string} listId - List where the Test Plan lives
 * @param {string} parentId - Test Plan task ID
 * @param {Object} report - { title, description, impact }
 * @param {string} ambiente - development | staging | production
 * @returns {Promise<Object>} Created task object
 */
async function createTestCase(listId, parentId, report, ambiente) {
  const environmentOptionId = ENVIRONMENT_OPTIONS[ambiente.toLowerCase()];

  const { data } = await http.post(`/list/${listId}/task`, {
    name: report.title,
    content: report.description,
    markdown_content: report.description,
    parent: parentId,
    custom_item_id: TASK_TYPES['test case'],
    priority: impactToPriority(report.impact),
    custom_fields: [
      { id: ENVIRONMENT_FIELD_ID, value: environmentOptionId },
    ],
  });
  return data;
}

/**
 * Creates a relationship link between two tasks.
 * @param {string} taskId - Source task ID (e.g. the HU)
 * @param {string} linkedTaskId - Target task ID (e.g. the TC)
 * @returns {Promise<Object>}
 */
async function linkTasks(taskId, linkedTaskId) {
  const { data } = await http.post(`/task/${taskId}/link/${linkedTaskId}`);
  return data;
}

module.exports = { getWorkspaceMembers, getTask, createSubtask, getCurrentSprint, getTasksInList, createTestPlan, createTestCase, linkTasks };
