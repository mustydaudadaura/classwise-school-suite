# Alegacy Integrated School Platform — Assessment and Roadmap

Nothing will be built, changed in the database or removed until you approve this plan. The new dashboard picture you sent is the design target for Phase 2.

## 1. Understanding
Alegacy becomes one school-management system: a central dashboard opens 15 departments, and every department reads the same student, staff, class, session and term records. Records are entered once, submitted, reviewed, approved, archived and retrieved for inspectors — with no fabricated documents and no mixing of schools.

## 2. What already exists (audit)
- **Schools, sign-in, roles:** real accounts, Super Admin / School Admin / Teacher / Accountant / Parent / Student, plus custom school roles and permissions, audit log, module on/off switches.
- **Student Affairs:** admissions (form-master admission awaiting admin activation), auto admission numbers, biodata, passport studio with AI, parent linking, promotion, bulk import/delete, scholarships.
- **HR:** Staff Register, staff logins, staff ID details, leave, payroll, salaries, penalties, department history.
- **Academics:** classes with sections, class-specific subjects, form-master and teacher allocations, timetable slots, scheme items, AI lesson notes with approval, curriculum upload.
- **Results:** individual and broadsheet entry, drafts/autosave, AI score-sheet reading, term records, report cards (many layouts, Arabic/Hausa, settings, fonts), positions, PDFs, distribution, scratch cards, public verification.
- **Attendance:** student daily attendance (present/absent/late/excused), staff geofence + PIN kiosk, lateness fines, day boards, weekly SMS digest.
- **Finance:** fee items, invoices, payments, receipts, expenses, defaulter notices.
- **Parents:** phone-based portal, multiple children, results, attendance, fees, notifications.
- **Islamic:** Islamiyya programmes, Tahfiz records, Arabic report card.
- **ID cards:** student and staff cards with verification codes.

## 3. Must be preserved
All of the above, every saved record, staff kiosk/PIN/QR flows, payroll attendance maths, the rule that report cards show any saved score, form-master approval flow, and school-scoped security.

## 4. Missing or partial
- Departmental dashboard + 15 department pages (dashboard today is metrics only).
- Attendance register reports: boys/girls split, weekly/monthly/termly, opening days from a **school calendar** (does not exist yet: holidays and closures).
- Student QR on the back of the ID card, QR scanning to mark attendance, revoke/regenerate QR.
- **Weekly Record of Work** (free text per subject, optional progress status, review, notebook-style print) — missing.
- Lesson delivery records, curriculum coverage report.
- **Submissions & School Records** centre with versions, deadlines, overdue tracking — missing (only per-module approvals exist).
- **Supervision & Inspection Centre** (filters, missing-record list, ZIP and combined PDF) — missing.
- Principal/Headteacher, Academic Coordinator/HOD, HR Officer roles.
- Security, Facilities/Inventory, Health, Government Compliance, Programmes, Transport/Boarding records — missing.
- Document generation is per module; no shared header/signature/archive yet.

## 5. Database assessment
The existing tables already hold the shared core (schools, students, staff_members, classes, subjects, allocations, attendance, assessments, finance). New tables will reference them, never copy them. New additions, all school-scoped with access rules:
- school calendar (opening days, holidays, closures)
- student QR tokens (random code, revocable)
- weekly records of work + per-subject entries + review comments
- submissions + immutable submission versions + deadlines
- one flexible "department records" table for the simpler registers (visitors, incidents, inventory, events, etc.) with strict category permissions; health records in their own locked table.

Old data is never deleted; existing tables are only extended.

## 6. Dashboard and departments
- New dashboard as in your picture: school name/motto bar, welcome banner, four real figure cards (students, staff, attendance today, pending submissions), 15 department tiles, attendance overview with boys/girls, recent submissions, upcoming events from the calendar.
- Each tile opens a real department page (`/departments/<name>`) that gathers that department's existing pages, figures and documents, plus "coming in Phase X" only where a feature is not built yet.
- Side menu regrouped by department; tiles and menu items shown by role. Figures come only from real records (empty shows 0, never sample numbers).
- Two columns on phones, four to eight on larger screens.

## 7. How records connect
Student admitted → class list, attendance, ID card/QR, results, fee invoices, nominal roll and statistics all read the same student row. Staff registered → staff ID, kiosk attendance, allocations, timetable, payroll. Teacher records (scheme, weekly record, lesson notes) → submitted into Submissions → visible in Inspection Centre once they exist. Payment → invoice balance, receipt, income report (existing shared money module).

## 8. Roles
Map to existing roles: Super Admin, School Admin/Proprietor, Accountant=Bursar, Teacher (Form Master / Subject Teacher by assignment), Parent, Student. Add Principal, Academic Coordinator/HOD and HR Officer as school roles using the existing permission system, so no current account changes. Teachers never see finance, HR or health records; nobody sees another school.

## 9. Phases and size
| Phase | Delivers | Size |
|---|---|---|
| 2 | New dashboard, 15 department pages, regrouped menu, role visibility | Medium |
| 3 | School calendar, attendance register reports (boys/girls, weekly/monthly/termly, print/Excel), student QR cards, QR scan attendance | Large |
| 4 | Weekly Record of Work, lesson delivery, curriculum coverage | Medium |
| 5 | Submissions & School Records (versions, deadlines, review) | Large |
| 6 | Supervision & Inspection Centre (filters, ZIP, combined PDF, missing list) | Medium |
| 7 | Remaining department registers, one department at a time | Large (split) |
| 8 | Role, data, QR, document, mobile and security testing | Medium |

Each phase is finished, tested in Demo School and confirmed with you before the next starts.

## 10. Risks
- Camera QR scanning needs HTTPS and camera permission; older Android browsers may fall back to manual entry.
- Combined PDFs of many documents are made in the browser and may be slow on phones; ZIP is the fallback.
- Attendance percentages need the calendar filled in; until then opening days count school days with attendance marked.
- Phase 7 is big; empty modules will not be added without agreeing each one.
- Credits: large phases may take several sessions.

## Technical details
- Routes: `src/routes/_authenticated/departments.index.tsx` and `departments.$dept.tsx` driven by one department config (tiles, links, permissions, figure queries); existing pages are linked, not duplicated.
- Dashboard figures via existing `dashboard-metrics` helpers extended with gender split and pending submissions.
- QR holds only a random token resolved by an authenticated scan function; duplicate attendance blocked by a unique (student, date, session) constraint; unmarked never becomes absent.
- Submission versions store a frozen JSON snapshot and generated file path in private storage; approval writes audit logs through triggers.
- Attendance formulas live in one tested helper using your stated formulas.
