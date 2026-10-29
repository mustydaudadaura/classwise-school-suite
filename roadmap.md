# School ERP upgrade roadmap

- [ ] Check and repair class, subject and student registration; verify saved records after reopening each list.

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
