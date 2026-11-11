import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

/** Danger alert for form masters listing their class students without a passport photo. */
export function MissingPassportAlert() {
  const { user, schoolId } = useAuth();
  const { data } = useQuery({
    queryKey: ["missing-passports", schoolId, user?.id],
    enabled: Boolean(schoolId && user?.id),
    queryFn: async () => {
      if (!user?.id || !schoolId) return [];
      const [own, alloc] = await Promise.all([
        supabase.from("classes").select("id").eq("school_id", schoolId).eq("teacher_id", user.id),
        supabase.from("teacher_allocations").select("class_id").eq("school_id", schoolId).eq("teacher_id", user.id).eq("is_class_teacher", true),
      ]);
      const ids = Array.from(new Set([...(own.data ?? []).map((c) => c.id), ...(alloc.data ?? []).map((a) => a.class_id)]));
      if (!ids.length) return [];
      const { data: rows, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_no, photo_url, classes(name)")
        .eq("school_id", schoolId)
        .in("class_id", ids)
        .or("photo_url.is.null,photo_url.eq.");
      if (error) throw error;
      return (rows ?? []).sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, undefined, { sensitivity: "base" }),
      );
    },
  });
  if (!data?.length) return null;
  return (
    <div role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
        <div>
          <h2 className="font-bold text-destructive">
            Warning: {data.length} student{data.length > 1 ? "s" : ""} in your class {data.length > 1 ? "have" : "has"} no passport photo
          </h2>
          <p className="text-sm text-foreground">
            Please kindly upload the passport photo of each child listed below. Open the student, take or upload the photo,
            and you <strong>must</strong> use <span className="inline-flex items-center gap-1 font-semibold"><Sparkles className="h-3.5 w-3.5" />AI enhance</span> so it has a clean white background.
          </p>
        </div>
      </div>
      <ul className="max-h-72 overflow-y-auto divide-y divide-destructive/20 rounded-lg bg-background">
        {data.map((s, i) => (
          <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              {i + 1}.{" "}
              <Link to="/students/$id" params={{ id: s.id }} search={{ upload: true }} className="font-bold underline-offset-2 hover:underline">
                {s.first_name} {s.last_name}
              </Link>
              <span className="text-muted-foreground"> · {s.admission_no}{(s.classes as { name?: string } | null)?.name ? ` · ${(s.classes as { name: string }).name}` : ""}</span>
            </span>
            <Button asChild size="sm" variant="destructive">
              <Link to="/students/$id" params={{ id: s.id }} search={{ upload: true }}><Camera className="mr-1 h-3.5 w-3.5" />Upload</Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
