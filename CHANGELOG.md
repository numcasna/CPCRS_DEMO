# Project Change Log — Cross-Project Code Review (CPCR)

## Entry 1: Seed Data & Developer 2 Addition (TDD)
- **Date/Timestamp**: 2026-10-31
- **Author**: Antigravity (Pair Programming with User)

### Files Changed / Added:

#### 1. `backend/seed.py`
- **Lines Changed**: Lines 6, 21, 29-33, 44
- **Modifications**:
  - Added documentation for Developer 2 credentials: `developer2@test.com / Dev2Test@2026`.
  - Added deterministic query and insertion for `developer2@test.com` with role `UserRole.developer` and Argon2 password hashing.
  - Included `dev2.id` in the `project_members` insertion loop for project `"Demo Code Review"`.
- **Functionality Changed**:
  - Seeding the database now provisioned two developers (`developer@example.com` and `developer2@test.com`).
  - `developer2@test.com` can log in via `/auth/login` and has access to `"Demo Code Review"` and its findings as a project member.

#### 2. `backend/test_seed.py` (New Unit Test File)
- **Modifications**:
  - Implemented unit tests under `unittest.TestCase`:
    - `test_developer2_is_seeded`: Asserts that `developer2@test.com` exists, role is `developer`, Argon2 password hash validates with `Dev2Test@2026`, and user is a member of `Demo Code Review`.
    - `test_existing_seed_users_remain_intact`: Asserts that `admin@example.com` and `developer@example.com` continue to verify with their original passwords.
    - `test_developer2_api_login`: Uses FastAPI's `TestClient` to perform a real end-to-end HTTP request against `POST /auth/login` asserting status 200, JWT token receipt, and developer role in response.
- **Functionality Added**:
  - TDD regression suite for testing seed data and authentication.

---

## Entry 2: Project Findings Table, Member Names & Clickable Developer Profile (TDD)
- **Date/Timestamp**: 2026-10-31
- **Author**: Antigravity (Pair Programming with User)

### Files Changed:

#### 1. `backend/app/api/routes/users.py`
- **Lines Changed**: Lines 60, 89
- **Modifications**:
  - Changed authorization dependency on `GET /users/{user_id}` and `GET /users/{user_id}/contributions` from `require_admin` to `get_current_user`.
- **Functionality Changed**:
  - Developers and project members can now view team member profile details and contribution workloads/timelines across the application.

#### 2. `backend/test_seed.py`
- **Modifications**:
  - Added unit test `test_developer_can_view_member_profile_and_contributions` asserting that a non-admin developer user can query `/users/{id}` and `/users/{id}/contributions` without receiving 403 Forbidden.

#### 3. `frontend/Cross_Project_Code_Review-main/src/context/DataContext.jsx`
- **Lines Changed**: `normalizeFinding`
- **Modifications**:
  - Added backward-compatible aliases in normalized finding objects: `project: finding.project_id`, `repository: finding.repository_id`, `assignee: finding.assignee_id`, and `reviewer: finding.reviewer_id`.
- **Functionality Changed**:
  - Fixes finding filtering and assignee lookups across all project views without breaking components expecting legacy properties.

#### 4. `frontend/Cross_Project_Code_Review-main/src/pages/user/UserProjectDetail.jsx`
- **Modifications**:
  - Connected `users` from `useData()` and implemented `findUser(userId)` helper.
  - Replaced broken `f.project === project.id` filter with `String(f.projectId || f.project_id || f.project) === String(project.id)`, populating the Project Findings count and "All Project Findings" table.
  - Replaced exposed raw member UUIDs (`? <uuid>`) with member avatars and real names.
  - Converted member chips into clickable buttons routing to `/user/users/${memberId}`.
  - Replaced `—` for Project Lead with the resolved user's display name.
  - Updated finding table links to navigate to `/user/findings/${f.backendId || f.id}`.

#### 5. `frontend/Cross_Project_Code_Review-main/src/pages/admin/ProjectDetail.jsx`
- **Modifications**:
  - Updated finding filter to check `f.projectId || f.project_id || f.project`.
  - Looked up project lead and assignee names from `users`.
  - Fixed member entries to fallback cleanly if user record is resolving.

#### 6. `frontend/Cross_Project_Code_Review-main/src/App.jsx`
- **Modifications**:
  - Registered `<Route path="users/:id" element={<DeveloperProfile />} />` under the `/user` protected route group.
- **Functionality Changed**:
  - Developer users can access `/user/users/:id` to inspect member contributions, resolution history, workload, and activity timelines.

