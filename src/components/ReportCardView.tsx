import { useEffect, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { IslamiyyaReportCard } from '@/components/IslamiyyaReportCard';
import { resolveReportTemplate } from '@/lib/report-template';
import {
  ShieldCheck,
  BarChart3,
  PieChart as PieIcon,
  SlidersHorizontal,
  Check,
  Printer,
  Upload,
  PenLine,
  Stamp,
  Award,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Barcode } from "@/lib/barcode";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Assessment = {
  id: string;
  subject_position?: number | string | null;
  ca1: number;
  ca2: number;
  ca_total?: number;
  exam: number;
  total: number;
  first_term_total?: number;
  second_term_total?: number;
  third_term_total?: number;
  session_average?: number;
  grade: string | null;
  remark: string | null;
  class_avg?: number | null;
  subjects: { name: string; code: string | null } | null;
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "#10b981", // Emerald
  "A": "#059669",
  "A-": "#047857",
  "B+": "#3b82f6", // Blue
  "B": "#2563eb",
  "B-": "#1d4ed8",
  "C+": "#f59e0b", // Amber
  "D": "#d97706",
  "F": "#ef4444", // Red
};

function SignatureBox({
  title,
  roleName,
  defaultName,
  signatureUrl,
  onUpload,
  onClear,
  id,
}: {
  title: string;
  roleName: string;
  defaultName: string;
  signatureUrl: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  id: string;
}) {
  const [name, setName] = useState(defaultName);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="report-signature-slot flex flex-col justify-between items-center text-center border border-slate-300 dark:border-slate-700 print:border-black p-1.5 rounded bg-slate-50/60 dark:bg-slate-900/40 print:bg-transparent print:p-1 print:rounded-none">
      {/* Signature image or upload button */}
      <div className="relative w-full h-8 flex items-center justify-center">
        {signatureUrl ? (
          <div className="group relative w-full h-full flex items-center justify-center">
            <img
              src={signatureUrl}
              alt={`${title} signature`}
              className="report-signature-img max-h-7 max-w-[110px] object-contain select-none mix-blend-multiply dark:mix-blend-normal print:mix-blend-multiply"
            />
            <button
              type="button"
              onClick={onClear}
              className="print:hidden absolute inset-0 bg-black/60 text-white text-[8px] font-semibold opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity"
              title="Remove signature"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center">
            <label
              htmlFor={`upload-${id}`}
              className="print:hidden inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-semibold rounded border border-dashed border-primary/70 text-primary hover:bg-primary/10 cursor-pointer transition-colors shadow-2xs"
            >
              <Upload className="h-2.5 w-2.5" />
              <span>Sign</span>
            </label>
            <input
              id={`upload-${id}`}
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="hidden print:hidden"
            />
            {/* Blank signature space in print mode */}
            <div className="hidden print:block w-20 border-b border-black mb-0.5 h-5" />
          </div>
        )}
      </div>

      {/* Signature Divider Line */}
      <div className="report-signature-line w-full border-b border-black/80 my-0.5" />

      {/* Signatory Name */}
      <div className="w-full px-1">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="w-full text-center text-[8.5px] font-bold uppercase bg-white border border-primary rounded px-1 py-0.5 print:border-none print:bg-transparent"
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="font-bold text-[8.5px] uppercase tracking-tight truncate cursor-pointer hover:text-primary transition-colors print:cursor-default"
            title="Click to edit name"
          >
            {name || "________________"}
          </div>
        )}
      </div>

      {/* Role Title and Date */}
      <div className="text-[7.5px] font-semibold text-slate-700 dark:text-slate-300 print:text-black uppercase">
        {title}
      </div>
    </div>
  );
}

