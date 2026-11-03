/**
 * Browser-only report card PDF generation. Each report is rendered off-screen with the
 * school's saved layout, captured as an image and placed on A4 pages.
 * Libraries are loaded on demand so they never reach the server bundle.
 */
import QRCode from "qrcode";
import { IslamiyyaReportCard } from "@/components/IslamiyyaReportCard";
import { SchoolReportLayouts, type SchoolReport } from "@/components/SchoolReportLayouts";
import { resolveReportTemplate, islamiyyaLanguage } from "@/lib/report-template";
import type { IslamiyyaAssessment } from "@/lib/islamiyya-report";

export type ReportDetail = { rc: SchoolReport & { verification_code?: string | null }; assessments: IslamiyyaAssessment[] };

const A4_W = 210;
const A4_H = 297;

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            const done = () => res();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 8000);
          }),
    ),
  );
  if (document.fonts?.ready) await document.fonts.ready;
}

async function renderCanvas(detail: ReportDetail): Promise<HTMLCanvasElement> {
  const [{ createRoot }, { default: html2canvas }, { flushSync }] = await Promise.all([
    import("react-dom/client"),
    import("html2canvas-pro"),
    import("react-dom"),
  ]);
  const qrDataUrl = detail.rc.verification_code
    ? await QRCode.toDataURL(`${window.location.origin}/verify/${encodeURIComponent(detail.rc.verification_code)}`, { width: 120, margin: 1 }).catch(() => "")
    : "";
  const layout = resolveReportTemplate(detail.rc.schools?.report_template, detail.rc.classes?.section).layout_id;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-12000px;top:0;width:820px;background:#fff;z-index:-1;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(
        islamiyyaLanguage(layout)
          ? <IslamiyyaReportCard rc={detail.rc as any} assessments={detail.assessments} qrDataUrl={qrDataUrl} language={islamiyyaLanguage(layout)!} />
          : <SchoolReportLayouts rc={detail.rc} assessments={detail.assessments} qrDataUrl={qrDataUrl} />,
      );
    });
    await waitForImages(host);
    const target = (host.firstElementChild as HTMLElement) ?? host;
    return await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
  } finally {
    root.unmount();
    host.remove();
  }
}

async function addCanvas(pdf: import("jspdf").jsPDF, canvas: HTMLCanvasElement, first: boolean) {
  const margin = 6;
  const w = A4_W - margin * 2;
  const pageH = A4_H - margin * 2;
  const fullH = (canvas.height * w) / canvas.width;
  // Shrink slightly-too-tall sheets onto one page; split genuinely long ones.
  if (fullH <= pageH * 1.15) {
    const h = Math.min(fullH, pageH);
    const drawW = (canvas.width * h) / canvas.height;
    if (!first) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin + (w - drawW) / 2, margin, drawW, h);
    return;
  }
  const slicePx = Math.floor((pageH * canvas.width) / w);
  for (let y = 0, i = 0; y < canvas.height; y += slicePx, i++) {
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = Math.min(slicePx, canvas.height - y);
    part.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
    if (!first || i > 0) pdf.addPage();
    pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, w, (part.height * w) / canvas.width);
  }
}

/** One PDF containing every given report, each starting on its own page. */
export async function reportsToPdf(details: ReportDetail[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  for (let i = 0; i < details.length; i++) {
    const canvas = await renderCanvas(details[i]);
    await addCanvas(pdf, canvas, i === 0);
    onProgress?.(i + 1, details.length);
  }
  return pdf.output("blob");
}

export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const f of files) {
    let name = f.name, n = 2;
    while (used.has(name)) name = f.name.replace(/\.pdf$/, `_${n++}.pdf`);
    used.add(name);
    zip.file(name, f.blob);
  }
  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
