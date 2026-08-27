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

- [x] Add a secure school-issued one-time reset-code process for students who forget custom passwords.
- [x] Add protected reset UI for learners and leadership issuance controls with expiry, lockout, and audit feedback.
- [x] Add regression coverage for reset-code authorization, hashing, expiry, one-time use, rate limiting, password replacement, and session behavior.

- [x] Add a reset-flow regression proving repeated invalid codes trigger lockout and a locked audit event.
- [x] Add a reset-flow regression proving successful password reset does not set a session cookie or automatically log the learner in.
- [x] Re-run type checking and the full regression suite after the missing reset security assertions are added.

- [x] Add a secure school-scoped report-card record and teacher-authorized create/update workflow.
- [x] Add learner-only report-card access with printable branded PDF download and clear empty/loading/error states.
- [x] Add report-card audit logging and regression coverage for teacher permissions, learner scoping, PDF/export behavior, and record validation.

- [x] Add report-card regression tests proving assigned teachers/class teachers can create or update cards only for permitted classes, while unauthorized roles and assignments are rejected.
- [x] Add report-card validation tests for no marks entered, learner/class mismatch, and term/year misalignment.
- [x] Add a report-card regression test proving non-academic roles cannot call `school.reportCards.create`, alongside the existing unassigned-teacher rejection case.

- [x] Add a teacher-authorized report-card preview procedure that returns an unsaved branded snapshot without creating an export audit.
- [x] Add a school-scoped class batch report-card generation procedure with per-learner results, validation handling, and audit logging.
- [x] Add teacher-facing preview and class batch-generation controls to the Academics report-card workflow.
- [x] Add regression tests for preview visibility, batch authorization, partial/missing marks, idempotent updates, and audit behavior.
- [x] Validate preview and batch-generation UI responsively, rerun type checks and all tests, and save a recoverable checkpoint.
- [x] Save a new recoverable checkpoint after the preview/batch feature changes and validated 62-test pass, then re-mark the validation/checkpoint item complete.

- [x] Define the report-card review/publish contract using the existing publication timestamp and confirm generated cards remain hidden from learners until released.
- [x] Add school-scoped teacher-authorized batch publish and unpublish procedures with audit summaries and safe empty-batch handling.
- [x] Add Academics review controls showing draft/published counts and confirmation feedback for publish or unpublish actions.
- [x] Add regression tests for draft visibility, batch publish/unpublish authorization, idempotency, school scoping, and audit events.
- [x] Validate the review/release UI responsively, rerun type checks and all tests, and save a new recoverable checkpoint.
- [x] Add a focused regression proving unpublished batch cards are hidden from learner report-card retrieval until publishBatch releases them.
- [x] Add a publish/unpublish regression proving cross-school or class/term-isolated rows are not changed by a scoped batch action.
- [x] Save a new recoverable checkpoint after the publish/unpublish changes and validated 64-test pass, then re-mark the validation/checkpoint item complete.
- [x] Add a scoped unpublish regression proving only the selected school/class/term rows are unpublished while unrelated published rows remain released.

- [x] Add the supplied Elimubora360 logo asset through the project’s durable web storage workflow.
- [x] Apply the logo to the dashboard shell, authentication branding, browser metadata, settings, and branded printable documents without breaking existing custom school-logo behavior.
- [x] Validate logo contrast and sizing across desktop/mobile views, rerun type checks and tests, and save a recoverable checkpoint.
- [x] Add explicit Settings UI wiring so the Elimubora360 fallback/logo is visibly applied when no custom school logo is configured.
- [x] Save a recoverable checkpoint after the logo branding changes and validated 67-test pass, then re-mark the validation/checkpoint item complete.

- [x] Define a short Elimubora360 section-transition behavior for major dashboard navigation changes without delaying the destination content.
- [x] Implement an accessible branded transition overlay using the uploaded logo, with reduced-motion support and no interaction lock longer than the animation.
- [x] Wire the transition into desktop, mobile drawer, and mobile bottom navigation while preserving active-state behavior.
- [x] Add regression coverage for transition timing/state behavior and rerun type checks, tests, and responsive visual validation.
- [x] Save a recoverable checkpoint after the transition animation changes and validated test pass.
- [x] Add a mounted DashboardLayout regression proving the transition overlay appears only after a section change and clears after the configured timeout.
- [x] Add a mounted reduced-motion regression proving no transient loader appears when reduced motion is requested.
- [x] Include client-side `.test.tsx` files in Vitest discovery so mounted React transition regressions run in the standard suite.

