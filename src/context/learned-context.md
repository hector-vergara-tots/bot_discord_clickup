# Learned Context

---

**[2026-05-22]** · Tipo: `improvement` · Ambiente: `development` · Status: `Open` · Link: `—`

- **Module/Feature**: Permit creation form with new Autosave functionality, specifically at Step 1 of the permit creation flow
- **UI Element & Interaction**: Confirmation modal with three action buttons that appears when user attempts to exit the form without saving
- **Technical Issue**: Modal buttons flicker and briefly disable during autosave process execution, indicating poor state management between the autosave operation and modal UI rendering
- **User Action Trigger**: User initiates form exit → confirmation modal displays → user remains idle in modal without clicking any button → autosave executes → button flickering occurs
- **Root Cause Pattern**: Concurrent state updates between autosave process and modal button state not properly synchronized, causing visual UI instability and disabled button states during save operations

---

**[2026-05-22]** · Tipo: `bug` · Ambiente: `development` · Status: `Open` · Link: `—`

- **Module/Feature:** Draft permit form management for Applicant role users; form exit/navigation behavior and step persistence
- **UI Elements & Actions Involved:** Draft permit form with multiple steps, form exit actions (close button, back navigation, away navigation), confirmation modal that should appear on unsaved changes
- **Specific Issues:** (1) Missing confirmation modal when exiting draft permit form with unsaved changes; (2) Incorrect step navigation on permit re-entry — user is not returned to the last step where changes were made, instead navigates to an arbitrary step
- **Technical Context:** Draft permit state persistence and change tracking; step/form state management on exit and re-entry flows; Applicant role permissions and data handling
- **Reproduction Scope:** Applicant role specifically; affects draft permits with modifications; inconsistent behavior on re-entry navigation

---

**[2026-05-26]** · Tipo: `bug` · Ambiente: `development` · Status: `Open` · Link: `—`

- Applicant role testing file uploads in Step 5 (Project Files & Comments) of the permit creation stepper workflow
- File upload button fails with error message "Failed to prepare upload. Please check your connection and try again" when attempting to attach required files
- Submit button should become enabled only after all mandatory file attachments are successfully uploaded
- Issue occurs after completing Steps 1-4 (Conservation District, Applicant Info, Project Info, Construction details) and navigating to Step 5
- Connection/upload preparation failure prevents progression in permit creation workflow for Applicant users

---

**[2026-05-27]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- Admin role user navigating through Permit detail view → CD/AGENCY USE option → form with data entry
- Back button malfunction: remains on CD/AGENCY USE form instead of returning to parent Permit detail view
- Issue occurs specifically after user has entered data into CD/AGENCY USE form fields
- Navigation path affected: Permit detail > CD/AGENCY USE form > back button (should return to Permit detail)
- Staging environment issue with back button state management in CD/AGENCY USE form component

---

**[2026-05-27]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- Public Complaint submission form allows unauthenticated users to create complaints; upon submission, displays success message and triggers form download
- Admin panel's Complaints section displays a table view of submitted complaints, but newly created complaints from public form are not appearing in this table
- Discrepancy exists between complaint creation confirmation (May 27) and Admin Complaints table display (most recent record shows May 21), indicating data synchronization or visibility issue between public submission and admin interface
- Bug affects the complaint record creation flow when submitted without authentication from the public interface, suggesting potential issue with unauthenticated request handling or database persistence

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- **Module:** Permit creation multi-step form (Step 2 → Step 3 → Step 4 navigation)
- **Issue:** Page focus/scroll position lands below the step header instead of at the top of the step after navigation, requiring manual scroll up to access initial required fields
- **User role:** Applicant
- **Expected behavior:** Focus should automatically scroll to the top of the new step upon navigation to display all required fields without additional scrolling
- **Affected flows:** Step transitions in permit creation workflow (e.g., Step 2→3, Step 3→4)

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- Permit creation flow, specifically **Step 3** with Stream selection dropdown and Address field manual entry
- Autosave functionality with 5-second delay persisting changes to Address field and map pin position across navigation (back/re-enter cycles)
- Address field behavior: manually entered data reverts to previous state instead of persisting last saved state; map pin resets to default location instead of maintaining moved position
- Geoservice integration automatically updates Address field when map pin is moved, but this auto-populated data does not persist correctly after autosave and re-entry
- Issue occurs in specific sequence: manual Address entry → autosave → navigate away → re-enter → map pin movement → autosave → navigate away → re-enter reveals data reversion

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- **Module:** Historical Data — new record creation and data persistence workflow
- **UI Elements & Actions:** Application Number field (manual data entry), Back button navigation, autosave mechanism (5-second delay), PDF upload functionality, form pre-population after AI processing
- **Expected Behavior:** Manually entered data in Application Number field persists after autosave and Back/re-entry cycle; AI-extracted data from uploaded PDF should persist identically after autosave and Back/re-entry cycle
- **Bug Pattern:** Asymmetric persistence — manually entered data is retained on return but AI-processed PDF data is not retained, despite both completing autosave before navigation away
- **Technical Context:** Autosave trigger occurs after 5 seconds of inactivity; form pre-loads saved data on Historical Data screen re-entry; AI processing extracts data from PDF and populates form fields before autosave cycle

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- **Feature**: Multi-step Permit form with dropdown selections on Step 1 (Conservation District/CD dropdown) and Step 3 (Stream dropdown)
- **UI Issue**: Dropdown arrow button (right side of field) does not trigger list expansion, though clicking the dropdown field itself works correctly
- **Affected Elements**: CD selection dropdown in Step 1 and Stream selection dropdown in Step 3 of the "Apply for permit" form
- **Expected Behavior**: Arrow button click should open dropdown list options, matching the behavior of clicking the field itself
- **Technical Context**: Dropdown component interaction issue where arrow button event handler may not be properly connected to toggle list visibility state

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- Permit creation flow: Step 2 (Applicant Information) contains a checkbox labeled "Landowner is the same as applicant" which defaults to checked
- When the checkbox remains selected during permit creation and user completes Steps 3-5 and signs, the Landowner Information section displays as empty after permit is created
- Landowner Information section contains required/mandatory fields that should prevent permit creation if empty, but validation is not enforcing this when checkbox is enabled
- Expected behavior: when "Landowner is the same as applicant" checkbox is checked, Landowner Information should auto-populate with applicant data and persist after permit creation
- Data loss occurs despite checkbox being in enabled state, suggesting the applicant information is not being properly mapped or saved to the Landowner Information fields during permit finalization

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- Inspector role performing permit inspection management in Online mode; inspection form submission via Submit button does not trigger permit status update
- Permit status lifecycle issue: remains in "In Progress" state instead of transitioning to "Completed" after online inspection submission
- Inspection data is successfully submitted, but the permit state change logic is not executed or not properly linked to the submission endpoint
- Affects the permit inspection workflow on staging environment; impacts Inspector role's ability to complete permit lifecycle through online inspection process