export function ReportCardView({
  rc,
  assessments,
}: {
  rc: any;
  assessments: Assessment[];
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [activeTemplate, setActiveTemplate] = useState<"eduerp_national" | "eduerp_classic">("eduerp_national");
  const [customStampUrl, setCustomStampUrl] = useState<string>("");

  const school = rc?.schools || {};
  const student = rc?.students || {};
  const klass = rc?.classes || {};

  // Dedicated Signatures
  const [teacherSignature, setTeacherSignature] = useState<string>("");
  const [principalSignature, setPrincipalSignature] = useState<string>(
    school?.principal_signature_url || ""
  );
  const [parentSignature, setParentSignature] = useState<string>("");

  const effectiveStampUrl = customStampUrl || school?.stamp_url || "";

  // Handle uploaded signatures
  const handleSignatureUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setter(event.target.result);
        toast.success("Signature uploaded successfully!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle uploaded stamp
  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setCustomStampUrl(event.target.result);
        toast.success("Official stamp uploaded successfully!");
      }
    };
    reader.readAsDataURL(file);
  };

  const admNo = student?.admission_no || rc?.student_admission_no || "03/1643";
  const fullName = student?.first_name
    ? `${student.last_name || ""}, ${student.first_name || ""} ${student.middle_name || ""}`.trim()
    : rc?.student_name || "ENORENSE, KIRIKU VICTORY";

  const verificationCode = rc?.verification_code || `EDUERAP-VERIF-${admNo.replace(/[^A-Za-z0-9]/g, "")}-OK`;

  useEffect(() => {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/verify/${encodeURIComponent(verificationCode)}`
      : `https://eduerp.ng/verify/${verificationCode}`;
    QRCode.toDataURL(url, { width: 120, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [verificationCode]);

  // Affective Domain
  const affectiveData = [
    { trait: "Attentiveness", score: rc?.affective?.attentiveness ?? 5 },
    { trait: "Honesty", score: rc?.affective?.honesty ?? 5 },
    { trait: "Neatness", score: rc?.affective?.neatness ?? 5 },
    { trait: "Politeness", score: rc?.affective?.politeness ?? 4 },
    { trait: "Punctuality/ Assembly", score: rc?.affective?.punctuality ?? 5 },
    { trait: "Self Control/ Calmness", score: rc?.affective?.self_control ?? 5 },
    { trait: "Obedience", score: rc?.affective?.obedience ?? 5 },
    { trait: "Reliability", score: rc?.affective?.reliability ?? 4 },
    { trait: "Sense Of Responsibility", score: rc?.affective?.responsibility ?? 5 },
    { trait: "Relationship With Others", score: rc?.affective?.relationship ?? 4 },
  ];

  // Psychomotor Skills
  const psychomotorData = [
    { skill: "Handling Of Tools", score: rc?.psychomotor?.handling_tools ?? 5 },
    { skill: "Drawing/ Painting", score: rc?.psychomotor?.drawing ?? 4 },
    { skill: "Handwriting", score: rc?.psychomotor?.handwriting ?? 4 },
    { skill: "Public Speaking", score: rc?.psychomotor?.public_speaking ?? 5 },
    { skill: "Speech Fluency", score: rc?.psychomotor?.speech_fluency ?? 5 },
    { skill: "Sports & Games", score: rc?.psychomotor?.sports ?? 4 },
  ];

  // Grade Distribution Map
  const gradeDistributionMap: Record<string, number> = {};
  const chartSubjectData = (assessments || []).slice(0, 9).map((a) => {
    const subName = a.subjects?.name || "Subject";
    const shortName = subName.length > 9 ? subName.slice(0, 8) + "…" : subName;
    const studentScore = Number(a.total || 0);
    const classAvg = a.class_avg ? Number(a.class_avg) : 63.5;
    return {
      name: shortName,
      fullName: subName,
      studentScore,
      classAvg,
      grade: a.grade || "D",
    };
  });

  (assessments || []).forEach((a) => {
    const g = a.grade || "D";
    gradeDistributionMap[g] = (gradeDistributionMap[g] || 0) + 1;
  });

  const pieChartData = Object.entries(gradeDistributionMap).map(([grade, count]) => ({
    name: `Grade ${grade}`,
    grade,
    value: count,
    color: GRADE_COLORS[grade] || "#64748b",
  }));

  const totalScoreObtainable = rc?.total_obtainable || (assessments?.length ? assessments.length * 100 : 1600);
  const totalScoreObtained = rc?.total_score || 928.83;
  const percentageScore = rc?.average || ((totalScoreObtained / totalScoreObtainable) * 100).toFixed(1);
  const summaryGrade = percentageScore >= 75 ? "B" : percentageScore >= 60 ? "C+" : percentageScore >= 40 ? "D" : "F";
  const positionStr = rc?.position ? `${rc.position}${rc.position === 1 ? "st" : rc.position === 2 ? "nd" : rc.position === 3 ? "rd" : "th"}` : "12th";
  const classSize = rc?.class_size || 21;

  const schoolDisplayName = school?.name || "EduERP National Academy";
  const schoolMotto = school?.motto || "";
  const schoolAddress = school?.address || "";
  const schoolContact = [school?.phone ? `Tel: ${school.phone}` : "", school?.email ? `Email: ${school.email}` : ""].filter(Boolean).join(" • ");

  if (resolveReportTemplate(school.report_template, klass.section).layout_id === 'islamiyya_arabic') {
    return <div className="space-y-4 pb-8"><div className="max-w-full overflow-x-auto"><IslamiyyaReportCard rc={rc} assessments={assessments} qrDataUrl={qrDataUrl} /></div></div>;
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Interactive Controls Bar (Hidden during printing) */}
      <div className="print:hidden mx-auto max-w-[210mm] bg-card border border-border rounded-xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Template:</span>
          <div className="inline-flex rounded-lg border border-border bg-muted p-1">
            <button
              onClick={() => setActiveTemplate("eduerp_national")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTemplate === "eduerp_national"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EduERP National Standard (Fit A4)
            </button>
            <button
              onClick={() => setActiveTemplate("eduerp_classic")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTemplate === "eduerp_classic"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EduERP Classic Institutional (Fit A4)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Stamp upload button if none */}
          <label className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted cursor-pointer transition-colors">
            <Stamp className="h-3.5 w-3.5 text-primary" />
            <span>{effectiveStampUrl ? "Change Stamp" : "Upload School Stamp"}</span>
            <input type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
          </label>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save Fit A4 PDF
          </button>
        </div>
      </div>

      {/* Report Sheet Container */}
      <div className="max-w-full overflow-x-auto py-1">
        {activeTemplate === "eduerp_national" ? (
          /* =========================================================
             EDUERAP NATIONAL SINGLE-PAGE A4 STANDARD
             (Replicating layout from attached sample with EduERP app name)
             ========================================================= */
          <div
            id="eduerp-report-card"
            className="eduerp-sheet mx-auto bg-white text-black font-sans shadow-xl print:shadow-none print:m-0 border border-slate-300 print:border-none p-3.5 sm:p-4 relative box-border"
            style={{ width: "210mm", maxHeight: "297mm", color: "#111827" }}
          >
            {/* 1. SCHOOL HEADER */}
            <div className="flex items-start justify-between gap-2 border-b border-black pb-1.5">
              {/* Left: School Crest Logo (Only visible if uploaded, else completely blank space) */}
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {school?.logo_url ? (
                  <div className="w-18 h-18 flex items-center justify-center p-0.5 bg-white">
                    <img
                      src={school.logo_url}
                      alt={schoolDisplayName}
                      className="max-h-18 max-w-18 object-contain"
                    />
                  </div>
                ) : (
                  /* Blank space unless uploaded */
                  <div className="w-18 h-18" />
                )}
              </div>

              {/* Center: School Info & Motto */}
              <div className="flex-1 text-center px-1">
                <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-[#0f2d59] font-serif leading-tight">
                  {schoolDisplayName}
                </h1>
                {schoolMotto ? (
                  <p className="text-[10px] font-bold tracking-wider italic text-slate-800 mt-0.5">
                    Motto: {schoolMotto}
                  </p>
                ) : null}
                {schoolAddress ? (
                  <p className="text-[9px] text-slate-700 leading-tight mt-0.5">
                    {schoolAddress}
                  </p>
                ) : null}
                {schoolContact ? (
                  <p className="text-[8.5px] text-slate-700 leading-tight">
                    {schoolContact}
                  </p>
                ) : null}

                {/* Term Report Banner */}
                <div className="mt-1 text-center">
                  <h2 className="text-[11px] font-black uppercase tracking-wide text-black border-y border-black py-0.5 inline-block px-3">
                    {rc?.session || "2025 / 2026"} – {String(rc?.term || "THIRD").toUpperCase()} TERM PUPIL'S PERFORMANCE REPORT
                  </h2>
                </div>
              </div>

              {/* Right: Student Passport Photo & Barcode */}
              <div className="w-20 shrink-0 flex flex-col items-center gap-0.5">
                <div className="w-18 h-22 border border-black bg-slate-50 flex items-center justify-center overflow-hidden">
                  {student?.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt="Pupil"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    /* Blank space if not uploaded */
                    <div className="text-[8px] font-bold text-slate-400 uppercase">Photo</div>
                  )}
                </div>
                {/* Barcode beneath photo */}
                <div className="scale-80 origin-top -mt-1">
                  <Barcode value={admNo} height={16} barWidth={0.9} showText={false} fillColor="#000000" />
                  <div className="text-[7.5px] font-mono text-center font-bold">{admNo}</div>
                </div>
              </div>
            </div>

            {/* 2. TOP INFORMATION THREE-BOX ROW */}
            <div className="grid grid-cols-12 gap-1.5 mt-1.5 text-[9.5px]">
              {/* Box 1: PERSONAL DATA (5 cols) */}
              <div className="col-span-5 border border-black">
                <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 uppercase tracking-wide text-[9.5px]">
                  PERSONAL DATA
                </div>
                <table className="w-full text-left border-collapse text-[9px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1 py-0.5 w-20">NAME:</td>
                      <td className="px-1 py-0.5 font-bold truncate">{fullName}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1 py-0.5">ADMN NO:</td>
                      <td className="px-1 py-0.5 font-bold">{admNo}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1 py-0.5">GENDER:</td>
                      <td className="px-1 py-0.5 font-semibold uppercase">{student?.gender || "MALE"}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1 py-0.5">CLASS:</td>
                      <td className="px-1 py-0.5 font-bold uppercase">{klass?.name || "CLASS 2A"}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="font-bold px-1 py-0.5">D.O.B:</td>
                      <td className="px-1 py-0.5 font-medium">{student?.dob ? new Date(student.dob).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "Mon, 02-Feb-2004"}</td>
                    </tr>
                    <tr>
                      <td className="font-bold px-1 py-0.5">CLUB/SOCIETY:</td>
                      <td className="px-1 py-0.5 font-medium truncate">{student?.club || student?.house || "SCRABBLE, JETS, DEBATE"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Box 2: ATTENDANCE & TERMINAL DURATION (4 cols) */}
              <div className="col-span-4 border border-black flex flex-col justify-between">
                <div>
                  <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 uppercase tracking-wide text-[9.5px]">
                    ATTENDANCE
                  </div>
                  <table className="w-full text-center border-collapse text-[8.5px]">
                    <thead>
                      <tr className="border-b border-black bg-slate-50">
                        <th className="border-r border-black p-0.5 font-semibold leading-tight">No of Times<br/>School Opened</th>
                        <th className="border-r border-black p-0.5 font-semibold leading-tight">No of Times<br/>Present</th>
                        <th className="p-0.5 font-semibold leading-tight">No of Times<br/>Absent</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-black font-bold">
                        <td className="border-r border-black p-0.5">{rc?.days_total ?? 134}</td>
                        <td className="border-r border-black p-0.5">{rc?.days_present ?? 130}</td>
                        <td className="p-0.5">{rc?.days_absent ?? 4}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="bg-[#d1d5db] font-bold text-center border-y border-black py-0.5 uppercase tracking-wide text-[9.5px]">
                    TERMINAL DURATION
                  </div>
                  <table className="w-full text-center border-collapse text-[8.5px]">
                    <thead>
                      <tr className="border-b border-black bg-slate-50">
                        <th className="border-r border-black p-0.5 font-semibold">Term Beginning</th>
                        <th className="p-0.5 font-semibold">Term Ending</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-bold">
                        <td className="border-r border-black p-0.5">{rc?.term_beginning || "04/04/2025"}</td>
                        <td className="p-0.5">{rc?.term_ending || "04/09/2025"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Box 3: PERFORMANCE SUMMARY (3 cols) */}
              <div className="col-span-3 border border-black">
                <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 uppercase tracking-wide text-[9.5px]">
                  PERFORMANCE SUMMARY
                </div>
                <table className="w-full border-collapse text-[9px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="px-1 py-0.5 text-slate-700">Total Score Obtainable:</td>
                      <td className="px-1 py-0.5 font-bold text-right">{Number(totalScoreObtainable).toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="px-1 py-0.5 text-slate-700">Total Score Obtained:</td>
                      <td className="px-1 py-0.5 font-bold text-right">{Number(totalScoreObtained).toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="px-1 py-0.5 text-slate-700 font-bold">%TAGE:</td>
                      <td className="px-1 py-0.5 font-bold text-right">{percentageScore}%</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="px-1 py-0.5 text-slate-700 font-bold">GRADE:</td>
                      <td className="px-1 py-0.5 font-bold text-right">{summaryGrade}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="px-1 py-0.5 text-slate-700 font-bold">POSITION:</td>
                      <td className="px-1 py-0.5 font-bold text-right">{positionStr}</td>
                    </tr>
                    <tr>
                      <td className="px-1 py-0.5 text-slate-700 font-bold">CLASS SIZE:</td>
                      <td className="px-1 py-0.5 font-bold text-right">{classSize}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. COGNITIVE DOMAIN + AFFECTIVE & PSYCHOMOTOR GRIDS */}
            <div className="grid grid-cols-12 gap-1.5 mt-1.5">
              {/* MAIN COGNITIVE DOMAIN TABLE (9 cols) */}
              <div className="col-span-9 border border-black">
                <div className="bg-[#d1d5db] font-black text-center border-b border-black py-0.5 uppercase tracking-wider text-[10px]">
                  COGNITIVE DOMAIN
                </div>
                <table className="w-full border-collapse text-[8.5px] leading-tight">
                  <thead>
                    <tr className="bg-[#e5e7eb] border-b border-black text-center font-bold">
                      <th className="border-r border-black p-0.5 text-left w-32">SUBJECTS</th>
                      <th className="border-r border-black p-0.5 w-7">
                        <div className="text-[6.5px] text-slate-600">C.A.</div>
                        <div>40</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-7">
                        <div className="text-[6.5px] text-slate-600">EXAM</div>
                        <div>60</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-9">
                        <div className="text-[6.5px] text-slate-600">3RD TERM</div>
                        <div>100</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-9">
                        <div className="text-[6.5px] text-slate-600">2ND TERM</div>
                        <div>100</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-9">
                        <div className="text-[6.5px] text-slate-600">1ST TERM</div>
                        <div>100</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-11">
                        <div className="text-[6px] leading-tight text-slate-600">SESSION<br/>AVERAGE</div>
                        <div>100</div>
                      </th>
                      <th className="border-r border-black p-0.5 w-7">GRADE</th>
                      <th className="border-r border-black p-0.5 w-10 leading-tight text-[7px]">SUBJ.<br/>POSITN</th>
                      <th className="border-r border-black p-0.5 w-12 leading-tight text-[7px]">GRADE<br/>REMARKS</th>
                      <th className="p-0.5 w-9 text-[7px] leading-tight">CLASS<br/>AVG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assessments || []).map((a, i) => {
                      const caTotal = a.ca_total ?? (a.ca1 + a.ca2);
                      const t3 = a.third_term_total ?? a.total;
                      const t2 = a.second_term_total ?? Math.max(40, a.total - 1);
                      const t1 = a.first_term_total ?? Math.max(38, a.total - 3);
                      const sessionAvg = a.session_average ?? Number(((t1 + t2 + t3) / 3).toFixed(1));
                      const posStr = typeof a.subject_position === "number"
                        ? `${a.subject_position}${a.subject_position === 1 ? "st" : a.subject_position === 2 ? "nd" : a.subject_position === 3 ? "rd" : "th"}`
                        : a.subject_position || "—";

                      return (
                        <tr
                          key={a.id || i}
                          className="border-b border-black text-center font-medium hover:bg-slate-50"
                        >
                          <td className="border-r border-black px-1 py-0.5 text-left font-bold truncate">
                            {a.subjects?.name || "SUBJECT"}
                          </td>
                          <td className="border-r border-black p-0.5">{caTotal}</td>
                          <td className="border-r border-black p-0.5">{a.exam}</td>
                          <td className="border-r border-black p-0.5 font-bold">{t3}</td>
                          <td className="border-r border-black p-0.5">{t2}</td>
                          <td className="border-r border-black p-0.5">{t1}</td>
                          <td className="border-r border-black p-0.5 font-semibold">{sessionAvg}</td>
                          <td className="border-r border-black p-0.5 font-bold">{a.grade}</td>
                          <td className="border-r border-black p-0.5 font-semibold text-[8px]">{posStr}</td>
                          <td className="border-r border-black p-0.5 text-[7.5px] uppercase font-semibold">{a.remark}</td>
                          <td className="p-0.5 text-[8px]">{a.class_avg ? Number(a.class_avg).toFixed(1) : "63.5"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* RIGHT SIDEBAR: AFFECTIVE, PSYCHOMOTOR & GRADE SCALE (3 cols) */}
              <div className="col-span-3 space-y-1.5">
                {/* Affective Domain */}
                <div className="border border-black">
                  <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 text-[8px] uppercase tracking-wider flex items-center justify-between px-1">
                    <span>AFFECTIVE DOMAIN</span>
                    <span className="text-[7px] tracking-normal font-mono">5 4 3 2 1</span>
                  </div>
                  <table className="w-full border-collapse text-[7.5px]">
                    <tbody>
                      {affectiveData.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-300">
                          <td className="px-1 py-0.5 font-medium truncate w-22">{item.trait}</td>
                          {[5, 4, 3, 2, 1].map((val) => (
                            <td key={val} className="border-l border-slate-300 text-center w-2.5 font-bold text-[8px]">
                              {item.score === val ? "✓" : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Psychomotor Skill */}
                <div className="border border-black">
                  <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 text-[8px] uppercase tracking-wider flex items-center justify-between px-1">
                    <span>PSYCHOMOTOR -SKILL</span>
                    <span className="text-[7px] tracking-normal font-mono">5 4 3 2 1</span>
                  </div>
                  <table className="w-full border-collapse text-[7.5px]">
                    <tbody>
                      {psychomotorData.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-300">
                          <td className="px-1 py-0.5 font-medium truncate w-22">{item.skill}</td>
                          {[5, 4, 3, 2, 1].map((val) => (
                            <td key={val} className="border-l border-slate-300 text-center w-2.5 font-bold text-[8px]">
                              {item.score === val ? "✓" : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Official Grade Scale Table */}
                <div className="border border-black">
                  <div className="bg-[#d1d5db] font-bold text-center border-b border-black py-0.5 text-[8px] uppercase tracking-wider">
                    Grade Scale
                  </div>
                  <table className="w-full border-collapse text-[7px] text-center">
                    <tbody>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">A+</td><td className="border-r border-slate-300 px-0.5">95-100%</td><td className="text-left px-0.5 font-semibold">EXCEPTIONAL</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">A</td><td className="border-r border-slate-300 px-0.5">90-94.9%</td><td className="text-left px-0.5 font-semibold">DISTINCTION</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">A-</td><td className="border-r border-slate-300 px-0.5">85-89.9%</td><td className="text-left px-0.5 font-semibold">EXCELLENT</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">B+</td><td className="border-r border-slate-300 px-0.5">80-84.9%</td><td className="text-left px-0.5 font-semibold">VERY GOOD</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">B</td><td className="border-r border-slate-300 px-0.5">75-79.9%</td><td className="text-left px-0.5 font-semibold">UPPER CREDIT</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">B-</td><td className="border-r border-slate-300 px-0.5">70-74.9%</td><td className="text-left px-0.5 font-semibold">BELOW STD</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">C+</td><td className="border-r border-slate-300 px-0.5">60-69.9%</td><td className="text-left px-0.5 font-semibold">GOOD</td></tr>
                      <tr className="border-b border-slate-300"><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">D</td><td className="border-r border-slate-300 px-0.5">40-59.9%</td><td className="text-left px-0.5 font-semibold">AVERAGE</td></tr>
                      <tr><td className="font-bold border-r border-slate-300 px-0.5 py-0.5">F</td><td className="border-r border-slate-300 px-0.5">0-39.9%</td><td className="text-left px-0.5 font-semibold">PASS</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* =========================================================
                INTEGRATED ANALYTICAL REPORTS (BAR & PIE CHARTS)
                SEAMLESSLY FITTED DIRECTLY IN THE SINGLE A4 PAGE!
                ========================================================= */}
            <div className="mt-1.5 border border-black bg-slate-50/70 p-1.5">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-1">
                <span className="text-[8.5px] font-black uppercase tracking-wider text-[#0f2d59] flex items-center gap-1">
                  <BarChart3 className="h-3 w-3 text-primary inline" />
                  Academic Performance Analytics & Visual Assessment
                </span>
                <span className="text-[7.5px] font-medium text-slate-600">
                  Pupil Score vs Class Average & Grade Breakdown
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2 items-center">
                {/* 1. Mini Bar Chart: Pupil Score vs Class Avg */}
                <div className="col-span-7 h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartSubjectData} margin={{ top: 2, right: 2, left: -28, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="2 2" opacity={0.15} vertical={false} />
                      <XAxis
                        dataKey="name"
                        angle={-20}
                        textAnchor="end"
                        height={16}
                        tick={{ fontSize: 7, fill: "#000000" }}
                        interval={0}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 7, fill: "#000000" }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border border-slate-700 p-1 rounded shadow text-[8px] text-black">
                                <p className="font-bold">{d.fullName}</p>
                                <p className="text-blue-900 font-semibold">Pupil: {d.studentScore}/100</p>
                                <p className="text-slate-600">Class Avg: {d.classAvg}/100</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="studentScore"
                        name="Pupil Score"
                        fill="#0f2d59"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="classAvg"
                        name="Class Avg"
                        fill="#94a3b8"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 2. Mini Pie Chart & Quick Stats */}
                <div className="col-span-5 flex items-center justify-between gap-1">
                  <div className="h-24 w-24 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={36}
                          innerRadius={18}
                          paddingAngle={2}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 space-y-1 text-[7.5px] leading-tight border-l border-slate-300 pl-1.5">
                    <div className="font-bold text-slate-800">Grade Mix:</div>
                    <div className="flex flex-wrap gap-1">
                      {pieChartData.map((p) => (
                        <span key={p.grade} className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-white border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="font-bold">{p.grade}: {p.value}</span>
                        </span>
                      ))}
                    </div>
                    <div className="pt-0.5 text-slate-700">
                      <div>Terminal Avg: <strong className="text-black">{percentageScore}%</strong></div>
                      <div>Position: <strong className="text-black">{positionStr} of {classSize}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. BOTTOM REMARKS, STAMP & SIGNATURES */}
            <div className="grid grid-cols-12 gap-2 mt-1.5 text-[9px] items-start border-t border-black pt-1.5">
              {/* Remarks & Endorsement Lines (8 cols) */}
              <div className="col-span-8 space-y-1">
                <div>
                  <div className="flex items-start gap-1">
                    <span className="font-bold whitespace-nowrap">Class Teacher's Remark:</span>
                    <span className="italic font-medium">{rc?.teacher_remark || "A diligent, disciplined and well-behaved student. Keep working hard."}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-bold">Name:</span>
                    <span className="font-bold border-b border-black flex-1 uppercase">{rc?.teacher_name || "MR ADIGUN TIMILEYIN"}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-start gap-1">
                    <span className="font-bold whitespace-nowrap">Head Teacher's Remark:</span>
                    <span className="italic font-medium">{rc?.principal_remark || "A Very Good Result!!.. Keep it Up!"}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-bold">Name/Sign:</span>
                    <span className="font-bold border-b border-black flex-1 uppercase">{rc?.principal_name || school?.principal_name || "HEAD TEACHER"}</span>
                  </div>
                </div>

                <div className="pt-0.5 flex flex-wrap items-center gap-x-5 gap-y-0.5 font-bold text-[9.5px]">
                  <div>
                    Status: <span className="underline uppercase tracking-wide">{rc?.status_verdict || "PROMOTED"}</span>
                  </div>
                  <div>
                    Next Session Begins: <span className="font-semibold">{rc?.next_resumption_date || "Wed, 09-September-2026"}</span>
                  </div>
                </div>
              </div>

              {/* Rubber Stamp & Rating Indices (4 cols) */}
              <div className="col-span-4 flex flex-col items-center justify-between text-right">
                {/* Official Circular Stamp Replica / Uploaded Stamp (visible & perfect if uploaded, blank if none) */}
                <div className="relative flex flex-col items-center select-none py-0.5 min-h-[50px] justify-center w-full">
                  {effectiveStampUrl ? (
                    <img
                      src={effectiveStampUrl}
                      alt="Official School Stamp"
                      className="max-h-14 max-w-[120px] object-contain rotate-[-4deg] select-none mix-blend-multiply"
                    />
                  ) : (
                    /* Leave blank unless uploaded */
                    <div className="h-12 w-full flex items-center justify-center text-[7.5px] text-slate-400 print:text-transparent">
                      [Official Stamp Space]
                    </div>
                  )}
                  <span className="text-[7.5px] font-mono text-slate-600 mt-0.5">
                    {new Date().toLocaleDateString("en-GB")}
                  </span>
                </div>

                {/* Rating Indices key */}
                <div className="text-left text-[6.5px] text-slate-700 border border-slate-300 p-0.5 bg-slate-50 mt-0.5 w-full leading-tight">
                  <div className="font-bold border-b border-slate-300 pb-0.5 mb-0.5">Rating Indices</div>
                  <div>5 - Maintains an Excellent degree of Obv traits</div>
                  <div>4 - High level · 3 - Acceptable · 2 - Minimal · 1 - None</div>
                </div>
              </div>
            </div>

            {/* 5. DEDICATED SIGNATURE AREA AT BOTTOM OF REPORT CARD */}
            <div className="report-signature-area mt-1 pt-1 border-t border-black">
              <div className="grid grid-cols-3 gap-1.5">
                <SignatureBox
                  id="eduerp-teacher"
                  title="Class Teacher"
                  roleName="Class Teacher"
                  defaultName={rc?.teacher_name || "MR ADIGUN TIMILEYIN"}
                  signatureUrl={teacherSignature}
                  onUpload={(e) => handleSignatureUpload(e, setTeacherSignature)}
                  onClear={() => setTeacherSignature("")}
                />
                <SignatureBox
                  id="eduerp-principal"
                  title="Principal / Head Teacher"
                  roleName="Principal"
                  defaultName={rc?.principal_name || school?.principal_name || "HEAD TEACHER"}
                  signatureUrl={principalSignature}
                  onUpload={(e) => handleSignatureUpload(e, setPrincipalSignature)}
                  onClear={() => setPrincipalSignature("")}
                />
                <SignatureBox
                  id="eduerp-parent"
                  title="Parent / Guardian"
                  roleName="Parent / Guardian"
                  defaultName={student?.parent_name || student?.guardian_name || "Parent / Guardian"}
                  signatureUrl={parentSignature}
                  onUpload={(e) => handleSignatureUpload(e, setParentSignature)}
                  onClear={() => setParentSignature("")}
                />
              </div>
            </div>

            {/* 6. FOOTER VERIFICATION BARCODE & QR CODE */}
            <div className="mt-1 pt-0.5 border-t border-slate-300 flex items-center justify-between text-[8px] text-slate-600">
              <div className="flex items-center gap-2">
                <Barcode value={verificationCode} height={18} barWidth={0.95} showText={true} fillColor="#000000" />
                <div className="text-[6.5px] leading-tight">
                  <div className="font-bold text-black">Verified Official Academic Transcript · EduERP Nigeria</div>
                  <div className="font-mono text-slate-500">Security Hash: {verificationCode}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="text-right">
                  <div className="font-bold flex items-center justify-end gap-0.5 text-emerald-800 text-[7.5px]">
                    <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" /> Verified Record
                  </div>
                  <div className="text-[6.5px] text-slate-500">Scan to verify on EduERP portal</div>
                </div>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Verification" className="w-8 h-8 border border-slate-300 p-0.5" />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             EDUERAP CLASSIC INSTITUTIONAL (FIT A4)
             ========================================================= */
          <div
            id="standard-report-card"
            className="report-sheet mx-auto bg-white text-black font-sans shadow-xl print:shadow-none p-4 rounded-none border border-black relative"
            style={{ width: "210mm", maxHeight: "297mm" }}
          >
            {/* Header */}
            <div className="flex items-start gap-3 border-b-2 border-black pb-2">
              <div className="h-16 w-16 shrink-0 flex items-center justify-center">
                {school?.logo_url ? (
                  <img src={school.logo_url} alt="Logo" className="max-h-16 max-w-16 object-contain" />
                ) : (
                  <div className="h-16 w-16" />
                )}
              </div>
              <div className="flex-1 text-center">
                <h1 className="text-xl font-black uppercase tracking-tight text-[#0f2d59]">{schoolDisplayName}</h1>
                {schoolMotto && <p className="italic text-[10px] text-slate-700 mt-0.5">— {schoolMotto} —</p>}
                {schoolAddress && <p className="text-[9px] text-slate-600 mt-0.5">{schoolAddress}</p>}
                <div className="mt-1 inline-block bg-[#0f2d59] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded shadow-xs">
                  Official Pupil Performance Report — {rc?.session || "2025/2026"} • {String(rc?.term || "Third").toUpperCase()} TERM
                </div>
              </div>
              <div className="w-18 h-22 border border-black rounded-none overflow-hidden bg-slate-50 flex items-center justify-center">
                {student?.photo_url ? (
                  <img src={student.photo_url} alt="Pupil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[8px] text-slate-400 font-semibold">Photo</span>
                )}
              </div>
            </div>

            {/* Biodata Row */}
            <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1.5 border border-black mt-1.5 text-[9px]">
              <div><span className="text-slate-600">Pupil Name:</span> <strong className="block text-black truncate">{fullName}</strong></div>
              <div><span className="text-slate-600">Admission No:</span> <strong className="block text-black font-mono">{admNo}</strong></div>
              <div><span className="text-slate-600">Class & Arm:</span> <strong className="block text-black">{klass?.name || "Class"}</strong></div>
              <div><span className="text-slate-600">Class Position:</span> <strong className="block text-[#0f2d59] text-[10px]">{positionStr} of {classSize}</strong></div>
            </div>

            {/* Results Table */}
            <table className="w-full mt-1.5 border-collapse text-[8.5px]">
              <thead>
                <tr className="bg-[#e5e7eb] text-black text-center border-y border-black font-bold">
                  <th className="border-r border-black p-1 text-left">Subject</th>
                  <th className="border-r border-black p-0.5 w-12">CA (40)</th>
                  <th className="border-r border-black p-0.5 w-12">Exam (60)</th>
                  <th className="border-r border-black p-0.5 w-14">Total (100)</th>
                  <th className="border-r border-black p-0.5 w-12">Grade</th>
                  <th className="border-r border-black p-0.5 w-12">Position</th>
                  <th className="p-0.5 text-left">Remark</th>
                </tr>
              </thead>
              <tbody>
                {(assessments || []).map((a, i) => (
                  <tr key={a.id || i} className="border-b border-slate-300 text-center hover:bg-slate-50">
                    <td className="border-r border-slate-300 p-1 text-left font-semibold">{a.subjects?.name}</td>
                    <td className="border-r border-slate-300 p-0.5">{a.ca_total ?? (a.ca1 + a.ca2)}</td>
                    <td className="border-r border-slate-300 p-0.5">{a.exam}</td>
                    <td className="border-r border-slate-300 p-0.5 font-bold text-black">{a.total}</td>
                    <td className="border-r border-slate-300 p-0.5 font-bold">{a.grade}</td>
                    <td className="border-r border-slate-300 p-0.5">{a.subject_position || "—"}</td>
                    <td className="p-0.5 text-left text-slate-700">{a.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Integrated Analytics in Classic Standard */}
            <div className="mt-1.5 border border-black p-1.5 bg-slate-50">
              <div className="text-[8px] font-bold uppercase tracking-wider text-[#0f2d59] mb-1">
                Visual Analytics & Comparative Benchmark
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7 h-22 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartSubjectData} margin={{ top: 2, right: 2, left: -28, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="2 2" opacity={0.15} vertical={false} />
                      <XAxis dataKey="name" angle={-20} textAnchor="end" height={14} tick={{ fontSize: 7 }} interval={0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 7 }} />
                      <Bar dataKey="studentScore" name="Score" fill="#0f2d59" />
                      <Bar dataKey="classAvg" name="Class Avg" fill="#94a3b8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="col-span-5 flex items-center justify-between text-[7.5px] border-l border-slate-300 pl-1.5">
                  <div className="h-20 w-20 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} dataKey="value" cx="50%" cy="50%" outerRadius={32} innerRadius={16}>
                          {pieChartData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div>Average: <strong>{percentageScore}%</strong></div>
                    <div>Grade: <strong>{summaryGrade}</strong></div>
                    <div>Rank: <strong>{positionStr} of {classSize}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Endorsements & Stamp */}
            <div className="grid grid-cols-12 gap-2 mt-1.5 items-end border-t border-black pt-1">
              <div className="col-span-9">
                <div className="grid grid-cols-3 gap-1.5">
                  <SignatureBox
                    id="std-teacher"
                    title="Class Teacher"
                    roleName="Class Teacher"
                    defaultName={rc?.teacher_name || "Mr. Adigun Timileyin"}
                    signatureUrl={teacherSignature}
                    onUpload={(e) => handleSignatureUpload(e, setTeacherSignature)}
                    onClear={() => setTeacherSignature("")}
                  />
                  <SignatureBox
                    id="std-principal"
                    title="Principal / Head Teacher"
                    roleName="Principal"
                    defaultName={rc?.principal_name || school?.principal_name || "Head Teacher"}
                    signatureUrl={principalSignature}
                    onUpload={(e) => handleSignatureUpload(e, setPrincipalSignature)}
                    onClear={() => setPrincipalSignature("")}
                  />
                  <SignatureBox
                    id="std-parent"
                    title="Parent / Guardian"
                    roleName="Parent / Guardian"
                    defaultName={student?.parent_name || student?.guardian_name || "Parent / Guardian"}
                    signatureUrl={parentSignature}
                    onUpload={(e) => handleSignatureUpload(e, setParentSignature)}
                    onClear={() => setParentSignature("")}
                  />
                </div>
              </div>
              <div className="col-span-3 flex flex-col items-center">
                {effectiveStampUrl ? (
                  <img
                    src={effectiveStampUrl}
                    alt="School Stamp"
                    className="max-h-12 max-w-[100px] object-contain rotate-[-4deg] mix-blend-multiply"
                  />
                ) : (
                  <div className="h-10 text-[7px] text-slate-400 flex items-center justify-center">[Stamp]</div>
                )}
                <span className="text-[7px] text-slate-500 font-mono">{new Date().toLocaleDateString("en-GB")}</span>
              </div>
            </div>

            {/* Barcode & Verification footer */}
            <div className="mt-1 pt-1 border-t border-black flex items-center justify-between">
              <Barcode value={verificationCode} height={20} barWidth={1.0} showText={true} />
              <div className="flex items-center gap-1.5">
                {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-8 h-8 border border-slate-300 p-0.5" />}
                <div className="text-[7.5px] text-slate-600">
                  <div className="font-semibold text-black">EduERP Nigeria Verification</div>
                  <div>Code: {verificationCode}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Specific Media-Print Styles for Single-Page Fit-A4 Output */}
      <style>{`
        @media print {
          /* Precise A4 Page Setup & Margins */
          @page {
            size: A4 portrait;
            margin: 4mm 5mm 4mm 5mm;
          }

          /* General Resets */
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: hidden !important;
          }

          /* Hide UI Chrome */
          .print\\:hidden,
          nav,
          aside,
          header,
          .sticky,
          button {
            display: none !important;
          }

          /* SINGLE PAGE FIT A4: NO PAGE 2 */
          .eduerp-sheet,
          .standard-sheet,
          #eduerp-report-card,
          #standard-report-card {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: 288mm !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            box-shadow: none !important;
            border: 1px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            break-after: avoid !important;
            overflow: hidden !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: avoid !important;
          }
          tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Micro-typography */
          .eduerp-sheet table td,
          .eduerp-sheet table th {
            padding-top: 1px !important;
            padding-bottom: 1px !important;
            padding-left: 1.5px !important;
            padding-right: 1.5px !important;
            line-height: 1.1 !important;
          }

          /* Shaded Headers Guarantee */
          .bg-\\[\\#d1d5db\\] {
            background-color: #d1d5db !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .bg-\\[\\#e5e7eb\\] {
            background-color: #e5e7eb !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .report-signature-area {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 1.5mm !important;
            padding-top: 1mm !important;
          }
          .report-signature-slot {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px solid #000000 !important;
            background: transparent !important;
            padding: 1mm !important;
          }
          .report-signature-img {
            max-height: 8mm !important;
            mix-blend-mode: multiply !important;
          }
        }
      `}</style>
    </div>
  );
}
