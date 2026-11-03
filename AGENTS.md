# Architecture rules

- Individual and general broadsheet score entry write the existing assessments with shared grading validation and persisted-row checks; only changed broadsheet cells are submitted, preserving untouched scores and approval rules.

- Assign form masters through the school-admin-checked class-assignment RPC; classes.teacher_id is the primary assignment and old class-teacher allocations are reconciled. Score entry defaults to assigned classes, with matching restrictive write policies; subject-teacher allocations remain valid.

- App emails use the managed server-only template helper; delivery, suppression and unsubscribe are hosted, with no local email queues or tables. Preserve self-authenticated /lovable/ routes and keep email rendering dependencies bundled for the Worker runtime.

- Password recovery uses the public /reset-password screen, separate from sign-in redirects; legacy recovery links on /auth are forwarded with their hash so users can choose a new password.

- Extend existing TanStack Start screens and PostgreSQL tables additively; preserve historical records and working school workflows during phased upgrades.
- Store school configuration, custom roles, permission assignments and audit records separately from user profiles; school affiliation never grants operational permissions.
- Enforce module activation and school-scoped permissions in database policies and authenticated server functions; navigation visibility is not authorization.
- Use authenticated RLS clients for ordinary operations; dynamically import privileged clients only inside authorized handlers for true administrative work.
- Keep audit records append-only and write them in database triggers so direct client mutations are covered.
- Resolve saved report layouts through one staff/family/print renderer with CSS colour tokens and authorized subject ranks; Arabic Islamiyya reuses existing report data and never fabricates missing scores or translations.
- Preserve compatibility with existing assessment and report structures until a separately verified data migration replaces them.
- AI features run in authenticated server functions that check school permissions before calling Lovable AI; prompts and keys never reach the browser.
- Keep money maths (invoice balance, waivable discount) in one shared browser-safe module that screens, server functions and reports all use, and unit-test it, so collected/outstanding figures never disagree.
- Curriculum uploads are converted in the browser (Word/Excel to text) and PDFs/photos sent as files to an authenticated server function; the AI breakdown is stored as scheme items that feed the existing lesson-note generator and approval flow rather than a parallel one.
- Demo access signs in through the real demo account; never add client- or server-side auth bypasses (fake sessions, hardcoded bearer tokens, admin fallbacks on network errors), because they expose every school's data.
- Resolve the managed auth-middleware import to the app-owned verified-auth middleware until managed regeneration removes imported bypasses; this preserves generated files while enforcing real sessions and typed RLS clients.
- Keep auth input validation in a shared tested helper and give the verified middleware an explicit user-scoped context type; missing configuration must deny access rather than infer an administrative context.
- Staff accounts are created server-side with the admin auth API (confirmed email + initial password) only after is_super_admin/can_manage_school checks, and the function itself writes the profile and role; client signUp silently fails for existing emails.
- School registry writes must return an actual saved row before showing success; database read failures must not render as an empty registry.
- Class, subject and student registries filter by the selected school and verify returned saved rows through the shared registry-save helper; this prevents false success and cross-school list mixing.
- Registry lifecycle actions use one authenticated database RPC that checks school administration, protects own/Super Admin access, blocks plain deletion across foreign-key references, and offers an admin-confirmed purge that erases dependent rows (nullable links are unset) behind a transaction-local trigger bypass; active role flags control operational permissions while audit history and auth accounts remain intact.
- SECURITY DEFINER execution is limited by purpose: trigger functions and parent phone lookup are server-only, policy helpers remain authenticated-callable, and published-report verification stays public.
- Bulk class and subject copying uses school-scoped RLS writes and shared tested preparation helpers; re-read before importing, skip existing names, and verify every returned row without cloning students, teachers or historical records.
- Class and subject creation and copying share academic-registration validation; require complete fields and approved school-scoped class links so imports cannot bypass creation requirements.

- Form masters admit students into their own class through a checked database function; those students stay inactive until a school admin activates them, so admin approval cannot be bypassed.
- Registration controls use school-scoped permission checks; staff class/subject submissions use RLS-protected inactive rows, teacher student submissions use a checked RPC, and only school administrators approve/activate them. Preserve the assigned-class form-master path and verify saved approval state.
- Registration editing/rejection uses a field-allowlisted invoker RPC with school-administrator checks and preserved activation state; rejection reasons remain on inactive records. Staff profile and custom-role editors use school-scoped RLS updates without changing login identities or school affiliation, so editing cannot grant cross-school access.
- Passport photo AI enhancement runs in the signed-in /api/passport-enhance route (staff-role checked) via Lovable AI image edits; the browser only uploads the photo and receives the white-background result.
- Class positions come only from the shared position-ranking module (school-chosen method stored in the report template); report PDFs are made in the browser from the same report renderer, and WhatsApp delivery status rows are bound to the report card's own student so a result never reaches another parent.
- Scratch-card PINs are stored only as school-bound hashes and redeemed through one atomic service-only database function; each card copies price/views/expiry at creation so rule changes never alter sold cards.
- ID cards get a random verification code per holder; the public QR check shows only what is printed on the card.