---

**[2026-05-28]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- Admin user testing Complaint inspection form with data entry and back navigation on staging environment
- Back button behavior inconsistent: first visit shows no confirmation modal and navigates immediately; second visit displays confirmation modal with "Save and Leave" option
- "Save and Leave" action on second visit causes delayed navigation response (several seconds) compared to first visit immediate navigation, suggesting performance or state management issue
- Confirmation modal appears only on subsequent visits after form data has been updated, not on initial data entry
- Navigation delay occurs after clicking "Save and Leave" button in the confirmation modal, impacting user experience with perceived unresponsiveness

---

**[2026-05-29]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- Emergency Form feature on public interface accessible to unauthenticated users
- Signature capture/signing functionality fails during form submission when user is not logged in
- Form submission flow breaks at the signature step for public users without authentication
- Issue occurs in staging environment affecting the public-facing Emergency Form page

---

**[2026-05-29]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- **Module:** Historical Data form with AI-powered PDF processing and auto-save functionality
- **UI Flow:** PDF upload → AI processing → form field auto-population → back button navigation; expected confirmation modal should appear before leaving unsaved form
- **Auto-save behavior:** Data should persist after 5+ seconds of inactivity; confirmation modal required if navigating back before auto-save completes
- **Bug:** Back button click bypasses confirmation modal and loses all form data populated from PDF extraction; form appears empty on re-entry to Historical Data
- **Technical context:** AI extracts data from uploaded PDF and populates Historical Data form fields; auto-save timing (5 seconds threshold) and navigation state management fail to prevent data loss

---

**[2026-06-02]** · Tipo: `bug` · Ambiente: `production` · Status: `Open` · Link: `—`

- Agency role user attempting to access Emergency permit details from the **All Permits** tab in the dashboard table
- Navigation flow: Dashboard table → **All Permits** tab → Search for Emergency type permit → Click permit record to view details
- 500 server error prevents the permit details page from loading and rendering information
- Issue is reproducible consistently in both production and staging environments
- Emergency permit type record handling appears to have a server-side processing failure when accessed via the details view

---

**[2026-06-03]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The module being tested is the **Inspection** feature, accessed via the **Inspection tab** within a permit, specifically **Step 1**
- The affected UI element is the **Inspection Form** header, which is missing an icon that should trigger the "See Assigned Inspectors" view when clicked
- The **"See Assigned Inspectors"** option currently exists in an **options/actions button menu** (as a workaround path), but per design spec it should be exposed as a dedicated **icon directly in the Inspection Form header**
- The bug is role-specific: it is reproduced when logged in with the **Inspector** role and navigating into a permit's inspection flow
- The discrepancy is between the implemented UI (option buried in a button menu) and the intended design (icon prominently placed in the **Inspection Form** section header)

---

**[2026-06-03]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The module being tested is the **Inspection tab** within a permit, accessible by users with the **Inspector role**
- The flow involves a **multi-step form** (at minimum Step 1 and Step 2) where navigation between steps triggers required field validation
- The specific UI element affected is the **step indicator/tab for Step 1**, which should display in **red** when a required field is left empty and the user advances to the next step
- The bug involves a **validation state persistence issue**: the red highlight on Step 1 appears momentarily upon navigating to Step 2 but then resets to **grey** instead of remaining red until the empty required field is filled
- Relevant condition: the premature state reset occurs during **inter-step navigation** while required fields remain unfilled, suggesting the validation state is not being persisted correctly across step transitions

---

**[2026-06-03]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The module being tested is the **Permit inspection flow**, specifically the **Permit tab** within an open permit record
- The UI elements involved are the **permit status badge** and the **download button** that should appear adjacent to it in the Permit tab header/detail area
- The issue is **role-specific**: the download button renders correctly (or is expected) for other roles but is missing when the authenticated user has the **Inspector** role
- The flow involves: logging in as **Inspector** → navigating to an existing **Permit** → opening it for inspection → selecting the **Permit tab**
- This is a **conditional rendering bug** where role-based visibility logic likely incorrectly excludes the download button for the Inspector role in the staging environment

---

**[2026-06-03]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The module being tested is the **permit inspection** workflow, specifically the **Permit tab** within the permit inspection view
- The failing UI action is clicking the **Download PDF** button located on the **Permit tab** when inspecting a permit
- The issue is **role-specific**, occurring only for users assigned the **Inspector** role, suggesting a permissions or access-control condition tied to that role during PDF generation
- The flow involves: logging in as Inspector → navigating to a permit → opening it for inspection → selecting the **Permit tab** → triggering the PDF download
- The defect manifests as a download error with no file produced, pointing to a potential backend failure (e.g., authorization check, endpoint restriction, or file generation error) when the Inspector role attempts to access the PDF resource

---

**[2026-06-04]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The module being tested is the **Permit inspection** feature, specifically the step-by-step navigation within the **Permit tab**
- The affected UI elements are the **forward/back arrows located in the footer** used to navigate between inspection steps sequentially
- The bug occurs specifically at the transition from **Step 4 to Step 5** — the forward arrow becomes unresponsive while the back arrow continues to function normally
- A **workaround exists**: tapping the **step indicator at the top of the screen** (step dots/tabs in the header) successfully advances to Step 5, isolating the issue to the footer arrow component only
- The issue is **role-specific** (Inspector role) and **environment/platform-specific** (staging, mobile version), suggesting it may relate to a state or validation condition triggered at Step 4 that blocks footer navigation only

---

**[2026-06-04]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug is located in the **Permit tab** of the permit inspection flow, specifically in its **mobile view**
- The affected UI element is the **footer navigation**, which contains **back and forward arrow buttons** used to move between steps
- The issue occurs on the **last step** of the permit inspection: the **forward (next) arrow** remains visible when it should be hidden, leaving only the **back arrow** visible
- The expected behavior is that footer arrow visibility should be conditional based on step position: no forward arrow on the last step, no back arrow on the first step
- The bug is reproducible by logging in with an **Inspector role** on a mobile device in the **staging environment** and navigating sequentially through all steps of a Permit inspection

