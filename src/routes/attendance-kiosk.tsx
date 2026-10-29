import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DayBoard } from "@/components/AttendanceDayBoard";
import { publicKioskBoard, publicKioskPunch, publicKioskSchools } from "@/lib/api/staff-attendance.functions";
import { getLocation } from "@/lib/geo-client";
import { fmtTime, SCHOOL_TZ } from "@/lib/staff-attendance";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, Delete, GraduationCap, LogIn, LogOut, MapPin, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/attendance-kiosk")({
  head: () => ({ meta: [
    { title: "Staff Attendance Kiosk — Alegacy" },
    { name: "description", content: "Staff sign in and out of school with a 4-digit PIN. No account login needed." },
    { property: "og:title", content: "Staff Attendance Kiosk — Alegacy" },
    { property: "og:description", content: "Quick PIN-based staff attendance for schools." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PublicKiosk,
});

const KEY = "alegacy-kiosk-school";

function PublicKiosk() {
  const listFn = useServerFn(publicKioskSchools);
  const punch = useServerFn(publicKioskPunch);
  const boardFn = useServerFn(publicKioskBoard);
  const schools = useQuery({ queryKey: ["public-kiosk-schools"], queryFn: () => listFn() });
  const [schoolId, setSchoolId] = useState<string>("");
  const [now, setNow] = useState<Date | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const board = useQuery({ queryKey: ["public-kiosk-board", schoolId], enabled: !!schoolId, queryFn: () => boardFn({ data: { school_id: schoolId } }), refetchInterval: 60000 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSchoolId(localStorage.getItem(KEY) ?? ""); setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!schoolId && schools.data?.length === 1) setSchoolId(schools.data[0].id);
  }, [schools.data, schoolId]);
  useEffect(() => {
    let alive = true;
    const run = async () => { const r = await getLocation(10000); if (!alive) return; if (r.fix) { setGeo(r.fix); setGeoErr(null); } else setGeoErr(r.error ?? "Location unavailable"); };
    run(); const t = setInterval(run, 30000);
    return () => { alive = false; clearInterval(t); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const school = schools.data?.find((s) => s.id === schoolId);
  const pick = (id: string) => { setSchoolId(id); localStorage.setItem(KEY, id); };
  const press = (d: string) => { if (!busy) { setPin((p) => (p + d).slice(0, 4)); setMsg(null); } };

  const act = async (action: "in" | "out") => {
    if (!schoolId) { setMsg({ ok: false, text: "Choose your school first." }); return; }
    if (pin.length !== 4) { setMsg({ ok: false, text: "Enter your 4-digit PIN first." }); return; }
    if (!navigator.onLine) { setMsg({ ok: false, text: "No internet connection. Nothing was recorded." }); return; }
    setBusy(true);
    try {
      const loc = geo ? { fix: geo } : await getLocation(8000);
      const r = await punch({ data: { school_id: schoolId, pin, action, lat: loc.fix?.lat ?? null, lng: loc.fix?.lng ?? null, accuracy: loc.fix?.accuracy ?? null } });
      const extra = "late" in r && r.late ? ` · ${r.lateMinutes} min late` : "";
      setMsg({ ok: true, text: `${r.name}: ${r.already ? "already " : ""}signed ${action} at ${fmtTime(r.time)}${extra}` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally {
      setPin(""); setBusy(false); board.refetch();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 8000);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary/15 via-background to-accent/30">
      {school?.logo_url ? (
        <img src={school.logo_url} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-[85vmin] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.07]" />
      ) : (
        <GraduationCap aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 text-primary opacity-[0.05]" />
      )}

      <div className="relative mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm"><Link to="/auth"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link></Button>
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Staff Kiosk</span>
        </div>

        <div className="text-center">
          {school?.logo_url && <img src={school.logo_url} alt={`${school.name} logo`} className="mx-auto mb-2 h-16 w-16 rounded-full border-2 border-primary/30 bg-card object-contain p-1" />}
          <h1 className="text-lg font-bold leading-tight text-foreground">{school?.name ?? "Staff Attendance"}</h1>
          {school?.motto && <p className="text-xs italic text-muted-foreground">{school.motto}</p>}
        </div>

        {(schools.data?.length ?? 0) > 1 || !school ? (
          <Select value={schoolId} onValueChange={pick}>
            <SelectTrigger className="bg-card/80 backdrop-blur"><SelectValue placeholder={schools.isLoading ? "Loading schools…" : "Choose your school"} /></SelectTrigger>
            <SelectContent>{schools.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
        {schools.error && <p className="text-center text-sm text-destructive">Could not load schools. Please reload.</p>}

        <div className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-xl backdrop-blur">
          <div className="text-center">
            <p className="font-serif text-5xl font-bold tabular-nums tracking-tight text-primary">{now ? now.toLocaleTimeString("en-GB", { timeZone: SCHOOL_TZ, hour12: false }) : "--:--:--"}</p>
            <p className="text-sm text-muted-foreground">{now?.toLocaleDateString("en-GB", { timeZone: SCHOOL_TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>

          <div className="my-5 flex justify-center gap-3" aria-label="PIN entered">
            {[0, 1, 2, 3].map((i) => <div key={i} className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-3xl transition-colors ${pin[i] ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>{pin[i] ? "•" : ""}</div>)}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <Button key={d} variant="secondary" className="h-14 rounded-2xl text-2xl font-semibold" onClick={() => press(d)} disabled={busy}>{d}</Button>)}
            <Button variant="ghost" className="h-14 rounded-2xl" onClick={() => setPin("")}>Clear</Button>
            <Button variant="secondary" className="h-14 rounded-2xl text-2xl font-semibold" onClick={() => press("0")} disabled={busy}>0</Button>
            <Button variant="ghost" className="h-14 rounded-2xl" aria-label="Delete" onClick={() => setPin(pin.slice(0, -1))}><Delete /></Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button size="lg" className="h-14 rounded-2xl text-lg" disabled={busy || pin.length !== 4 || !schoolId} onClick={() => act("in")}><LogIn /> Sign In</Button>
            <Button size="lg" variant="destructive" className="h-14 rounded-2xl text-lg" disabled={busy || pin.length !== 4 || !schoolId} onClick={() => act("out")}><LogOut /> Sign Out</Button>
          </div>
        </div>

        <div role="status" className={`rounded-2xl border p-4 text-center backdrop-blur ${msg ? (msg.ok ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive") : "border-border/60 bg-card/70 text-muted-foreground"}`}>
          {msg ? <p className="flex items-center justify-center gap-2 font-medium">{msg.ok ? <CheckCircle2 /> : <ShieldAlert />}{msg.text}</p>
            : busy ? "Recording…" : "Enter your PIN, then press Sign In or Sign Out."}
        </div>

        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{geo ? `Location ready (±${Math.round(geo.accuracy)} m)` : geoErr ?? "Getting location…"}</p>
      </div>
      {schoolId && (
        <div className="relative mx-auto max-w-3xl space-y-4 px-4 pb-10">
          {board.error && <p className="text-center text-sm text-destructive">Could not load attendance history.</p>}
          {board.isLoading && <p className="text-center text-sm text-muted-foreground">Loading attendance history…</p>}
          {board.data && <><DayBoard title="Today" day={board.data.today} /><DayBoard title="Yesterday" day={board.data.yesterday} /></>}
        </div>
      )}
    </div>
  );
}
