import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, ShieldCheck, Siren, Undo2, Video, X } from "lucide-react";
import { FeedPanel, type FeedStatus } from "@/components/vision/feed-panel";
import { DownloadDialog } from "@/components/vision/download-dialog";
import { SettingsSheet } from "@/components/vision/settings-sheet";
import {
  Chip,
  DetectionBox,
  EmptyState,
  Kpi,
  Panel,
  PanelHead,
  SectionTitle,
} from "@/components/vision/kit";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { intrusionEvents, zoneCameras } from "@/lib/mock";
import { cn } from "@/lib/utils";
import feedWarehouse from "@/assets/feed-warehouse.jpg";

/* ---------------- backend wiring ---------------- */

const API_BASE = "http://localhost:8000";
const RZ_BASE = `${API_BASE}/api/restricted-zone`;

type ZoneFrame = { frame_base64: string; width: number; height: number };
type DrawnZone = { name: string; points: [number, number][] };

type RZEvent = { track_id: number; cls_name: string; zone: string; time: string };

type RZStatus =
  | { is_capturing: false; has_report: boolean }
  | {
      is_capturing: boolean;
      session_id: number;
      start_time: string;
      frame_count: number;
      total_breaches: number;
      persons_detected: number;
      currently_inside: number;
      zones: string[];
      recent_events: RZEvent[];
      has_report: boolean;
    };

type ReportFormat = "PDF" | "CSV";
const apiFormat = (format: ReportFormat) => (format === "PDF" ? "pdf" : "csv");

function base64ToBlob(base64: string, mediaType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mediaType });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || fallback);
  }
  return res.json();
}

async function setCameraSource(): Promise<void> {
  const res = await fetch(`${RZ_BASE}/camera/source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "0" }),
  });
  await jsonOrThrow(res, "Failed to select camera source");
}

async function uploadZoneVideo(file: File): Promise<void> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${RZ_BASE}/upload`, { method: "POST", body });
  await jsonOrThrow(res, "Failed to upload video");
}

async function fetchZoneFrame(): Promise<ZoneFrame> {
  const res = await fetch(`${RZ_BASE}/zones/frame`);
  return jsonOrThrow(res, "Failed to grab a frame from the source");
}

