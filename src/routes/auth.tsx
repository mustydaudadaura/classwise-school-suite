import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setParentSession } from "@/hooks/useParentAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Clock, GraduationCap, Phone, School, Users } from "lucide-react";
import { startDemo } from "@/lib/api/demo.functions";

import { useServerFn } from "@tanstack/react-start";
import { isPasswordRecoveryHash } from "@/lib/password-recovery";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Alegacy" }, { name: "description", content: "Sign in for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Sign in — Alegacy" }, { property: "og:description", content: "Sign in for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  validateSearch: (s: Record<string, unknown>): { portal?: "parent" } => (s.portal === "parent" ? { portal: "parent" } : {}),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { portal } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  useEffect(() => {
    if (isPasswordRecoveryHash(window.location.hash)) {
      window.location.replace(`/reset-password${window.location.hash}`);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    }).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        window.location.replace(`/reset-password${window.location.hash}`);
        return;
      }
      if (s) navigate({ to: "/dashboard", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) toast.error(error.message);
      else {
        toast.success("Welcome back!");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const parentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/public/parent-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: parentPhone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");
      setParentSession(json.token, json.parent);
      toast.success(`Welcome, ${json.parent.full_name}`);
      navigate({ to: "/portal" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,0,88,0.06),transparent_55%)] pointer-events-none" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-foreground leading-tight">Alegacy</span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-wide">School Management Platform</span>
          </div>
        </Link>
        <Button asChild size="lg" className="mb-4 h-14 w-full rounded-2xl text-base font-semibold shadow-md shadow-primary/25">
          <Link to="/attendance-kiosk"><Clock className="mr-2 h-5 w-5" /> Staff Attendance Kiosk</Link>
        </Button>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to your account or create a new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium text-foreground">Just looking around?</p>
              <p className="mb-3 text-muted-foreground">Explore a demo school with students, results and fees already filled in.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full text-xs font-semibold shadow-sm"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Attempt Supabase sign in if configured, otherwise activate demo admin session
                      let creds = { email: "demo.admin@eduerp-demo.ng", password: "DemoSchool#2026" };
                      try {
                        const c = await startDemo();
                        if (c?.email && c?.password) creds = c;
                      } catch (err) {
                        console.warn("Using static demo credentials:", err);
                      }
                      const { error } = await supabase.auth.signInWithPassword(creds);
                      if (error) throw error;
                      toast.success("Welcome to the demo school!");
                      navigate({ to: "/dashboard" });
                    } catch (e: any) {
                      toast.error(e?.message || "Demo sign-in failed. Please reload and try again.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {loading ? (
                    "Opening…"
                  ) : (
                    <>
                      <School className="mr-1.5 h-4 w-4" />
                      Admin / Staff Demo
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs font-semibold bg-background hover:bg-muted"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const res = await fetch("/api/public/parent-login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ phone: "08031000001" }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || "Parent demo login failed");
                      setParentSession(json.token, json.parent);
                      toast.success(`Welcome, ${json.parent.full_name}`);
                      navigate({ to: "/portal" });
                    } catch (e: any) {
                      toast.error(e?.message ?? "Parent demo unavailable");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <Users className="mr-1.5 h-4 w-4" />
                  Parent Demo
                </Button>
              </div>
            </div>
            <Tabs defaultValue={portal === "parent" ? "parent" : "signin"}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">
                  <School className="mr-1.5 h-3.5 w-3.5" />
                  Staff & Admin
                </TabsTrigger>
                <TabsTrigger value="parent">
                  <Phone className="mr-1.5 h-3.5 w-3.5" />
                  Parent Portal
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-4 pt-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      School Administrator & Staff Sign In
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Sign in with your email and password to access your school dashboard.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="admin@school.ng"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Button
                        type="button"
                        variant="link"
                        onClick={async () => {
                          if (!email.trim()) {
                            toast.error("Please enter your email address first.");
                            return;
                          }
                          try {
                            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                              redirectTo: `${window.location.origin}/reset-password`,
                            });
                            if (error) throw error;
                            toast.success("Password reset instructions sent to your email!");
                          } catch (err: any) {
                            toast.error(err?.message || "Failed to send reset email.");
                          }
                        }}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full font-semibold" disabled={loading}>
                    {loading ? "Signing in…" : "Sign In to Portal"}
                  </Button>
                  <div className="rounded-md border border-border/60 bg-muted/40 p-2.5 text-center text-xs text-muted-foreground">
                    <p className="text-[11px] leading-relaxed">
                      Need credentials? Accounts are provisioned exclusively by the Platform Super Admin or your School Administrator.
                    </p>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="parent">
                <form onSubmit={parentLogin} className="space-y-4 pt-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      Parent & Guardian Sign In
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Enter the phone number registered with the school to view your child's academic reports.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent_phone">Phone number</Label>
                    <Input id="parent_phone" type="tel" inputMode="tel" required placeholder="e.g. 08012345678"
                      value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      No password required. Enter your registered phone number.
                    </p>
                  </div>
                  <Button type="submit" className="w-full font-semibold" disabled={loading}>
                    {loading ? "Checking…" : "Enter Parent Portal"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
