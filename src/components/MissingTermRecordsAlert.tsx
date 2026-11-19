import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const TERM_ORDER = { first: 1, second: 2, third: 3 } as const;

/** Reminds form masters which pupils in their class still lack days present for the current term. */
export function MissingTermRecordsAlert() {
  const { user, schoolId } = useAuth();
  const { data } = useQuery({
    queryKey: ["missing-term-records", schoolId, user?.id],
    enabled: Boolean(schoolId && user?.id),
    queryFn: async () => {
      if (!user?.id || !schoolId) return null;
      const { data: own } = await supabase.from("classes").select("id").eq("school_id", schoolId).eq("teacher_id", user.id);
      const ids = (own ?? []).map((c) => c.id);
      if (!ids.length) return null;
      // Current term = the latest session/term the school has started recording, else the default.
      const { data: latest } = await supabase.from("student_term_records").select("session, term").eq("school_id", schoolId).order("session", { ascending: false }).limit(200);
      const cur = (latest ?? []).sort((a, b) => b.session.localeCompare(a.session) || TERM_ORDER[b.term] - TERM_ORDER[a.term])[0] ?? { session: "2025/2026", term: "first" as const };
      const [st, rec] = await Promise.all([
        supabase.from("students").select("id").eq("school_id", schoolId).eq("active", true).in("class_id", ids),
        supabase.from("student_term_records").select("student_id, days_present").in("class_id", ids).eq("session", cur.session).eq("term", cur.term),
      ]);
      const done = new Set((rec.data ?? []).filter((r) => r.days_present != null).map((r) => r.student_id));
      const missing = (st.data ?? []).filter((s) => !done.has(s.id)).length;
      return missing ? { missing, ...cur } : null;
    },
  });
  if (!data) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
      <ClipboardList className="h-6 w-6 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-destructive">{data.missing} pupil{data.missing > 1 ? "s" : ""} still need term records</h2>
        <p className="text-sm text-foreground">Enter days present and tick psychomotor and affective skills for {data.session} {data.term} term before report cards are generated.</p>
      </div>
      <Button asChild size="sm" variant="destructive"><Link to="/term-records">Open Term Records</Link></Button>
    </div>
  );
}
