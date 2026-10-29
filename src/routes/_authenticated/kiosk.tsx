import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DayBoard } from "@/components/AttendanceDayBoard";
import { useAuth } from "@/hooks/useAuth";
import { kioskBoard, kioskIdentify, kioskPunch } from "@/lib/api/staff-attendance.functions";
import { getLocation } from "@/lib/geo-client";
import { checkSites, fmtTime, SCHOOL_TZ } from "@/lib/staff-attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Delete, LogIn, LogOut, MapPin, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kiosk")({
  head: () => ({ meta: [
    { title: "Attendance Kiosk — Alegacy" },
    { name: "description", content: "Shared tablet kiosk where staff sign in and out with a 4-digit PIN." },
    { property: "og:title", content: "Attendance Kiosk — Alegacy" },
    { property: "og:description", content: "PIN-based staff attendance kiosk for schools." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: KioskPage,
});

const naira = (n: number) => (n > 0 ? `₦${Math.round(n).toLocaleString()}` : "0");

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

function KioskPage() {
  const { schoolId } = useAuth();
  const identify = useServerFn(kioskIdentify);
  const punch = useServerFn(kioskPunch);
  const board = useServerFn(kioskBoard);
  const now = useClock();
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = useQuery({ queryKey: ["kiosk-board", schoolId], enabled: !!schoolId, queryFn: () => board({ data: { school_id: schoolId! } }), refetchInterval: 60000 });

  useEffect(() => {
    let alive = true;
    const run = async () => { const r = await getLocation(10000); if (!alive) return; if (r.fix) { setGeo(r.fix); setGeoErr(null); } else setGeoErr(r.error ?? "Location unavailable"); };
    run(); const t = setInterval(run, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!schoolId) return <p className="text-muted-foreground">Select a school first.</p>;

  const sites = q.data?.sites ?? [];
  const hit = geo && sites.length ? checkSites(geo, sites) : null;
  const clear = (ms: number) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), ms); };

  const act = async (action: "in" | "out") => {
    if (pin.length !== 4) { setMsg({ ok: false, text: "Enter your 4-digit PIN first." }); return; }
    if (!navigator.onLine) { setMsg({ ok: false, text: "No internet connection. Nothing was recorded." }); return; }
    setBusy(true);
    try {
      const who = await identify({ data: { school_id: schoolId, pin } });
      const loc = geo ? { fix: geo } : await getLocation(8000);
      const r = await punch({ data: { school_id: schoolId, pin, action, lat: loc.fix?.lat ?? null, lng: loc.fix?.lng ?? null, accuracy: loc.fix?.accuracy ?? null } });
      const label = action === "in" ? "Signed in" : "Signed out";
      const extra = "late" in r && r.late ? ` · ${r.lateMinutes} min late` : "";
      setMsg({ ok: true, text: `${who.name}: ${r.already ? "already " : ""}${label.toLowerCase()} at ${fmtTime(r.time)}${extra}` });
      q.refetch();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setPin(""); setBusy(false); clear(8000); }
  };
  const press = (d: string) => { if (!busy) { setPin((p) => (p + d).slice(0, 4)); setMsg(null); } };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card><CardContent className="space-y-6 p-6 sm:p-8">
        <div>
          <p className="text-sm text-muted-foreground">Local time (Lagos)</p>
          <p className="font-serif text-6xl font-bold tabular-nums tracking-tight">{now ? now.toLocaleTimeString("en-GB", { timeZone: SCHOOL_TZ, hour12: false }) : "--:--:--"}</p>
          <p className="text-muted-foreground">{now?.toLocaleDateString("en-GB", { timeZone: SCHOOL_TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex gap-3" aria-label="PIN entered">
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-border bg-background text-3xl">{pin[i] ? "•" : ""}</div>)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <Button key={d} variant="secondary" className="h-16 text-2xl" onClick={() => press(d)} disabled={busy}>{d}</Button>)}
          <Button variant="secondary" className="h-16" onClick={() => setPin("")}>Clear</Button>
          <Button variant="secondary" className="h-16 text-2xl" onClick={() => press("0")} disabled={busy}>0</Button>
          <Button variant="secondary" className="h-16" aria-label="Delete" onClick={() => setPin(pin.slice(0, -1))}><Delete /></Button>
        </div>
        <div role="status" className={`rounded-xl border-2 p-4 text-center text-sm ${hit?.inside ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
          {!sites.length ? "No school site has been set. Ask the administrator to add one in Attendance settings."
            : geoErr && !geo ? geoErr
            : !hit ? "Getting location…"
            : <><b>{hit.inside ? "On-site" : "Off-site"} at {hit.site.name.toUpperCase()}</b> · {hit.distance}m from center (allowed: {hit.site.radius_m}m)</>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" className="h-16 text-xl" disabled={busy || pin.length !== 4} onClick={() => act("in")}><LogIn /> Sign In</Button>
          <Button size="lg" variant="destructive" className="h-16 text-xl" disabled={busy || pin.length !== 4} onClick={() => act("out")}><LogOut /> Sign Out</Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">Enter your 4-digit PIN, then press Sign In or Sign Out.<br /><span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{geo ? `Location ready (±${Math.round(geo.accuracy)} m)` : "Getting location…"}</span></p>
      </CardContent></Card>

      <Card><CardContent className="p-6 text-center">
        {msg ? <p className={`flex items-center justify-center gap-2 text-lg font-medium ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.ok ? <CheckCircle2 /> : <ShieldAlert />}{msg.text}</p>
          : <><p className="text-muted-foreground">Ready</p><p className="text-xl text-muted-foreground">Please enter your PIN to clock in or out.</p></>}
      </CardContent></Card>

      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && <><DayBoard title="Today" day={q.data.today} /><DayBoard title="Yesterday" day={q.data.yesterday} /></>}
    </div>
  );
}

