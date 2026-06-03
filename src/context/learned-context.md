# Learned Context

---

**[2026-05-22]** · Tipo: `improvement` · Ambiente: `development`

- **Module/Feature**: Permit creation form with new Autosave functionality, specifically at Step 1 of the permit creation flow
- **UI Element & Interaction**: Confirmation modal with three action buttons that appears when user attempts to exit the form without saving
- **Technical Issue**: Modal buttons flicker and briefly disable during autosave process execution, indicating poor state management between the autosave operation and modal UI rendering
- **User Action Trigger**: User initiates form exit → confirmation modal displays → user remains idle in modal without clicking any button → autosave executes → button flickering occurs
- **Root Cause Pattern**: Concurrent state updates between autosave process and modal button state not properly synchronized, causing visual UI instability and disabled button states during save operations

---

**[2026-05-22]** · Tipo: `bug` · Ambiente: `development`

- **Module/Feature:** Draft permit form management for Applicant role users; form exit/navigation behavior and step persistence
- **UI Elements & Actions Involved:** Draft permit form with multiple steps, form exit actions (close button, back navigation, away navigation), confirmation modal that should appear on unsaved changes
- **Specific Issues:** (1) Missing confirmation modal when exiting draft permit form with unsaved changes; (2) Incorrect step navigation on permit re-entry — user is not returned to the last step where changes were made, instead navigates to an arbitrary step
- **Technical Context:** Draft permit state persistence and change tracking; step/form state management on exit and re-entry flows; Applicant role permissions and data handling
- **Reproduction Scope:** Applicant role specifically; affects draft permits with modifications; inconsistent behavior on re-entry navigation

---

**[2026-05-26]** · Tipo: `bug` · Ambiente: `development`

- Applicant role testing file uploads in Step 5 (Project Files & Comments) of the permit creation stepper workflow
- File upload button fails with error message "Failed to prepare upload. Please check your connection and try again" when attempting to attach required files
- Submit button should become enabled only after all mandatory file attachments are successfully uploaded
- Issue occurs after completing Steps 1-4 (Conservation District, Applicant Info, Project Info, Construction details) and navigating to Step 5
- Connection/upload preparation failure prevents progression in permit creation workflow for Applicant users

---

**[2026-05-27]** · Tipo: `bug` · Ambiente: `staging`

- Admin role user navigating through Permit detail view → CD/AGENCY USE option → form with data entry
- Back button malfunction: remains on CD/AGENCY USE form instead of returning to parent Permit detail view
- Issue occurs specifically after user has entered data into CD/AGENCY USE form fields
- Navigation path affected: Permit detail > CD/AGENCY USE form > back button (should return to Permit detail)
- Staging environment issue with back button state management in CD/AGENCY USE form component

---

**[2026-05-27]** · Tipo: `bug` · Ambiente: `staging`

- Public Complaint submission form allows unauthenticated users to create complaints; upon submission, displays success message and triggers form download
- Admin panel's Complaints section displays a table view of submitted complaints, but newly created complaints from public form are not appearing in this table
- Discrepancy exists between complaint creation confirmation (May 27) and Admin Complaints table display (most recent record shows May 21), indicating data synchronization or visibility issue between public submission and admin interface
- Bug affects the complaint record creation flow when submitted without authentication from the public interface, suggesting potential issue with unauthenticated request handling or database persistence

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging`

- **Module:** Permit creation multi-step form (Step 2 → Step 3 → Step 4 navigation)
- **Issue:** Page focus/scroll position lands below the step header instead of at the top of the step after navigation, requiring manual scroll up to access initial required fields
- **User role:** Applicant
- **Expected behavior:** Focus should automatically scroll to the top of the new step upon navigation to display all required fields without additional scrolling
- **Affected flows:** Step transitions in permit creation workflow (e.g., Step 2→3, Step 3→4)

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging`

- Permit creation flow, specifically **Step 3** with Stream selection dropdown and Address field manual entry
- Autosave functionality with 5-second delay persisting changes to Address field and map pin position across navigation (back/re-enter cycles)
- Address field behavior: manually entered data reverts to previous state instead of persisting last saved state; map pin resets to default location instead of maintaining moved position
- Geoservice integration automatically updates Address field when map pin is moved, but this auto-populated data does not persist correctly after autosave and re-entry
- Issue occurs in specific sequence: manual Address entry → autosave → navigate away → re-enter → map pin movement → autosave → navigate away → re-enter reveals data reversion

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging`

- **Module:** Historical Data — new record creation and data persistence workflow
- **UI Elements & Actions:** Application Number field (manual data entry), Back button navigation, autosave mechanism (5-second delay), PDF upload functionality, form pre-population after AI processing
- **Expected Behavior:** Manually entered data in Application Number field persists after autosave and Back/re-entry cycle; AI-extracted data from uploaded PDF should persist identically after autosave and Back/re-entry cycle
- **Bug Pattern:** Asymmetric persistence — manually entered data is retained on return but AI-processed PDF data is not retained, despite both completing autosave before navigation away
- **Technical Context:** Autosave trigger occurs after 5 seconds of inactivity; form pre-loads saved data on Historical Data screen re-entry; AI processing extracts data from PDF and populates form fields before autosave cycle

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging`

