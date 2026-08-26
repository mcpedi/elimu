# Project TODO

- [x] Establish a role model for Super Administrator, Principal, Deputy Principal, Teacher, Class Teacher, Bursar, Parent, and Student with least-privilege server-side authorization.
- [x] Model school configuration, Kenyan terms, academic years, Forms 1–4, streams, subjects, departments, rooms, and Kenyan grading scales.
- [x] Implement secure student, guardian, document-reference, subject-allocation, and student-status workflows, including admission-number generation and searchable records.
- [x] Implement teacher profiles, departmental/class/subject allocations, workload visibility, and teacher attendance.
- [x] Implement examinations, assessments, assignment-aware teacher-restricted marks entry, Kenyan grading calculations, and performance summaries.
- [x] Implement student attendance capture, absence reasons, attendance rates, attendance history, and repeated-absence flags.
- [x] Implement KES fee structures, balances, payment recording, receipts, statements, collection summaries, and an M-Pesa-ready payment adapter boundary.
- [x] Implement conflict-aware timetable records and role-appropriate administrator, teacher, and student timetable views.
- [x] Implement targeted announcements, in-app notification records, authorized global search, report metadata, and auditable administrative actions.
- [x] Store uploaded student records as secure object-storage references rather than database file bytes.
- [x] Build an elegant, mobile-first responsive UI with role-specific dashboards, dark/light theme support, accessible navigation, loading, empty, error, and confirmation states.
- [x] Create and apply relational database migrations with foreign keys and seed only non-user-generated configuration data required for initial operation.
- [x] Add server-side tests for key calculations, authorization boundaries, and validation rules.
- [x] Verify the application through type checks, tests, desktop/mobile visual review, and a final runtime inspection.
- [x] Prepare a completion checkpoint and delivery summary with configuration and deployment guidance.
- [x] Reset each data-entry form after a successful save so users can immediately add the next subject, teacher, learner, payment, record, or other operational item without manual clearing.
- [x] Add administrator controls to edit and remove subjects and teacher records, with audit logging and safeguards for dependent data.
- [x] Add administrator controls to update class capacity and assign or change a class teacher.
- [x] Add administrator controls to correct fee-account balances through an auditable, safe adjustment workflow rather than silent direct edits.
- [x] Add accessible administrator interface controls for these record-management workflows, including confirmations for destructive actions.
- [x] Add tests and validation for the new editing, removal, assignment, capacity, and fee-adjustment controls.
- [x] Add a protected fee-account creation workflow for selecting a learner and fee structure, entering amount due and due date, and saving the account with audit logging.
- [x] Add secure printable learner account statements with balances, fee lines, payment history, and download/print actions.
- [x] Add secure printable payment receipts with learner, amount, payment method, reference, receipt number, and download/print actions.
- [x] Audit generated statement and receipt exports, add tests, and validate the finance document workflow.
- [x] Prevent statement or receipt audit/export records when the printable document window cannot be opened.
- [x] Add focused retrieval tests for secure learner statements and payment receipts, including failure-path validation.
- [x] Add a focused failure-path test for payment-receipt retrieval when the payment is missing or belongs to a different learner.
- [x] Add a payment-receipt test that rejects when the payment ID does not exist for the selected learner.
- [x] Add a payment-receipt test that rejects when a real payment belongs to a different learner than the supplied student ID.
- [x] Add a protected school-logo upload workflow with image validation and object-storage persistence outside the database.
- [x] Display the saved logo in school settings and in printable statement and receipt headers.
- [x] Add secure upload, logo-display, document-rendering, and regression tests.
- [x] Make the desktop workspace content independently scrollable so users can move up and down without losing the navigation shell.
- [x] Improve the visible workspace setup-fetch failure state so transient setup errors do not leave the main workspace unusable.
- [x] Validate desktop and mobile scrolling plus the setup-error recovery path with type checks, tests, and visual review.
- [x] Add focused Overview readiness tests for transient setup-status failure, dashboard fallback loading, and retry behavior.
- [x] Capture a mobile viewport visual review after the scrolling/layout change.
- [x] Re-run typecheck, tests, and targeted visual validation, then finalize the workspace-navigation checkpoint.
- [x] Save a new checkpoint capturing the desktop scroll-container and setup-error recovery changes after the validated typecheck, test, and screenshot pass.
- [x] Add a brief delivery note referencing the new workspace-navigation checkpoint.
- [x] Consolidate all fee workflows under Fees, including structures, learner accounts, balances, payments, statements, receipts, and collection reports.
- [x] Consolidate related workflows inside Students, Teachers, Academics, Attendance, Timetable, Announcements, Reports, and Settings instead of scattering actions across specialist screens.
- [x] Improve navigation labels, section headings, workflow grouping, and in-page guidance so the workspace is easier to understand.
- [x] Add a working department-creation form with school-scoped persistence and audit logging.
- [x] Add tests and responsive visual validation for the reorganized modules and department entry.

- [x] Move fee balance correction into FeesPanel, remove stale finance-management wiring from other screens, and verify every finance action renders in Fees exactly once.
- [x] Render AcademicWorkflowEntry from AcademicsPanel, remove duplicate announcement-publishing UI, and complete remaining module-first ownership cleanup.
- [x] Add focused regression coverage for reorganized module ownership and role visibility, then rerun desktop/mobile visual validation.

- [x] Add secure student admission-number/password credential setup and login without weakening existing role authorization.
- [x] Add a responsive learner login experience and protected own-results view with clear password lifecycle states.
- [x] Add regression coverage for password hashing, login failures, school scoping, learner-only visibility, and audit events.

- [x] Defer learner activation-code email delivery per the user’s revised scope; no email provider integration was added.
- [x] Defer email-provider configuration and activation-email delivery per the user’s revised scope.
- [x] Remove emailed activation-code UI and expiry tests per the user’s revised scope.

- [x] Replace the emailed activation flow with a learner username derived from the name on the student record and the admission number as the initial password.
- [x] Preserve hashed credential storage, school-scoped lookup, duplicate-name handling, rate limiting, secure session issuance, audit events, and own-results access in the simplified flow.
- [x] Update learner and leadership UI copy to remove activation-code/email steps and explain the initial credentials safely.
- [x] Add regression coverage for name normalization, duplicate-name rejection, admission-number password login, role restrictions, and results visibility.

- [x] Add a safe migration/reset strategy so existing learner credentials from the earlier activation flow use the admission-number password model consistently.
- [x] Add a regression test proving unauthorized roles cannot access learner-only results.

- [x] Narrow the learner-auth regression checklist wording to the learner-only results authorization boundary actually covered by the test suite.

- [x] Add an authenticated student password-change procedure that verifies the current password, validates the new password, and writes an audit event.
- [x] Add a learner-facing password settings form with confirmation, clear errors, and success feedback while preserving the current session.
- [x] Add regression coverage for password changes, wrong-current-password rejection, role boundaries, password reuse, and audit logging.

- [x] Normalize the current admission-number password consistently during password changes while preserving exact custom-password verification.
- [x] Add a regression test for changing the password after login with a case/spacing variant of the admission number.
- [x] Re-run type checking and the full regression suite after the password-change normalization fix.