#### 7. `frontend/Cross_Project_Code_Review-main/src/pages/admin/DeveloperProfile.jsx`
- **Modifications**:
  - Added `useAuth` hook integration.
  - Updated `openFinding(findingId)` to navigate to `/user/findings/${id}` when logged in as a developer and `/admin/findings/${id}` when logged in as an admin.
  - Added safe `handleBack` routing back to the originating project.

#### 8. `frontend/Cross_Project_Code_Review-main/src/index.css`
- **Modifications**:
  - Added button chip styling, hover states, and smooth transition to `.member-list button`.

---

## Entry 3: Attachment Pop-Up Preview & Admin/User Segregation (TDD)
- **Date/Timestamp**: 2026-10-31
- **Author**: Antigravity (Pair Programming with User)

### Files Changed:

#### 1. `backend/app/api/routes/findings.py`
- **Lines Changed**: `attachment_metadata`, `upload_finding_attachment`, `list_finding_attachments`
- **Modifications**:
  - Enriched `attachment_metadata` response with `uploader_role` (`admin` or `developer`) and `uploader_name`.
  - Added eager loading of `FindingAttachment.uploader` via `selectinload` in `list_finding_attachments`.
- **Functionality Changed**:
  - The API explicitly returns uploader role and name for each attachment, enabling the frontend to reliably segregate admin and user attachments.

#### 2. `backend/test_seed.py`
- **Modifications**:
  - Added unit test `test_attachment_uploader_info_and_segregation` asserting that an uploaded attachment contains `uploader_role` and `uploader_name`, and that the finding attachments list provides role data for segregation. All 5 test cases pass.

#### 3. `frontend/Cross_Project_Code_Review-main/src/pages/admin/FindingDetail.jsx`
- **Modifications**:
  - Segregated attachments into two distinct sections: **Admin Attachments** and **User Attachments** based on `uploader_role`.
  - Replaced immediate direct download on attachment click with an **Attachment Preview Modal (pop-up)**.
  - Modal features full image preview, PDF viewer, filename, file size, uploader role/name, date, close button (`✕` and ESC key), and an optional download button inside the modal.
  - Added "+ Add Attachment" file upload action directly in the Admin Attachments header.

#### 4. `frontend/Cross_Project_Code_Review-main/src/pages/user/UserFindingDetail.jsx`
- **Modifications**:
  - Fixed bug where attachments submitted during developer review were lost (now uploads native `File` objects to `POST /findings/{id}/attachments` with `attachment_kind: "resolution"` before status transition).
  - Segregated attachments into **Admin Attachments** and **User Attachments**.
  - Replaced immediate download with the **Attachment Preview Modal (pop-up)**.
  - Added "+ Add Attachment" file upload action in the User Attachments header for uploading verification files at any time.

#### 5. `frontend/Cross_Project_Code_Review-main/src/index.css`
- **Modifications**:
  - Added styling and keyframe animations for the attachment modal backdrop, modal card, header, body preview container, footer, and interactive attachment cards (`.modal-backdrop`, `.modal-card`, `.attachment-card-item`).

---

## Entry 4: Fix UserFindingDetail Blank Screen Crash & Finding Accepted Date Normalization (TDD)
- **Date/Timestamp**: 2026-10-31
- **Author**: Antigravity (Pair Programming with User)

### Files Changed:

#### 1. `backend/test_seed.py`
- **Modifications**:
  - Added unit test `test_developer_can_accept_open_finding` asserting that a developer can accept an open finding (`PATCH /findings/{id}/status` to `"In Progress"`), and that `GET /findings/{id}/history` records the status transition timestamp (`changed_at`).
  - All 6 backend unit tests pass cleanly.

#### 2. `frontend/Cross_Project_Code_Review-main/src/pages/user/UserFindingDetail.jsx`
- **Modifications**:
  - Restored missing `findingLabel`, `dueDate`, and `createdDate` declarations in component scope before render. Previously, accessing `findingLabel` threw a fatal `ReferenceError`, unmounting the React tree and rendering a blank white screen upon opening any finding.
  - Added safe date parsing guard (`!isNaN(new Date(finding.acceptedDate).getTime())`) for `acceptedDate`.
- **Functionality Changed**:
  - Developers can now click and open any finding from `/user/findings` without the screen going blank.
  - Finding label, due date, created date, and accept action banner all render reliably.