- **Feature**: Multi-step Permit form with dropdown selections on Step 1 (Conservation District/CD dropdown) and Step 3 (Stream dropdown)
- **UI Issue**: Dropdown arrow button (right side of field) does not trigger list expansion, though clicking the dropdown field itself works correctly
- **Affected Elements**: CD selection dropdown in Step 1 and Stream selection dropdown in Step 3 of the "Apply for permit" form
- **Expected Behavior**: Arrow button click should open dropdown list options, matching the behavior of clicking the field itself
- **Technical Context**: Dropdown component interaction issue where arrow button event handler may not be properly connected to toggle list visibility state

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging`

- Permit creation flow: Step 2 (Applicant Information) contains a checkbox labeled "Landowner is the same as applicant" which defaults to checked
- When the checkbox remains selected during permit creation and user completes Steps 3-5 and signs, the Landowner Information section displays as empty after permit is created
- Landowner Information section contains required/mandatory fields that should prevent permit creation if empty, but validation is not enforcing this when checkbox is enabled
- Expected behavior: when "Landowner is the same as applicant" checkbox is checked, Landowner Information should auto-populate with applicant data and persist after permit creation
- Data loss occurs despite checkbox being in enabled state, suggesting the applicant information is not being properly mapped or saved to the Landowner Information fields during permit finalization

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging`

- Inspector role performing permit inspection management in Online mode; inspection form submission via Submit button does not trigger permit status update
- Permit status lifecycle issue: remains in "In Progress" state instead of transitioning to "Completed" after online inspection submission
- Inspection data is successfully submitted, but the permit state change logic is not executed or not properly linked to the submission endpoint
- Affects the permit inspection workflow on staging environment; impacts Inspector role's ability to complete permit lifecycle through online inspection process

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging`

- Admin user testing Complaint inspection form with data entry and back navigation on staging environment
- Back button behavior inconsistent: first visit shows no confirmation modal and navigates immediately; second visit displays confirmation modal with "Save and Leave" option
- "Save and Leave" action on second visit causes delayed navigation response (several seconds) compared to first visit immediate navigation, suggesting performance or state management issue
- Confirmation modal appears only on subsequent visits after form data has been updated, not on initial data entry
- Navigation delay occurs after clicking "Save and Leave" button in the confirmation modal, impacting user experience with perceived unresponsiveness

---

**[2026-05-29]** · Tipo: `bug` · Ambiente: `staging`

- Emergency Form feature on public interface accessible to unauthenticated users
- Signature capture/signing functionality fails during form submission when user is not logged in
- Form submission flow breaks at the signature step for public users without authentication
- Issue occurs in staging environment affecting the public-facing Emergency Form page

---

**[2026-05-29]** · Tipo: `bug` · Ambiente: `staging`

- **Module:** Historical Data form with AI-powered PDF processing and auto-save functionality
- **UI Flow:** PDF upload → AI processing → form field auto-population → back button navigation; expected confirmation modal should appear before leaving unsaved form
- **Auto-save behavior:** Data should persist after 5+ seconds of inactivity; confirmation modal required if navigating back before auto-save completes
- **Bug:** Back button click bypasses confirmation modal and loses all form data populated from PDF extraction; form appears empty on re-entry to Historical Data
- **Technical context:** AI extracts data from uploaded PDF and populates Historical Data form fields; auto-save timing (5 seconds threshold) and navigation state management fail to prevent data loss

---

**[2026-06-02]** · Tipo: `bug` · Ambiente: `production`

- Agency role user attempting to access Emergency permit details from the **All Permits** tab in the dashboard table
- Navigation flow: Dashboard table → **All Permits** tab → Search for Emergency type permit → Click permit record to view details
- 500 server error prevents the permit details page from loading and rendering information
- Issue is reproducible consistently in both production and staging environments
- Emergency permit type record handling appears to have a server-side processing failure when accessed via the details view

---

**[2026-06-03]** · Tipo: `bug` · Ambiente: `staging`

- The module being tested is the **Inspection** feature, accessed via the **Inspection tab** within a permit, specifically **Step 1**
- The affected UI element is the **Inspection Form** header, which is missing an icon that should trigger the "See Assigned Inspectors" view when clicked
- The **"See Assigned Inspectors"** option currently exists in an **options/actions button menu** (as a workaround path), but per design spec it should be exposed as a dedicated **icon directly in the Inspection Form header**
- The bug is role-specific: it is reproduced when logged in with the **Inspector** role and navigating into a permit's inspection flow
- The discrepancy is between the implemented UI (option buried in a button menu) and the intended design (icon prominently placed in the **Inspection Form** section header)

---

**[2026-06-03]** · Tipo: `bug` · Ambiente: `staging`

- The module being tested is the **Inspection tab** within a permit, accessible by users with the **Inspector role**
- The flow involves a **multi-step form** (at minimum Step 1 and Step 2) where navigation between steps triggers required field validation
- The specific UI element affected is the **step indicator/tab for Step 1**, which should display in **red** when a required field is left empty and the user advances to the next step
- The bug involves a **validation state persistence issue**: the red highlight on Step 1 appears momentarily upon navigating to Step 2 but then resets to **grey** instead of remaining red until the empty required field is filled
- Relevant condition: the premature state reset occurs during **inter-step navigation** while required fields remain unfilled, suggesting the validation state is not being persisted correctly across step transitions
