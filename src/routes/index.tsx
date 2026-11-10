import { createFileRoute, Link } from "@tanstack/react-router";
import alegacyLogo from "@/assets/alegacy-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Users,
  FileText,
  Shield,
  BarChart3,
  BookOpen,
  Award,
  Wallet,
  Globe,
  Sparkles,
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  TrendingUp,
  QrCode,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Alegacy — Publish Your School Results Faster, Cheaper & More Efficiently" },
      {
        name: "description",
        content:
          "All-in-one ERP for Nigerian schools: admissions, automatic WAEC grading, beautiful PDF report cards, parent portal, and fees.",
      },
      { property: "og:title", content: "Alegacy — Modern School Management" },
      {
        property: "og:description",
        content:
          "Publish your school results faster, cheaper and more efficiently. Over 100 schools already trust our platform.",
      },
    ],
  }),
  component: Landing,
});

function Feature({
  icon: Icon,
  title,
  desc,
  tag,
}: {
  icon: any;
  title: string;
  desc: string;
  tag?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md hover:border-primary/40">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {tag && <span className="text-[10px] text-primary font-medium">· {tag}</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={alegacyLogo.url} alt="Alegacy Technologies logo" className="h-10 w-14 object-contain" />
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-foreground leading-none">
                Alegacy
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
                School Management Platform
              </span>
            </div>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-xs font-semibold">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="text-xs font-semibold shadow-sm">
                Get Started Free
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section with exact Alegacy Colour Separation */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Left Column: Headline, Proof, and Action Buttons */}
            <div className="space-y-6 lg:col-span-6">
              {/* Trust Badge matching the flyer */}
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-1.5 backdrop-blur-md border border-white/20 text-xs font-medium text-white/95 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-pink-300" />
                <span>Over 100 Schools Already Trust Alegacy</span>
              </div>

              {/* Bold Title */}
              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-pink-200">
                  Publish Your School
                </p>
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-balance leading-[1.08]">
                  SCHOOL RESULTS
                </h1>
                <p className="text-lg sm:text-xl font-medium text-pink-100">
                  Faster, Cheaper &amp; More Efficiently
                </p>
              </div>

              <p className="max-w-xl text-sm sm:text-base text-white/85 leading-relaxed">
                Generate, manage and publish results easily. Automate CA1, CA2, exam calculations,
                Nigerian-standard WAEC grading, Broad sheets, and instant parent portal access.
              </p>

              {/* Highlight Pillars matching flyer bottom badges */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="flex items-center gap-2 rounded-lg bg-white/10 p-2.5 border border-white/15 backdrop-blur-xs text-xs">
                  <Wallet className="h-4 w-4 text-emerald-300 shrink-0" />
                  <span className="font-medium">Manage Fees</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/10 p-2.5 border border-white/15 backdrop-blur-xs text-xs">
                  <Globe className="h-4 w-4 text-sky-300 shrink-0" />
                  <span className="font-medium">Free School Website</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/10 p-2.5 border border-white/15 backdrop-blur-xs text-xs">
                  <Users className="h-4 w-4 text-pink-300 shrink-0" />
                  <span className="font-medium">Students &amp; Classes</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/10 p-2.5 border border-white/15 backdrop-blur-xs text-xs">
                  <Award className="h-4 w-4 text-amber-300 shrink-0" />
                  <span className="font-medium">Reports &amp; Broadsheets</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <Link to="/auth">
                  <Button
                    size="lg"
                    className="bg-white text-primary hover:bg-white/90 font-bold shadow-lg text-sm px-6"
                  >
                    Get Your Free Demo Today
                  </Button>
                </Link>
                <a
                  href="https://wa.me/2348090000000?text=Hello%20Result%20Arena%20I%20would%20like%20to%20learn%20more"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#20ba59] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors"
                >
                  <MessageCircle className="h-4 w-4 fill-white" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Right Column: Tablet Mockup matching the screenshot */}
            <div className="lg:col-span-6">
              <div className="relative mx-auto rounded-2xl border-4 border-white/20 bg-slate-900/40 p-2 shadow-2xl backdrop-blur-md">
                {/* Tablet Frame Header */}
                <div className="rounded-xl overflow-hidden bg-card text-foreground border border-border shadow-md">
                  {/* Mock Tablet Layout: Sidebar + Dashboard */}
                  <div className="flex min-h-[420px]">
                    {/* Deep Midnight Plum Sidebar */}
                    <div className="w-40 sm:w-48 bg-sidebar p-3 text-sidebar-foreground flex flex-col justify-between shrink-0">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sidebar-primary text-white text-xs font-bold">
                            R
                          </div>
                          <span className="font-bold text-xs truncate">Alegacy</span>
                        </div>
                        <nav className="space-y-1 text-xs">
                          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-2 py-1.5 font-medium text-white">
                            <BarChart3 className="h-3.5 w-3.5 text-sidebar-primary" />
                            <span>Dashboard</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground/75 hover:bg-sidebar-accent/50">
                            <Users className="h-3.5 w-3.5" />
                            <span>Students</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground/75 hover:bg-sidebar-accent/50">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Classes</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground/75 hover:bg-sidebar-accent/50">
                            <FileText className="h-3.5 w-3.5" />
                            <span>Results</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground/75 hover:bg-sidebar-accent/50">
                            <Wallet className="h-3.5 w-3.5" />
                            <span>Fees</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground/75 hover:bg-sidebar-accent/50">
                            <Award className="h-3.5 w-3.5" />
                            <span>Reports</span>
                          </div>
                        </nav>
                      </div>
                      <div className="text-[10px] text-sidebar-foreground/60 px-1">
                        Great Minds Academy
                      </div>
                    </div>

                    {/* Dashboard Workspace */}
                    <div className="flex-1 p-3 sm:p-4 bg-background space-y-3 overflow-hidden text-xs">
                      {/* Top greeting bar */}
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <div>
                          <p className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                            Welcome back, Great Minds Academy
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Here's what's happening in your school today
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                          2026/2027 · Second Term
                        </span>
                      </div>

                      {/* 4 Colored Stat Chips matching the flyer screenshot */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <div className="rounded-md border border-pink-200/50 bg-pink-50/60 dark:bg-pink-950/20 p-2">
                          <p className="text-[9px] text-pink-700 dark:text-pink-300 font-medium uppercase truncate">
                            Total Students
                          </p>
                          <p className="text-sm font-bold text-pink-900 dark:text-pink-100 tabular-nums">
                            318
                          </p>
                          <p className="text-[9px] text-emerald-600 font-medium">↑ 12% last term</p>
                        </div>

                        <div className="rounded-md border border-purple-200/50 bg-purple-50/60 dark:bg-purple-950/20 p-2">
                          <p className="text-[9px] text-purple-700 dark:text-purple-300 font-medium uppercase truncate">
                            Results Published
                          </p>
                          <p className="text-sm font-bold text-purple-900 dark:text-purple-100 tabular-nums">
                            318
                          </p>
                          <p className="text-[9px] text-purple-600 font-medium">100% complete</p>
                        </div>

                        <div className="rounded-md border border-emerald-200/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-2">
                          <p className="text-[9px] text-emerald-700 dark:text-emerald-300 font-medium uppercase truncate">
                            Fees Collected
                          </p>
                          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">
                            ₦1,250,000
                          </p>
                          <p className="text-[9px] text-emerald-600 font-medium">↑ 18% collection</p>
                        </div>

                        <div className="rounded-md border border-sky-200/50 bg-sky-50/60 dark:bg-sky-950/20 p-2">
                          <p className="text-[9px] text-sky-700 dark:text-sky-300 font-medium uppercase truncate">
                            Active Classes
                          </p>
                          <p className="text-sm font-bold text-sky-900 dark:text-sky-100 tabular-nums">
                            12
                          </p>
                          <p className="text-[9px] text-sky-600 font-medium">JSS 1 – SS 3</p>
                        </div>
                      </div>

                      {/* Spotlight Card */}
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
                            Publish Results Online
                          </span>
                          <p className="text-xs font-bold text-foreground">
                            Share results with parents instantly
                          </p>
                          <p className="text-[10px] text-muted-foreground hidden sm:block">
                            Generate beautiful result sheets, share via link or QR code.
                          </p>
                        </div>
                        <span className="rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-white shrink-0">
                          Publish Results →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Comprehensive Platform
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Everything your school needs in one place
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Engineered specifically for Nigerian nursery, primary, and secondary private schools to
            automate workflows and impress parents.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={FileText}
            title="Automated Result Processing"
            tag="WAEC Standard"
            desc="Automated CA1 (20), CA2 (20), and Exam (60) score sheets. Computes subject ranks, class average, GPA, and cumulative metrics automatically."
          />
          <Feature
            icon={Award}
            title="Nigerian-Standard Report Cards"
            tag="Print & PDF"
            desc="HisGrace & classic green-bordered Nigerian report templates with QR verification, principal stamps, and psychomotor/affective domain tracking."
          />
          <Feature
            icon={Users}
            title="Instant Parent Portal"
            tag="Phone Login"
            desc="No complicated passwords. Parents sign in with their registered phone number to check results, fee balances, and attendance for all siblings under one roof."
          />
          <Feature
            icon={Wallet}
            title="Fee Tracking & Receipts"
            tag="Finance Ready"
            desc="Issue fee bills, track partial payments, apply sibling discounts, and print branded receipts with immutable financial records."
          />
          <Feature
            icon={BookOpen}
            title="Classes, Subjects & Timetables"
            tag="Curriculum Ready"
            desc="Organize classes from Nursery up to SS3 with arm allocations, scheme of work breakdown, and teacher subject schedules."
          />
          <Feature
            icon={Shield}
            title="Role-Based Security"
            tag="Multi-Role"
            desc="Separate authenticated workspaces for Super Admins, School Admins, Teachers, Parents, and Accountants with strict access boundaries."
          />
        </div>
      </section>

      {/* Bottom Call to Action banner */}
      <section className="bg-muted/30 border-y border-border py-16">
        <div className="mx-auto max-w-5xl px-4 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Join hundreds of Nigerian schools managing results smarter
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Switch from slow spreadsheets and manual report writing to a streamlined, modern
            school management solution today.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="font-bold text-sm px-6">
                Start Free Trial
              </Button>
            </Link>
            <a
              href="https://wa.me/2348090000000?text=Hello%20Result%20Arena%20I%20would%20like%20to%20learn%20more"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#20ba59] px-5 py-2 text-sm font-semibold text-white shadow-sm transition"
            >
              <MessageCircle className="h-4 w-4 fill-white" />
              <span>Talk to an Expert on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span>Alegacy</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Alegacy. All rights reserved. Built for Nigerian schools.
          </p>
          <Link to="/auth" className="text-xs font-semibold text-primary hover:underline">
            Authorized Sign In →
          </Link>
        </div>
      </footer>
    </div>
  );
}