#### 3. `frontend/Cross_Project_Code_Review-main/src/context/DataContext.jsx`
- **Modifications**:
  - Updated `normalizeFinding` to map `acceptedDate` from `finding.accepted_at`, `finding.accepted_date`, `status_history` (`new_status === 'In Progress'`), or `updated_at` if the finding has been accepted/worked on.
- **Functionality Changed**:
  - Findings that are accepted will now display their valid acceptance timestamp rather than defaulting to "Not accepted".
  - Open findings intentionally continue to display "Not accepted" until accepted by the developer.

#### 4. `frontend/Cross_Project_Code_Review-main/src/pages/user/UserFindings.jsx`
- **Modifications**:
  - Safeguarded `acceptedDate` formatting against invalid date values (`!isNaN(new Date(...).getTime())`).

---

## Entry 5: Fix Attachment Segregation by Resolution Kind & Auth State Persistence (TDD)
- **Date/Timestamp**: 2026-10-31
- **Author**: Antigravity (Pair Programming with User)

### Files Changed:

#### 1. `backend/test_seed.py`
- **Modifications**:
  - Added unit test `test_demo_developer_attachment_submission_and_segregation` asserting that Demo Developer (`developer@example.com`) can upload a resolution attachment, that response includes `uploader_role == "developer"`, `uploader_name == "Demo Developer"`, and `attachment_kind == "resolution"`, and that segregation classification identifies it as a user attachment.
  - All 7 backend unit tests pass cleanly.

#### 2. `frontend/Cross_Project_Code_Review-main/src/pages/user/UserFindingDetail.jsx`
- **Modifications**:
  - Replaced flawed `adminAttachments` filter that was greedily capturing all admin-uploaded items before checking attachment kind. Introduced `isResolutionAttachment` predicate:
    - Flags any attachment as a User Attachment if `attachment_kind === 'resolution'`, or if `uploader_role === 'developer'/'user'`, or if `uploader.role === 'developer'`.
    - Remaining attachments (`attachment_kind === 'evidence'`) route to Admin Attachments.
  - Synchronized attachment preview modal header label to use `isResolutionAttachment`.
- **Functionality Changed**:
  - When Demo Developer or any user submits a fix/resolution attachment (via "Submit for Review" or direct "+ Add Attachment"), it reliably routes to the **User Attachments** section.
  - Fixes the bug in Screenshot 1 where resolution attachments were appearing under Admin Attachments.

#### 3. `frontend/Cross_Project_Code_Review-main/src/pages/admin/FindingDetail.jsx`
- **Modifications**:
  - Applied the exact same `isResolutionAttachment` segregation logic and modal header label in the admin portal view.
- **Functionality Changed**:
  - Admins and developers now see identical, consistent segregation of evidence vs resolution attachments.

#### 4. `frontend/Cross_Project_Code_Review-main/src/context/AuthContext.jsx`
- **Modifications**:
  - Persisted `user_profile` in `localStorage` alongside `access_token` on login and restored it upon page initialization.
  - Cleaned up profile on logout.
- **Functionality Changed**:
  - Prevents authentication state loss and token desync when refreshing or navigating pages in the browser.

---

## Entry 6: Finding Reassignment with Feedback, Status Reset to Open & Closure (TDD)
- **Date/Timestamp**: 2026-10-31
- **Author**: Antigravity (Pair Programming with User)

### Files Changed:

#### 1. `backend/app/schemas/findings.py`
- **Modifications**:
  - Added `FindingReassignRequest` schema with `assignee_id: uuid.UUID`, optional `feedback: str`, and optional `reason: str`.

#### 2. `backend/app/api/routes/findings.py`
- **Modifications**:
  - Implemented `POST /findings/{finding_id}/reassign` endpoint:
    - Restricts permission to admins (`current_user.role == UserRole.admin`).
    - Validates that target assignee is an active user and member of the project.
    - Sets `finding.assignee_id = assignee.id`.
    - Resets finding status to `FindingStatus.open` regardless of previous status.
    - Adds `FindingStatusHistory` entry stating `"Reassigned to <Name> — <Feedback>"`.
    - Adds a `FindingFeedback` note with the admin's feedback text for visibility in the discussion thread.
  - Updated `allowed_transitions` in `update_finding_status` to allow admins to transition findings to `Closed` and `Open` across active workflow states.

