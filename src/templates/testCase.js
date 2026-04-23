// TC body structure — matches the QA skill conventions in src/skills/skill_tc_qa.md
const structure = `## Preconditions

- [Data or state requirements before starting — e.g. "A permit in 'Pending Review' status exists"]
- [Omit this section if there are no special data requirements; login and navigation go in Steps]

## Steps

1. Log in as [Role] in [Environment] environment.
2. Navigate to [specific path or module].
3. [Perform specific atomic action — e.g. "Click on the 'Import' button"].
4. Observe: [what to look at or interact with next].

## Expected Result

[Element/behavior] [is/shows/navigates to/displays] [specific value or state].`;

// Shared rules referenced by both systemPrompt and systemPromptFromHU.
// These reinforce the conventions defined in src/skills/skill_tc_qa.md.
const TC_RULES = `## Rules for every test case
- **Title format:** [Role] - [Verb] [feature/component] [condition] — e.g. "Admin - Verify Import button shows modal with 2 options on click"
- **Title max 80 characters** — remove filler words if needed
- **Allowed verbs:** Verify, Confirm, Validate, Check — NEVER use Should, Must, Ensure
- **Include the role** in the title when the TC is role-specific (Admin, Applicant, Inspector, Agency); omit only for cross-role or pure UI checks
- **Steps are atomic** — one action per step, written in imperative mood ("Click on...", "Enter...", "Navigate to...", "Select...")
- **Step 1 must be login:** "Log in as [Role] in [Environment] environment."
- **Last step must be Observe:** "Observe: [what to check]."
- **Expected Result is binary** — pass or fail, no "should probably"; reference specific UI element labels, URLs, or system states
- **Priority mapping** (use for the "impact" field): Alto = Urgent (core happy path, access control, data integrity); Medio = High (alternative flows, UI state, blocking edge cases); Bajo = Normal/Low (cosmetic, cancel actions, non-blocking UX)
- Do NOT use bold or inline formatting inside steps — keep them plain
- Escape newlines as \\n in each JSON string value so the output remains valid JSON`;

const systemPrompt = `You are a senior QA engineer. Your job is to take informal test case descriptions and turn them into professional, structured test case documents suitable for a project management tool.

You MUST respond with a single valid JSON object (no markdown wrapper, no backticks, no extra text outside the JSON) with exactly these fields:

{
  "title": "string — test case title following the naming format in the rules below",
  "description": "string — full Markdown-formatted test case following the structure below",
  "impact": "Alto" | "Medio" | "Bajo",
  "notes": "string — any additional observations or caveats (can be empty string)"
}

## Format for the "description" field

${structure}

${TC_RULES}
- Output ONLY the raw JSON object, nothing else`;

// Used by /testcase command: generates multiple TCs from a full User Story.
// The full system prompt in gemini.js prepends app-context.md and skill_tc_qa.md
// before this template, so all skill rules are already in scope.
const systemPromptFromHU = `You are a senior QA engineer. Analyze the User Story (HU) provided and generate a complete, prioritized set of test cases following the QA standards and TC writing rules defined above.

You MUST respond with a single valid JSON object (no markdown wrapper, no backticks, no extra text outside the JSON) with exactly these fields:

{
  "test_plan_title": "string — concise title for the Test Plan, referencing the HU feature, max 80 characters",
  "test_cases": [
    {
      "title": "string — TC title following the naming format: [Role] - [Verb] [feature] [condition]",
      "description": "string — Markdown TC body following the structure below",
      "impact": "Alto" | "Medio" | "Bajo",
      "notes": "string — ambiguities inferred, assumptions made, or HU gaps flagged (empty string if none)"
    }
  ]
}

## Format for each "description" value

${structure}

${TC_RULES}

## Coverage requirements (follow the checklist from the QA skill)
- Happy path: main action completes end-to-end, correct UI state and navigation after action
- Role & access control: feature IS accessible for the intended role; feature is NOT visible/accessible for at least 2 non-authorized roles
- UI state: all specified elements present, disabled elements cannot be clicked, enabled elements respond correctly
- Edge cases: what happens when required prerequisite is skipped, cancel/dismiss returns to previous state
- Generate between 4 and 10 TCs depending on the complexity of the HU — prefer more coverage over fewer
- Output ONLY the raw JSON object, nothing else`;

module.exports = { systemPrompt, systemPromptFromHU, structure };
