-- Read-only regression checks, runnable without modifying school records.
SELECT count(*) = 52 AS all_public_tables_have_rls
FROM pg_tables WHERE schemaname = 'public' AND rowsecurity;
SELECT NOT has_function_privilege('anon', 'public.find_parent_by_phone(text)', 'EXECUTE') AS phone_lookup_is_not_public;
SELECT has_function_privilege('anon', 'public.verify_report_card(text)', 'EXECUTE') AS published_report_verification_remains_public;
SELECT NOT has_function_privilege('authenticated', 'public.capture_school_audit()', 'EXECUTE') AS audit_trigger_is_not_directly_callable;
SELECT convalidated AS student_status_validated FROM pg_constraint
WHERE conrelid = 'public.students'::regclass AND conname = 'students_status_check';