---

**[2026-06-04]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug occurs in the **Permit Application Form**, specifically on **Step 5 (Project Files & Comments)**, the final step of the permit creation flow
- The affected UI element is the **dropzone component** used for file attachments; the issue triggers when **3 or more files** are uploaded to a **single dropzone**
- The role context is **Applicant**, accessed via the **"Apply for permit"** flow after completing Steps 1 through 4
- The visual defect consists of **file items overflowing outside the dropzone container boundary**, indicating a layout/CSS containment issue within the dropzone's file list rendering
- The bug is reproducible on the **staging environment** and applies to any single dropzone on Step 5 when the attachment count reaches 3 or more

---

**[2026-06-04]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug occurs in the **permit creation flow** (Joint Application), specifically in **Step 4 (Construction)**, within the **MATERIALS section**, accessible via the **"Apply for permit"** button under the **Applicant** role
- The affected UI elements are **text input fields related to materials** in the MATERIALS section; the issue manifests when a user is actively typing in any of these fields
- An **autosave feature** triggers every **5 seconds** in the background to persist form data; this cycle incorrectly causes the active input field to **lose focus**, interrupting continuous typing
- The focus loss only becomes disruptive when a typing pause coincides with the 5-second autosave interval, making data entry tedious rather than causing outright data loss
- The expected behavior is that the autosave cycle runs **silently in the background** without stealing focus from any active input field in the form

---

**[2026-06-04]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The module being tested is the **Permit Duplication** feature, accessible from the main dashboard under the **In Progress** tab via a **duplicate icon** on permit cards
- The user role involved is **Applicant**, and the flow triggers a multi-step cloned permit form that should pre-fill data from the source permit
- The expected behavior is that Steps 1–4 data is fully pre-filled in the duplicated permit; **Step 5 (Attachments)** is the only step intentionally excluded from duplication
- The affected steps where data is not being carried over are: **Step 2 (Applicant Information)**, **Step 3 (Project Information)**, and **Step 4 (Construction)**
- The bug manifests specifically when the duplication flow opens — fields in Steps 2 through 4 appear empty instead of being populated with the source permit's data

---

**[2026-06-04]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The feature being tested is "Refresh notification for application update and deployments," which alerts authenticated users when a new application update or deployment is available
- The bug occurs in the notification dismissal/confirmation flow: after a user handles (dismisses or confirms) the refresh notification on one tab, the notification reappears when opening a new tab in the same browser session
- The issue is specific to multi-tab scenarios within the same authenticated browser session, suggesting the notification state is not being persisted or shared across tabs (e.g., via localStorage, sessionStorage, or a shared service worker signal)
- Relevant conditions: user must be authenticated, the refresh notification must have been triggered and acted upon in a first tab before opening a second tab pointing to the same application URL
- The expected expected behavior implies a cross-tab state synchronization mechanism (e.g., BroadcastChannel API, shared storage flags) should prevent the notification from re-showing once handled in any tab of the same session

---

**[2026-06-04]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug occurs in the **Inspection tab**, specifically on **Step 3** (map view) of the inspection flow, accessible via an **Inspector** role account
- The affected UI element is the **map pin** rendered on the Step 3 map, which displays an incorrect location different from the permit's original creation coordinates
- The **Permit tab** map correctly displays the pin at the right coordinates, indicating the coordinate data is stored correctly but is being read or passed differently in the Inspection tab flow
- The issue involves a discrepancy in how location/coordinates are sourced or bound between the **Permit tab map** and the **Inspection tab Step 3 map**, suggesting a potential mismatch in the data reference or API call used for each view
- Relevant navigation path: Login as Inspector → Open existing permit → **Inspection tab** → Open/begin inspection → advance to **Step 3** (map view)

---

**[2026-06-05]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug affects the **Inspector role** in the **PWA (Progressive Web App)** running in **Offline mode** on the staging environment
- The affected flow involves opening a **Permit** in the new UI version and navigating to the **Inspection tab**
- The specific interaction involves the question **"Does this project need an inspection?"** — selecting the **"No"** option fails to trigger the expected UI state change
- The **Sign & Finish** button/option should become enabled after selecting "No" (indicating no physical inspection is required), allowing the inspector to complete the workflow, but instead remains disabled and non-interactable
- The issue is tied to the **new design/version** of the app, suggesting a regression introduced in the updated UI that affects conditional logic controlling the **Sign & Finish** enablement state

---

**[2026-06-05]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug occurs in the **Complaints module**, accessible via the main navigation with an **Admin** role account
- The flow involves inspecting an **existing complaint's detail view**, which is a read-only/visualization mode (not an edit/update mode)
- The complaint detail is organized in a **multi-step wizard UI** (at least 5 steps); the issue specifically manifests during transitions from **Step 2 → Step 3** and **Step 4 → Step 5**
- Two distinct defects are present: (1) **attached files/attachments intermittently not rendering** in the detail view, and (2) **false mandatory field validation warnings** (steps highlighted in red) appearing in view mode despite the complaint already being created
- The core logic issue is that **validation logic intended for creation/edit mode** is incorrectly triggering in **view-only mode**, where no data entry is required or expected

---

**[2026-06-05]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug occurs in the **Dashboard Table** module, specifically within the **Emergencies** tab
- The affected flow involves opening an already **managed/gestioned emergency** record and attempting to use the **Download PDF** button
- The issue is role-specific, occurring under the **Admin** role; behavior with other roles (e.g., standard user) is not confirmed as affected
- The failure is silent — no file download is triggered and no error message or feedback is displayed when the button is pressed
- The condition that differentiates the failing case is the **managed/gestioned state** of the emergency, suggesting the download functionality may behave differently based on emergency status

---

**[2026-06-05]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug affects the **Help Applicant** section, accessible to users with the **Admin** role on the staging environment
- The flow involved is **Create Permit** initiated from within the Help Applicant view, which upon completion should return the user to the Help Applicant permit list
- The specific issue is a missing **list refresh/reload** after permit creation — the newly created permit does not appear in the Help Applicant permit list without a manual page refresh
- The expected behavior is that the Help Applicant view automatically re-fetches or updates its permit list upon returning from the Create Permit flow, displaying all permits including the most recently created one
- Relevant technical context: the permit list displayed in Help Applicant likely relies on a data fetch triggered on view load or navigation, which is not being called after the Create Permit flow completes

