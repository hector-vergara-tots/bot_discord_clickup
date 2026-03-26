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
- Creates permit requests through a multi-step form (5–6 steps)
- Step 1: Select CD (currently only Gallatin is available)
- Intermediate steps: project details and required information
- Final step: document upload
- Last action: sign the permit (manual or digital signature) to submit it

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