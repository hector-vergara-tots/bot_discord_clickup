# Application Context — 4C Platform

## What is 4C?
4C is an environmental control platform for residents in the United States who live near natural areas. Its purpose is to ensure that any construction or improvement project in sensitive zones is reviewed and approved before execution, committing residents to preserve and renew their environment. The platform is managed through Conservation Districts (CD).

> **Key term — CD (Conservation District):** The territorial unit through which all permits, inspections, and reports are organized. Currently only **Gallatin** CD is operational.

---

## Public Area (no login required)

### /emergency
Form for reporting an environmental emergency that requires immediate intervention without prior authorization.
- Fields: reporter name, state, CD, emergency location (map), time of occurrence, evidence attachments
- The form includes a **signature step** at the end before submission (available to unauthenticated users)
- Upon successful submission: displays a success message and triggers a form download
- Use case: a resident must intervene urgently due to a natural event

### /complaints
Form for reporting that someone is performing construction or improvements without prior authorization.
- Fields: state, CD, location (map)
- Upon successful submission: displays a success message and triggers a form download
- Use case: a neighbor or citizen reports an unauthorized activity

### Notifications (Public submissions)
Both public forms (/emergency and /complaints) trigger **two simultaneous email notifications** upon successful submission:
1. To the **CD Admin**, informing them of the new report
2. To the **email address** manually entered by the submitter in the form

---

## Private Area (requires login)

### Roles

#### Applicant
* **Main Dashboard:**
    * **In Progress Tab:** Displays permits as individual cards. Each card includes a mini-map with georeferenced location, stream name, current status, applicant/landowner info, and the last update date.
    * **All Permits Tab:** A centralized table view for mass data management. Features include a global search input, a "Filters" button, and action buttons for duplicating or printing permits.
    * **Table Controls:** All columns in the table view support ascending and descending sorting.
    * **Advanced Filtering:** Permits can be filtered by Submission Date, Status (e.g., Under Review, Pending Inspection, Ready for CD), and Conservation District (CD).

* **Permit Creation (Joint Application):**
    * Triggered by the **"Apply for permit"** button. It is a guided **Stepper** process where each step has minimum required fields.
    * **Autosave behavior:** The form autosaves every **5 seconds of inactivity**, persisting the draft in the background silently without interrupting user interaction (e.g., without stealing focus from active input fields).
    * **Draft re-entry:** When a user returns to an in-progress draft, the form should navigate directly to the **last step where changes were made**.
    * **Step navigation:** When advancing or going back between steps, the page should **automatically scroll to the top** of the new step.
    * **Dropdown behavior:** All dropdown fields include an **arrow button on the right side** that should open the options list, identical in behavior to clicking the field itself. Affected dropdowns include CD selection (Step 1) and Stream selection (Step 3).

    * **Step 1 (Conservation District):** Selection of the target district; includes links to external mapping tools for assistance.

    * **Step 2 (Applicant Information):** Personal and contact data.
        * Contains a checkbox **"Landowner is the same as applicant"** which is **checked by default**.
        * When checked, the **Landowner Information fields must auto-populate** with the applicant's data and persist correctly through the permit creation and signing process.

    * **Step 3 (Project Information):** Technical details of the proposal.
        * Contains a **Stream selection dropdown** and an **Address field** for manual entry.
        * **Geoservice integration:** Moving the map pin automatically updates the Address field with the corresponding location. Both the address and the pin position must be correctly persisted by the autosave cycle.

    * **Step 4 (Construction):** Specifics regarding the construction or intervention.
        * Contains a **MATERIALS section** with multiple text input fields.
        * The autosave cycle must run silently and **must not steal focus** from any active input field while the user is typing.

    * **Step 5 (Project Files & Comments):** Mandatory document uploads and additional notes.
        * Contains multiple **dropzone components**, one per file category.
        * The **Submit button is only enabled** once all mandatory file attachments have been successfully uploaded.
        * This step is a "blocker"; submission is impossible without the required attachments.

* **Submission & Signature Workflow:**
    * After the Stepper, a **Preview** of the completed form is displayed. The user can print it or click "Continue" to proceed to the signature phase.
    * **Signature Options:**
        * **Manual Signature:** Downloads the pre-filled PDF for the user to print, sign by hand, scan/photograph, and re-upload to the platform.
        * **Digital Signature:** Provides an online canvas with three modes: **Typed** (text-based), **Draw** (manual stroke), or **Upload** (image of a physical signature).
    * Upon clicking **"Sign"**, the permit is successfully created, and the user can return to the dashboard via a "Go to permits" button.