#### 3. `backend/test_seed.py`
- **Modifications**:
  - Added 7 unit and integration tests (bringing total suite to 14 passing tests):
    - `test_admin_can_close_in_review_finding`: Tests admin closing an In Review finding.
    - `test_admin_can_reassign_finding_with_feedback_and_status_becomes_open`: Asserts status resets to Open, history records reassignment and feedback, and feedback thread records admin note.
    - `test_admin_can_reassign_to_same_developer`: Asserts reassignment works when selecting the developer currently assigned.
    - `test_non_admin_cannot_reassign`: Asserts non-admins receive HTTP 403 Forbidden.
    - `test_admin_can_close_resolved_finding`: Tests admin closing a Resolved finding.
    - `test_attachment_download_and_preview_bytes`: Tests attachment file download/preview API.
    - `test_full_finding_lifecycle_reassignment_and_closure`: Full end-to-end user journey test (Open $\to$ In Progress $\to$ In Review $\to$ Admin Reassign to Dev 2 with feedback $\to$ Dev 2 In Progress $\to$ In Review $\to$ Admin Close).
  - All 14 tests run and pass cleanly.

#### 4. `frontend/Cross_Project_Code_Review-main/src/pages/admin/FindingDetail.jsx`
- **Modifications**:
  - Added `reassignFeedback` state and feedback `<textarea>` input for the admin.
  - Updated developer selection options:
    - Displays all developers belonging to the project.
    - Allows reassigning to any developer, including the current assignee (labeled `(Current Assignee)`).
  - Updated `reassignFinding()`:
    - Calls `POST /findings/${id}/reassign` with `assignee_id` and trimmed `feedback`.
    - Resets local finding state status to `'Open'`.
    - Immediately reloads status history, timeline, and global findings list.
  - Updated `adminStatusAction()`:
    - Immediately reloads status history, timeline, and global findings list after closing a finding.
- **Functionality Changed**:
---

## Entry 7: Custom Finding Label Support (Admin Typing & Configuration) (TDD)
- **Date/Timestamp**: 2026-10-31
- **Author**: Antigravity (Pair Programming with User)

### Files Changed:

#### 1. `backend/test_seed.py`
- **Modifications**:
  - Added unit test `test_admin_create_finding_with_custom_label`:
    - Asserts that an admin can create a finding with any custom label string (e.g. `"Zero-Day Memory Safety Hazard"`).
    - Verifies response status 201, `category` matching the custom label, and retrieval via `GET /findings/{id}`.
  - Test suite extended to 15 unit tests (all passing cleanly).

#### 2. `frontend/Cross_Project_Code_Review-main/src/data/mockData.js`
- **Modifications**:
  - Added `DEFAULT_FINDING_LABELS`, `getCustomLabels()`, `saveCustomLabel()`, `removeCustomLabel()`, and `getAllFindingLabels()`.
  - Added dispatch of custom DOM event `'cpcr_custom_labels_updated'` whenever custom labels are modified, enabling cross-component reactivity.

#### 3. `frontend/Cross_Project_Code_Review-main/src/context/DataContext.jsx`
- **Modifications**:
  - Added `customLabels` state synced with `localStorage` (`cpcr_custom_finding_labels`).
  - Added computed `allFindingLabels` array merging default labels, labels from existing findings, and custom labels.
  - Exposed `customLabels`, `allFindingLabels`, `saveCustomLabel`, and `removeCustomLabel` through `DataContext`.

#### 4. `frontend/Cross_Project_Code_Review-main/src/pages/admin/CreateFinding.jsx`
- **Modifications**:
  - Added dual input mode for `Finding Label *`:
    - Standard dropdown containing all predefined and custom labels, plus a `+ Add Custom Label (type your own)...` option.
    - Quick toggle button `+ Type custom label` to switch to a direct text input.
    - Switch back link `← Choose from standard list`.
  - Updated `handleSubmit()` to save newly typed custom labels and create the finding with the custom label as `category`.

#### 5. `frontend/Cross_Project_Code_Review-main/src/pages/Settings.jsx`
- **Modifications**:
  - Added "Finding Labels Configuration" card for admin users (`currentUser.role === 'admin'`).
  - Displays all active custom labels as tag chips with delete (`×`) buttons.
  - Added an inline text input and `+ Add Custom Label` button to configure new custom labels centrally.

#### 6. `frontend/Cross_Project_Code_Review-main/src/pages/admin/AdminFindings.jsx` & `UserFindings.jsx`
- **Modifications**:
  - Updated "All Finding Labels" filter dropdowns to use `allFindingLabels`, ensuring custom labels can be filtered across both admin and developer finding lists.

- **Functionality Changed**:
  - Admins can now type custom labels directly when creating a finding, or manage custom labels in workspace settings. Custom labels automatically appear across all dropdowns and filters.



