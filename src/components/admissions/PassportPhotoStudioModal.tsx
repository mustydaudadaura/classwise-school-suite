import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { CameraCaptureModal } from "./CameraCaptureModal";
import { Camera, Upload, RotateCw, ZoomIn, Check, X, User, Sparkles, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { streamImage } from "@/lib/stream-image";

interface PassportPhotoStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
  studentIdentifier?: string;
  personName?: string;
  personIdentifier?: string;
  role?: "student" | "teacher" | "staff";
  currentPhotoUrl?: string;
  onSavePhoto: (dataUrl: string) => void;
}

export function PassportPhotoStudioModal({
  open,
  onOpenChange,
  studentName,
  studentIdentifier,
  personName,
  personIdentifier,
  role = "student",
  currentPhotoUrl,
  onSavePhoto,
}: PassportPhotoStudioModalProps) {
  const displayName = personName || studentName || "Candidate";
  const displayId = personIdentifier || studentIdentifier;

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isEnhanced, setIsEnhanced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setImageSrc(currentPhotoUrl || null);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setIsEnhanced(false);
    }
  }, [open, currentPhotoUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WebP)");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Photo size must be less than 8 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setImageSrc(ev.target.result);
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
        setIsEnhanced(false);
        void handleGeminiEnhance(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (captures: Array<{ dataUrl: string }>) => {
    if (captures[0]) {
      setImageSrc(captures[0].dataUrl);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setIsEnhanced(false);
      void handleGeminiEnhance(captures[0].dataUrl);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // AI passport enhancement: white background, centred head & shoulders, face preserved.
  const handleGeminiEnhance = async (source?: string) => {
    const src = source ?? imageSrc;
    if (!src) return;
    setIsEnhancing(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again");
      const blob = await (await fetch(src)).blob();
      const form = new FormData();
      form.append("image", new File([blob], "passport.png", { type: blob.type || "image/png" }));
      let final: string | null = null;
      await streamImage("/api/passport-enhance", form, (frame, isFinal) => {
        setImageSrc(frame);
        if (isFinal) final = frame;
      }, undefined, { Authorization: `Bearer ${token}` });
      if (!final) throw new Error("No enhanced photo returned");
      setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0);
      setIsEnhanced(true);
      toast.success("Passport enhanced: white background and centred face");
    } catch (err: any) {
      setImageSrc(src);
      const msg = String(err?.message || "");
      toast.error(msg.includes("402") ? "AI credits have run out. Photo kept as uploaded." : msg.includes("429") ? "AI is busy, try Enhance again shortly." : "AI enhancement failed. Photo kept as uploaded — you can try Enhance again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Generate cropped standard 450x550 passport photo
  const generateCroppedPassport = async (): Promise<string | null> => {
    if (!imageSrc) return null;

    const canvas = document.createElement("canvas");
    const targetWidth = 450;
    const targetHeight = 550;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const img = new Image();
    img.src = imageSrc;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

    // Background white fill
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.save();
    ctx.translate(targetWidth / 2 + pan.x, targetHeight / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const w = img.width || 300;
    const h = img.height || 400;
    const scale = Math.max(targetWidth / w, targetHeight / h);
    ctx.drawImage(img, (-w * scale) / 2, (-h * scale) / 2, w * scale, h * scale);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const handleSave = async () => {
    const cropped = await generateCroppedPassport();
    if (!cropped) {
      toast.error("Please take or upload a photo first.");
      return;
    }
    onSavePhoto(cropped);
    toast.success(`Official passport photograph confirmed for ${displayName}!`);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Camera className="h-5 w-5 text-primary" />
              Passport Photograph Studio (Biometric 35x45mm)
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {role === "teacher" || role === "staff" ? "Staff Member" : "Student"}:{" "}
              <span className="font-semibold text-foreground">{displayName}</span>
              {displayId && ` (${displayId})`}
            </p>
          </DialogHeader>

          <div className="p-4 flex flex-col items-center gap-3 bg-muted/20">
            {/* Viewport Frame */}
            <div
              className="relative w-60 h-76 rounded-2xl border-4 border-primary/60 bg-muted/60 overflow-hidden shadow-inner flex items-center justify-center cursor-move select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Passport preview"
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: "center center",
                    transition: isDragging ? "none" : "transform 0.05s ease-out",
                  }}
                  className="max-w-none max-h-none pointer-events-none select-none"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <div className="h-20 w-20 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center mb-3">
                    <User className="h-10 w-10 opacity-40" />
                  </div>
                  <p className="text-xs font-medium">No passport photo selected</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Use your device camera or upload an image file
                  </p>
                </div>
              )}

              {/* Passport alignment oval guide */}
              {imageSrc && (
                <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-white/50 rounded-2xl flex items-center justify-center">
                  <div className="w-36 h-48 border-2 border-white/80 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.3)] flex items-center justify-center">
                    <span className="text-[9.5px] text-white/90 bg-black/60 px-2 py-0.5 rounded font-medium">
                      Face Oval Guide
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Passport standard badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-medium border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Photograph Passport Standard · Face 100% Preserved</span>
            </div>

            {/* Controls if image loaded */}
            {imageSrc ? (
              <div className="w-full space-y-2.5 px-1">
                {/* Gemini Enhance Action Button */}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => handleGeminiEnhance()}
                  disabled={isEnhancing}
                  className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-semibold text-xs shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {isEnhancing
                    ? "AI is enhancing (white background)…"
                    : isEnhanced
                    ? "Enhance again with AI"
                    : "AI Enhance (white background, centred)"}
                </Button>

                <div className="flex items-center gap-3">
                  <ZoomIn className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground w-12">Zoom</span>
                  <Slider
                    value={[zoom]}
                    min={0.6}
                    max={2.5}
                    step={0.05}
                    onValueChange={([v]) => setZoom(v)}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono w-10 text-right">{Math.round(zoom * 100)}%</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                  >
                    <RotateCw className="h-3 w-3 mr-1" /> Rotate
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                      setRotation(0);
                    }}
                  >
                    Reset Framing
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => setImageSrc(null)}
                  >
                    <X className="h-3 w-3 mr-1" /> Clear
                  </Button>
                </div>
              </div>
            ) : (
              /* Capture / Upload Buttons */
              <div className="flex gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Upload Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </div>

          <DialogFooter className="p-3 border-t bg-card flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} size="sm" disabled={!imageSrc || isEnhancing} className="font-semibold text-xs">
              <Check className="h-4 w-4 mr-1" /> Confirm Passport Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CameraCaptureModal
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={handleCameraCapture}
        title={`Take Passport: ${displayName}`}
        isPassportMode={true}
      />
    </>
  );
}