- [x] Audit and harden the shared tenant resolver plus staff, learner, document, report-card, finance, search, and audit query paths for strict server-side school scoping.
- [x] Bind authenticated users and learner sessions to exactly one school context on every protected procedure and exported document path.
- [x] Add adversarial regression tests proving one school cannot read, update, export, or search another school's records.
- [x] Validate the hardened tenant boundaries with type checks, the full regression suite, and a new recoverable security checkpoint.
- [x] Add a focused tenant-isolation regression proving `school.search` never returns students, teachers, or subjects from another school.
- [x] Complete explicit verification of the remaining school-scoped query families or narrow the audit checklist wording to match proven coverage.

- [x] Define a platform-only Super Administrator monitoring contract that aggregates schools without exposing cross-school records to school-level roles.
- [x] Add protected platform-monitoring procedures for registered schools, active user counts by school, and unassigned accounts.
- [x] Add a responsive Super Administrator dashboard with school inventory, user-count summaries, and privacy-safe unassigned-account monitoring.
- [x] Add regression tests for platform authorization, correct aggregation, and denial to non-platform roles.
- [x] Validate the protected platform procedures plus the responsive dashboard shell, rerun type checks and all tests, and save a recoverable checkpoint.

- [x] Define safe platform-administrator designation and revocation rules, including audit requirements and protection against self-lockout.
- [x] Add protected platform-administrator list, eligibility, designation, and revocation procedures restricted to designated Super Administrators.
- [x] Build a responsive Platform administrator management interface with searchable eligible accounts, active administrators, confirmations, and clear access guidance.
- [x] Add authorization and mutation regression tests covering designation, revocation, self-lockout prevention, data minimization, and audit events.
- [x] Validate protected management paths and the responsive dashboard shell, rerun type checks and all tests, and save a recoverable checkpoint.

- [x] Define administrator-directory filters and sort modes that operate only on the existing data-minimized platform-admin response.
- [x] Add responsive search, assignment-status filters, activity filters, and deterministic sort controls for current and eligible administrator lists.
- [x] Add regression coverage for filter/sort behavior and preserve platform-only navigation and procedure authorization.
- [x] Validate directory-control logic and the responsive dashboard shell, rerun type checks and all tests, and save a recoverable checkpoint.

- [x] Define platform-only safeguards for registering additional schools and assigning only unassigned accounts to the target school and role.
- [x] Add audited platform onboarding procedures to create a school and assign an unassigned account to a school-scoped role without cross-tenant reassignment.
- [x] Build responsive Platform monitor controls for registering a school and assigning unassigned accounts to a selected school and permitted role.
- [x] Add regression coverage for platform authorization, duplicate school codes, unassigned-only assignment, role validation, audit events, and tenant isolation.
- [x] Validate protected onboarding paths and the responsive dashboard shell, rerun type checks and all tests, and save a recoverable checkpoint.

- [x] Map the attached MVP enhancements to existing modules and define tenant-safe, role-aware data contracts without duplicating core records.
- [x] Add safe schema migrations for calendar events, assignments, targeted notices, ID data, messages, recent views, and related document metadata.
- [x] Implement calendar events and a targeted digital notice board with expiry-aware active views and attachments.
- [x] Implement teacher assignment creation, learner completion, parent visibility, due-date status, and attachment access.
- [x] Add role-specific quick actions, global learner search, dashboard activity timeline, rule-based in-app alerts, and recently viewed records.
- [x] Add branded digital learner IDs, QR-backed minimal verification, admission/transfer documents, and print-ready outputs.
- [x] Add validated bulk student/class/marks import-export workflows and batch report support.
- [x] Add simple school-authorized inbox, sent, read-state, conversation, and notification views.
- [x] Expand school branding settings for motto, contact details, website, and colors across applicable screens and documents.
- [x] Validate tenant isolation, role permissions, attachments, responsive behavior, type checks, and all regressions; save a checkpoint.

- [x] Define school-scoped learner photo upload validation, storage, replacement, and role-access safeguards.
- [x] Add protected learner photo upload and retrieval procedures that persist only an object-storage key on the existing student record.
- [x] Add responsive photo preview/upload controls to the learner workflow and reflect saved photos in the digital ID-card preview.
- [x] Add regression coverage for authorization, image validation, tenant isolation, and ID photo rendering; validate and save a checkpoint.

