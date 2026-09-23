import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, HardHat, ShieldAlert, XCircle } from "lucide-react";
import {
  Area,
  AreaChart,
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
  SeverityChip,
} from "@/components/vision/kit";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { complianceTrend, kitchenStaff, violations } from "@/lib/mock";
import feedKitchen from "@/assets/feed-kitchen.jpg";

/* ---------------- backend wiring ---------------- */

const API_BASE = "http://localhost:8000";
const KITCHEN_BASE = `${API_BASE}/api/kitchen`;

type RequirementState = "compliant" | "violation" | "unknown";

type PersonRequirement = {
  state: RequirementState;
  confidence: number;
  evidence_type: string | null;
};

type KitchenPerson = {
  track_id: number;
  staff_label: string;
  mask: PersonRequirement;
  gloves: PersonRequirement;
  hair_cover: PersonRequirement;
  overall: RequirementState;
};

type RequirementSummary =
  | {
      supported: true;
      compliant: number;
      violation: number;
      unknown: number;
      known: number;
      percentage: number | null;
    }
  | { supported: false; status: string };

type KitchenViolation = {
  event_id: string;
  track_id: number;
  staff_label: string;
  requirement: "mask" | "gloves" | "hair_cover";
  violation_type: string;
  severity: "critical" | "warning";
  started_at: string;
  last_seen_at: string;
};

type TrendPoint = {
  timestamp: string;
  compliance_score: number | null;
};

type KitchenDashboard = {
  session_id: string;
  status: "queued" | "running" | "completed" | "stopped" | "failed";
  camera_id: string | null;
  summary: {
    staff_detected: number;
    fully_compliant: number;
    open_violations: number;
    compliance_score: number | null;
  };
  requirements: Record<string, RequirementSummary>;
  persons: KitchenPerson[];
  compliance_trend: TrendPoint[];
};

type KitchenSessionStatus = {
  session_id: string;
  status: "queued" | "running" | "completed" | "stopped" | "failed";
  processed_frames: number;
  total_frames: number | null;
  error: string | null;
};

type ReportFormat = "PDF" | "CSV";
const apiFormat = (format: ReportFormat) => (format === "PDF" ? "pdf" : "csv");

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

async function startKitchenCamera(): Promise<{ session_id: string }> {
  const res = await fetch(`${KITCHEN_BASE}/sessions/camera`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // "0" = default local webcam index, same source Attendance/Guard use.
    body: JSON.stringify({ source: "0", camera_id: "CAM-03" }),
  });
  return jsonOrThrow(res, "Failed to start kitchen camera session");
}

async function stopKitchenSession(sessionId: string) {
  try {
    await fetch(`${KITCHEN_BASE}/sessions/${sessionId}/stop`, { method: "POST" });
  } catch {
    // Backend unreachable - nothing more we can do client-side.
  }
}

async function fetchKitchenStatus(sessionId: string): Promise<KitchenSessionStatus> {
  const res = await fetch(`${KITCHEN_BASE}/sessions/${sessionId}`);
  return jsonOrThrow(res, "Failed to fetch session status");
}

