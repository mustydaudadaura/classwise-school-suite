import { useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, RotateCcw, Check, Upload, Trash2, ShieldCheck, Building2, Sparkles, Layout } from 'lucide-react';
import { toast } from 'sonner';
import { REPORT_COLOURS, REPORT_PARTS, resolveReportTemplate, REPORT_LAYOUTS, type ReportTemplate, type ReportPart, type ReportLayoutId } from '@/lib/report-template';
import { ReportCardView } from '@/components/ReportCardView';

export function ReportTemplateSettings({ school }: { school: { id: string; name: string; report_template: unknown; logo_url?: string | null; stamp_url?: string | null; principal_signature_url?: string | null; motto?: string | null; address?: string | null; phone?: string | null; email?: string | null; principal_name?: string | null; [key: string]: unknown } }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ReportTemplate>((school.report_template || {}) as ReportTemplate);

  // School Identity registration state (user registers their own school identity)
  const [schoolName, setSchoolName] = useState<string>(school.name || '');
  const [motto, setMotto] = useState<string>((school.motto as string) || '');
  const [principalName, setPrincipalName] = useState<string>((school.principal_name as string) || '');
  const [address, setAddress] = useState<string>((school.address as string) || '');
  const [phone, setPhone] = useState<string>((school.phone as string) || '');
  const [email, setEmail] = useState<string>((school.email as string) || '');

  // Insignia state (strictly blank unless uploaded)
  const [logoUrl, setLogoUrl] = useState<string | null>(school.logo_url || null);
  const [stampUrl, setStampUrl] = useState<string | null>(school.stamp_url || null);
  const [sigUrl, setSigUrl] = useState<string | null>(school.principal_signature_url || null);

  const [section, setSection] = useState('secondary');
  const [part, setPart] = useState<ReportPart>('border');
  const [busy, setBusy] = useState(false);
  const resolved = resolveReportTemplate(draft, section);

  // Helper to read file as data url for instant reliable upload
  const handleFileUpload = (type: "logo" | "stamp" | "signature", file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === "logo") setLogoUrl(dataUrl);
      else if (type === "stamp") setStampUrl(dataUrl);
      else if (type === "signature") setSigUrl(dataUrl);
      toast.success(`${type === "logo" ? "School Logo" : type === "stamp" ? "Official Stamp" : "Principal Signature"} loaded`);
    };
    reader.readAsDataURL(file);
  };

  async function save() {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('schools')
        .update({
          name: schoolName.trim() || school.name,
          motto: motto.trim() || null,
          principal_name: principalName.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          report_template: draft,
          logo_url: logoUrl,
          stamp_url: stampUrl,
          principal_signature_url: sigUrl,
        })
        .eq('id', school.id)
        .select('id')
        .single();

      if (error || !data) throw new Error(error?.message ?? 'Could not save settings');
      await qc.invalidateQueries({ queryKey: ['school-settings', school.id] });
      await qc.invalidateQueries({ queryKey: ['report-card'] });
      await qc.invalidateQueries({ queryKey: ['portal-rc-detail'] });
      toast.success('Official school identity, branding, and report card template saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            School Identity, Branding & Report Card Template
          </h2>
          <p className="text-xs text-muted-foreground">
            Register your official school name, motto, principal details, and upload your official logo, stamp, and signature. If any insignia is not uploaded, its space on the report sheet remains clean and blank.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setDraft({})}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Colours
          </Button>
          <Button disabled={busy} onClick={save}>
            <Save className="mr-2 h-4 w-4" /> {busy ? 'Saving…' : 'Save School & Template'}
          </Button>
        </div>
      </div>

      {/* SECTION 1: Direct School Identity Registration */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Official School Registration Details</h3>
          <p className="text-xs text-muted-foreground">
            Enter your official school name, motto, and principal information as they should appear on student report cards.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="school-name" className="text-xs">School Name</Label>
            <Input
              id="school-name"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Al-Hikmah International School"
              className="text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="school-motto" className="text-xs">School Motto</Label>
            <Input
              id="school-motto"
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              placeholder="e.g. Knowledge, Faith & Excellence"
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="principal-name" className="text-xs">Principal / Head of School</Label>
            <Input
              id="principal-name"
              value={principalName}
              onChange={(e) => setPrincipalName(e.target.value)}
              placeholder="e.g. Dr. Amina Bello (Ph.D)"
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="school-address" className="text-xs">Campus Address</Label>
            <Input
              id="school-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 14 Airport Road, Kano State"
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="school-phone" className="text-xs">Official Phone</Label>
            <Input
              id="school-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 08031234567"
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="school-email" className="text-xs">Official Email</Label>
            <Input
              id="school-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. info@school.sch.ng"
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Official Insignia Uploader (Logo, Stamp, Signature) */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Official School Insignia & Validation</h3>
            <p className="text-xs text-muted-foreground">
              Uploaded insignia will be displayed prominently and cleanly on the Single-Page A4 report card. If unuploaded, spaces remain completely blank without default logos.
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono">
            Blank if Unuploaded
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Logo Card */}
          <div className="rounded-lg border border-border/80 p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">School Logo</Label>
              {logoUrl && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => setLogoUrl(null)} title="Remove logo">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="h-24 flex items-center justify-center bg-white rounded border border-dashed border-border overflow-hidden p-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo preview" className="h-full object-contain drop-shadow-sm" />
              ) : (
                <div className="text-center p-2 text-muted-foreground">
                  <span className="text-[11px] italic block">Space blank</span>
                  <span className="text-[9px] text-muted-foreground/70 block">(No logo uploaded)</span>
                </div>
              )}
            </div>
            <label className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-muted transition-colors">
              <Upload className="mr-1.5 h-3.5 w-3.5 text-primary" />
              <span>{logoUrl ? "Replace logo" : "Upload school logo"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("logo", e.target.files[0])} />
            </label>
          </div>

          {/* Stamp Card */}
          <div className="rounded-lg border border-border/80 p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Official School Stamp</Label>
              {stampUrl && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => setStampUrl(null)} title="Remove stamp">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="h-24 flex items-center justify-center bg-white rounded border border-dashed border-border overflow-hidden p-2">
              {stampUrl ? (
                <img src={stampUrl} alt="Stamp preview" className="h-full object-contain opacity-95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.18)]" />
              ) : (
                <div className="text-center p-2 text-muted-foreground">
                  <span className="text-[11px] italic block">Space blank</span>
                  <span className="text-[9px] text-muted-foreground/70 block">(No stamp uploaded)</span>
                </div>
              )}
            </div>
            <label className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-muted transition-colors">
              <Upload className="mr-1.5 h-3.5 w-3.5 text-primary" />
              <span>{stampUrl ? "Replace stamp" : "Upload official stamp"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("stamp", e.target.files[0])} />
            </label>
          </div>

          {/* Principal Signature Card */}
          <div className="rounded-lg border border-border/80 p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Principal Signature</Label>
              {sigUrl && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => setSigUrl(null)} title="Remove signature">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="h-24 flex items-center justify-center bg-white rounded border border-dashed border-border overflow-hidden p-2">
              {sigUrl ? (
                <img src={sigUrl} alt="Signature preview" className="h-full object-contain filter contrast-125" />
              ) : (
                <div className="text-center p-2 text-muted-foreground">
                  <span className="text-[11px] italic block">Space blank</span>
                  <span className="text-[9px] text-muted-foreground/70 block">(Signing line shown)</span>
                </div>
              )}
            </div>
            <label className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-muted transition-colors">
              <Upload className="mr-1.5 h-3.5 w-3.5 text-primary" />
              <span>{sigUrl ? "Replace signature" : "Upload principal signature"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("signature", e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 3: Specialized Nigerian Report Card Templates */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layout className="h-4 w-4 text-primary" />
              Specialized Nigerian Report Sheet Templates
            </h3>
            <p className="text-xs text-muted-foreground">
              Select a report format.
            </p>
          </div>
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs font-mono">
            {REPORT_LAYOUTS.length} Report Templates
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {REPORT_LAYOUTS.map((layout) => {
            const isSelected = (draft.layout_id || resolved.layout_id) === layout.id;
            return (
              <Button
                type="button"
                variant="outline"
                aria-pressed={isSelected}
                key={layout.id}
                onClick={() => setDraft({ ...draft, layout_id: layout.id })}
                className={`relative block h-auto whitespace-normal rounded-lg border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <Badge variant={isSelected ? "default" : "secondary"} className="text-[10px] font-medium">
                    {layout.badge}
                  </Badge>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <h4 className="text-xs font-bold text-foreground leading-snug">{layout.name}</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-normal line-clamp-3">
                  {layout.description}
                </p>
                <div className="mt-2.5 pt-2 border-t border-border/50 text-[10px] text-primary font-medium flex items-center justify-between">
                  <span>{isSelected ? "Active Template" : "Click to select"}</span>
                  <span className="font-mono text-muted-foreground">Single A4</span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: Template Colours & Position Options */}
      {resolved.layout_id === 'islamiyya_arabic' && <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="arabic-school-name">School name in Arabic / اسم المدرسة</Label><Input id="arabic-school-name" dir="rtl" lang="ar" value={draft.arabic_school_name ?? ''} onChange={e => setDraft({ ...draft, arabic_school_name: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="arabic-school-address">Address in Arabic / العنوان</Label><Input id="arabic-school-address" dir="rtl" lang="ar" value={draft.arabic_address ?? ''} onChange={e => setDraft({ ...draft, arabic_address: e.target.value })} /></div>
      </div>}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Color Palette & Ranking Format</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Positions on sheet</Label>
            <Select value={resolved.positions} onValueChange={(value) => setDraft({ ...draft, positions: value as ReportTemplate['positions'] })}>
              <SelectTrigger aria-label="Positions on sheet"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No positions</SelectItem>
                <SelectItem value="class">Overall class position</SelectItem>
                <SelectItem value="subject">Subject positions</SelectItem>
                <SelectItem value="both">Both positions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template part</Label>
            <Select value={part} onValueChange={(value) => setPart(value as ReportPart)}>
              <SelectTrigger aria-label="Template part"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_PARTS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preview section</Label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger aria-label="Preview section"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['nursery', 'primary', 'secondary'].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label={`${REPORT_PARTS[part]} colours`}>
          {REPORT_COLOURS.map((colour) => (
            <Button
              key={colour}
              variant="outline"
              size="icon"
              className="report-swatch h-10 w-10 rounded-md border-2"
              style={{ '--swatch': `var(--report-colour-${colour})`, color: 'var(--report-paper)' } as CSSProperties}
              title={colour}
              aria-label={`${REPORT_PARTS[part]}: ${colour}`}
              aria-pressed={resolved[part] === colour}
              onClick={() => setDraft({ ...draft, [part]: colour })}
            >
              {resolved[part] === colour && <Check className="h-5 w-5" />}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm pt-1">
          {Object.entries(REPORT_PARTS).map(([key, label]) => (
            <span key={key} className="flex items-center gap-2">
              <span
                className="report-swatch inline-block h-3 w-3 rounded-sm"
                style={{ '--swatch': `var(--report-colour-${resolved[key as ReportPart]})` } as CSSProperties}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* SECTION 4: Live Single-Page A4 Preview */}
      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-foreground">Report Card Preview</h3>
            <p className="text-xs text-muted-foreground">
              Report preview
            </p>
          </div>
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-xs font-mono">
            A4 Portrait
          </Badge>
        </div>

        <ReportCardView
          rc={{
            schools: {
              ...school,
              name: schoolName || "Official School Report",
              motto: motto || null,
              principal_name: principalName || "Principal / Head of School",
              address: address || null,
              logo_url: logoUrl,
              stamp_url: stampUrl,
              principal_signature_url: sigUrl,
              report_template: draft,
            },
            students: {
              first_name: resolved.layout_id === 'islamiyya_arabic' ? 'زينب' : 'Zainab',
              last_name: resolved.layout_id === 'islamiyya_arabic' ? 'بلو' : 'Bello',
              middle_name: resolved.layout_id === 'islamiyya_arabic' ? 'موسى' : 'Musa',
              admission_no: 'ADM/2026/014',
              gender: 'female',
              dob: '2014-06-18',
            },
            classes: {
              name: resolved.layout_id === 'islamiyya_arabic' ? 'المستوى الثاني' : section === 'secondary' ? 'JSS 2' : section === 'primary' ? 'Primary 5' : 'Nursery 2',
              arm: resolved.layout_id === 'islamiyya_arabic' ? 'أ' : 'Gold',
              section,
            },
            session: typeof school.current_session === 'string' ? school.current_session : '2025/2026',
            term: typeof school.current_term === 'string' ? school.current_term : 'first',
            position: 2,
            class_size: 32,
            days_total: 65,
            days_present: 63,
            days_absent: 2,
            teacher_remark: resolved.layout_id === 'islamiyya_arabic' ? 'طالب مجتهد، مواظب على الحفظ والمراجعة، وحسن الخلق.' : 'An exceptional student with strong analytical skills and consistent dedication.',
            principal_remark: resolved.layout_id === 'islamiyya_arabic' ? 'بارك الله فيك، واصل الاجتهاد والتميز.' : 'Commended for academic excellence and outstanding character.',
            verification_code: 'VERIFY-2026-SAMPLE',
          }}
          assessments={resolved.layout_id === 'islamiyya_arabic' ? [
            { id: 'ar-1', ca1: 18, ca2: 19, exam: 54, total: 91, grade: 'A', remark: 'ممتاز', subjects: { name: 'القرآن الكريم', code: 'QUR' } },
            { id: 'ar-2', ca1: 17, ca2: 18, exam: 50, total: 85, grade: 'A', remark: 'ممتاز', subjects: { name: 'التجويد', code: 'TAJ' } },
            { id: 'ar-3', ca1: 16, ca2: 17, exam: 49, total: 82, grade: 'A', remark: 'جيد جداً', subjects: { name: 'اللغة العربية', code: 'ARA' } },
            { id: 'ar-4', ca1: 15, ca2: 16, exam: 48, total: 79, grade: 'B', remark: 'جيد', subjects: { name: 'الفقه', code: 'FIQ' } },
            { id: 'ar-5', ca1: 18, ca2: 18, exam: 52, total: 88, grade: 'A', remark: 'ممتاز', subjects: { name: 'العقيدة', code: 'AQD' } },
            { id: 'ar-6', ca1: 17, ca2: 17, exam: 53, total: 87, grade: 'A', remark: 'ممتاز', subjects: { name: 'الحديث', code: 'HAD' } },
          ] : [
            { id: 'sub-1', ca1: 18, ca2: 19, exam: 54, total: 91, grade: 'A', remark: 'Distinction', subject_position: 1, subjects: { name: 'Mathematics', code: 'MTH' } },
            { id: 'sub-2', ca1: 17, ca2: 18, exam: 50, total: 85, grade: 'A', remark: 'Excellent', subject_position: 2, subjects: { name: 'English Language', code: 'ENG' } },
            { id: 'sub-3', ca1: 16, ca2: 17, exam: 49, total: 82, grade: 'A', remark: 'Very Good', subject_position: 3, subjects: { name: 'Basic Science', code: 'BSC' } },
            { id: 'sub-4', ca1: 15, ca2: 16, exam: 48, total: 79, grade: 'B', remark: 'Good', subject_position: 4, subjects: { name: 'Social Studies', code: 'SOS' } },
            { id: 'sub-5', ca1: 18, ca2: 18, exam: 52, total: 88, grade: 'A', remark: 'Distinction', subject_position: 2, subjects: { name: 'ICT & Computing', code: 'ICT' } },
            { id: 'sub-6', ca1: 17, ca2: 17, exam: 53, total: 87, grade: 'A', remark: 'Distinction', subject_position: 1, subjects: { name: 'Civic Education', code: 'CVE' } },
          ]}
        />
      </div>
    </div>
  );
}