# Architecture rules

- Password recovery uses the public /reset-password screen, separate from sign-in redirects; legacy recovery links on /auth are forwarded with their hash so users can choose a new password.

- Extend existing TanStack Start screens and PostgreSQL tables additively; preserve historical records and working school workflows during phased upgrades.
- Store school configuration, custom roles, permission assignments and audit records separately from user profiles; school affiliation never grants operational permissions.
- Enforce module activation and school-scoped permissions in database policies and authenticated server functions; navigation visibility is not authorization.
- Use authenticated RLS clients for ordinary operations; dynamically import privileged clients only inside authorized handlers for true administrative work.
- Keep audit records append-only and write them in database triggers so direct client mutations are covered.
- Store report presentation choices on the school and resolve them through one shared report renderer for staff, families and printing; keep colour values in global CSS tokens and compute subject ranks in an authorized database function.
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
- SECURITY DEFINER execution is limited by purpose: trigger functions and parent phone lookup are server-only, policy helpers remain authenticated-callable, and published-report verification stays public.
