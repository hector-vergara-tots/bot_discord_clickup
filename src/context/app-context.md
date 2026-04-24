# Application Context — 4C Platform

## What is 4C?
4C is an environmental control platform for residents in the United States who live near natural areas. Its purpose is to ensure that any construction or improvement project in sensitive zones is reviewed and approved before execution, committing residents to preserve and renew their environment. The platform is managed through Conservation Districts (CD).

> **Key term — CD (Conservation District):** The territorial unit through which all permits, inspections, and reports are organized. Currently only **Gallatin** CD is operational.

---

## Public Area (no login required)

### /emergency
Form for reporting an environmental emergency that requires immediate intervention without prior authorization.
- Fields: reporter name, state, CD, emergency location (map), time of occurrence, evidence attachments
- Use case: a resident must intervene urgently due to a natural event

### /complaints
Form for reporting that someone is performing construction or improvements without prior authorization.
- Fields: state, CD, location (map)
- Use case: a neighbor or citizen reports an unauthorized activity

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
    * **Step 1 (Conservation District):** Selection of the target district; includes links to external mapping tools for assistance.
    * **Step 2 (Applicant Information):** Personal and contact data.
    * **Step 3 (Project Information):** Technical details of the proposal.
    * **Step 4 (Construction):** Specifics regarding the construction or intervention.
    * **Step 5 (Project Files & Comments):** Mandatory document uploads and additional notes. This step is a "blocker"; submission is impossible without these attachments.

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
        1.  To the **CD Admin** informing them of the new request for review.
        2.  To the **Email Address** manually entered by the applicant within the form data.

* **Initial State:** All newly created or signed permits automatically enter the **"Under Review"** status. Permits are displayed in the dashboard ordered from newest to oldest.

#### Admin
- Main view: dashboard with a table of all permits and emergencies, divided into tabs by status
- Key tabs: permits by status (e.g., Pending, Reviewed, etc.) + **Emergency** tab (receives public emergency forms)
- **Complaints** section: accessible from the header (not the main dashboard), visually similar to the emergencies table
- Can inspect (view full detail) of any permit, emergency, or complaint
- Can manage and change the status of permits
- Can move permits to **Pending Inspection** status so they appear in the **Reviewed** tab
- Can assign permits to an Inspector from the Reviewed tab
- Can also perform and finalize inspections directly from their own module (same as Inspector)

#### Inspector
- Receives permits assigned by Admin
- Conducts field inspections to determine if the project is viable
- Can use the platform in three modes:
  - **Web** (standard browser)
  - **Responsive** (mobile browser)
  - **PWA** (Progressive Web App) — available for Android and iOS, with two sub-modes:
    - **Online**: normal operation with connectivity
    - **Offline**: works without internet, syncs data when connectivity is restored

#### Agency
- Has the same view as Admin
- Read-only access: cannot modify, manage, or change the status of anything

#### Historical Data (Admin only)
- Allows Admin to manually enter permits that were created before the application existed (legacy permits)
- Uses the same form as the Applicant permit form, but with fewer required fields
- Contains an additional feature: PDF upload of a manually filled legacy form (scanned document)
- The platform uses AI to parse the scanned PDF and map its data to the current application form fields automatically
- Important context for bug reporting: a "Permit" can originate from two sources:
  1. Created by an Applicant through the normal multi-step form
  2. Created by Admin through Historical Data (manually or via PDF scan)
- Bugs in this module may involve: form validation differences vs Applicant form, AI field mapping errors from PDF, or missing data from legacy records

---

## Key modules summary

| Module | Role | Description |
|---|---|---|
| Emergency (public) | Public | Report urgent environmental interventions |
| Complaints (public) | Public | Report unauthorized activities |
| Permit form | Applicant | Multi-step form to request a construction/improvement permit |
| Admin dashboard | Admin | Central table with tabs by permit status |
| Complaints (private) | Admin / Agency | Management and review of reported complaints |
| Inspection module | Admin / Inspector | Field inspection management, online and offline via PWA |
| Agency view | Agency | Read-only view of Admin dashboard |
| Historical Data | Admin | Manual entry and PDF scan of legacy permits created before the platform existed |

---

## Important notes for bug reporting and test case generation
- When a bug is reported in the **PWA**, always clarify whether it occurred in **Online** or **Offline** mode and on which device (**Android** or **iOS**)
- The **Offline mode** has specific sync behavior: data is queued locally and sent to the server when connectivity is restored — bugs in this area often involve data loss or incorrect sync
- The **Gallatin CD** is the only active one; any bug related to CD selection likely involves this district
- The permit workflow is sequential and stateful — a bug in one step may affect subsequent steps
- **Admin and Inspector share inspection functionality** — a bug may affect both roles or only one
- **Agency** should never be able to modify data — any write action from this role is a bug by definition