async function submitZones(zones: DrawnZone[]): Promise<void> {
  const res = await fetch(`${RZ_BASE}/zones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zones }),
  });
  await jsonOrThrow(res, "Failed to save the restricted zone");
}

async function startZoneSession(): Promise<void> {
  const res = await fetch(`${RZ_BASE}/session/start`, { method: "POST" });
  await jsonOrThrow(res, "Failed to start monitoring");
}

async function stopZoneSession() {
  try {
    await fetch(`${RZ_BASE}/session/stop`, { method: "POST" });
  } catch {
    // Backend unreachable - nothing more we can do client-side.
  }
}

async function fetchZoneStatus(): Promise<RZStatus> {
  const res = await fetch(`${RZ_BASE}/status`);
  return jsonOrThrow(res, "Failed to fetch status");
}

async function fetchZoneReport(format: ReportFormat) {
  const res = await fetch(`${RZ_BASE}/session/report?format=${apiFormat(format)}`);
  const data = await jsonOrThrow<{
    media_type: string;
    report_base64: string;
    report_filename: string;
  }>(res, "Failed to generate report");
  return { blob: base64ToBlob(data.report_base64, data.media_type), name: data.report_filename };
}

async function wipeZoneData() {
  try {
    await fetch(`${RZ_BASE}/wipe_data`, { method: "POST" });
  } catch {
    // Backend unreachable - nothing more we can do client-side.
  }
}

/* ---------------- component ---------------- */

export const Route = createFileRoute("/intrusion")({
  head: () => ({
    meta: [
      { title: "Restricted Area Intrusion — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Watch restricted zones with polygon overlays, instant intrusion alerts, an event log and downloadable security reports.",
      },
      { property: "og:title", content: "Restricted Area Intrusion — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Restricted zone monitoring with instant intrusion alerts.",
      },
    ],
  }),
  component: Intrusion,
});

function Intrusion() {
  const [breach, setBreach] = useState(false);

  const [feedStatus, setFeedStatus] = useState<FeedStatus>("demo");

  const [zoneFrame, setZoneFrame] = useState<ZoneFrame | null>(null);
  const [savedZones, setSavedZones] = useState<DrawnZone[]>([]);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState<RZStatus | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // True from the moment an upload starts until its replay video is ready -
  // keeps every real panel/KPI showing real (if empty) data through zone
  // drawing and monitoring, instead of falling back to demo mock data while
  // FeedPanel itself is still sitting in "connecting".
  const [uploadActive, setUploadActive] = useState(false);
  // Holds the pending onProcessMedia resolver for an upload flow, fulfilled
  // only once the session actually finishes and a replayable video exists -
  // never while it's still being processed.
  const pendingUploadResolve = useRef<((url: string) => void) | null>(null);

  const backendConnected = feedStatus === "live" || feedStatus === "media" || uploadActive;
  const drawingZones = backendConnected && zoneFrame && !sessionActive;

  const resetZoneState = () => {
    setZoneFrame(null);
    setSavedZones([]);
    setCurrentPoints([]);
    setSessionActive(false);
    setStatus(null);
    setUploadActive(false);
    pendingUploadResolve.current = null;
  };

  // Reset on a genuine disconnect only - not merely because uploadActive
  // hasn't caught up with feedStatus yet (there's a brief gap between the
  // upload's promise resolving and FeedPanel's status actually flipping to
  // "media" that must not be mistaken for a disconnect mid-transition).
  useEffect(() => {
    if (
      feedStatus === "idle" ||
      feedStatus === "demo" ||
      feedStatus === "stopped" ||
      feedStatus === "error"
    ) {
      resetZoneState();
    }
  }, [feedStatus]);

  // Only turn uploadActive off once feedStatus itself has actually left
  // "connecting" - never proactively from finalizeSession, which would
  // create a gap where uploadActive is already false but feedStatus hasn't
  // caught up yet, making backendConnected flicker back to false (and
  // panels flash demo data) right as the real result is ready.
  useEffect(() => {
    if (feedStatus !== "connecting" && feedStatus !== "requesting") {
      setUploadActive(false);
    }
  }, [feedStatus]);

  // Once a session actually finishes (writer already released server-side -
  // see monitor.py's stop_session()/_finalize_session()), fetch the real
  // annotated video for an upload flow so it can be replayed as many times
  // as wanted without reprocessing. The report itself is downloaded on
  // demand from the "Download report" button, not forced on the user here.
  const finalizeSession = async () => {
    setSessionActive(false);
    // Drop the drawing snapshot so the side panel switches from "draw a
    // zone" back to the real recap ("Zones monitored") once finished,
    // instead of re-offering zone drawing for a session that's already over.
    setZoneFrame(null);
    const resolve = pendingUploadResolve.current;
    pendingUploadResolve.current = null;
    if (resolve) {
      try {
        const res = await fetch(`${RZ_BASE}/session/video`);
        resolve(res.ok ? URL.createObjectURL(await res.blob()) : "");
      } catch {
        resolve("");
      }
      // uploadActive itself is cleared by the feedStatus effect above, once
      // FeedPanel actually reflects the outcome - not here.
    }
  };

  // Poll real status every second while a session is running - same cadence
  // every other module uses for its live status.
  useEffect(() => {
    if (!sessionActive) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchZoneStatus();
        if (cancelled) return;
        setStatus(data);
        if (!data.is_capturing) {
          // The source reached EOF on its own (uploaded file) rather than an
          // explicit Stop click - finalize the same way a manual stop does.
          void finalizeSession();
        }
      } catch {
        // backend unreachable, keep last known status
      }
    };
    poll();
    const t = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sessionActive]);

  const addPoint = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentPoints((pts) => [...pts, [Math.min(Math.max(x, 0), 1), Math.min(Math.max(y, 0), 1)]]);
  };

  const undoPoint = () => setCurrentPoints((pts) => pts.slice(0, -1));

  const saveZone = () => {
    if (currentPoints.length < 3) return;
    setSavedZones((zs) => [...zs, { name: `Zone ${zs.length + 1}`, points: currentPoints }]);
    setCurrentPoints([]);
  };

  const canStart = savedZones.length > 0 || currentPoints.length >= 3;

  const handleStartMonitoring = async () => {
    setStarting(true);
    try {
      const zones =
        currentPoints.length >= 3
          ? [...savedZones, { name: `Zone ${savedZones.length + 1}`, points: currentPoints }]
          : savedZones;
      await submitZones(zones);
      await startZoneSession();
      setSavedZones(zones);
      setCurrentPoints([]);
      setSessionActive(true);
    } finally {
      setStarting(false);
    }
  };

  const handleStopMonitoring = async () => {
    if (!sessionActive) return;
    // stop_session() on the backend joins the capture thread before
    // responding, so the annotated video is already fully written and
    // closed by the time this resolves - safe to fetch it right after.
    await stopZoneSession();
    await finalizeSession();
  };

  const currentlyInside = status && "currently_inside" in status ? status.currently_inside : 0;
  const totalBreaches = status && "total_breaches" in status ? status.total_breaches : 0;
  const personsDetected = status && "persons_detected" in status ? status.persons_detected : 0;
  const monitoredZones = status && "zones" in status ? status.zones : [];
  const recentEvents = status && "recent_events" in status ? status.recent_events : [];

  const isBreach = backendConnected ? currentlyInside > 0 : breach;

  const [eventStatus, setEventStatus] = useState("all");
  const filteredIntrusions = intrusionEvents.filter(
    (e) => eventStatus === "all" || e.status === eventStatus,
  );

  return (
    <>
      <SectionTitle
        title="Warehouse Floor · Restricted Zone A"
        sub="CAM-11 · ZONE PERIMETER · 24/7"
      >
        <SettingsSheet
          pipelineName="Restricted Zones"
          extra={[
            {
              title: "Show zone outline",
              help: "Draw the restricted area on the feed.",
              defaultOn: true,
            },
          ]}
        />
        <DownloadDialog
          reportName="Security report"
          {...(backendConnected
            ? {
                onGenerate: async (format: ReportFormat) => {
                  const { blob, name } = await fetchZoneReport(format);
                  downloadBlob(blob, name);
                },
              }
            : {})}
        />
      </SectionTitle>

      <div
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-4 py-4 ring-1",
          isBreach ? "bg-rose/8 ring-rose/25" : "bg-moss/8 ring-moss/25",
        )}
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-lg ring-1",
            isBreach ? "bg-rose/15 text-rose ring-rose/25" : "bg-moss/15 text-moss ring-moss/25",
          )}
        >
          {isBreach ? <Siren className="size-5" /> : <ShieldCheck className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="label-mono">Zone status</p>
          <p
            className={cn(
              "truncate text-base font-extrabold uppercase tracking-tight sm:text-lg",
              isBreach ? "text-rose" : "text-moss",
            )}
          >
            {isBreach ? "Intrusion detected" : "Secure"}
          </p>
          <p className="truncate text-[11px] text-mute">
            {isBreach
              ? "A tracked object is inside a restricted zone right now."
              : "No unauthorised activity detected in the monitored zone."}
          </p>
        </div>
        {!backendConnected ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBreach((b) => !b)}
            className="shrink-0"
          >
            Simulate {breach ? "clear" : "breach"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FeedPanel
          title="Zone A perimeter camera"
          cameraCode="CAM-11"
          sample={feedWarehouse}
          sampleAlt="Warehouse floor camera feed with restricted zone"
          liveSrc={`${RZ_BASE}/video_feed`}
          liveOverride={sessionActive}
          sampleVideosModule="Restricted Zone"
          {...(starting
            ? { busyLabel: "Starting monitoring" }
            : drawingZones
              ? { busyLabel: "Draw a restricted zone to the right" }
              : {})}
          onStatusChange={setFeedStatus}
          onConnect={async () => {
            // A previous session's report may still be sitting unreported
            // (the user never clicked "Download report") - clear it before
            // starting a fresh one so its video/snapshots don't orphan on
            // disk indefinitely.
            await wipeZoneData();
            await setCameraSource();
            const frame = await fetchZoneFrame();
            setZoneFrame(frame);
          }}
          onStop={async () => {
            await handleStopMonitoring();
          }}
          onProcessMedia={(file) => {
            setUploadActive(true);
            return new Promise<string>((resolve) => {
              pendingUploadResolve.current = resolve;
              (async () => {
                try {
                  await wipeZoneData();
                  await uploadZoneVideo(file);
                  const frame = await fetchZoneFrame();
                  setZoneFrame(frame);
                  // Resolution is deferred until the session actually
                  // finishes (see finalizeSession) - by then the real
                  // annotated video is ready and replayable as many times
                  // as wanted, never a raw unprocessed preview.
                } catch {
                  pendingUploadResolve.current = null;
                  resolve(URL.createObjectURL(file));
                }
              })();
            });
          }}
          overlay={
            backendConnected ? undefined : (
              <>
                <div
                  className={cn(
                    "absolute rounded-md ring-2 transition-colors",
                    breach ? "bg-rose/25 ring-rose" : "bg-amber/15 ring-amber/70",
                  )}
                  style={{ left: "22%", top: "48%", width: "56%", height: "42%" }}
                >
                  <span
                    className={cn(
                      "absolute left-2 top-2 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest",
                      breach ? "bg-rose text-elev" : "bg-amber text-ink",
                    )}
                  >
                    Restricted area
                  </span>
                </div>
                {breach ? (
                  <DetectionBox
                    left={44}
                    top={52}
                    width={13}
                    height={34}
                    tone="rose"
                    label="PERSON · 96%"
                    sublabel="INSIDE ZONE A"
                  />
                ) : null}
              </>
            )
          }
        />

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Kpi
              label="Current status"
              value={isBreach ? "Breach" : "Secure"}
              tone={isBreach ? "rose" : "moss"}
              hint="Zone A"
            />
            <Kpi
              label="Intrusions today"
              value={backendConnected ? totalBreaches : breach ? 2 : 1}
              tone="rose"
              hint={backendConnected ? "this session" : "1 unresolved"}
            />
            <Kpi
              label="Persons detected"
              value={backendConnected ? personsDetected : 38}
              hint={backendConnected ? "in frame now" : "all zones"}
            />
            <Kpi
              label="Active cameras"
              value={backendConnected ? "1/1" : "3/4"}
              tone="amber"
              hint={backendConnected ? "this session" : "Roof access offline"}
            />
          </div>

          {drawingZones ? (
            <Panel className="overflow-hidden">
              <PanelHead
                title="Draw restricted zone"
                hint={`${savedZones.length + (currentPoints.length >= 3 ? 1 : 0)} zone(s) ready`}
              />
              <div className="p-3">
                <div className="relative overflow-hidden rounded-lg bg-ink">
                  <img
                    ref={imgRef}
                    src={`data:image/jpeg;base64,${zoneFrame.frame_base64}`}
                    alt="Latest frame from the selected source"
                    onClick={addPoint}
                    className="block w-full cursor-crosshair select-none"
                  />
                  {currentPoints.length > 0 ? (
                    <svg className="pointer-events-none absolute inset-0 size-full">
                      <polygon
                        points={currentPoints.map(([x, y]) => `${x * 100}%,${y * 100}%`).join(" ")}
                        className="fill-amber/20 stroke-amber"
                        strokeWidth={2}
                      />
                      {currentPoints.map(([x, y], i) => (
                        <circle
                          key={i}
                          cx={`${x * 100}%`}
                          cy={`${y * 100}%`}
                          r={4}
                          className="fill-amber"
                        />
                      ))}
                    </svg>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] text-mute">
                  Click on the frame to place points (at least 3) around the restricted area.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={undoPoint}
                    disabled={currentPoints.length === 0}
                  >
                    <Undo2 className="size-3.5" /> Undo point
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveZone}
                    disabled={currentPoints.length < 3}
                  >
                    <MapPin className="size-3.5" /> Save zone, draw another
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleStartMonitoring()}
                    disabled={!canStart || starting}
                  >
                    {starting ? "Starting…" : "Start monitoring"}
                  </Button>
                </div>
                {savedZones.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {savedZones.map((z, i) => (
                      <span
                        key={z.name}
                        className="inline-flex items-center gap-1 rounded-md bg-panel px-2 py-1 text-[11px] font-medium ring-1 ring-line"
                      >
                        {z.name}
                        <button
                          aria-label={`Remove ${z.name}`}
                          onClick={() => setSavedZones((zs) => zs.filter((_, idx) => idx !== i))}
                          className="text-faint transition-colors hover:text-ink"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : (
            <Panel className="overflow-hidden">
              <PanelHead
                title={backendConnected ? "Zones monitored" : "Zone cameras"}
                hint={backendConnected ? "This session" : "Coverage of monitored areas"}
              />
              {backendConnected ? (
                <div className="divide-y divide-line">
                  {monitoredZones.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[12px] text-mute">No zones set.</p>
                  ) : (
                    monitoredZones.map((name) => (
                      <div
                        key={name}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line">
                          <Video className="size-4 text-mute" />
                        </span>
                        <p className="truncate text-[12px] font-semibold">{name}</p>
                        <Chip
                          tone={currentlyInside > 0 ? "rose" : "moss"}
                          dot
                          pulse={currentlyInside > 0}
                        >
                          {currentlyInside > 0 ? "Active" : "Clear"}
                        </Chip>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {zoneCameras.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line">
                        {c.online ? (
                          <Video className="size-4 text-mute" />
                        ) : (
                          <Video className="size-4 text-rose" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold">{c.name}</p>
                        <p className="truncate font-mono text-[10px] text-mute">
                          {c.code} · {c.zone}
                        </p>
                      </div>
                      <Chip tone={c.online ? "moss" : "rose"} dot pulse={c.online}>
                        {c.online ? "Online" : "Offline"}
                      </Chip>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {sessionActive ? (
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => void handleStopMonitoring()}
            >
              Stop monitoring
            </Button>
          ) : null}
        </div>
      </div>

      <Panel className="overflow-hidden">
        <PanelHead
          title="Intrusion event log"
          hint={backendConnected ? "This session" : "Snapshots kept for 30 days"}
        >
          {!backendConnected ? (
            <Select value={eventStatus} onValueChange={setEventStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </PanelHead>
        {backendConnected ? (
          recentEvents.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="size-5" />}
              title="No breaches recorded"
              body="Nothing has entered a restricted zone yet this session."
            />
          ) : (
            <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {recentEvents.map((e, i) => (
                <div
                  key={`${e.track_id}-${e.time}-${i}`}
                  className="row-in flex items-start gap-3 px-4 py-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line">
                    <Siren className="size-4 text-rose" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">
                      {e.cls_name} #{e.track_id} entered {e.zone}
                    </p>
                    <p className="truncate font-mono text-[10px] text-mute">{e.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
            {filteredIntrusions.map((e) => (
              <article
                key={e.id}
                className="row-in overflow-hidden rounded-lg bg-panel ring-1 ring-line"
              >
                <div className="relative aspect-video overflow-hidden bg-ink">
                  <img
                    src={feedWarehouse}
                    alt={`Snapshot of ${e.zone} at ${e.time}`}
                    loading="lazy"
                    width={1280}
                    height={720}
                    className="size-full object-cover opacity-75"
                  />
                </div>
                <div className="space-y-1 p-3">
                  <p className="truncate text-[12px] font-semibold">{e.zone}</p>
                  <p className="font-mono text-[10px] text-mute">
                    {e.time} · {e.persons} person{e.persons > 1 ? "s" : ""}
                  </p>
                  <Chip
                    tone={e.status === "open" ? "rose" : e.status === "resolved" ? "moss" : "mute"}
                  >
                    {e.status}
                  </Chip>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