* **Copy/Duplicate Functionality:**
    * Users can clone an existing permit using the "duplicate" icon in the card or table view.
    * **Data Persistence:** Information from Steps 1 through 4 is pre-filled automatically in the new form.
    * **Exclusions:** **Attachments (Step 5) are NOT duplicated**. If a user attempts to submit a duplicated permit without new files, Step 5 is highlighted in red, and an error modal appears.

* **Notifications:**
    * Every successful submission triggers **two simultaneous email notifications**:
        1. To the **CD Admin** informing them of the new request for review.
        2. To the **Email Address** manually entered by the applicant within the form data.

* **Initial State:** All newly created or signed permits automatically enter the **"Under Review"** status. Permits are displayed in the dashboard ordered from newest to oldest.

---

#### Admin
- Main view: dashboard with a table of all permits and emergencies, divided into tabs by status
- Key tabs: permits by status (e.g., Pending, Reviewed, etc.) + **Emergency** tab (receives public emergency forms)
- **Complaints** section: accessible from the header (not the main dashboard), visually similar to the emergencies table
- Can inspect (view full detail) of any permit, emergency, or complaint
- Can manage and change the status of permits
- Can move permits to **Pending Inspection** status so they appear in the **Reviewed** tab
- Can assign permits to an Inspector from the Reviewed tab
- Can also perform and finalize inspections directly from their own module (same as Inspector)

* **Help Applicant:**
    * A dedicated section accessible to the Admin role
    * Allows Admin to **create a permit on behalf of an Applicant**, using the same permit creation stepper flow
    * Displays its own **permit list** showing permits created through this section
    * After completing the permit creation flow and returning to Help Applicant, the permit list should **automatically refresh** to include the newly created permit without requiring a manual page reload

---

#### Inspector
- Receives permits assigned by Admin and conducts field inspections to determine if the project is viable
- Upon login, is presented with a **table listing all permits** assigned to them (both pending and already inspected)
- Can use the platform in three modes:
  - **Web** (standard desktop browser)
  - **Responsive** (mobile browser)
  - **PWA** (Progressive Web App) — available for Android and iOS, **exclusive to the Inspector role**, with two sub-modes:
    - **Online**: normal operation with connectivity
    - **Offline**: works without internet, syncs data when connectivity is restored