- [x] Replace the Students-table placeholder with a school-scoped in-app learner detail view and recent-view recording.
- [x] Audit and complete the role-authorized subject-by-subject examination setup and marks entry flow for valid classes, subjects, and learners.
- [x] Add controlled report-card edit/upload workflow for authorised academic staff, preserving existing draft, publication, and learner-visibility rules.
- [x] Add regression coverage for learner detail access, subject marks validation, report-card update authorization, and tenant isolation.
- [x] Validate desktop/mobile interactions, rerun type checks and all tests, and save a recoverable checkpoint.

- [x] Define the authorised learner-summary print content using only details already available in the protected in-app record dialog.
- [x] Add a branded Print / save PDF action to the learner detail dialog and handle blocked pop-ups clearly.
- [x] Add regression coverage for summary rendering and validate type checks, tests, responsive shell, and a recovery checkpoint.

- [x] Define selectable learner-summary sections that use only the existing authorised detail payload and preserve a useful default selection.
- [x] Add responsive section selectors in the learner detail dialog and generate a branded print document containing only selected sections.
- [x] Add document-output regressions for selected and excluded sections; validate type checks, full tests, responsive shell, and checkpoint.

- [x] Define school-scoped academic performance metrics for class mean grade, average percentage, and strongest-to-weakest subject ranking.
- [x] Add a protected academic-performance aggregation procedure scoped to selected academic year and term, with class and subject validation.
- [x] Build a responsive Academics performance view showing every class summary and ordered subject results.
- [x] Add regression coverage for calculations, empty data, ties, invalid scope, role authorization, and tenant isolation; validate and save a checkpoint.

- [x] Define school-scoped term-over-term metrics and chart behavior for each configured class.
- [x] Add a protected multi-term performance aggregation procedure with academic-year and term validation.
- [x] Build responsive per-class trend charts in the Academics performance workspace.
- [x] Add regression coverage for trend calculations, empty terms, authorization, and tenant isolation; validate and save a checkpoint.

- [x] Define school-scoped comparison limits and normalized trend metrics for selected classes.
- [x] Add a protected comparison aggregation procedure with same-year validation and deterministic class ordering.
- [x] Build responsive class selectors and a comparative multi-series trend visualization.
- [x] Add regression coverage for comparison calculations, selection limits, empty terms, authorization, and tenant isolation; validate and save a checkpoint.

- [x] Diagnose and repair the authorised pre-publication report-card preview flow without publishing or creating an export audit.
- [x] Include the learner’s current balance in school-scoped fee-receipt data and branded printable output.
- [x] Add regression coverage for preview visibility, receipt balance calculation, authorization, and tenant isolation; validate responsively and save a checkpoint.

- [x] Define the authorised receipt preview fields and ensure previewing does not create a document audit until printing or saving.
- [x] Add a responsive in-app receipt preview with learner, payment, and remaining-balance details plus a print handoff.
- [x] Add regression coverage for preview contents, balance visibility, authorization, and print-audit behavior; validate and save a checkpoint.

- [x] Add a secure school-scoped admin workflow to link, update, or clear a learner email on the student profile.
- [x] Validate learner email format and school-local uniqueness, and audit every email-link change without exposing unrelated schools.
- [x] Add responsive admin controls and regression coverage for authorization, validation, uniqueness, clearing, and learner-profile visibility; validate and save a checkpoint.

- [x] Add an optional school-scoped learner recovery notice workflow using the linked email, with safe delivery status and audit logging.
- [x] Extend the Students search to match linked learner email addresses without weakening tenant isolation.
- [x] Add bulk learner-email import with admission-number matching, format validation, school-local duplicate detection, partial-error reporting, and audit coverage.
- [x] Add responsive controls, regression tests, and validation for recovery notices, email search, and bulk email import; save a checkpoint.

- [x] Connect a transactional email provider for learner recovery notices with a server-only delivery helper. Not applicable: user chose to keep recovery notices in-app only.
- [x] Add secure provider configuration and sender settings, with clear delivery failure status and no reset-code disclosure. Not applicable: no external provider will be configured.
- [x] Add provider mocking/tests for successful delivery, missing configuration, upstream failure, tenant authorization, and audit behavior; validate and save a checkpoint. Not applicable: external delivery was declined.

- [x] Add an authorised Students workspace filter for all learners, learners with linked emails, or learners without linked emails.
- [x] Keep email-presence filtering school-scoped and compatible with name, admission-number, and email search.
- [x] Add responsive result feedback and regression coverage for filter combinations and tenant boundaries; validate and save a checkpoint.

