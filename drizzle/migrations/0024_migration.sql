-- Demo school with fictional data (fixed ids, idempotent)
INSERT INTO public.schools (id,name,code,address,phone,email,motto,current_session,current_term,active,principal_name)
VALUES ('af91ff67-95eb-4b62-93a0-5617d23a2f1d','Alegacy Demo Academy','DEMO','12 Sample Road, Kaduna','08030000000','demo@alegacyng.com.ng','Knowledge and Character','2025/2026','first',true,'Mallam Demo Principal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.classes (id,school_id,name,level,arm,section,active,pending_activation) VALUES
('a0000000-0000-4000-8000-000000000001','af91ff67-95eb-4b62-93a0-5617d23a2f1d','Primary 4','Primary 4','A','primary',true,false),
('a0000000-0000-4000-8000-000000000002','af91ff67-95eb-4b62-93a0-5617d23a2f1d','JSS 1','JSS 1','A','secondary',true,false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.subjects (id,school_id,name,code,class_id,active,pending_activation) VALUES
('b0000000-0000-4000-8000-000000000001','af91ff67-95eb-4b62-93a0-5617d23a2f1d','Mathematics','MTH','a0000000-0000-4000-8000-000000000001',true,false),
('b0000000-0000-4000-8000-000000000002','af91ff67-95eb-4b62-93a0-5617d23a2f1d','English Language','ENG','a0000000-0000-4000-8000-000000000001',true,false),
('b0000000-0000-4000-8000-000000000003','af91ff67-95eb-4b62-93a0-5617d23a2f1d','Basic Science','BSC','a0000000-0000-4000-8000-000000000001',true,false),
('b0000000-0000-4000-8000-000000000004','af91ff67-95eb-4b62-93a0-5617d23a2f1d','Mathematics','MTH','a0000000-0000-4000-8000-000000000002',true,false),
('b0000000-0000-4000-8000-000000000005','af91ff67-95eb-4b62-93a0-5617d23a2f1d','English Language','ENG','a0000000-0000-4000-8000-000000000002',true,false),
('b0000000-0000-4000-8000-000000000006','af91ff67-95eb-4b62-93a0-5617d23a2f1d','Basic Technology','BTE','a0000000-0000-4000-8000-000000000002',true,false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.students (id,school_id,admission_no,first_name,last_name,gender,class_id,active,pending_activation,status) VALUES
('c0000000-0000-4000-8000-000000000001','af91ff67-95eb-4b62-93a0-5617d23a2f1d','DEMO/2025/0001','Zainab','Bello','female','a0000000-0000-4000-8000-000000000001',true,false,'active'),
('c0000000-0000-4000-8000-000000000002','af91ff67-95eb-4b62-93a0-5617d23a2f1d','DEMO/2025/0002','Farouk','Bello','male','a0000000-0000-4000-8000-000000000002',true,false,'active'),
('c0000000-0000-4000-8000-000000000003','af91ff67-95eb-4b62-93a0-5617d23a2f1d','DEMO/2025/0003','Aisha','Musa','female','a0000000-0000-4000-8000-000000000001',true,false,'active'),
('c0000000-0000-4000-8000-000000000004','af91ff67-95eb-4b62-93a0-5617d23a2f1d','DEMO/2025/0004','Ibrahim','Yusuf','male','a0000000-0000-4000-8000-000000000002',true,false,'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parents (id,school_id,full_name,phone,email) VALUES
('d6ec3069-0809-4eba-a77a-ca441363b192','af91ff67-95eb-4b62-93a0-5617d23a2f1d','Mrs. Hauwa Bello','08031000001','parent.demo@alegacyng.com.ng')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.student_parents (student_id,parent_id,relationship,is_primary)
SELECT s, 'd6ec3069-0809-4eba-a77a-ca441363b192','mother',true FROM unnest(ARRAY['c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002']::uuid[]) s
WHERE NOT EXISTS (SELECT 1 FROM public.student_parents sp WHERE sp.student_id=s AND sp.parent_id='d6ec3069-0809-4eba-a77a-ca441363b192');

INSERT INTO public.assessments (school_id,student_id,subject_id,class_id,session,term,ca1,ca2,exam,grade,status)
SELECT 'af91ff67-95eb-4b62-93a0-5617d23a2f1d', st.id, sb.id, st.class_id, '2025/2026','first',
  12 + (abs(hashtext(st.id::text||sb.id::text)) % 8), 11 + (abs(hashtext(sb.id::text||st.id::text)) % 9), 40 + (abs(hashtext(st.id::text||'x'||sb.id::text)) % 20), NULL, 'approved'
FROM public.students st JOIN public.subjects sb ON sb.class_id=st.class_id
WHERE st.school_id='af91ff67-95eb-4b62-93a0-5617d23a2f1d'
AND NOT EXISTS (SELECT 1 FROM public.assessments a WHERE a.student_id=st.id AND a.subject_id=sb.id AND a.session='2025/2026' AND a.term='first');

INSERT INTO public.fee_invoices (school_id,student_id,title,session,term,amount_due,amount_paid,status,due_date)
SELECT 'af91ff67-95eb-4b62-93a0-5617d23a2f1d', id, 'First Term School Fees','2025/2026','first',85000,
  CASE WHEN admission_no LIKE '%1' THEN 85000 WHEN admission_no LIKE '%2' THEN 40000 ELSE 0 END,
  (CASE WHEN admission_no LIKE '%1' THEN 'paid' WHEN admission_no LIKE '%2' THEN 'partial' ELSE 'unpaid' END)::invoice_status,
  DATE '2025-10-15'
FROM public.students st WHERE school_id='af91ff67-95eb-4b62-93a0-5617d23a2f1d'
AND NOT EXISTS (SELECT 1 FROM public.fee_invoices f WHERE f.student_id=st.id AND f.session='2025/2026' AND f.term='first');

INSERT INTO public.attendance (school_id,student_id,class_id,date,status)
SELECT 'af91ff67-95eb-4b62-93a0-5617d23a2f1d', st.id, st.class_id, d::date,
  (CASE WHEN abs(hashtext(st.id::text||d::text)) % 10 = 0 THEN 'absent' ELSE 'present' END)::attendance_status
FROM public.students st, generate_series(current_date - 13, current_date - 1, interval '1 day') d
WHERE st.school_id='af91ff67-95eb-4b62-93a0-5617d23a2f1d' AND extract(isodow from d) < 6
AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.student_id=st.id AND a.date=d::date);