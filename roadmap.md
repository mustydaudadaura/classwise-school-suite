# School ERP upgrade roadmap

- [x] Repair class/student registration permission mismatches; signed-in teacher submissions and administrator approvals verified.
- [x] Allow teachers to submit inactive classes and student admissions for administrator approval and activation; reload persistence verified and temporary test records removed.
- [x] Include subject submissions for school staff, inactive until administrator activation; submission and approval verified, with pending records blocked from operational use.

- [x] Add bulk class creation using an existing class's settings and copy subjects to multiple classes; nine tests pass and owner-session checks confirm two imported classes persist after reload, subject copies appear in both, and retries skip duplicates. Verification records remain in Registration Verification School.

- [x] Add confirmed deactivate/reactivate and safe delete controls for schools, classes, subjects, students, staff and roles; verified class status persistence, linked-delete rejection, unused-subject deletion, and protected owner access. Six regression tests pass. Staff removal deletes assigned roles, not auth accounts.

- [x] Repair password-reset email destination and provide a public new-password form; legacy routing and expired-link handling verified, six auth/recovery tests pass.
- [ ] Confirm password update through a real emailed recovery link — requires the owner to open a fresh reset email; no recovery link is available for automated testing.

- [x] Check and repair class, subject and student registration; verified all three persist after reload through the owner account, including the guardian link; six regression tests pass.

- [x] Review all 52 public tables for RLS, grants and policy presence; repair function execution privileges and validate student status.
- [x] School registry now confirms a saved row and displays load errors; remove fabricated transport/session roles and school fallbacks; registration regression tests pass.
- [x] Create the owner-selected real Super Admin via email invitation; verify school creation and reopening after reload using Registration Verification School.

- [x] Fix inherited preview type errors and verify the sign-in screen; three auth input regression tests pass.

- [x] Compare uploaded master brief with current pages, server functions and live table/policy inventory.
- [x] Smoke-check public homepage and sign-in page (no browser page errors).
- [x] Replace the default typeface with a clear, professional font across public, staff and parent pages.
- [x] Phase 1: school configuration, module activation, school-scoped permissions, audit trails and access-boundary tests.
- [x] Phase 2 (core): student 360 profiles, admissions pipeline, campuses, enrollment history and guardians.
- [x] Phase 3 (core): teacher allocations, class timetable with clash checks, assignments.
- [x] AI lesson plan & lesson note generator (NERDC format).
- [x] Phase 3: result approval before publishing.
- [x] Configurable professional report card: school-admin position controls and 26 colours for independent sheet sections; seven configuration tests pass.
- [ ] Verify report template save/reopen and printed output through signed-in school settings — owner is clicking through Report Card Design and Certificates & Reports themselves.
- [ ] Flexible score patterns (beyond 20/20/60) — waiting on owner decision; brief requires 20/20/60 only.
- [x] Phase 4: fee discounts/scholarships, expense book, staff payroll and termly finance report — verified in the demo school (₦810,000 billed, ₦5,000 waived, ₦370,000 collected, ₦30,000 expenses, ₦90,000 salary released, ₦250,000 net in hand).
- [ ] Online fee payments (Paystack/Flutterwave) with receipt on payment — needs provider keys and webhook setup.
- [x] Phase 5: message templates, scheduled notices, parent alert choices, name placeholders — Termii key and sender name now saved.
- [x] Weekly attendance report to parents: per-child days present/absent/late/excused for the Monday–Sunday week, faults flagged, sent by SMS or WhatsApp on demand and filed in the family portal; preview verified in the demo school.
- [ ] Automatic weekly send (every Friday evening without staff pressing the button) — needs a scheduled job.
- [ ] Live SMS delivery test to one real parent number — waiting on the owner's number.
- [x] Phase 6: Tahfiz, Arabic and Islamic programme workflows — programmes, enrolment, Tahfiz records and printable per-student progress reports; verified in the demo school.
- [x] Academic assistant: AI breaks uploaded curriculum into classes, terms, weekly topics, then lesson plans/notes with admin approval.
- [ ] Phase 7: inventory/assets, library, transport, boarding, health and discipline.
- [ ] Phase 8: permission-aware search, analytics, exports and AI assistant.
- [ ] Phase 9: offline synchronization, managed backup/recovery, performance/security testing and deployment readiness.

Current gate: approve phased upgrade scope before applying foundational access/schema changes.
Parent security decision: real-family phone-only access conflicts with the secure-authentication brief; agree on OTP or another verification method before changing that experience.
- [ ] Audit Google AI Studio imports, remove reproduced security/saving regressions, and test authenticated school workflows.

- [x] Form masters admit students; admin bulk-activates
- [x] Remove all schools except Assalam Tahfizul Qur'an Academy Limited
- [x] Attendance tracking upgrade: kiosk with live clock, PIN boxes, live on-site badge, Sign In/Sign Out, Today/Yesterday boards with late minutes and penalties; multiple geofence sites; per-minute late penalty. Unit tests pass; kiosk not yet clicked through in the browser.

## Open tasks
- [x] Require complete class/subject creation details, enforce class-first subject registration, and align import validation and class selection; 22 tests pass, signed-in phone-sized class/subject saves persist after reload, temporary records removed, and automatic build passes.
- [x] Separate subjects by registered class in both score-entry modes and class registry selector; unassigned subjects remain preserved separately. Class-isolation tests pass.
- [x] Add individual/general score entry and changed-score saving; signed-in phone-sized mode switching verified. Saving real scores remains unverified because the school currently has no students.
- [x] Add administrator form-master class assignment and default assigned-class score entry; administrator assignment/reload/removal verified and original state restored; three assignment-rule tests pass and restrictive score-write policies applied. Full teacher score submission still requires a teacher-session test.
- [x] Scaffold managed app email support for notify.alegacyng.com.ng; install rendering packages and preserve authenticated preview access. Sending awaits domain verification; no feature-specific email triggers were requested.
- [x] Add administrator editing and rejection with reasons for pending classes, subjects and students; signed-in edits/rejections persist after reload, rejected entries stay inactive.
- [x] Add existing class/subject/student editing, staff name/phone editing, custom-role name/permission editing, and school details shortcut; active-class and custom-role edits persist after reload, staff save and school form verified. Protected login identities and school affiliation remain unchanged. Fourteen regression tests pass; temporary records removed.
- [x] Answered: database storage limits (DB healthy, 14.2 MB used, 14% disk; disk can grow on request)
