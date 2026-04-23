# Skill: Write QA Test Cases for 4C / Gilly

## Purpose
Generate structured, executable, and complete Test Cases (TCs) from User Stories (HUs) for the 4C / Gilly platform. This skill enforces quality standards, naming conventions, coverage completeness, and scenario prioritization.

---

## Context
- **Platform:** 4C / Gilly — environmental control web application
- **Roles in scope:** Admin (CD Admin), Applicant, Inspector, Agency, Public User
- **Environments:** Development, Staging, Production
- **Devices:** Desktop (primary), Mobile/PWA (when specified in HU)
- **TC storage:** ClickUp — list `Test Cases` (ID: `901413246506`), project `QA Management [4C]`
- **TC task type:** `Test Case`
- **Parent task type:** `Test Plan`

---

## TC Naming Rules

### Format
```
[Role] - [Action verb] [feature/component] [condition/context]
```

### Rules
- **Max 80 characters** — if longer, remove filler words
- **Start with role** when the TC is role-specific (Admin, Applicant, Inspector, Agency)
- **Omit role** only for cross-role or UI-only verifications
- **Use action verbs:** Verify, Confirm, Validate, Check — not "Should", "Must", "Ensure"
- **Include the condition** that makes this TC unique (e.g., "when field is empty", "without uploading file")
- **Never use vague names** like "Test import flow" or "Verify initial UI layout"

### Examples
| ❌ Bad | ✅ Good |
|---|---|
| Should display Import button and modal | Admin - Verify Import button shows modal with 2 options on click |
| Verify initial UI layout | Admin - Verify Active Permit form shows 3 tabs and Upload/Submit buttons |
| Should not show button for non-Admin | Applicant/Inspector - Confirm Import button is not visible |
| Verify navigation between enabled tabs | Admin - Verify tab switch between Permit Overview and Full Application |

---

## TC Structure (per task)

Each TC must be created as a **subtask** of a Test Plan parent, with these fields populated:

### Required Fields
| Field | Value |
|---|---|
| **Name** | Follow naming rules above |
| **Type** | `Test Case` |
| **Priority** | Urgent / High / Normal / Low (see priority rules) |
| **Environment** | Development (default), Staging, or Production |
| **Device** | 💻 Desktop / 📲 Mobile / 🌐 Web / 🚩 All |
| **Steps** | Numbered, precise, reproducible |
| **Expected Result** | Explicit, verifiable, no ambiguity |

### Steps Format
```
1. Log in as [Role] in [Environment].
2. Navigate to [specific path or module].
3. [Perform specific action].
4. [Perform specific action].
5. Observe: [what to look at].
```
- Steps must be **atomic** — one action per step
- Always include login and navigation as explicit steps
- Always end with "Observe:" to focus the tester

### Expected Result Format
```
[Element/behavior] [is/shows/navigates to/displays] [specific value or state].
```
- Must be **binary** — pass or fail, no "should probably"
- Must reference **specific UI elements** by their exact label
- For navigation: specify the destination URL pattern or page title
- For UI state: specify enabled/disabled, visible/hidden, text content

---

## Priority Rules

| Priority | When to use |
|---|---|
| 🔴 **Urgent** | Core happy path, critical role-access control, data integrity |
| 🟠 **High** | Alternative flows, UI state validation, edge cases that block users |
| 🔵 **Normal** | Edge cases, cancel/dismiss actions, tooltip/helper text |
| ⚪ **Low** | Pure cosmetic, redundant safety checks, non-blocking UX details |

---

## Coverage Checklist (run for every HU)

Before generating TCs, verify coverage for ALL of these dimensions:

### ✅ Happy Path
- [ ] Main action completes successfully end-to-end
- [ ] Correct UI state after action (elements shown/hidden/enabled/disabled)
- [ ] Correct navigation destination after action

### ✅ Role & Access Control
- [ ] Feature IS accessible for the intended role
- [ ] Feature is NOT accessible / not visible for other roles (test at least 2 non-authorized roles)
- [ ] Role-specific UI differences are validated

### ✅ UI State & Components
- [ ] All specified elements are present (buttons, tabs, modals, labels)
- [ ] Disabled elements cannot be interacted with (click does nothing)
- [ ] Enabled elements respond correctly to interaction
- [ ] Tooltips display on hover for disabled elements (if specified)
- [ ] Renamed elements: old label no longer exists, new label is present

### ✅ Device / Responsive
- [ ] If HU says "desktop only" → TC validates feature is desktop-only
- [ ] If HU says mobile/PWA → TC validates mobile behavior separately

### ✅ Negative / Edge Cases
- [ ] What happens when required action is skipped (e.g., Submit without Upload)
- [ ] Cancel/dismiss action returns user to previous state
- [ ] Empty states or missing data handled gracefully

### ✅ New Instance / State Isolation
- [ ] New record/instance is created (not reusing existing)
- [ ] State resets correctly after cancel or completion

---

## Scenarios to Always Include (if applicable)

These are commonly missed by AI-generated TCs — always check:

1. **Renamed UI element:** TC verifying the OLD label no longer exists
2. **Button disabled state:** TC for Submit/Continue blocked before prerequisite action
3. **New instance creation:** TC confirming a fresh record is created, not an existing one reused
4. **Desktop-only enforcement:** TC verifying feature is absent or non-functional on mobile
5. **Non-authorized role:** TC for each non-authorized role (not just one)
6. **Tooltip content:** TC verifying the exact tooltip message on disabled elements
7. **Cancel/dismiss:** TC verifying modal closes and no side effects remain
8. **State after error:** TC verifying form/UI recovers correctly after a failed action

---

## Anti-patterns to Avoid

| ❌ Don't do this | ✅ Do this instead |
|---|---|
| Merge multiple verifications in one TC | One assertion per TC |
| Use "Should" in TC name | Use "Verify", "Confirm", "Validate", "Check" |
| Leave Expected Result vague ("it works") | Write exact observable outcome |
| Skip non-authorized role TCs | Always test access control for at least 2 roles |
| Assume UI text without quoting it | Use exact label text from the HU or Figma |
| Create TC for out-of-scope behavior | Only cover what the HU explicitly defines |
| Overlapping TCs with identical scope | If two TCs test the same thing, merge or differentiate |

---

## TC Generation Workflow

When given a User Story (HU), follow this order:

1. **Read the HU completely** — identify: role, scope, components, devices, acceptance criteria
2. **Run the Coverage Checklist** — identify gaps before writing
3. **Group TCs by category:** Happy Path → Access Control → UI State → Edge Cases → Device
4. **Write names first** — validate all names follow naming rules before writing steps
5. **Write Steps + Expected Result** for each TC
6. **Assign priority** per priority rules
7. **Flag any ambiguity** in the HU that could affect TC accuracy

---

## Example TC (complete)

**Name:** `Admin - Verify Import button is renamed from "Add Historical Data"`

**Priority:** Urgent
**Device:** 💻 Desktop
**Environment:** Development

**Steps:**
```
1. Log in as Admin (CD Admin) in Development environment.
2. Navigate to the main permits dashboard.
3. Locate the action buttons in the header area.
4. Observe: the label of the import/entry button.
```

**Expected Result:**
```
The button displays the label "Import". The label "Add Historical Data" is not present anywhere on the page.
```