- See **[Inspection Module](#inspection-module)** below for full detail on the inspection flow, tabs, step behavior, and platform coverage.

---

#### Agency
- Has the same view as Admin
- Read-only access: cannot modify, manage, or change the status of anything

---

#### Historical Data (Admin only)
- Allows Admin to manually enter permits that were created before the application existed (legacy permits)
- Uses the same form as the Applicant permit form, but with fewer required fields
- Contains an additional feature: PDF upload of a manually filled legacy form (scanned document)
- The platform uses AI to parse the scanned PDF and map its data to the current application form fields automatically
- **Autosave behavior** (same 5-second rule as the Applicant form applies here)
- A **confirmation modal** should appear if the user navigates away before the autosave cycle has completed, to prevent data loss
- Important context for bug reporting: a "Permit" can originate from two sources:
  1. Created by an Applicant through the normal multi-step form
  2. Created by Admin through Historical Data (manually or via PDF scan)
- Bugs in this module may involve: form validation differences vs Applicant form, AI field mapping errors from PDF, or missing data from legacy records

---

## Permit Detail View

When a permit is opened from any dashboard (Admin, Inspector, Agency), it displays the full permit information. From this view, additional modules may be accessible depending on the user's role and the permit's current status.

### CD/AGENCY USE Form
- Accessible from the **permit detail view header**, via a dedicated button displayed at the same level as the permit status badge
- Available to **Admin role** users
- Contains data entry fields specific to the CD or agency review process
- The **Back button** should return the user to the parent permit detail view
- More functional context will be added as the feature is further developed and tested

---

## Inspection Module

### Access paths
- **Admin:** Opens the permit detail of a permit in **Pending Inspection** status and navigates to the Inspection tab
- **Inspector:** Logs in and is presented with a **table listing all permits** assigned to them (pending and completed inspections). Selects a permit to begin or review an inspection.

### Permit detail tabs (during inspection)
When a permit is opened in the context of an inspection, two tabs are available:

* **Permit tab:** Read-only view of the full permit information — same visualization available to Admin. Includes the **permit status badge** and a **Download PDF button** accessible to all roles including Inspector.

* **Inspection tab:** The active inspection workspace. Contains a **multi-step form** (at least 5 steps) for completing the inspection.

### Inspection form — step behavior
- **Step indicators** at the top of the form display in **red** when a required field has been left empty and the user has advanced to the next step. This state must persist until the field is filled.
- **Footer navigation** contains **back and forward arrow buttons** for sequential step traversal:
  - On the **first step**: only the forward arrow is visible
  - On the **last step**: only the back arrow is visible
- Steps can also be navigated via the **step dots/tabs in the header**

### Key inspection interactions
- **Step 1** contains the question: **"Does this project need an inspection?"**
  - Selecting **"No"** should immediately enable the **Sign & Finish** button, allowing the inspector to complete the workflow without filling out the physical inspection steps
  - The Inspection Form header should display a dedicated **icon for "See Assigned Inspectors"** (not buried in an options menu)
- **Step 2** contains a **map component** showing the permit's location pin
- **Step 3** contains a **map view** — the pin must reflect the permit's **original creation coordinates**

### Permit status lifecycle (inspection)
- Before inspection begins: permit status is **Pending Inspection**
- During inspection: **In Progress**
- After successful inspection submission: **Completed**

### Platform coverage
The Inspection module must be tested and function correctly across:
- Web desktop (Admin and Inspector)
- Mobile browser — responsive (Inspector)
- PWA installed app (Inspector only):
  - **Online mode**: full functionality
  - **Offline mode**: data is queued locally and synced when connectivity is restored; map tiles must be cached by the service worker so they render without internet

---

## Complaints Module (Private — Admin)

### Complaints list
- Accessible from the **main navigation header** (not the dashboard)
- Displays a table of all submitted complaints, including those submitted from the public `/complaints` form

### Complaint detail view
- Organized as a **multi-step wizard with at least 5 steps**
- Has two modes:
  - **View-only mode:** for visualizing an already-created complaint — validation logic should NOT trigger in this mode
  - **Inspection/edit mode:** for reviewing or updating complaint data; **autosave (5-second rule)** applies here
- In inspection/edit mode, navigating away with unsaved changes should trigger a **confirmation modal** with a **"Save and Leave"** option
- Attached files and evidence should render correctly during step transitions in view mode

---

## Key modules summary

| Module | Role | Description |
|---|---|---|
| Emergency (public) | Public | Report urgent environmental interventions |
| Complaints (public) | Public | Report unauthorized activities |
| Permit form | Applicant | Multi-step form to request a construction/improvement permit |
| Admin dashboard | Admin | Central table with tabs by permit status |
| Help Applicant | Admin | Create permits on behalf of applicants; has its own permit list |
| CD/AGENCY USE form | Admin | Data entry form accessible from permit detail header |
| Complaints (private) | Admin / Agency | Management and review of reported complaints |
| Inspection module | Admin / Inspector | Field inspection management, online and offline via PWA |
| Agency view | Agency | Read-only view of Admin dashboard |
| Historical Data | Admin | Manual entry and PDF scan of legacy permits created before the platform existed |

---

## Important notes for bug reporting and test case generation
- When a bug is reported in the **PWA**, always clarify whether it occurred in **Online** or **Offline** mode and on which device (**Android** or **iOS**)
- The **Offline mode** has specific sync behavior: data is queued locally and sent to the server when connectivity is restored — bugs in this area often involve data loss or incorrect sync; map tiles must be available from service worker cache
- The **Gallatin CD** is the only active one; any bug related to CD selection likely involves this district
- The permit workflow is sequential and stateful — a bug in one step may affect subsequent steps
- **Admin and Inspector share inspection functionality** — a bug may affect both roles or only one
- **Agency** should never be able to modify data — any write action from this role is a bug by definition
- **Autosave (5-second rule)** applies to: Permit Creation (Applicant), Historical Data (Admin), and Complaint inspection/edit mode (Admin) — bugs in any of these modules may relate to autosave timing, focus management, or data persistence
- The **Inspection module** must be tested across all platforms: web desktop, mobile browser, and PWA (online + offline)

---

## System notifications

### In-app refresh notification
- When a new application version or deployment is available, an **in-app notification** alerts authenticated users to refresh
- Once a user dismisses or confirms this notification in one browser tab, it must **not reappear in other tabs** of the same authenticated session
- Expected mechanism: cross-tab state synchronization (e.g., BroadcastChannel API or shared storage flags)

### Email notifications
Triggered automatically upon the following events:

| Event | Recipients |
|---|---|
| Applicant submits a permit | CD Admin + email entered in the permit form |
| Public Emergency form submitted | CD Admin + email entered in the form |
| Public Complaint form submitted | CD Admin + email entered in the form |

> More notification scenarios will be documented as the feature is further defined and tested.