---

**[2026-06-07]** · Tipo: `bug` · Ambiente: `staging` · Status: `Open` · Link: `—`

- The bug affects the **Inspection tab** within a permit, specifically at **Step 2** of the inspection flow
- The affected role is **Inspector**, and the issue only manifests when the application is used as a **PWA in offline mode**
- The UI element involved is a **map component** that displays a **location pin** for the permit's geographic position; in offline mode, map tiles fail to render while the pin remains visible
- The root cause relates to **map tile caching behavior** in PWA offline mode — tiles are not being cached/served from service worker cache, resulting in a blank map background
- The navigation path to reproduce: Login as Inspector → Open PWA → Navigate to a permit → Disable network → Open permit → **Inspection tab** → **Step 2**

---

**[2026-06-09]** · Tipo: `bug` · Ambiente: `staging`

- The bug occurs in the **Permit Creation** multi-step flow, specifically affecting users with the **Applicant** role
- **Step 2** contains permit type selection via **checkboxes**, where multiple permit types can be selected simultaneously
- The specific trigger is selecting both the **310** permit type checkbox and the **Floodplain Permit** checkbox at the same time in Step 2
- The unintended behavior causes an automatic redirect back to **Step 1**, though the checkbox selections (310 + Floodplain Permit) are preserved in state after the redirect
- The issue appears to be tied to a navigation/validation side effect triggered by a specific combination of permit type selections, not a data loss problem

---

**[2026-06-09]** · Tipo: `improvement` · Ambiente: `staging`

- The feature being tested is **Help Applicant** functionality, accessible to users with the **Admin role**
- The specific screen involved is the **permit list view** within Help Applicant, where each record currently displays only **permit type, date, and status**
- The identified gap is the absence of **applicant name** and other identifying details in the list view, requiring admins to enter each permit's **detail view** individually to identify ownership
- The **Applicant role** already has a richer permit list display (a "preview" format) that serves as the reference model for the requested improvement
- The improvement requests adding an **applicant preview detail** component to the Admin permit list, similar to what the Applicant role sees, to allow differentiation of permits without navigating to individual detail pages

---

**[2026-06-09]** · Tipo: `bug` · Ambiente: `staging`

- The bug affects the **Permit creation form**, accessible via the **Applicant** role and through the **Help Applicant** functionality in the Admin panel
- Validation is triggered by clicking the **Submit** button (Applicant flow) or the **Ready for Signature** button (Help Applicant flow), which highlights empty required fields in red
- The issue involves inconsistent real-time validation behavior: some required fields correctly remove the red highlight when input is entered, while others remain highlighted in red despite containing valid data
- The expected behavior is that any required field highlighted in red should immediately lose its red state as soon as the user enters valid input into it
- The bug is reproducible on **staging** environment under both the Applicant role flow and the Admin "Help Applicant" flow, suggesting the validation clearing logic is not uniformly applied across all field types in the Permit form

---

**[2026-06-09]** · Tipo: `improvement` · Ambiente: `development`

- The module being tested is the **Emergency permit flow**, accessible via the **"Apply for Permit"** button with the **Applicant** role
- The specific UI interaction involves clicking the **"Emergency"** option within the **Apply for Permit** button's menu/dropdown
- The issue occurs during navigation/loading between the permit selection action and the Emergency functionality screen, where a perceptible delay exists with no visual feedback
- Missing UI elements identified: spinner, skeleton screen, or progress indicator that should display while the Emergency feature loads
- The improvement requests implementing a **loading/waiting state indicator** so users receive confirmation that their click was registered and the app is processing

---

**[2026-06-09]** · Tipo: `improvement` · Ambiente: `development`

- The tested module is the **Emergency form**, accessed from the **Applicant role** within the application
- The navigation flow involved is: **Applicant main view → Emergency view**, where no return path exists back to the Applicant main view
- Missing UI elements identified: a **header** component and a **back button/navigation control** on the Emergency form, both of which are present on the Applicant form
- The improvement requires **design consistency** between the Emergency form and the Applicant form, aligning layout and header styling to the existing design system
- The issue affects **role-based navigation** for the **Applicant role**, where users are forced to rely on browser-level navigation due to missing in-app back navigation

---

**[2026-06-09]** · Tipo: `bug` · Ambiente: `development`

- The bug affects the **Emergency creation** module, specifically accessible to users with the **Applicant** role
- The flow involves navigating to the **Emergency creation section**, filling in all required fields, and attempting to submit via the **Submit button**
- The **Submit button** remains disabled regardless of valid data entered in all required fields, completely blocking emergency creation for Applicant users
- The issue is role-specific — it occurs under the **Applicant** role, suggesting possible role-based form validation or permission logic controlling the button's enabled/disabled state
- The condition triggering the bug is completing the full form fill flow; the button activation logic (likely tied to form validation state) fails to recognize the form as complete for this role

---

**[2026-06-10]** · Tipo: `bug` · Ambiente: `staging`

- The module under test is the **Emergency** feature, specifically the **Emergency–Applicant integration** flow
- The user role involved is **Applicant**, and the bug is role-specific (does not necessarily affect other roles)
- The action triggering the failure is clicking the **Submit** button after filling in required fields to create a new Emergency
- The expected post-submit flow advances to a **signatures step** where the Emergency is signed and finalized; this step is blocked by the backend error
- The defect is a **backend error on submit**, preventing progression through the Emergency creation lifecycle within the Applicant integration context

---

**[2026-06-10]** · Tipo: `bug` · Ambiente: `staging`

- The bug is in the **Emergencies** module/section, specifically the **Emergencies tab** viewed from the **Applicant** role
- Two distinct user roles are involved: **Applicant** (the role creating and viewing emergencies) and **Admin** (which correctly displays all emergencies including those created by Applicants)
- The flow tested: login as Applicant → navigate to Emergencies section → create a new emergency → return to the Emergencies tab to verify visibility
- The root issue is a visibility/filtering discrepancy: emergencies created under the Applicant role appear in the Admin Emergencies tab but are not returned/displayed in the Applicant-facing Emergencies tab
- This was triggered by a **new Applicant functionality** feature, implying a recent change introduced role-based access or filtering logic for emergencies that does not yet correctly scope Applicant-created records back to the Applicant view

