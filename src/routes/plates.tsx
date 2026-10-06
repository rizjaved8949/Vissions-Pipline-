import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bike, Car, Search, Truck } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { plateRecords, plateTraffic, type PlateRecord } from "@/lib/mock";
import feedGate from "@/assets/feed-gate.jpg";

/* ---------------- backend wiring ----------------
 * Plate_detector is DETECTION ONLY - it produces enhanced plate IMAGES, never
 * plate text (no OCR). Every "real" field below reflects that: there is no
 * alphanumeric plate number to show, search or export - only vehicle class,
 * confidence/quality scores, a timestamp and the crop image itself. */

const API_BASE = "http://localhost:8000";
const ALPR_BASE = `${API_BASE}/api/alpr`;

type PlateRecordReal = {
  track_id: string;
  vehicle: string | null;
  plate_conf: number | null;
  quality: number | null;
  low_conf: boolean;
  timestamp: string | null;
  image_url: string | null;
  raw_image_url: string | null;
};

type JobSummary = {
  frames: number;
  elapsed_s: number;
  fps: number;
  finalized: number;
  lowconf: number;
  video: string | null;
  counts: { plates_saved: number; lowconf_quarantined: number; rejected_adframe: number };
};

type JobStatusResponse = {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number | null;
  frames_processed: number;
  total_frames: number | null;
  error: string | null;
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

async function startPlateCamera(): Promise<{ job_id: string }> {
  const res = await fetch(`${ALPR_BASE}/jobs/camera`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // "0" = default local webcam index, same source every other module uses.
    body: JSON.stringify({ source: "0" }),
  });
  return jsonOrThrow(res, "Failed to start plate detection camera job");
}

async function stopPlateJob(jobId: string) {
  try {
    await fetch(`${ALPR_BASE}/jobs/${jobId}/stop`, { method: "POST" });
  } catch {
    // Backend unreachable - nothing more we can do client-side.
  }
}

async function createPlateJob(file: File): Promise<string> {
  const body = new FormData();
  body.append("video", file);
  const res = await fetch(`${ALPR_BASE}/jobs`, { method: "POST", body });
  const data = await jsonOrThrow<{ job_id: string }>(res, "Failed to upload video");
  return data.job_id;
}