- [x] Add a visible leadership-only school-code management workflow for learner login access.
- [x] Validate school-code format and uniqueness, preserve learner login compatibility, and audit every code change.
- [x] Add responsive view, edit, copy/share, and regression coverage for school-code management; validate and save a checkpoint.

- [x] Add a printable learner-login instruction sheet using the current school name, code, login address, and safe learner guidance.
- [x] Add preview and print/save-PDF controls under School configuration without exposing administrator-only data.
- [x] Add regression coverage for escaped document content, school-code inclusion, print handoff, and responsive controls; validate and save a checkpoint.

- [x] Show specific subject and marks context in academic activity entries instead of only the assessment title.
- [x] Let exam dates target all learners in Form 1, Form 2, Form 3, or Form 4, with school-scoped validation and display.
- [x] Make audit entries open a detailed view showing the actor, action, entity, timestamp, and recorded metadata.
- [x] Add regression coverage and responsive validation for subject-aware activity, form targeting, and audit details; save a checkpoint.

- [x] Add a personalised greeting for signed-in personnel using their account name, with a safe fallback when no name is available.
- [x] Keep the greeting role-aware, accessible, and responsive across the dashboard shell.
- [x] Add regression coverage for name rendering and fallback behavior, validate the responsive layout, and save a checkpoint.

- [x] Display a readable signed-in user role beneath the personalized greeting in the dashboard header.
- [x] Keep the role label visible, accessible, and responsive on mobile without exposing extra account data.
- [x] Add regression coverage for role formatting and greeting/header rendering, validate mobile layout, and save a checkpoint.

- [x] Define role-aware AI assistant capabilities, allowed context, privacy boundaries, and confirmation rules for sensitive actions.
- [x] Add a protected server-side assistant procedure using the built-in LLM without exposing credentials or cross-school data.
- [x] Add a responsive assistant chat experience with navigation help, marks/grading explanations, and safe workflow guidance.
- [x] Add regression coverage for role isolation, prompt-injection resistance, grading guidance, error handling, and responsive behavior; validate and save a checkpoint.

- [x] Persist private AI conversations and messages under the authenticated user and school tenant.
- [x] Add protected procedures to list, create, resume, rename, and append messages to a user’s own conversations.
- [x] Add responsive history controls with new chat, resume, rename, empty, loading, and error states.
- [x] Add regression coverage for user/school isolation, ordering, message persistence, rename behavior, and responsive history controls; validate and save a checkpoint.

- [x] Add a bottom-right AI assistant launcher and responsive landing-page chat widget.
- [x] Prevent blank or incomplete AI replies with bounded retry, continuation guidance, and clear fallback errors while preserving conversation history.
- [x] Add regression coverage for widget placement, response extraction, blank/truncated responses, retry behavior, and mobile layout; validate and save a checkpoint.

- [x] Add a retryable failed-message state and a visible “Retry answer” action for AI responses that fail.
- [x] Preserve the last user question and conversation ID when retrying, without duplicating the failed placeholder message.
- [x] Add regression coverage for retry behavior, loading/disabled states, context preservation, and responsive accessibility; validate and save a checkpoint.

- [x] Add the footer credit “Designed by Jacks Webs Solutions” to the dashboard shell.
- [x] Keep the credit discreet, accessible, and readable across desktop and mobile layouts.
- [x] Add regression coverage for footer rendering, validate the responsive shell, and save a checkpoint.

- [x] Add a small branded Jacks Webs Solutions mark beside the existing footer credit.
- [x] Keep the mark scalable, accessible, and readable in light/dark desktop and mobile layouts.
- [x] Add regression coverage for footer mark rendering and sizing, validate the responsive shell, and save a checkpoint.

- [x] Add leadership controls to temporarily disable and re-enable student and teacher accounts within the active school.
- [x] Enforce school scoping, prevent unauthorised self/privileged-account changes, and audit every disable or re-enable action.
- [x] Block disabled accounts at login with the exact guidance “Contact System Admin for help.” while preserving safe authentication behavior.
- [x] Add regression coverage and responsive UI validation for disable, re-enable, authorization, login messaging, and audit details; validate and save a checkpoint.
- [x] Add explicit student and teacher profile suspension fields and apply the database migration.
- [x] Add protected account-status procedures and synchronize linked user suspension state.
- [x] Enforce the disabled-account login message in OAuth sessions and learner login.
- [x] Add admin status controls, tests, visual validation, and a final checkpoint.