---

**[2026-06-11]** · Tipo: `bug` · Ambiente: `staging`

- The bug is in the **Emergencies** tab/module of the application
- The affected UI interaction is **clicking on an emergency record row** to navigate to its detail view
- The issue is **role-specific**, occurring only for users with the **Applicant** role (other roles presumably work correctly)
- Expected behavior is that row click triggers navigation to the **emergency detail view**; actual behavior is no response, no error, and no feedback displayed
- The staging environment was used for testing; the flow involves: login with Applicant role → Emergencies tab → click any record row → detail view should open

---

**[2026-06-11]** · Tipo: `bug` · Ambiente: `staging`

- The bug is in the **Apply for Permit** modal, accessible from the permits section under the **Applicant** role
- The specific UI element involved is the application type selector within the modal, which contains at least the **Joint Application** option
- The flow to reproduce: login as **Applicant** → navigate to permits section → click **Apply for Permit** button → modal opens with **Joint Application** pre-selected
- Expected behavior: no application type option should be pre-selected by default; the user must make an explicit selection before proceeding
- This is a default state/initialization issue where the modal's form control for application type is incorrectly initialized with **Joint Application** as the default value instead of an empty/null state

---

**[2026-06-11]** · Tipo: `bug` · Ambiente: `staging`

- The bug is located in the header/navigation bar component of the Gilly application (staging: `https://app-stg.gilly.org`)
- The specific UI element involved is the **Gilly logo** in the top navigation, which is expected to act as a home/redirect button
- The expected behavior is a full page reload/redirect to a role-specific home URL upon clicking the logo (e.g., `/permit/applicant` for the Applicant role), not just a URL update
- The application uses role-based routing, where different user roles (e.g., Applicant) have distinct home views mapped to specific URL paths under the `/permit/` route namespace
- Current behavior: clicking the logo either refreshes the URL in place or does nothing navigational, leaving the user on the current section without redirecting to the role home view

---

**[2026-06-11]** · Tipo: `bug` · Ambiente: `staging`

- The **Permits** section was being tested, specifically the **Emergencies** tab and **All Permits** tab
- The affected UI element is the **search input field** used to filter permit listings within those tabs
- The bug is role-dependent: filtering works correctly for the **Admin** role but fails entirely for the **Applicant** role, suggesting role-based conditional logic or API query parameters differ between roles
- The expected behavior is that typing a search term filters the displayed list in real time (or on submit), matching the Admin role's functionality
- Tested on the **staging** environment; the list remains unfiltered regardless of input when logged in as **Applicant**

---

**[2026-06-11]** · Tipo: `bug` · Ambiente: `staging`

- The module being tested is the **Permits** section, specifically the **All Permits** tab and the **In Progress** tab within the same screen
- The user role involved is **Applicant**, suggesting role-based data access or filtering logic may differ per role
- The specific UI interaction involves applying a **Status filter** with the value **"In Progress"** inside the **All Permits** tab
- The bug manifests as a discrepancy between two tabs: the **In Progress** tab correctly displays records with that status, while the **All Permits** tab returns an empty list when the same status is filtered
- The issue likely points to a mismatch in filter query parameters, status value mapping, or API call logic used by the **Status filter** in the **All Permits** tab versus the criteria used to populate the **In Progress** tab

---

**[2026-06-11]** · Tipo: `bug` · Ambiente: `staging`

- The bug is located in the **Permits** section of the application, specifically on the **In Progress** tab, which is the default tab loaded upon navigation
- The affected role is **Applicant**; the issue may be role-specific, as the creation date rendering appears to depend on the user's role context
- The UI element missing is the **creation date field** on individual **permit cards** listed under the **In Progress** status
- The flow involved: log in as Applicant → navigate to Permits section → In Progress tab loads by default → permit cards are displayed without creation date
- "In Progress" is a specific **permit status** used within the app, and permits of this status are grouped under a dedicated tab that serves as the default view for the Permits section

---

**[2026-06-11]** · Tipo: `bug` · Ambiente: `staging`

- The bug affects the **Emergency detail screen** within the **Emergencies section**, specifically for users logged in with the **Applicant role**
- The missing UI elements are the **header** (which should match the design specification) and a **back navigation button/control** to return to the Emergencies list
- The issue is role-specific: it manifests under the **Applicant role** and may not affect other roles (e.g., admin or other user types)
- The navigation flow involved is: **Emergencies list → Emergency detail view**, where the return path is broken due to the absent back navigation
- Reported on the **staging environment**, suggesting the fix has not yet been deployed and the issue exists in pre-production builds

---

**[2026-06-11]** · Tipo: `bug` · Ambiente: `staging`

- The bug is located in the **Permits** section of the application, specifically affecting the **Emergency** and **All Permits** tabs
- The affected UI elements are two tab components within the Permits section: the **Emergency** tab and the **All Permits** tab, both failing to render record lists
- The issue is role-specific, triggered when a user is authenticated with the **Admin** role; other roles are reported as potentially unaffected
- The navigation flow involved is: Login as Admin → Permits section → Emergency tab / All Permits tab → record list view
- The defect involves a data visibility/filtering problem where existing permit records are not displayed, suggesting a possible role-based access control or data-fetching condition that incorrectly excludes Admin users from retrieving permit records

---

**[2026-06-16]** · Tipo: `bug` · Ambiente: `staging`

- The module being tested is the **Emergencies** section, specifically the **Emergency detail view**
- The affected UI element is the **Inspection Files** button, which should be visible in the Emergency detail regardless of the record's status
- The bug is role-specific, occurring only for users with the **Applicant** role when viewing Emergency records
- The condition triggering the bug is the Emergency's status being anything **other than Pending** (e.g., Approved, Rejected, In Progress)
- The application uses status-based conditional rendering in the Emergency detail view, which incorrectly gates the **Inspection Files** button visibility based on the **Pending** status for Applicant users

---

**[2026-06-22]** · Tipo: `bug` · Ambiente: `staging`