async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${ALPR_BASE}/jobs/${jobId}`);
  return jsonOrThrow(res, "Failed to fetch job status");
}

async function waitForPlateJob(
  jobId: string,
  onProgress?: (status: JobStatusResponse) => void,
): Promise<JobStatusResponse> {
  for (;;) {
    const status = await fetchJobStatus(jobId);
    onProgress?.(status);
    if (status.status === "completed" || status.status === "failed") return status;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function fetchJobSummary(jobId: string): Promise<JobSummary> {
  const res = await fetch(`${ALPR_BASE}/jobs/${jobId}/summary`);
  const data = await jsonOrThrow<{ summary: JobSummary }>(res, "Failed to fetch job summary");
  return data.summary;
}

async function fetchPlates(jobId: string): Promise<PlateRecordReal[]> {
  const res = await fetch(`${ALPR_BASE}/jobs/${jobId}/plates`);
  const data = await jsonOrThrow<{ plates: PlateRecordReal[] }>(res, "Failed to fetch plates");
  return data.plates;
}

async function fetchJobVideoUrl(jobId: string): Promise<string> {
  const res = await fetch(`${ALPR_BASE}/jobs/${jobId}/video`);
  if (!res.ok) throw new Error("Failed to fetch processed video");
  return URL.createObjectURL(await res.blob());
}

async function fetchJobReport(jobId: string, format: ReportFormat) {
  const res = await fetch(`${ALPR_BASE}/jobs/${jobId}/report?format=${apiFormat(format)}`);
  const data = await jsonOrThrow<{
    media_type: string;
    report_base64: string;
    report_filename: string;
  }>(res, "Failed to generate report");
  return { blob: base64ToBlob(data.report_base64, data.media_type), name: data.report_filename };
}

function jobProgressLabel(status: JobStatusResponse): string {
  if (status.total_frames) {
    return `Processing video · ${Math.round(status.progress ?? 0)}%`;
  }
  return "Processing video";
}

function vehicleIcon(vehicle: string | null) {
  if (vehicle === "motorcycle" || vehicle === "bicycle") return Bike;
  if (vehicle === "bus" || vehicle === "truck") return Truck;
  return Car;
}

function formatTimestamp(ts: string | null): string {
  // "20261002_220745_186" -> "22:07:45"
  if (!ts) return "-";
  const m = /^\d{8}_(\d{2})(\d{2})(\d{2})/.exec(ts);
  return m ? `${m[1]}:${m[2]}:${m[3]}` : ts;
}

function hourOf(ts: string | null): number | null {
  const m = /^\d{8}_(\d{2})/.exec(ts ?? "");
  return m?.[1] ? parseInt(m[1], 10) : null;
}

/* ---------------- component ---------------- */

export const Route = createFileRoute("/plates")({
  head: () => ({
    meta: [
      { title: "Vehicle Plate Detection — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Detect cars and motorcycles at the gate, locate their licence plates and review a history of every pass.",
      },
      { property: "og:title", content: "Vehicle Plate Detection — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Gate camera vehicle classification and licence plate detection.",
      },
    ],
  }),
  component: Plates,
});

function Plates() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [detail, setDetail] = useState<PlateRecordReal | PlateRecord | null>(null);

  const [feedStatus, setFeedStatus] = useState<FeedStatus>("demo");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [reportJobId, setReportJobId] = useState<string | null>(null);
  const [sessionReportOpen, setSessionReportOpen] = useState(false);
  const [jobSummary, setJobSummary] = useState<JobSummary | null>(null);
  const [plates, setPlates] = useState<PlateRecordReal[]>([]);
  const [uploadLabel, setUploadLabel] = useState<string | undefined>(undefined);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  // True the moment a real camera/job is in play, including while an upload
  // is still processing - not just once results are ready. Keeps every real
  // panel/KPI showing real (if empty) data instead of falling back to demo
  // mock mid-processing.
  const backendConnected = feedStatus === "live" || feedStatus === "media" || !!processingJobId;

  // A stale processed job shouldn't linger once the user leaves "media"/"live".
  useEffect(() => {
    if (feedStatus !== "media" && feedStatus !== "live") {
      setJobId(null);
      setJobSummary(null);
      setPlates([]);
    }
  }, [feedStatus]);

  // Only turn processingJobId off once feedStatus itself has actually left
  // "connecting" - never from inside onProcessMedia's own finally block,
  // which would create a gap where processingJobId is already null but
  // feedStatus hasn't caught up yet, making backendConnected flicker back to
  // false (and panels flash demo data) right as the real result is ready.
  useEffect(() => {
    if (feedStatus !== "connecting" && feedStatus !== "requesting") {
      setProcessingJobId(null);
    }
  }, [feedStatus]);

  const activeStreamJobId = sessionId || processingJobId;

  const vehicleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of plates) {
      const v = p.vehicle || "unknown";
      counts[v] = (counts[v] || 0) + 1;
    }
    return counts;
  }, [plates]);

  // Real per-hour histogram derived from each plate's own timestamp - no
  // backend bucketing needed, it's directly computable from real data.
  const trendData = useMemo(() => {
    if (!backendConnected) return plateTraffic;
    const buckets = new Map<number, { cars: number; bikes: number }>();
    for (const p of plates) {
      const h = hourOf(p.timestamp);
      if (h === null) continue;
      const b = buckets.get(h) || { cars: 0, bikes: 0 };
      if (p.vehicle === "motorcycle" || p.vehicle === "bicycle") b.bikes += 1;
      else b.cars += 1;
      buckets.set(h, b);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([h, b]) => ({ hour: `${String(h).padStart(2, "0")}:00`, ...b }));
  }, [backendConnected, plates]);

  const rows = useMemo(() => {
    if (backendConnected) {
      const q = query.trim().toLowerCase();
      return plates.filter((p) => {
        const matchesType =
          type === "all" ||
          (type === "car" && p.vehicle === "car") ||
          (type === "motorcycle" && (p.vehicle === "motorcycle" || p.vehicle === "bicycle"));
        const matchesQuery = !q || String(p.track_id).toLowerCase().includes(q);
        return matchesType && matchesQuery;
      });
    }
    return plateRecords.filter((r) => {
      const q = query.trim().toLowerCase();
      return (
        (type === "all" || r.type.toLowerCase() === type) &&
        (!q || r.plate.toLowerCase().includes(q))
      );
    });
  }, [backendConnected, plates, query, type]);

  const uniqueDemo = new Set(plateRecords.map((r) => r.plate)).size;

  return (
    <>
      <SectionTitle title="Gate A · Vehicle & Plate Reading" sub="CAM-04 · ANPR · TWO LANES">
        <SettingsSheet
          pipelineName="Plate Detection"
          extra={[
            {
              title: "Highlight repeat vehicles",
              help: "Mark plates seen more than once today.",
              defaultOn: true,
            },
          ]}
        />
        <DownloadDialog
          reportName="Vehicle log"
          {...(reportJobId
            ? {
                onGenerate: async (format: ReportFormat) => {
                  const { blob, name } = await fetchJobReport(reportJobId, format);
                  downloadBlob(blob, name);
                },
              }
            : {})}
        />
      </SectionTitle>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FeedPanel
          title="Gate approach camera"
          cameraCode="CAM-04"
          sample={feedGate}
          sampleAlt="Parking gate camera feed with vehicles"
          sampleVideosModule="Plate"
          {...(activeStreamJobId
            ? { liveSrc: `${ALPR_BASE}/jobs/${activeStreamJobId}/stream` }
            : {})}
          liveOverride={!!processingJobId}
          {...(uploadLabel ? { busyLabel: uploadLabel } : {})}
          onStatusChange={setFeedStatus}
          onConnect={async () => {
            const { job_id } = await startPlateCamera();
            setSessionId(job_id);
            setReportJobId(job_id);
          }}
          onStop={async () => {
            const id = sessionId;
            setSessionId(null);
            if (id) {
              await stopPlateJob(id);
              setReportJobId(id);
              setSessionReportOpen(true);
              try {
                const [summaryData, platesData] = await Promise.all([
                  fetchJobSummary(id),
                  fetchPlates(id),
                ]);
                setJobSummary(summaryData);
                setPlates(platesData);
              } catch {
                // backend unreachable - the report dialog still works on demand
              }
            }
          }}
          onProcessMedia={async (file) => {
            setUploadLabel("Uploading video");
            try {
              const newJobId = await createPlateJob(file);
              setProcessingJobId(newJobId);
              const status = await waitForPlateJob(newJobId, (s) =>
                setUploadLabel(jobProgressLabel(s)),
              );
              if (status.status === "failed") {
                throw new Error(status.error || "ALPR processing failed");
              }
              setUploadLabel("Loading processed video");
              const [url, summaryData, platesData] = await Promise.all([
                fetchJobVideoUrl(newJobId),
                fetchJobSummary(newJobId),
                fetchPlates(newJobId),
              ]);
              setJobId(newJobId);
              setReportJobId(newJobId);
              setJobSummary(summaryData);
              setPlates(platesData);
              return url;
            } finally {
              setUploadLabel(undefined);
            }
          }}
          overlay={
            backendConnected ? undefined : (
              <>
                <DetectionBox
                  left={56}
                  top={42}
                  width={26}
                  height={26}
                  tone="amber"
                  label="CAR · 98%"
                />
                <DetectionBox
                  left={62}
                  top={57}
                  width={12}
                  height={7}
                  tone="moss"
                  label="PLATE: ABC-123"
                />
                <DetectionBox
                  left={28}
                  top={44}
                  width={18}
                  height={26}
                  tone="slate"
                  label="MOTORCYCLE · 93%"
                />
                <DetectionBox
                  left={29}
                  top={58}
                  width={9}
                  height={6}
                  tone="moss"
                  label="PLATE: KHI-8842"
                />
              </>
            )
          }
        >
          {!backendConnected ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { type: "Car", plate: "ABC-123", conf: 98, icon: Car, lane: "Gate A · In" },
                {
                  type: "Motorcycle",
                  plate: "KHI-8842",
                  conf: 93,
                  icon: Bike,
                  lane: "Gate A · In",
                },
              ].map((v) => (
                <div key={v.plate} className="rounded-lg bg-panel p-3 ring-1 ring-line">
                  <div className="flex items-center gap-2">
                    <v.icon className="size-4 text-mute" />
                    <span className="label-mono">{v.type}</span>
                    <Chip tone="moss" className="ml-auto">
                      {v.conf}%
                    </Chip>
                  </div>
                  <p className="mt-2 rounded-md bg-elev px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.18em] ring-1 ring-line">
                    {v.plate}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-mute">{v.lane} · just now</p>
                </div>
              ))}
            </div>
          ) : null}
        </FeedPanel>

        {/* Fully dialog-controlled (no visible trigger) - opened
            programmatically right after a live camera is stopped, same
            pattern Attendance/Guard/Kitchen use. */}
        <DownloadDialog
          reportName="Session report"
          trigger={null}
          open={sessionReportOpen}
          onOpenChange={setSessionReportOpen}
          {...(reportJobId
            ? {
                onGenerate: async (format: ReportFormat) => {
                  const { blob, name } = await fetchJobReport(reportJobId, format);
                  downloadBlob(blob, name);
                },
              }
            : {})}
        />

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Kpi
              label="Vehicles tracked"
              value={backendConnected ? (jobSummary?.finalized ?? 0) : 149}
              hint={backendConnected ? "this video" : "both lanes"}
            />
            <Kpi
              label="Cars"
              value={backendConnected ? (vehicleCounts["car"] ?? 0) : 96}
              tone="amber"
              hint={backendConnected ? "plates saved" : "64% of traffic"}
            />
            <Kpi
              label="Motorcycles"
              value={
                backendConnected
                  ? (vehicleCounts["motorcycle"] ?? 0) + (vehicleCounts["bicycle"] ?? 0)
                  : 53
              }
              tone="slate"
              hint={backendConnected ? "plates saved" : "36% of traffic"}
            />
            <Kpi
              label="Needs review"
              value={
                backendConnected ? (jobSummary?.counts.lowconf_quarantined ?? 0) : uniqueDemo + 121
              }
              tone={backendConnected ? "rose" : "moss"}
              hint={backendConnected ? "low confidence" : "12 repeat visitors"}
            />
          </div>
          <Panel className="p-4">
            <p className="label-mono">Traffic by hour</p>
            <div className="mt-3 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "var(--mute)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--mute)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RTooltip
                    cursor={{ fill: "var(--panel)" }}
                    contentStyle={{
                      background: "var(--elev)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="cars" stackId="a" fill="var(--amber)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="bikes" stackId="a" fill="var(--slate)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <PanelHead
          title="Plate history"
          hint={
            backendConnected ? "Every plate saved this video" : "Every read from both lanes today"
          }
        >
          <DownloadDialog
            reportName="Plate history"
            trigger={
              <Button size="sm" variant="outline">
                Export
              </Button>
            }
            {...(reportJobId
              ? {
                  onGenerate: async (format: ReportFormat) => {
                    const { blob, name } = await fetchJobReport(reportJobId, format);
                    downloadBlob(blob, name);
                  },
                }
              : {})}
          />
        </PanelHead>

        <div className="grid gap-3 border-b border-line px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={backendConnected ? "Search by track ID" : "Search plate number"}
              className="h-9 pl-9 font-mono uppercase"
            />
          </div>
          <Tabs value={type} onValueChange={setType}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="car">Cars</TabsTrigger>
              <TabsTrigger value="motorcycle">Bikes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title={backendConnected ? "No plates saved yet" : "No plates match that search"}
            body={
              backendConnected
                ? "No confident plate detections recorded for this video yet."
                : "Check the spelling or clear the filter."
            }
          />
        ) : backendConnected ? (
          <div className="max-h-[480px] divide-y divide-line overflow-y-auto">
            {(rows as PlateRecordReal[]).map((p) => {
              const Icon = vehicleIcon(p.vehicle);
              return (
                <button
                  key={`${p.track_id}-${p.timestamp}`}
                  onClick={() => setDetail(p)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel/60"
                >
                  <span className="size-12 shrink-0 overflow-hidden rounded-md bg-panel ring-1 ring-line">
                    {p.image_url ? (
                      <img
                        src={`${API_BASE}${p.image_url}`}
                        alt={`Detected ${p.vehicle || "vehicle"} plate`}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center">
                        <Icon className="size-4 text-mute" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12px] font-bold">
                      Track #{p.track_id} · {p.vehicle || "vehicle"}
                    </p>
                    <p className="truncate font-mono text-[10px] text-mute">
                      quality {Math.round((p.quality ?? 0) * 100)}% · {formatTimestamp(p.timestamp)}
                    </p>
                  </div>
                  {p.low_conf ? (
                    <Chip tone="rose">needs review</Chip>
                  ) : (
                    <Chip tone={(p.plate_conf ?? 0) > 0.7 ? "moss" : "amber"}>
                      {Math.round((p.plate_conf ?? 0) * 100)}%
                    </Chip>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => {
              const record = r as (typeof plateRecords)[number];
              return (
                <button
                  key={record.id}
                  onClick={() => setDetail(record)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel/60"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line">
                    {record.type === "Car" ? (
                      <Car className="size-4 text-mute" />
                    ) : (
                      <Bike className="size-4 text-mute" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px] font-bold tracking-[0.14em]">
                      {record.plate}
                    </p>
                    <p className="truncate font-mono text-[10px] text-mute">
                      {record.type} · {record.lane} · {record.time}
                    </p>
                  </div>
                  <Chip tone={record.confidence > 94 ? "moss" : "amber"}>{record.confidence}%</Chip>
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail && "track_id" in detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono tracking-[0.14em]">
                  Track #{detail.track_id}
                </DialogTitle>
                <DialogDescription>
                  {detail.vehicle || "vehicle"} · enhanced plate crop
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-lg bg-ink ring-1 ring-line">
                {detail.image_url ? (
                  <img
                    src={`${API_BASE}${detail.image_url}`}
                    alt="Enhanced plate crop"
                    loading="lazy"
                    className="aspect-video w-full object-contain"
                  />
                ) : (
                  <div className="grid aspect-video place-items-center text-[11px] text-mute">
                    No crop image available
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Plate confidence", `${Math.round((detail.plate_conf ?? 0) * 100)}%`],
                  ["Quality", `${Math.round((detail.quality ?? 0) * 100)}%`],
                  ["Timestamp", formatTimestamp(detail.timestamp)],
                  ["Needs review", detail.low_conf ? "Yes" : "No"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md bg-panel p-3 ring-1 ring-line">
                    <p className="label-mono">{k}</p>
                    <p className="mt-1 truncate font-mono text-[12px] font-semibold">{v}</p>
                  </div>
                ))}
              </div>
            </>
          ) : detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono tracking-[0.14em]">{detail.plate}</DialogTitle>
                <DialogDescription>
                  {detail.type} · {detail.lane}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-lg ring-1 ring-line">
                <img
                  src={feedGate}
                  alt="Snapshot of the detected vehicle"
                  loading="lazy"
                  width={1280}
                  height={720}
                  className="aspect-video w-full object-cover"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Confidence", `${detail.confidence}%`],
                  ["Time", detail.time],
                  ["Colour", detail.color],
                  ["Lane", detail.lane],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md bg-panel p-3 ring-1 ring-line">
                    <p className="label-mono">{k}</p>
                    <p className="mt-1 truncate font-mono text-[12px] font-semibold">{v}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