async function waitForKitchenSession(
  sessionId: string,
  onProgress?: (status: KitchenSessionStatus) => void,
): Promise<KitchenSessionStatus> {
  for (;;) {
    const status = await fetchKitchenStatus(sessionId);
    onProgress?.(status);
    if (
      status.status === "completed" ||
      status.status === "failed" ||
      status.status === "stopped"
    ) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function fetchKitchenDashboard(sessionId: string): Promise<KitchenDashboard> {
  const res = await fetch(`${KITCHEN_BASE}/sessions/${sessionId}/dashboard`);
  return jsonOrThrow(res, "Failed to fetch kitchen dashboard");
}

async function fetchKitchenViolations(sessionId: string): Promise<KitchenViolation[]> {
  const res = await fetch(`${KITCHEN_BASE}/sessions/${sessionId}/violations?active_only=false`);
  const data = await jsonOrThrow<{ violations: KitchenViolation[] }>(
    res,
    "Failed to fetch violations",
  );
  return data.violations;
}

async function fetchKitchenVideoUrl(sessionId: string): Promise<string> {
  const res = await fetch(`${KITCHEN_BASE}/sessions/${sessionId}/video`);
  if (!res.ok) throw new Error("Failed to fetch processed video");
  return URL.createObjectURL(await res.blob());
}

async function createKitchenUpload(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("camera_id", "CAM-03");
  const res = await fetch(`${KITCHEN_BASE}/sessions/upload`, { method: "POST", body });
  const data = await jsonOrThrow<{ session_id: string }>(res, "Failed to upload video");
  return data.session_id;
}

async function fetchKitchenReport(sessionId: string, format: ReportFormat) {
  const res = await fetch(
    `${KITCHEN_BASE}/sessions/${sessionId}/report?format=${apiFormat(format)}`,
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || "Failed to generate report");
  }
  const blob = await res.blob();
  return { blob, name: `${sessionId}-report.${apiFormat(format)}` };
}

function uploadProgressLabel(status: KitchenSessionStatus): string {
  if (status.total_frames) {
    const pct = Math.round((status.processed_frames / status.total_frames) * 100);
    return `Processing video · ${pct}%`;
  }
  return "Processing video";
}

const VIOLATION_LABELS: Record<string, string> = {
  no_mask: "Missing mask",
  incorrect_mask: "Face mask lowered",
  no_glove: "Missing gloves",
  no_hairnet: "Hair cover not worn",
  conflicting_evidence: "Conflicting PPE evidence",
};

function violationLabel(type: string): string {
  return VIOLATION_LABELS[type] ?? type.replace(/_/g, " ");
}

/* ---------------- component ---------------- */

export const Route = createFileRoute("/hygiene")({
  head: () => ({
    meta: [
      { title: "Kitchen Hygiene & PPE — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Monitor kitchen staff for masks, gloves and hair covers with live compliance scoring and violation history.",
      },
      { property: "og:title", content: "Kitchen Hygiene & PPE — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Live PPE compliance monitoring for kitchen and food prep areas.",
      },
    ],
  }),
  component: Hygiene,
});

const categories = [
  { key: "Face mask", worn: 2, total: 3 },
  { key: "Gloves", worn: 2, total: 3 },
  { key: "Hair cover", worn: 2, total: 3 },
  { key: "Apron", worn: 3, total: 3 },
];

function Hygiene() {
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("demo");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);
  const [sessionReportOpen, setSessionReportOpen] = useState(false);
  const [dashboard, setDashboard] = useState<KitchenDashboard | null>(null);
  const [violationsLog, setViolationsLog] = useState<KitchenViolation[]>([]);
  const [uploadLabel, setUploadLabel] = useState<string | undefined>(undefined);
  const [processingUpload, setProcessingUpload] = useState(false);

  // True the moment a real camera/upload is in play, including while an
  // upload is still processing - not just once results are ready. Keeps the
  // panels from falling back to demo mock data mid-processing (they show
  // real, empty-until-populated panels instead).
  const backendConnected = feedStatus === "live" || feedStatus === "media" || processingUpload;

  // Poll the dashboard + violation log every second while a live session is
  // running, same cadence Attendance/Guard use for their status polling.
  // Must NOT clear dashboard/violationsLog here: sessionId is also set for a
  // just-finished upload (at the same moment as the real dashboard/log from
  // onProcessMedia), which re-triggers this effect while feedStatus hasn't
  // caught up to "media" yet - wiping the real result right back to null.
  // Cleanup on a genuine disconnect is handled by the feedStatus-only effect
  // below instead.
  useEffect(() => {
    if (feedStatus !== "live" || !sessionId) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchKitchenDashboard(sessionId);
        if (!cancelled) setDashboard(data);
      } catch {
        // backend unreachable, keep last known dashboard
      }
      try {
        const log = await fetchKitchenViolations(sessionId);
        if (!cancelled) setViolationsLog(log);
      } catch {
        // backend unreachable, keep last known log
      }
    };
    poll();
    const t = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [feedStatus, sessionId]);

  // A stale processed session's dashboard shouldn't linger once the user
  // leaves "media".
  useEffect(() => {
    if (feedStatus !== "media" && feedStatus !== "live") {
      setDashboard(null);
      setViolationsLog([]);
    }
  }, [feedStatus]);

  // Only turn processingUpload off once feedStatus itself has actually left
  // "connecting" - never on a timer or from inside onProcessMedia's own
  // finally block, which would create a gap where processingUpload is
  // already false but feedStatus hasn't caught up yet, making
  // backendConnected flicker back to false (and panels flash demo data)
  // right as the real result is ready.
  useEffect(() => {
    if (feedStatus !== "connecting" && feedStatus !== "requesting") {
      setProcessingUpload(false);
    }
  }, [feedStatus]);

  const [severity, setSeverity] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");

  // Real per-person compliance when connected (live or a processing/processed
  // upload) - empty until the backend actually has people to report, never
  // the demo roster once we're past demo mode. Demo roster only outside of
  // any real connection.
  const staffList = useMemo(() => {
    if (!backendConnected) return kitchenStaff;
    if (!dashboard) return [];
    return dashboard.persons.map((p) => ({
      id: String(p.track_id),
      name: p.staff_label,
      station: `Track ${p.track_id}`,
      mask: p.mask.state === "compliant",
      gloves: p.gloves.state === "compliant",
      hairCover: p.hair_cover.state === "compliant",
    }));
  }, [backendConnected, dashboard]);

  const compliant = backendConnected
    ? (dashboard?.summary.fully_compliant ?? 0)
    : kitchenStaff.filter((s) => s.mask && s.gloves && s.hairCover).length;

  const list = (backendConnected ? violationsLog : violations).filter((v) => {
    if (severity === "all") return true;
    return "severity" in v && v.severity === severity;
  });

  const filteredStaff = staffList.filter((s) => {
    const isCompliant = s.mask && s.gloves && s.hairCover;
    if (complianceFilter === "compliant") return isCompliant;
    if (complianceFilter === "violation") return !isCompliant;
    return true;
  });

  const requirementRows = backendConnected
    ? dashboard
      ? (
          [
            ["Face mask", dashboard.requirements["mask"]],
            ["Gloves", dashboard.requirements["gloves"]],
            ["Hair cover", dashboard.requirements["hair_cover"]],
            ["Apron", dashboard.requirements["apron"]],
          ] as const
        ).map(([label, req]) => {
          if (!req || !req.supported) {
            return { key: label, text: "Not tracked", pct: 0 };
          }
          if (req.known === 0) {
            return { key: label, text: "No data yet", pct: 0 };
          }
          const pct = Math.max(0, Math.min(100, Math.round(req.percentage ?? 0)));
          return { key: label, text: `${req.compliant}/${req.known} · ${pct}%`, pct };
        })
      : ["Face mask", "Gloves", "Hair cover", "Apron"].map((label) => ({
          key: label,
          text: "Processing…",
          pct: 0,
        }))
    : categories.map((c) => {
        const pct = Math.round((c.worn / c.total) * 100);
        return { key: c.key, text: `${c.worn}/${c.total} · ${pct}%`, pct };
      });

  const trendData = backendConnected
    ? dashboard && dashboard.compliance_trend.length > 0
      ? dashboard.compliance_trend.map((t) => ({
          hour: new Date(t.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          score: t.compliance_score ?? 0,
        }))
      : []
    : complianceTrend;

  return (
    <>
      <SectionTitle title="Kitchen Line · Hygiene & PPE" sub="CAM-03 · PPE COMPLIANCE · SHIFT 2">
        <SettingsSheet
          pipelineName="Kitchen Hygiene"
          extra={[
            {
              title: "Snapshot every violation",
              help: "Save a still image with each event.",
              defaultOn: true,
            },
          ]}
        />
        <DownloadDialog
          reportName="Compliance report"
          {...(reportSessionId
            ? {
                onGenerate: async (format: ReportFormat) => {
                  const { blob, name } = await fetchKitchenReport(reportSessionId, format);
                  downloadBlob(blob, name);
                },
              }
            : {})}
        />
      </SectionTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Staff detected"
          value={backendConnected ? (dashboard?.summary.staff_detected ?? 0) : kitchenStaff.length}
          hint="on the line now"
        />
        <Kpi label="Fully compliant" value={compliant} tone="moss" hint="all PPE worn" />
        <Kpi
          label="Open violations"
          value={backendConnected ? (dashboard?.summary.open_violations ?? 0) : 2}
          tone="rose"
          hint="needs supervisor"
        />
        <Kpi
          label="Compliance score"
          value={backendConnected ? Math.round(dashboard?.summary.compliance_score ?? 0) : 84}
          unit="%"
          tone="amber"
          hint="target 95%"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <FeedPanel
            title="Kitchen line monitoring"
            cameraCode="CAM-03"
            sample={feedKitchen}
            sampleAlt="Commercial kitchen camera feed"
            liveSrc={`${KITCHEN_BASE}/sessions/current/stream`}
            liveOverride={processingUpload}
            sampleVideosModule="Kitchen"
            {...(uploadLabel ? { busyLabel: uploadLabel } : {})}
            onStatusChange={setFeedStatus}
            onConnect={async () => {
              const { session_id } = await startKitchenCamera();
              setSessionId(session_id);
              setReportSessionId(session_id);
            }}
            onStop={async () => {
              const id = sessionId;
              setSessionId(null);
              if (id) {
                await stopKitchenSession(id);
                setReportSessionId(id);
                setSessionReportOpen(true);
              }
            }}
            onProcessMedia={async (file) => {
              setUploadLabel("Uploading video");
              setProcessingUpload(true);
              try {
                const newSessionId = await createKitchenUpload(file);
                const status = await waitForKitchenSession(newSessionId, (s) =>
                  setUploadLabel(uploadProgressLabel(s)),
                );
                if (status.status === "failed") {
                  throw new Error(status.error || "Kitchen processing failed");
                }
                setUploadLabel("Loading processed video");
                const [url, dashboardData, log] = await Promise.all([
                  fetchKitchenVideoUrl(newSessionId),
                  fetchKitchenDashboard(newSessionId),
                  fetchKitchenViolations(newSessionId),
                ]);
                setSessionId(newSessionId);
                setReportSessionId(newSessionId);
                setDashboard(dashboardData);
                setViolationsLog(log);
                return url;
              } finally {
                // processingUpload itself is cleared by the feedStatus
                // effect above, once FeedPanel actually reflects the
                // outcome - not here.
                setUploadLabel(undefined);
              }
            }}
            overlay={
              feedStatus === "live" || feedStatus === "media" || processingUpload ? undefined : (
                <>
                  {kitchenStaff.map((s) => {
                    const ok = s.mask && s.gloves && s.hairCover;
                    const missing = [
                      !s.mask && "NO MASK",
                      !s.gloves && "NO GLOVES",
                      !s.hairCover && "NO HAIR COVER",
                    ].filter(Boolean) as string[];
                    return (
                      <DetectionBox
                        key={s.id}
                        left={s.left}
                        top={s.top}
                        width={s.width}
                        tone={ok ? "moss" : "rose"}
                        label={`${s.station} · ${ok ? "PPE OK" : "VIOLATION"}`}
                        sublabel={ok ? "MASK · GLOVES · COVER" : missing.join(" · ")}
                      />
                    );
                  })}
                </>
              )
            }
          />

          {/* Fully dialog-controlled (no visible trigger) - opened
              programmatically right after Stop, same pattern Attendance and
              Guard use. */}
          <DownloadDialog
            reportName="Session report"
            trigger={null}
            open={sessionReportOpen}
            onOpenChange={setSessionReportOpen}
            {...(reportSessionId
              ? {
                  onGenerate: async (format: ReportFormat) => {
                    const { blob, name } = await fetchKitchenReport(reportSessionId, format);
                    downloadBlob(blob, name);
                  },
                }
              : {})}
          />

          <Panel className="overflow-hidden">
            <PanelHead title="Per-person compliance" hint="Live read of each station">
              <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="violation">Violation</SelectItem>
                </SelectContent>
              </Select>
            </PanelHead>
            <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {filteredStaff.map((s) => {
                const items = [
                  { label: "Mask", ok: s.mask },
                  { label: "Gloves", ok: s.gloves },
                  { label: "Hair cover", ok: s.hairCover },
                ];
                return (
                  <div key={s.id} className="px-4 py-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold">{s.name}</p>
                        <p className="font-mono text-[10px] text-mute">{s.station}</p>
                      </div>
                      <Chip tone={items.every((i) => i.ok) ? "moss" : "rose"} dot>
                        {items.every((i) => i.ok) ? "Compliant" : "Violation"}
                      </Chip>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {items.map((i) => (
                        <span
                          key={i.label}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ${
                            i.ok
                              ? "bg-moss/10 text-moss ring-moss/20"
                              : "bg-rose/10 text-rose ring-rose/20"
                          }`}
                        >
                          {i.ok ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <XCircle className="size-3" />
                          )}
                          {i.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {backendConnected && filteredStaff.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-mute">
                  No staff detected {feedStatus === "live" ? "yet" : "in this video"}.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <p className="label-mono">Compliance by requirement</p>
            <div className="mt-4 space-y-3">
              {requirementRows.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium">{c.key}</span>
                    <span className="font-mono text-mute">{c.text}</span>
                  </div>
                  <Progress value={c.pct} className="mt-1.5 h-1.5" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <p className="label-mono">Compliance score today</p>
            <div className="mt-3 h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "var(--mute)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[60, 100]}
                    tick={{ fontSize: 10, fill: "var(--mute)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "var(--elev)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--amber)"
                    strokeWidth={2}
                    fill="url(#hg)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHead title="Violation feed" hint="Most recent first">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </PanelHead>
            {list.length === 0 ? (
              <EmptyState
                icon={<ShieldAlert className="size-5" />}
                title="No violations in this view"
                body={
                  backendConnected
                    ? "No PPE violations recorded for this session."
                    : "Everything on the line is compliant right now."
                }
              />
            ) : (
              <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
                {list.map((v) => {
                  const display =
                    "violation_type" in v
                      ? {
                          id: v.event_id,
                          issue: violationLabel(v.violation_type),
                          staff: v.staff_label,
                          camera: dashboard?.camera_id ?? "—",
                          time: new Date(v.last_seen_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                          severity: v.severity as "critical" | "warning" | "info",
                        }
                      : v;
                  return (
                    <div key={display.id} className="row-in flex items-start gap-3 px-4 py-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line">
                        <HardHat className="size-4 text-mute" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold">{display.issue}</p>
                        <p className="truncate font-mono text-[10px] text-mute">
                          {display.staff} · {display.camera} · {display.time}
                        </p>
                      </div>
                      <SeverityChip severity={display.severity} />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