- The bug affects the **Permit Creation** flow, specifically **Step 1** of the multi-step form
- The affected UI element is the **Conservation District** dropdown, which renders empty (no options available)
- The issue is role-specific: it only reproduces when logged in with the **Applicant** role, suggesting a permissions or data-filtering condition tied to that role
- The expected behavior is that the dropdown populates with available district options, implying the data source exists but is not being returned or displayed for this role
- Likely causes include a backend endpoint filtering Conservation District data based on user role, or a frontend data-fetch call that lacks proper authorization headers/parameters for the Applicant role

---

**[2026-06-22]** · Tipo: `bug` · Ambiente: `staging`

- The bug affects the **permit creation flow**, specifically **Step 1** of the multi-step permit creation process
- The affected UI element is the **Conservation District (CD) dropdown**, which renders empty with no selectable options
- The issue is **role-specific**: it only occurs when the user is logged in with the **Applicant** role; other roles are not mentioned as affected
- The empty dropdown **blocks progression** through the permit creation flow, as Conservation District selection appears to be a required step
- Environment is **staging**; the root cause likely involves a data-fetching or permissions issue tied to the Applicant role when retrieving Conservation District records

---

**[2026-06-22]** · Tipo: `bug` · Ambiente: `staging`

- The feature under test is **Note & Admin Files**, specifically the **Admin Files** tab within a **Permit** record
- The bug involves the **delete/remove icon** displayed on newly uploaded files that are in an **unsaved/pending state** — the icon shown is a **trash (🗑) icon** instead of an **X icon**
- The expected UX pattern distinguishes between **unsaved files** (should show **X** to discard) and **saved files** (should show **trash icon** to delete), indicating a state-aware icon rendering requirement
- The issue is reproducible only when logged in with an **Admin role** and applies to files uploaded but not yet committed via a save action
- The navigation path to reproduce is: **Login as Admin → Open a Permit → Admin Files tab → Upload file(s) → Observe icon without saving**

---

**[2026-06-22]** · Tipo: `bug` · Ambiente: `staging`

- The feature being tested is **Notes & Admin Files** functionality within a permit detail view, accessible via the **CD/AGENCY USE** button that opens a right-side panel
- The right-side panel contains at least two tabs: **Admin Files** and **Notes**, and the bug occurs when switching between them with unsaved changes
- The specific flow involves uploading one or more files in the **Admin Files** tab without saving, then clicking the **Notes** tab — no unsaved-changes confirmation modal appears
- Expected behavior is a **confirmation/warning modal** alerting the user that unsaved uploaded files will be lost upon tab navigation, consistent with standard unsaved-changes guard patterns
- The issue was reproduced under the **Admin** role on the **staging** environment; the unsaved state is tied to pending file uploads that have not been committed/saved

---

**[2026-06-22]** · Tipo: `bug` · Ambiente: `staging`

- The **Complaints** module was being tested, specifically the flow from the complaints list view to an individual complaint detail page
- The triggering action is **clicking on a complaint record** in the **Complaints view** to navigate to its detail
- The issue is **role-specific**: it only reproduces when authenticated with an **Admin** role account
- The error returned is a **500 internal server error**, indicating a server-side failure when loading the complaint detail
- The complaint detail view is completely inaccessible to Admin users, suggesting a backend permission handling or data retrieval issue tied to the Admin role context

---

**[2026-06-23]** · Tipo: `bug` · Ambiente: `production`

- The bug affects the **Permit module**, specifically the edit flow for permits in **Changes Requested** status
- Key roles involved: **Admin** (used to change permit status from **Under Review** to **Changes Requested**) and **Applicant** (used via **Help Applicant** feature to edit the permit)
- The **Edit** button on a **Changes Requested** permit opens edit mode but **Step 1** loses its **CD (Construction Document) information**, and navigation between steps is blocked
- After exiting the edit flow, the permit record in the **dashboard table** loses its data entirely, indicating a data corruption or unintended save/clear operation is triggered on edit mode entry
- The **Help Applicant** feature is a context-switching mechanism allowing an Admin to act on behalf of an Applicant; the bug manifests specifically within this impersonation flow when editing multi-step permit forms

---

**[2026-06-23]** · Tipo: `bug` · Ambiente: `staging`

