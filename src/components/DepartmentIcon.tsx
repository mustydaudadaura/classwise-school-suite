import {
  GraduationCap, Users, BookOpen, Coins, CalendarCheck, FileText, HeartHandshake, ShieldCheck,
  Building, HeartPulse, Landmark, Trophy, MoonStar, Bus, Search, type LucideIcon,
} from "lucide-react";

export const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  "student-affairs": GraduationCap,
  "human-resources": Users,
  "academic-affairs": BookOpen,
  finance: Coins,
  attendance: CalendarCheck,
  submissions: FileText,
  "parents-pta": HeartHandshake,
  security: ShieldCheck,
  facilities: Building,
  health: HeartPulse,
  compliance: Landmark,
  programmes: Trophy,
  tahfiz: MoonStar,
  transport: Bus,
  supervision: Search,
};

export function DepartmentIcon({ slug, className, color }: { slug: string; className?: string; color: string }) {
  const Icon = DEPARTMENT_ICONS[slug] ?? FileText;
  return <Icon className={className} style={{ color }} aria-hidden />;
}
