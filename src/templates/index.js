const bug = require('./bug');
const improvement = require('./improvement');
const testCase = require('./testCase');
const taskDefault = require('./taskDefault');

// Keyed by custom_item_id (matches TASK_TYPES in clickup.js)
module.exports = {
  1004: bug,         // bug
  1005: improvement, // improvement
  1002: testCase,    // test case
  1011: testCase,    // test plan  — reuses testCase template
  0:    taskDefault, // task (default)
};