- The feature under test is **Permit Creation**, specifically the multi-step form where **Step 1** is the affected screen
- The bug involves the **CD dropdown** UI element on Step 1, which is expected to become enabled once the form finishes loading but instead remains permanently disabled
- The issue is **role-specific**: it only reproduces when logged in with the **Applicant** role; other roles are presumably unaffected
- The expected behavior is that the CD dropdown enables automatically upon full form load completion, suggesting a load/ready state triggers the dropdown's enabled state programmatically
- The environment is **staging**, and the defect completely blocks permit creation progress for Applicant-role users since the CD dropdown is a required Step 1 interaction

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The bug is in the **Notes And Files** module/section of the application
- The affected UI elements are the **Edit Note** option and the **Cancel button** within the note editing view
- The issue is role-specific, occurring when an **Admin** role user edits a note they personally created (own note)
- The expected flow is: Edit Note → Cancel → discard changes and return to note view without saving; instead, the edit mode remains active with no response from the Cancel button
- The bug is reproducible on the **staging** environment and requires the note creator and editor to be the same Admin account

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The bug is in the **Notes & Files** section/module within a **permit** record
- The affected UI element is the **note card**, which displays truncated text when a note is lengthy; clicking the card is expected to open it in **read mode** to show the full note content
- The flow involves two **Admin** role users: one creates a long note on a permit via Notes & Files, and a second Admin user navigates to the same permit to view it
- The failure condition is specific to **long/truncated notes** created by a different Admin user — the read mode does not trigger on click for those notes
- Relevant navigation path: Login as Admin → open permit → Notes & Files section → click truncated note card → expected read mode view

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The bug is located in the **Notes and Files** section of the application
- The issue involves the **URL / Hyperlink formatting option** accessible from the rich text editor toolbar
- The **hyperlink input popover** component overlaps or clips with the **text area editor** when the cursor is positioned at the very beginning (position 0) or at the very end of the text area
- The overlap causes the hyperlink popover to appear visually truncated ("mocho/corto"), indicating a positioning/z-index or anchor calculation issue tied to cursor position within the editor
- Relevant UI elements: text area editor, hyperlink/URL toolbar button, and the hyperlink popover component that appears upon triggering the formatting option

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The bug is located in the **Notes and Files** section of the application, accessible by admin users
- The flow involves uploading files (specifically **images** or **PDFs**) via a file upload control, before performing a save action (pre-saved/pre-persisted state)
- A **red indicator** is expected to appear on each newly uploaded file to visually distinguish files that are loaded but not yet saved ("pre-saved" state) from already-persisted files
- The acceptance criterion explicitly states: *"Newly loaded files (before saving) are shown with a red indicator"* — this is a defined UI state requirement for unsaved uploads
- The issue is reproducible on **staging** environment when logged in as an **admin** role, and the missing indicator causes newly uploaded files to appear identical to already-saved files

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The feature under test is the **Notes and Files** section, accessible by an **Admin** user role
- The specific flow involves uploading files (images or PDFs) via a file upload control **before clicking Save**, leaving them in a "pre-saved" state
- A **red indicator** is the expected visual marker for newly uploaded/pre-saved files, distinguishing them from already-saved files
- The bug is that the red indicator does not appear after upload completes — pre-saved files appear visually identical to saved files
- The acceptance criterion explicitly states: *"Newly loaded files (before saving) are shown with a red indicator"*, making this a direct failure against defined requirements

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The **Emergency** form is the feature being tested, available in two access contexts: **public view** and **authenticated view** (accessible via the **Applicant** role)
- The issue occurs at the **last section** of the form, specifically with the **Submit** button not being sticky/fixed to the viewport when scrolling to the bottom
- The **Back to Gilly** button serves as the reference for correct behavior — it is already implemented as a fixed/sticky element and the **Submit** button should match this behavior
- The bug affects both the **public** and **authenticated (Applicant role)** flows of the Emergency form, suggesting it is a shared UI component or layout issue
- Relevant UI elements: **Submit** button, **Back to Gilly** button, bottom navigation/footer area of the Emergency form

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The bug affects the **Dashboard** screen, specifically the **All Permits** tab within the dashboard table, tested under the **Applicant** role
- Other tabs on the same dashboard (**In Progress** and **Emergencies**) correctly display permits dated June 24, 2026, confirming the records exist but are missing or misordered in **All Permits**
- The issue is a **sorting/ordering defect**: the **All Permits** tab on **page 1** does not display records from most recent to oldest, causing today's permits to not appear on the first page
- The expected sort order for the **All Permits** tab is **descending by date** (newest first), consistent with how other tabs surface the most recent records
- Role-specific behavior is relevant — the defect was reproduced under the **Applicant** role, and other roles may need separate verification

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The feature being tested is **Admin Files**, located within the **CD/Agency Use** section, accessible via a dedicated **Admin Files** tab
- Two distinct validation failures were identified in the file upload flow: (1) invalid non-video files (e.g., `.html`) are silently rejected with **no error message displayed**, and (2) video files (e.g., `.avi`, `.mov`) are incorrectly **accepted and uploaded successfully**
- Per feature specification, the **Admin Files uploader** should only accept **images and PDF** file types, rejecting all other formats with a clear validation error message
- The bug involves missing **client-side or server-side file type validation feedback** and an incorrect **allowlist configuration** that permits video file formats

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The bug is located in the **Notes and Files** section, specifically within the **Admin Files** tab
- The tested flow involves **file upload functionality**, where users select and upload files either simultaneously or sequentially
- The enforced business rule requires a **maximum of 5 files** upload limit on the Admin Files tab, which is not being validated
- The upload limit validation is absent both for **bulk selection** (selecting more than 5 at once) and **sequential uploads** (adding files one by one beyond the limit)
- Testing was performed on the **staging environment**, and the current behavior allows unlimited file uploads without any rejection or warning

---

**[2026-06-24]** · Tipo: `bug` · Ambiente: `staging`

- The bug occurs in the **Permit** module, specifically when accessed by users with the **Agency** role
- The **CD/AGENCY US** button is a navigation/action element inside a permit detail view that is expected to load the **Notes and Admin Files** view
- Clicking **CD/AGENCY US** triggers an HTTP **404 error**, meaning the underlying endpoint or route it calls does not resolve correctly under the Agency role context
- The **Notes and Admin Files** view is a sub-section within permits, accessible (or expected to be accessible) via the CD/AGENCY US button
- The issue may be role-specific, suggesting the endpoint or resource path tied to **CD/AGENCY US** may not be properly configured or permissioned for the **Agency** role in the staging environment

---

**[2026-06-25]** · Tipo: `bug` · Ambiente: `staging`

- The bug is in the **CD/Agency Use** tab/view within the permit detail screen
- The affected UI elements are the **Notes** and **Attachments** sections displayed inside the CD/Agency Use tab
- The issue is role-based: users with the **Agency** role cannot see Notes or Attachments that are already associated with a permit, while users with the **Admin** role can see them correctly
- The view loads without errors for the Agency role, indicating the content is being silently filtered or not fetched rather than causing a visible failure
- Key navigation path: Login as Agency role → open an existing permit → open **CD/Agency Use** tab → Notes and Attachments sections appear empty despite having data

---

**[2026-06-25]** · Tipo: `bug` · Ambiente: `staging`

- The bug occurs in the **Notes and Admin Files** module, specifically within the **permit** detail view
- Navigation path involved: **Notes and Admin Files** → open a permit → **CD/Agency** section → **CD/Agency Use** tab
- The **Submit button** exhibits unintended floating/fixed positioning behavior, causing it to remain visually anchored while the rest of the form scrolls (likely a CSS `position: fixed` or `position: sticky` issue)
- The visual defect is triggered by **scrolling up** within the **CD/Agency Use** form, at which point form elements render behind the Submit button
- The expected behavior is that the Submit button participates in the normal document flow, with no z-index or positioning overlap with other form elements during scroll

---

**[2026-06-25]** · Tipo: `bug` · Ambiente: `staging`

- The bug occurs in the **Note and Admin files** module, specifically within the **Permit** screen
- The issue is triggered by clicking the **CD/AGENCY USE button**, which opens a side panel (form panel) on the right side of the screen
- Affected UI elements are the **status Badges** and the **permit Steps** component, which visually overlap/collide when the CD/AGENCY USE panel is open simultaneously
- The problem is layout/responsive specific, reproducible only when simulating **iPad Pro** viewport (tablet breakpoint) via browser DevTools responsive mode
- The overlap suggests a CSS layout conflict — likely insufficient space management or z-index/flex/grid misalignment when the side panel is rendered alongside the Steps section at tablet screen widths

---

