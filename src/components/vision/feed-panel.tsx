import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CircleAlert,
  Clapperboard,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Chip, type Tone } from "./kit";

const API_BASE = "http://localhost:8000";

type SampleVideo = { name: string; url: string };

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
  /** When set, "Connect camera" streams this URL (e.g. a backend MJPEG feed)
   *  instead of requesting the browser's own camera via getUserMedia. */
  liveSrc?: string;
  /** Called right before switching to the live backend stream (e.g. to start a session). */
  onConnect?: () => Promise<void> | void;
  /** Called when the session is stopped (e.g. to stop the backend session).
   *  If it returns a promise, callers wait for it before reconnecting - so the
   *  backend has actually released the camera before we ask for it again. */
  onStop?: () => Promise<void> | void;
  /** Checked before connecting the camera or accepting an upload. Return (or
   *  resolve to) false to block the action (e.g. no one enrolled yet), which
   *  fires onGuardBlocked. May be async - it's awaited fresh on every attempt,
   *  so it should re-check live state rather than a locally cached flag. */
  guard?: () => boolean | Promise<boolean>;
  onGuardBlocked?: () => void;
  /** When set, uploaded media is sent here for processing (e.g. a backend
   *  face-recognition pass) instead of being previewed as-is. Must resolve to
   *  an object URL for the processed result. */
  onProcessMedia?: (file: File) => Promise<string>;
  /** Overrides the "Connecting camera" label shown while awaiting onConnect
   *  or onProcessMedia - e.g. "Processing video" for a backend job that isn't
   *  actually a camera connection. Can change while connecting/processing is
   *  in progress (e.g. to show live percent complete). */
  busyLabel?: string;
  /** Called whenever the user downloads the processed result -
   *  e.g. to clean up server-side data now that it's been saved locally. */
  onDownload?: () => void;
  /** Shows liveSrc as the base layer even outside status "live" - for a
   *  backend that processes an upload in place and streams it through the
   *  same live feed rather than handing back one finished file (e.g. a
   *  session that keeps running after onProcessMedia resolves). */
  liveOverride?: boolean;
  /** Restricts the "Sample videos" dropdown to clips whose filename contains
   *  this keyword (e.g. "Guard", "Kitchen") - so one module's sample footage
   *  never shows up on another module's page. Omit it and no sample videos
   *  are offered at all (never falls back to showing every clip). */
  sampleVideosModule?: string;
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
  liveSrc,
  onConnect,
  onStop,
  guard,
  onGuardBlocked,
  onProcessMedia,
  onDownload,
  busyLabel,
  liveOverride = false,
  sampleVideosModule,
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
  const [feedRetry, setFeedRetry] = useState(0);
  const [sampleVideos, setSampleVideos] = useState<SampleVideo[]>([]);
  const [loadingSample, setLoadingSample] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaVideoRef = useRef<HTMLVideoElement | null>(null);
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

  useEffect(() => {
    if (!sampleVideosModule) {
      setSampleVideos([]);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/sample-videos/list?module=${encodeURIComponent(sampleVideosModule)}`)
      .then((res) => (res.ok ? res.json() : { videos: [] }))
      .then((data: { videos: SampleVideo[] }) => {
        if (!cancelled) setSampleVideos(data.videos ?? []);
      })
      .catch(() => {
        // No backend reachable yet - just hide the button, not fatal.
      });
    return () => {
      cancelled = true;
    };
  }, [sampleVideosModule]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const passesGuard = useCallback(async () => {
    if (guard) {
      const ok = await guard();
      if (!ok) {
        onGuardBlocked?.();
        return false;
      }
    }
    return true;
  }, [guard, onGuardBlocked]);

  const connect = useCallback(
    async (preferred?: string) => {
      if (!(await passesGuard())) return;

      if (liveSrc) {
        if (status === "live") {
          // Reconnecting: release the backend's camera first so the OS device
          // is actually free before we request it again - otherwise the browser
          // permission check below fails with a "device busy" error.
          setStatus("connecting");
          await onStop?.();
        }

        setStatus("requesting");
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          setStatus("error");
          setErrorText("This browser does not expose a camera device.");
          return;
        }
        try {
          // Ask the browser for camera permission first, purely as a user-facing
          // confirmation step - the actual video comes from the backend feed below.
          const permissionStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          permissionStream.getTracks().forEach((t) => t.stop());
        } catch {
          setStatus("error");
          setErrorText(
            "Permission denied or no camera available. You can continue on the demo feed.",
          );
          toast.error("Camera permission denied");
          return;
        }

        setStatus("connecting");
        try {
          await onConnect?.();
          stopStream();
          setUpload(null);
          setStatus("live");
          toast.success("Camera connected", { description: "Backend session started" });
        } catch {
          setStatus("error");
          setErrorText("Could not start the backend session. You can continue on the demo feed.");
          toast.error("Could not start the camera");
        }
        return;
      }

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
    [stopStream, liveSrc, onConnect, onStop, status, passesGuard],
  );

  const stopSession = async () => {
    stopStream();
    setStatus("stopped");
    await onStop?.();
    toast("Session stopped");
  };
  const handleDownload = () => {
    if (!upload) return;
    const a = document.createElement("a");
    a.href = upload.url;
    a.download = upload.name;
    a.click();
    onDownload?.();
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!(await passesGuard())) return;

    const kind = file.type.startsWith("video") ? "video" : "image";
    stopStream();

    if (onProcessMedia) {
      setStatus("connecting");
      try {
        const processedUrl = await onProcessMedia(file);
        const base = file.name.replace(/\.[^./]+$/, "");
        const outName = `${base}-processed.${kind === "video" ? "mp4" : "jpg"}`;
        setUpload({ url: processedUrl, kind, name: outName });
        setStatus("media");
        toast.success("Media processed", { description: file.name });
      } catch {
        setStatus("error");
        setErrorText("Could not process the uploaded media. You can continue on the demo feed.");
        toast.error("Processing failed");
      }
      return;
    }

    setUpload({ url: URL.createObjectURL(file), kind, name: file.name });
    setStatus("media");
    toast.success("Media loaded", { description: file.name });
  };

  const handleSampleVideo = async (sample: SampleVideo) => {
    if (!(await passesGuard())) return;
    setLoadingSample(true);
    try {
      const res = await fetch(`${API_BASE}${sample.url}`);
      if (!res.ok) throw new Error("Failed to fetch sample video");
      const blob = await res.blob();
      const file = new File([blob], sample.name, { type: blob.type || "video/mp4" });
      await handleFile(file);
    } catch {
      toast.error("Could not load sample video");
    } finally {
      setLoadingSample(false);
    }
  };

  const info = statusCopy[status];
  const liveOverrideActive = liveOverride && (status === "media" || status === "connecting");
  const showLiveSrc = (status === "live" || liveOverrideActive) && !!liveSrc;
  const showOverlay =
    status === "live" || status === "demo" || status === "media" || liveOverrideActive;
  const isLive = status === "live" || status === "demo" || liveOverrideActive;

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
          {showLiveSrc ? (
            <img
              key={feedRetry}
              src={liveSrc}
              alt={`${cameraCode} live feed`}
              className="absolute inset-0 size-full bg-ink object-contain"
              onError={() => {
                // The MJPEG connection can drop for transient reasons (network
                // blip, tab backgrounding). The session/camera keeps running
                // server-side, so just reconnect the stream, not the session.
                setTimeout(() => setFeedRetry((n) => n + 1), 1000);
              }}
            />
          ) : status === "live" ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 size-full object-cover"
            />
          ) : status === "media" && upload ? (
            upload.kind === "video" ? (
              <video
                ref={mediaVideoRef}
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
          {(status === "requesting" || status === "connecting") && !showLiveSrc ? (
            <div className="absolute inset-0 grid place-items-center bg-ink/70 text-elev">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-5 animate-spin" />
                <p className="font-mono text-[11px] uppercase tracking-widest">
                  {status === "requesting"
                    ? "Awaiting permission"
                    : (busyLabel ?? "Connecting camera")}
                </p>
              </div>
            </div>
          ) : null}

          {status === "connecting" && showLiveSrc ? (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-ink/70 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-elev">
              <Loader2 className="size-3 animate-spin" />
              {busyLabel ?? "Processing"}
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
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!(await passesGuard())) return;
              fileRef.current?.click();
            }}
          >
            <Upload className="size-3.5" /> Upload media
          </Button>
          {sampleVideos.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={loadingSample}>
                  {loadingSample ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Clapperboard className="size-3.5" />
                  )}
                  Sample videos
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {sampleVideos.map((v) => (
                  <DropdownMenuItem key={v.url} onClick={() => void handleSampleVideo(v)}>
                    {v.name.replace(/\.[^./]+$/, "")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {status === "media" && upload?.kind === "video" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const el = mediaVideoRef.current;
                if (!el) return;
                el.pause();
                el.currentTime = 0;
                // Some browsers reject play() if it's issued in the same
                // tick as the currentTime seek (the seek hasn't landed yet)
                // - retry once "seeked" actually fires instead of failing
                // silently.
                el.play().catch(() => {
                  el.addEventListener("seeked", () => void el.play(), { once: true });
                });
              }}
            >
              <RefreshCw className="size-3.5" /> Replay
            </Button>
          ) : null}
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

          {devices.length > 0 && !liveSrc ? (
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
