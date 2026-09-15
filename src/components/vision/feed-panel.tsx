import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CircleAlert,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Upload,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Chip, type Tone } from "./kit";

export type FeedStatus =
  "idle" | "requesting" | "connecting" | "live" | "demo" | "stopped" | "media" | "error";

type FeedPanelProps = {
  title: string;
  sample: string;
  sampleAlt: string;
  cameraCode: string;
  overlay?: React.ReactNode;
  tone?: Tone;
  aspect?: string;
  children?: React.ReactNode;
  onStatusChange?: (status: FeedStatus) => void;
};

const statusCopy: Record<FeedStatus, { text: string; tone: Tone }> = {
  idle: { text: "Camera not connected", tone: "mute" },
  requesting: { text: "Permission requested", tone: "amber" },
  connecting: { text: "Connecting", tone: "amber" },
  live: { text: "Live", tone: "rose" },
  demo: { text: "Live · demo feed", tone: "rose" },
  stopped: { text: "Session stopped", tone: "mute" },
  media: { text: "Reviewing upload", tone: "slate" },
  error: { text: "Camera unavailable", tone: "rose" },
};

export function FeedPanel({
  title,
  sample,
  sampleAlt,
  cameraCode,
  overlay,
  tone = "amber",
  aspect = "aspect-[16/9]",
  children,
  onStatusChange,
}: FeedPanelProps) {
  const [status, setStatus] = useState<FeedStatus>("demo");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [errorText, setErrorText] = useState("");
  const [upload, setUpload] = useState<{
    url: string;
    kind: "image" | "video";
    name: string;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [clock, setClock] = useState("--:--:--");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const connect = useCallback(
    async (preferred?: string) => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorText("This browser does not expose a camera device.");
        return;
      }
      setStatus("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: preferred ? { deviceId: { exact: preferred } } : true,
          audio: false,
        });
        setStatus("connecting");
        stopStream();
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const list = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        );
        setDevices(list);
        const active = stream.getVideoTracks()[0];
        const activeId =
          preferred ??
          list.find((d) => d.label === active?.label)?.deviceId ??
          list[0]?.deviceId ??
          "";
        setDeviceId(activeId);
        setUpload(null);
        setStatus("live");
        toast.success("Camera connected", { description: active?.label || "Default camera" });
      } catch {
        setStatus("error");
        setErrorText(
          "Permission denied or no camera available. You can continue on the demo feed.",
        );
        toast.error("Could not start the camera");
      }
    },
    [stopStream],
  );

  const stopSession = () => {
    stopStream();
    setStatus("stopped");
    toast("Session stopped");
  };
  const handleDownload = () => {
    if (!upload) return;
    const a = document.createElement("a");
    a.href = upload.url; // swap for the processed-result URL once that exists
    a.download = upload.name;
    a.click();
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const kind = file.type.startsWith("video") ? "video" : "image";
    stopStream();
    setUpload({ url: URL.createObjectURL(file), kind, name: file.name });
    setStatus("media");
    toast.success("Media loaded", { description: file.name });
  };

  const info = statusCopy[status];
  const showOverlay = status === "live" || status === "demo" || status === "media";
  const isLive = status === "live" || status === "demo";

  return (
    <section className="rounded-xl bg-elev ring-1 ring-line">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-bold tracking-tight">{title}</h3>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-mute">
            {cameraCode} · 1080p · 32 fps
          </p>
        </div>
        <Chip tone={info.tone} dot pulse={isLive}>
          {info.text}
        </Chip>
      </div>

      <div className="p-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "relative overflow-hidden rounded-lg bg-ink ring-1 ring-ink/10 transition-shadow",
            aspect,
            dragging && "ring-2 ring-amber",
          )}
        >
          {/* base layer */}
          {status === "live" ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 size-full object-cover"
            />
          ) : status === "media" && upload ? (
            upload.kind === "video" ? (
              <video
                src={upload.url}
                controls
                className="absolute inset-0 size-full bg-ink object-contain"
              />
            ) : (
              <img
                src={upload.url}
                alt={upload.name}
                className="absolute inset-0 size-full object-contain"
              />
            )
          ) : (
            <img
              src={sample}
              alt={sampleAlt}
              width={1280}
              height={720}
              className={cn(
                "absolute inset-0 size-full object-cover transition-all",
                (status === "stopped" || status === "error" || status === "idle") &&
                  "scale-105 opacity-25 blur-sm grayscale",
              )}
            />
          )}

          {/* overlays */}
          {showOverlay ? (
            <>
              {overlay}
              <span className="absolute left-3 top-3 font-mono text-[10px] text-elev/70">
                {cameraCode} · {clock}
              </span>
              {isLive ? (
                <span className="absolute right-3 top-3 flex items-center gap-1 font-mono text-[10px] text-amber">
                  <span className="size-1.5 rounded-full bg-amber pulse-dot" />
                  REC
                </span>
              ) : null}
            </>
          ) : null}

          {/* state veils */}
          {status === "requesting" || status === "connecting" ? (
            <div className="absolute inset-0 grid place-items-center bg-ink/70 text-elev">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-5 animate-spin" />
                <p className="font-mono text-[11px] uppercase tracking-widest">
                  {status === "requesting" ? "Awaiting permission" : "Connecting camera"}
                </p>
              </div>
            </div>
          ) : null}

          {status === "idle" || status === "stopped" ? (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div className="flex flex-col items-center gap-2">
                <CameraOff className="size-6 text-elev/60" />
                <p className="text-[13px] font-semibold text-elev">
                  {status === "idle" ? "No camera connected" : "Session stopped"}
                </p>
                <p className="max-w-xs text-[11px] text-elev/60">
                  Connect a camera, drop a file here, or continue on the built-in demo feed.
                </p>
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div className="flex flex-col items-center gap-2">
                <CircleAlert className="size-6 text-rose" />
                <p className="text-[13px] font-semibold text-elev">Camera unavailable</p>
                <p className="max-w-xs text-[11px] text-elev/60">{errorText}</p>
              </div>
            </div>
          ) : null}

          {dragging ? (
            <div className="absolute inset-0 grid place-items-center bg-ink/75">
              <p className="font-mono text-[11px] uppercase tracking-widest text-amber">
                Drop image or video to analyse
              </p>
            </div>
          ) : null}

          {isLive ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-amber/40 scan-sweep" />
          ) : null}
        </div>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isLive || status === "requesting" || status === "connecting" ? (
            <Button size="sm" variant="secondary" onClick={stopSession}>
              <Square className="size-3.5" /> Stop session
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStatus("demo")}>
              <Play className="size-3.5" /> Start demo session
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => void connect()}>
            <Camera className="size-3.5" /> {status === "live" ? "Reconnect" : "Connect camera"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload media
          </Button>
          {status === "media" && upload ? (
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="size-3.5" /> Download result
            </Button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {devices.length > 0 ? (
            <Select
              value={deviceId}
              onValueChange={(v) => {
                setDeviceId(v);
                void connect(v);
              }}
            >
              <SelectTrigger className="w-full max-w-[240px] sm:w-[220px]">
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d, i) => (
                  <SelectItem key={d.deviceId || i} value={d.deviceId || `cam-${i}`}>
                    {d.label || `Camera ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {upload ? (
            <span className="ml-auto flex max-w-full items-center gap-1.5 rounded-md bg-panel px-2 py-1 font-mono text-[10px] text-mute ring-1 ring-line">
              <span className="truncate">{upload.name}</span>
              <button
                aria-label="Clear uploaded media"
                onClick={() => {
                  setUpload(null);
                  setStatus("demo");
                }}
                className="text-faint transition-colors hover:text-ink"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : status === "error" ? (
            <Button size="sm" variant="ghost" onClick={() => setStatus("demo")}>
              <RefreshCw className="size-3.5" /> Continue on demo feed
            </Button>
          ) : null}
        </div>

        {children}
      </div>
    </section>
  );
}