**[2026-06-25]** · Tipo: `bug` · Ambiente: `staging`

- The **Notes** and **Admin Files** modules were being tested, specifically the note editing and saving functionality
- The feature involved adding **hyperlinks** (enlaces/hipervínculos) to selected words or phrases within a note's rich text editor
- The bug occurs when clicking a saved hyperlink: the app incorrectly concatenates its own **base URL** with the **target URL** (e.g., `https://app.staging.com/https://example.com`) instead of navigating directly to the target URL
- The root cause is likely a missing protocol check or relative URL handling in the link-rendering logic — external URLs without proper routing treatment get prefixed with the app's base path
- Affected environment is **staging**; the expected behavior is that clicking a hyperlink opens the exact URL entered by the user in the editor

---

**[2026-06-26]** · Tipo: `bug` · Ambiente: `staging`

- The module under test is the **Emergency form**, specifically comparing the **public (unauthenticated) version** at `/emergency` versus the **authenticated Applicant version**
- The map component is the primary UI element involved; expected behavior includes rendering **CD (Conservation District) boundary overlays** visually demarcating each CD within the map
- A key interactive flow is **clicking a location on the map to drop a pin**, which should trigger **automatic population of the Conservation District dropdown** with the corresponding CD based on the pin's geographic position
- The bug manifests as two distinct failures on the public form: (1) **CD boundary overlays are not rendered**, making districts indistinguishable on the map, and (2) **the Conservation District dropdown auto-selection does not function** when a map location is selected
- The **Conservation District dropdown** is a form field expected to sync with map interaction; the authenticated Applicant experience serves as the reference/baseline for correct behavior

---

**[2026-06-26]** · Tipo: `bug` · Ambiente: `staging`

- The **Complaint Form** feature was being tested, accessible via the `/complaints` route on the staging environment
- The issue occurs specifically for **unauthenticated (logged out) users** attempting to access the public-facing form directly via URL navigation
- The page fails to load entirely, displaying an error instead of rendering the Complaint form — the form is completely inaccessible in this state
- This is a **public route** intended for citizens to report unauthorized activities, meaning no authentication should be required to access it
- The bug was reproduced by navigating directly to `/complaints` while logged out, suggesting a possible authentication state check or session-dependent initialization error on page entry

---

**[2026-06-26]** · Tipo: `bug` · Ambiente: `staging`

- The bug involves the **Permit Creation** module, specifically the multi-step stepper flow (Steps 1 through 5) accessible via the **"Apply for permit"** button under the **Applicant** role
- The critical UI elements involved are the **Submit** button on **Step 5** (final step) and the **mandatory fields/file attachments** that must be completed across all steps before submission
- The expected post-submission flow advances the user to a **Preview/Signature** step, indicating permit creation uses a staged flow: stepper → Preview → Signature
- A key symptom is that each failed Submit attempt silently creates empty **duplicate permit records** in **"In Progress"** status, visible in the Applicant's main permit list view, suggesting the creation call fires but the navigation/completion logic fails
- No network errors were detected in Chrome DevTools, pointing to a **frontend state management or event handling issue** (e.g., silent failure in form validation, submission handler, or step transition logic) rather than a backend/API problem

---

**[2026-06-26]** · Tipo: `bug` · Ambiente: `staging`

- The feature being tested is **Notes and Admin Files**, specifically the attached files panel within this section
- The UI element involved is a **red notification dot** displayed on attached files, which serves as a visual indicator intended exclusively for the **Admin role**
- The bug involves incorrect **role-based visibility logic**: the red notification dot is being rendered for users with the **Agency role**, when it should be restricted to Admin roles only
- The issue was reproduced in the **staging environment** by logging in with an Agency role account and navigating to the Notes and Admin Files section
- Key application concepts include role differentiation between **Admin** and **Agency** roles, where certain UI indicators (red dot) are meant to be conditionally rendered based on user role permissions

---

**[2026-06-26]** · Tipo: `bug` · Ambiente: `staging`

- The bug affects the **Applicant Dashboard**, specifically the **In Progress** tab and **All Permits** tab under the permit listing section
- The flow involved is: logging in as **Applicant** role → clicking **"Apply for permit"** → completing the permit creation stepper → selecting a **CD (Community District) other than Gallatin** → signing and submitting the permit
- The filtering logic for the **In Progress** tab should display all permits whose status is **not superior to "Ready for CD"**; statuses that should exclude a permit from In Progress are: **Approved, Rejected, Denied, and Approved w/ Modifications**
- The bug is CD-specific: permits created with **Gallatin** as the CD appear correctly in **In Progress**, while permits with any **non-Gallatin CD** are incorrectly routed to **All Permits** only
- Confirmation from stakeholder (Matias) establishes the business rule: newly created permits must appear in **In Progress** regardless of the selected CD, as long as their status falls below the **Ready for CD** threshold

---

**[2026-06-26]** · Tipo: `bug` · Ambiente: `staging`

- The bug occurs in the **Permit Creation** flow within the **Applicant** role, specifically when creating a **Joint Application** using the multi-step permit form (stepper)
- The steps involved are: **Step 1** (Conservation District selection), **Step 2** (Applicant Information), and **Step 3** (Project Information); the issue triggers upon exiting the form at Step 3 without filling any fields
- The **"In Progress"** tab in the Applicant dashboard view is where duplicate permit draft cards appear, all sharing the same **Conservation District (CD)** selected in Step 1
- The duplication pattern suggests each step navigation may be triggering a separate draft save/creation call, resulting in as many duplicate records as the number of steps visited (e.g., visiting 3 steps produces 3 draft entries)
- The exit action (navigating back to the dashboard or closing the stepper) appears to be the trigger that surfaces the duplicated drafts, indicating a potential issue with draft persistence logic or unguarded POST/save calls on step transitions

---

**[2026-06-26]** · Tipo: `bug` · Ambiente: `staging`

- The report was submitted in the **staging environment** and lacks specific module or screen identification
- No concrete UI elements, button names, field names, or navigation paths were referenced in the original submission
- The bug description contains placeholder/test content ("Esto es una prueba"), indicating the report was not completed with real issue details
- No evidence was provided (no JAM recordings, screenshots, or external links); follow-up is required to capture actual failure symptoms
- The report template references generic steps (navigate → interact → observe unexpected behavior) without specifying the affected feature, endpoint, or application state
