import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Armchair, BedDouble, CircleAlert, CircleSlash, Eye, PersonStanding } from "lucide-react";
import { FeedPanel, type FeedStatus } from "@/components/vision/feed-panel";
import { DownloadDialog } from "@/components/vision/download-dialog";
import { SettingsSheet } from "@/components/vision/settings-sheet";
import {
  Chip,
  DetectionBox,
  Kpi,
  Panel,
  PanelHead,
  SectionTitle,
  SeverityChip,
  type Tone,
} from "@/components/vision/kit";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { guardEvents, guardStateLabels, guardTimeline, type GuardState } from "@/lib/mock";
import { cn } from "@/lib/utils";
import feedGuard from "@/assets/feed-guard.jpg";

/* ---------------- backend wiring ---------------- */

const API_BASE = "http://localhost:8000";
const GUARD_BASE = `${API_BASE}/api/guard`;

type RuleName = "sleep" | "phone" | "stationary" | "absence";

type RuleEvent = {
  rule: RuleName;
  track_id: number | null;
  triggered_at: number;
  threshold_seconds: number;
  wall_time?: string;
};

type ModuleStatus = { status: "ok" | "unknown" | "error" | "disabled"; error: string | null };

type FrameLog = {
  present: boolean | null;
  movement: { stationary: boolean; patrol_coverage_ratio: number | null };
  posture: { posture: "sitting" | "standing" | "unknown"; head_down: boolean };
  phone: { detected: boolean; usage: string };
  eyes: { available: boolean; quality_ok: boolean; eyes_closed: boolean | null; reason: string };
  sleep: { candidate: boolean; evidence_quality: string; score: number; perclos: number | null };
  rules_triggered: Record<RuleName, boolean>;
  module_status: Record<string, ModuleStatus>;
};

type LiveStats = {
  visible_frames: number;
  stationary_frames: number;
  sleep_candidate_frames: number;
  absence_frames: number;
};

type LiveState = {
  session_id: string;
  analysis_fps: number;
  uptime_seconds: number;
  stats: LiveStats;
  state: FrameLog | null;
};

type JobStatusResponse = {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number | null;
  frames_processed: number;
  total_frames: number | null;
  error: string | null;
};

type JobSummary = {
  fps: number;
  frames_processed: number;
  guard_visible_frames: number;
  stationary_frames: number;
  sleep_candidate_frames: number;
  absence_frames: number;
};

type ModuleHealth = Record<
  string,
  { status: "ok" | "unknown" | "error" | "disabled"; last_error: string | null }
>;

type ReportFormat = "PDF" | "CSV";
const apiFormat = (format: ReportFormat) => (format === "PDF" ? "pdf" : "xlsx");

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

async function startGuardLiveSession(): Promise<{ session_id: string }> {
  const res = await fetch(`${GUARD_BASE}/live/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // "0" = default local webcam index, same source Attendance uses.
    body: JSON.stringify({ source: "0" }),
  });
  return jsonOrThrow(res, "Failed to start guard live session");
}

async function stopGuardLiveSession(sessionId: string) {
  try {
    await fetch(`${GUARD_BASE}/live/${sessionId}/stop`, { method: "POST" });
  } catch {
    // Backend unreachable - nothing more we can do client-side.
  }
}

async function stopGuardJob(jobId: string) {
  try {
    await fetch(`${GUARD_BASE}/jobs/${jobId}/stop`, { method: "POST" });
  } catch {
    // Backend unreachable - nothing more we can do client-side.
  }
}

async function fetchLiveState(sessionId: string): Promise<LiveState> {
  const res = await fetch(`${GUARD_BASE}/live/${sessionId}/state`);
  return jsonOrThrow(res, "Failed to fetch live state");
}

async function fetchLiveEvents(sessionId: string): Promise<RuleEvent[]> {
  const res = await fetch(`${GUARD_BASE}/live/${sessionId}/events`);
  const data = await jsonOrThrow<{ events: RuleEvent[] }>(res, "Failed to fetch live events");
  return data.events;
}

async function fetchLiveReport(sessionId: string, format: ReportFormat) {
  const res = await fetch(`${GUARD_BASE}/live/${sessionId}/report?format=${apiFormat(format)}`);
  const data = await jsonOrThrow<{
    media_type: string;
    report_base64: string;
    report_filename: string;
  }>(res, "Failed to generate report");
  return { blob: base64ToBlob(data.report_base64, data.media_type), name: data.report_filename };
}

async function createGuardJob(file: File): Promise<string> {
  const body = new FormData();
  body.append("video", file);
  const res = await fetch(`${GUARD_BASE}/jobs`, { method: "POST", body });
  const data = await jsonOrThrow<{ job_id: string }>(res, "Failed to upload video");
  return data.job_id;
}

async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${GUARD_BASE}/jobs/${jobId}`);
  return jsonOrThrow(res, "Failed to fetch job status");
}

async function waitForGuardJob(
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

async function fetchJobVideoUrl(jobId: string): Promise<string> {
  const res = await fetch(`${GUARD_BASE}/jobs/${jobId}/video`);
  if (!res.ok) throw new Error("Failed to fetch processed video");
  return URL.createObjectURL(await res.blob());
}

async function fetchJobSummary(jobId: string): Promise<JobSummary> {
  const res = await fetch(`${GUARD_BASE}/jobs/${jobId}/summary`);
  const data = await jsonOrThrow<{ summary: JobSummary }>(res, "Failed to fetch job summary");
  return data.summary;
}

async function fetchJobEvents(jobId: string): Promise<RuleEvent[]> {
  const res = await fetch(`${GUARD_BASE}/jobs/${jobId}/events`);
  const data = await jsonOrThrow<{ events: RuleEvent[] }>(res, "Failed to fetch job events");
  return data.events;
}

async function fetchJobModuleHealth(jobId: string): Promise<ModuleHealth> {
  const res = await fetch(`${GUARD_BASE}/jobs/${jobId}/module-health`);
  return jsonOrThrow(res, "Failed to fetch job module health");
}

async function fetchLiveModuleHealth(sessionId: string): Promise<ModuleHealth> {
  const res = await fetch(`${GUARD_BASE}/live/${sessionId}/module-health`);
  const data = await jsonOrThrow<{ module_health: ModuleHealth }>(
    res,
    "Failed to fetch live module health",
  );
  return data.module_health;
}

async function fetchJobReport(jobId: string, format: ReportFormat) {
  const res = await fetch(`${GUARD_BASE}/jobs/${jobId}/report?format=${apiFormat(format)}`);
  const data = await jsonOrThrow<{
    media_type: string;
    report_base64: string;
    report_filename: string;
  }>(res, "Failed to generate report");
  return { blob: base64ToBlob(data.report_base64, data.media_type), name: data.report_filename };
}

/* ---------------- real-data helpers ---------------- */

function fmtSeconds(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0s";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatEventTime(event: RuleEvent): string {
  if (event.wall_time) {
    return new Date(event.wall_time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
  const total = Math.max(0, Math.round(event.triggered_at ?? 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `t+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** What the backend's video-processing job is actually doing right now, for
 *  the loading veil - not a camera connection, so it must never say
 *  "Connecting camera". */
function jobProgressLabel(status: JobStatusResponse): string {
  if (status.progress != null) return `Processing video · ${Math.round(status.progress)}%`;
  if (status.total_frames) {
    return `Processing video · ${status.frames_processed}/${status.total_frames} frames`;
  }
  return "Processing video";
}

/** Maps a triggered rule onto the existing 5-state vocabulary/icon set so real
 *  events render through the exact same UI as the demo timeline/alerts. */
function ruleToState(rule: RuleName): GuardState {
  if (rule === "sleep") return "sleeping";
  if (rule === "absence") return "absent";
  if (rule === "stationary") return "sitting";
  return "on-duty"; // phone
}

function ruleEventText(rule: RuleName): string {
  switch (rule) {
    case "sleep":
      return "Possible sleeping detected";
    case "absence":
      return "Absent from position";
    case "stationary":
      return "Extended stationary period";
    case "phone":
      return "Phone use detected";
  }
}

function severityOfRule(rule: RuleName): "critical" | "warning" {
  return rule === "sleep" || rule === "absence" ? "critical" : "warning";
}

function deriveGuardState(fl: FrameLog | null | undefined): GuardState {
  if (!fl) return "on-duty";
  if (fl.present === false) return "absent";
  if (fl.rules_triggered?.sleep || (fl.sleep.candidate && fl.sleep.evidence_quality === "high")) {
    return "sleeping";
  }
  if (fl.posture.posture === "sitting") return "sitting";
  if (fl.posture.posture === "standing") return "standing";
  return "on-duty";
}

/** Best-effort single label for a completed video, since there's no single
 *  "current instant" once processing has finished - picks the most severe
 *  thing actually observed. */
function deriveMediaState(summary: JobSummary | null, events: RuleEvent[]): GuardState {
  if (!summary) return "on-duty";
  const has = (rule: RuleName) => events.some((e) => e.rule === rule);
  if (summary.absence_frames > 0 || has("absence")) return "absent";
  if (summary.sleep_candidate_frames > 0 || has("sleep")) return "sleeping";
  if (summary.stationary_frames > summary.guard_visible_frames * 0.5) return "sitting";
  return "on-duty";
}

function eventCount(events: RuleEvent[], rule: RuleName) {
  return events.filter((e) => e.rule === rule).length;
}

const RULE_LABEL: Record<RuleName, string> = {
  sleep: "Sleep",
  phone: "Phone use",
  stationary: "Stationary",
  absence: "Absence",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

/** The same per-frame signals the backend used to burn into the video as a
 *  debug HUD (see pipeline.py's draw_status_panel, now disabled server-side
 *  by default) - reshaped into presentable KPI tiles instead. Internal
 *  module/health bookkeeping (module_status) is intentionally left out -
 *  that's an engineering concern, not something a viewer needs to see. */
function liveSignalTiles(
  fl: FrameLog,
): { label: string; value: string; hint: string; tone: Tone }[] {
  const postureLabel = fl.posture.posture === "unknown" ? "Unknown" : humanize(fl.posture.posture);
  const phoneLabel =
    fl.phone.usage === "no_phone"
      ? "None"
      : fl.phone.usage === "screen_use"
        ? "Screen use"
        : fl.phone.usage === "call"
          ? "On call"
          : "Visible";
  const eyesLabel = !fl.eyes.available ? "Unknown" : fl.eyes.eyes_closed ? "Closed" : "Open";
  const coveragePct =
    fl.movement.patrol_coverage_ratio != null
      ? `${Math.round(fl.movement.patrol_coverage_ratio * 100)}%`
      : "n/a";

  return [
    {
      label: "Posture",
      value: postureLabel,
      hint: fl.posture.head_down ? "head down" : "head up",
      tone: fl.posture.posture === "unknown" ? "mute" : "moss",
    },
    {
      label: "Phone",
      value: phoneLabel,
      hint: fl.phone.detected ? "in frame" : "not detected",
      tone: fl.phone.usage === "no_phone" ? "moss" : "amber",
    },
    {
      label: "Eyes",
      value: eyesLabel,
      hint: fl.eyes.available ? "tracked" : humanize(fl.eyes.reason),
      tone: fl.eyes.eyes_closed ? "rose" : fl.eyes.available ? "moss" : "mute",
    },
    {
      label: "Patrol coverage",
      value: coveragePct,
      hint: "of patrol zones",
      tone: "slate",
    },
  ];
}

function activeAlertLabels(fl: FrameLog): string[] {
  return (Object.keys(fl.rules_triggered) as RuleName[])
    .filter((rule) => fl.rules_triggered[rule])
    .map((rule) => RULE_LABEL[rule]);
}

/* ---------------- component ---------------- */

export const Route = createFileRoute("/guard")({
  head: () => ({
    meta: [
      { title: "Guard Activity Monitoring — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Verify that the security guard is present and alert, with a duty timeline, alert history and shift reports.",
      },
      { property: "og:title", content: "Guard Activity Monitoring — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Post presence, alertness and duty verification for security staff.",
      },
    ],
  }),
  component: Guard,
});

const stateMeta: Record<GuardState, { tone: Tone; icon: typeof Eye }> = {
  "on-duty": { tone: "moss", icon: Eye },
  standing: { tone: "moss", icon: PersonStanding },
  sitting: { tone: "amber", icon: Armchair },
  sleeping: { tone: "rose", icon: BedDouble },
  absent: { tone: "rose", icon: CircleSlash },
};

const states: GuardState[] = ["on-duty", "standing", "sitting", "sleeping", "absent"];

function Guard() {
  const [current, setCurrent] = useState<GuardState>("on-duty");

  const [feedStatus, setFeedStatus] = useState<FeedStatus>("demo");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [liveEvents, setLiveEvents] = useState<RuleEvent[]>([]);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobSummary, setJobSummary] = useState<JobSummary | null>(null);
  const [jobEvents, setJobEvents] = useState<RuleEvent[]>([]);
  const [uploadLabel, setUploadLabel] = useState<string | undefined>(undefined);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  // True the moment a real camera/job is in play, including while an upload
  // is still processing - not just once results are fully ready. Keeps the
  // UI from falling back to demo mock data mid-processing (it shows real
  // panels with "no data yet" instead, once jobSummary/liveState land).
  const backendConnected = feedStatus === "live" || feedStatus === "media" || !!processingJobId;

  // Health of the backend's own detection/tracking/etc. modules for whichever
  // session or job is active - lets the UI say *why* nothing was detected
  // (e.g. a missing model file) instead of just showing an empty result.
  const [moduleHealth, setModuleHealth] = useState<ModuleHealth | null>(null);

  // Poll live state + events every second while a session is live, same
  // cadence Attendance uses for /api/status.
  useEffect(() => {
    if (feedStatus !== "live" || !sessionId) {
      setLiveState(null);
      setLiveEvents([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const state = await fetchLiveState(sessionId);
        if (!cancelled) setLiveState(state);
      } catch {
        // backend unreachable, keep last known state
      }
      try {
        const events = await fetchLiveEvents(sessionId);
        if (!cancelled) setLiveEvents(events);
      } catch {
        // backend unreachable, keep last known events
      }
      try {
        const health = await fetchLiveModuleHealth(sessionId);
        if (!cancelled) setModuleHealth(health);
      } catch {
        // backend unreachable, keep last known health
      }
    };
    poll();
    const t = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [feedStatus, sessionId]);

  // A stale processed job shouldn't linger once the user leaves "media".
  useEffect(() => {
    if (feedStatus !== "media") {
      setJobId(null);
      setJobSummary(null);
      setJobEvents([]);
    }
    if (feedStatus !== "media" && feedStatus !== "live") {
      setModuleHealth(null);
    }
  }, [feedStatus]);

  // Only turn processingJobId off once feedStatus itself has actually left
  // "connecting" - never from inside onProcessMedia's own finally block,
  // which would create a gap where processingJobId is already null but
  // feedStatus hasn't caught up yet, making backendConnected flicker back
  // to false (and panels flash demo data) right as the real result is ready.
  useEffect(() => {
    if (feedStatus !== "connecting" && feedStatus !== "requesting") {
      setProcessingJobId(null);
    }
  }, [feedStatus]);

  // Real per-instant state while connected; the manual "Simulate state"
  // buttons still drive `current` for the demo feed exactly as before.
  const displayState: GuardState = backendConnected
    ? feedStatus === "live"
      ? deriveGuardState(liveState?.state)
      : deriveMediaState(jobSummary, jobEvents)
    : current;

  const meta = stateMeta[displayState];
  const Icon = meta.icon;
  const critical = displayState === "sleeping" || displayState === "absent";

  // When the detector itself can't run (e.g. a missing model file), every
  // downstream signal is legitimately empty - say so instead of leaving a
  // silent, seemingly-broken KPI/timeline/alert panel.
  const detectorHealth = moduleHealth?.["guard_detection"];
  const detectorIssue =
    backendConnected && detectorHealth?.status === "error"
      ? detectorHealth.last_error || "The guard detection model failed to load"
      : null;

  const [eventSeverity, setEventSeverity] = useState("all");

  // Real aggregate stats whenever a real camera/job is in play, including
  // while a job is still processing (all zero until jobSummary lands) -
  // never demo numbers past that point. Null only in true demo mode.
  const guardStats = useMemo(() => {
    if (!backendConnected) return null;
    const emptyGuardStats = {
      dutySeconds: 0,
      alertSeconds: 0,
      inactiveSeconds: 0,
      sleepSeconds: 0,
      absenceSeconds: 0,
      sleepEvents: 0,
      absenceEvents: 0,
    };
    if (feedStatus === "live" && liveState) {
      const fps = liveState.analysis_fps || 3;
      const stats = liveState.stats;
      return {
        dutySeconds: liveState.uptime_seconds,
        alertSeconds: stats.visible_frames / fps,
        inactiveSeconds: stats.stationary_frames / fps,
        sleepSeconds: stats.sleep_candidate_frames / fps,
        absenceSeconds: stats.absence_frames / fps,
        sleepEvents: eventCount(liveEvents, "sleep"),
        absenceEvents: eventCount(liveEvents, "absence"),
      };
    }
    if (feedStatus === "media" && jobSummary) {
      const fps = jobSummary.fps || 25;
      return {
        dutySeconds: jobSummary.frames_processed / fps,
        alertSeconds: jobSummary.guard_visible_frames / fps,
        inactiveSeconds: jobSummary.stationary_frames / fps,
        sleepSeconds: jobSummary.sleep_candidate_frames / fps,
        absenceSeconds: jobSummary.absence_frames / fps,
        sleepEvents: eventCount(jobEvents, "sleep"),
        absenceEvents: eventCount(jobEvents, "absence"),
      };
    }
    return emptyGuardStats;
  }, [backendConnected, feedStatus, liveState, liveEvents, jobSummary, jobEvents]);

  const realEvents = backendConnected ? (feedStatus === "live" ? liveEvents : jobEvents) : null;

  const timelineEntries = useMemo(() => {
    if (!realEvents) return guardTimeline;
    return [...realEvents]
      .sort((a, b) => (a.triggered_at ?? 0) - (b.triggered_at ?? 0))
      .map((e) => ({
        id: `${e.rule}-${e.triggered_at}`,
        time: formatEventTime(e),
        state: ruleToState(e.rule),
        note: ruleEventText(e.rule),
        duration: fmtSeconds(e.threshold_seconds),
      }));
  }, [realEvents]);

  const alertEvents = realEvents
    ? [...realEvents]
        .sort((a, b) => (b.triggered_at ?? 0) - (a.triggered_at ?? 0))
        .map((e) => ({
          id: `${e.rule}-${e.triggered_at}`,
          event: ruleEventText(e.rule),
          time: formatEventTime(e),
          duration: fmtSeconds(e.threshold_seconds),
          severity: severityOfRule(e.rule),
        }))
    : guardEvents;

  const filteredEvents = alertEvents.filter(
    (e) => eventSeverity === "all" || e.severity === eventSeverity,
  );

  return (
    <>
      <SectionTitle
        title="North Post · Guard Activity"
        sub="CAM-09 · POSTURE & PRESENCE · NIGHT SHIFT"
      >
        <SettingsSheet
          pipelineName="Guard Activity"
          extra={[
            {
              title: "Escalate after 5 minutes",
              help: "Raise a critical alert if the post stays empty.",
              defaultOn: true,
            },
          ]}
        />
        <DownloadDialog
          reportName="Activity report"
          {...(reportSessionId
            ? {
                onGenerate: async (format: ReportFormat) => {
                  const { blob, name } = await fetchLiveReport(reportSessionId, format);
                  downloadBlob(blob, name);
                },
              }
            : jobId
              ? {
                  onGenerate: async (format: ReportFormat) => {
                    const { blob, name } = await fetchJobReport(jobId, format);
                    downloadBlob(blob, name);
                  },
                }
              : {})}
        />
      </SectionTitle>

      <div
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-4 py-4 ring-1",
          critical ? "bg-rose/8 ring-rose/25" : "bg-moss/8 ring-moss/25",
        )}
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-lg ring-1",
            critical ? "bg-rose/15 text-rose ring-rose/25" : "bg-moss/15 text-moss ring-moss/25",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="label-mono">Current status</p>
          <p
            className={cn(
              "truncate text-base font-extrabold tracking-tight sm:text-lg",
              critical ? "text-rose" : "text-moss",
            )}
          >
            {guardStateLabels[displayState]}
          </p>
          <p className="truncate text-[11px] text-mute">
            {critical
              ? "Supervisor attention recommended for this post."
              : "Guard appears present and responsive at the post."}
          </p>
        </div>
        <Chip tone={critical ? "rose" : "moss"} dot pulse className="shrink-0">
          {critical ? "Alert" : "Normal"}
        </Chip>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <FeedPanel
            title="North post camera"
            cameraCode="CAM-09"
            sample={feedGuard}
            sampleAlt="Security guard post camera feed"
            liveSrc={
              processingJobId
                ? `${GUARD_BASE}/jobs/${processingJobId}/stream`
                : `${GUARD_BASE}/live/current/stream`
            }
            liveOverride={!!processingJobId}
            sampleVideosModule="Guard"
            {...(uploadLabel ? { busyLabel: uploadLabel } : {})}
            onStatusChange={setFeedStatus}
            onConnect={async () => {
              const { session_id } = await startGuardLiveSession();
              setSessionId(session_id);
              setReportSessionId(session_id);
            }}
            onStop={async () => {
              const camId = sessionId;
              setSessionId(null);
              if (camId) {
                await stopGuardLiveSession(camId);
                return;
              }
              // An upload still processing (FeedPanel shows "Stop session"
              // during "connecting" too) - without this, the backend job
              // never actually stopped and kept running to the end
              // regardless of the click, only to pop up as a finished video
              // later. Signal it to stop now; the pending onProcessMedia
              // promise (already polling job status) picks up the
              // "completed" transition within a second or two and resolves
              // with the now-early-finished real video, same as letting it
              // reach EOF on its own.
              if (processingJobId) {
                await stopGuardJob(processingJobId);
              }
            }}
            onProcessMedia={async (file) => {
              setUploadLabel("Uploading video");
              try {
                const newJobId = await createGuardJob(file);
                setProcessingJobId(newJobId);
                const status = await waitForGuardJob(newJobId, (s) =>
                  setUploadLabel(jobProgressLabel(s)),
                );
                if (status.status === "failed") {
                  throw new Error(status.error || "Guard processing failed");
                }
                setUploadLabel("Loading processed video");
                const [url, summary, events, health] = await Promise.all([
                  fetchJobVideoUrl(newJobId),
                  fetchJobSummary(newJobId),
                  fetchJobEvents(newJobId),
                  fetchJobModuleHealth(newJobId),
                ]);
                setJobId(newJobId);
                setJobSummary(summary);
                setJobEvents(events);
                setModuleHealth(health);
                return url;
              } finally {
                // processingJobId itself is cleared by the feedStatus effect
                // above, once FeedPanel actually reflects the outcome - not
                // here.
                setUploadLabel(undefined);
              }
            }}
            overlay={
              feedStatus === "live" ||
              feedStatus === "media" ||
              processingJobId ? undefined : displayState === "absent" ? (
                <div className="absolute inset-x-6 bottom-6 rounded-md bg-rose/90 px-3 py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-widest text-elev">
                  No person detected at post
                </div>
              ) : (
                <DetectionBox
                  left={34}
                  top={32}
                  width={26}
                  height={42}
                  tone={critical ? "rose" : "moss"}
                  label={`GUARD · ${displayState.toUpperCase()}`}
                  sublabel="POSTURE CONFIDENCE 92%"
                />
              )
            }
          >
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="label-mono mr-1">Simulate state</span>
              {states.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === current ? "default" : "outline"}
                  onClick={() => setCurrent(s)}
                >
                  {guardStateLabels[s].split(" ")[0]}
                </Button>
              ))}
            </div>
          </FeedPanel>

          {detectorIssue ? (
            <div className="flex items-start gap-3 rounded-lg bg-rose/10 px-4 py-3 ring-1 ring-rose/25">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-rose" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-rose">Guard detector unavailable</p>
                <p className="text-[11px] text-mute">
                  No person or posture detections are possible for this{" "}
                  {feedStatus === "live" ? "session" : "video"} - the detection model failed to
                  load.
                </p>
                <p className="mt-1 truncate font-mono text-[10px] text-faint">{detectorIssue}</p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi
              label="Duty duration"
              value={guardStats ? fmtSeconds(guardStats.dutySeconds) : "5h 42m"}
              hint={
                guardStats
                  ? feedStatus === "live"
                    ? "since connect"
                    : "this video"
                  : "since 09:00"
              }
            />
            <Kpi
              label="Alert time"
              value={guardStats ? fmtSeconds(guardStats.alertSeconds) : "4h 51m"}
              tone="moss"
              hint={
                guardStats
                  ? `${
                      guardStats.dutySeconds > 0
                        ? Math.round((guardStats.alertSeconds / guardStats.dutySeconds) * 100)
                        : 0
                    }% of duty time`
                  : "85% of shift"
              }
            />
            <Kpi
              label="Inactive time"
              value={guardStats ? fmtSeconds(guardStats.inactiveSeconds) : "45m"}
              tone="amber"
              hint="seated periods"
            />
            <Kpi
              label="Sleep events"
              value={guardStats ? guardStats.sleepEvents : 1}
              tone="rose"
              hint={guardStats ? `${fmtSeconds(guardStats.sleepSeconds)} total` : "4m 12s total"}
            />
            <Kpi
              label="Absences"
              value={guardStats ? guardStats.absenceEvents : 1}
              tone="rose"
              hint={guardStats ? `${fmtSeconds(guardStats.absenceSeconds)} total` : "12m 04s total"}
            />
          </div>
        </div>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <PanelHead
              title="Duty timeline"
              hint={
                backendConnected
                  ? feedStatus === "live"
                    ? "Since connect"
                    : "This video"
                  : "Shift started 09:00"
              }
            />
            <ol className="space-y-0 px-4 py-2">
              {timelineEntries.map((t) => {
                const m = stateMeta[t.state];
                const TIcon = m.icon;
                return (
                  <li key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full ring-1",
                          m.tone === "moss" && "bg-moss/12 text-moss ring-moss/25",
                          m.tone === "amber" && "bg-amber/12 text-amber ring-amber/25",
                          m.tone === "rose" && "bg-rose/12 text-rose ring-rose/25",
                        )}
                      >
                        <TIcon className="size-3.5" />
                      </span>
                      <span className="mt-1 w-px flex-1 bg-line" />
                    </div>
                    <div className="min-w-0 pb-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] font-semibold">{t.time}</span>
                        <span className="truncate text-[12px] font-semibold">
                          {guardStateLabels[t.state]}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-mute">{t.note}</p>
                      <p className="font-mono text-[10px] text-faint">held {t.duration}</p>
                    </div>
                  </li>
                );
              })}
              {backendConnected && timelineEntries.length === 0 ? (
                <li className="py-6 text-center text-[12px] text-mute">
                  No alerts triggered yet - the guard's presence/posture never crossed an alert
                  threshold for this {feedStatus === "live" ? "session" : "video"}.
                </li>
              ) : null}
            </ol>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHead
              title="Alert history"
              hint={
                backendConnected
                  ? feedStatus === "live"
                    ? "Since connect"
                    : "This video"
                  : "This shift"
              }
            >
              <Select value={eventSeverity} onValueChange={setEventSeverity}>
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
            <div className="divide-y divide-line">
              {filteredEvents.map((e) => (
                <div
                  key={e.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">{e.event}</p>
                    <p className="font-mono text-[10px] text-mute">
                      {e.time} · {e.duration}
                    </p>
                  </div>
                  <SeverityChip severity={e.severity} />
                </div>
              ))}
              {backendConnected && filteredEvents.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-mute">
                  {eventSeverity === "all"
                    ? "No alerts for this " +
                      (feedStatus === "live" ? "session" : "video") +
                      " yet."
                    : "No alerts match this filter."}
                </p>
              ) : null}
            </div>
          </Panel>

          {feedStatus === "live" && liveState?.state ? (
            <Panel className="overflow-hidden">
              <PanelHead title="Live signals" hint="Latest analyzed frame" />
              <div className="grid grid-cols-2 gap-3 p-4">
                {liveSignalTiles(liveState.state).map((tile) => (
                  <Kpi
                    key={tile.label}
                    label={tile.label}
                    value={tile.value}
                    tone={tile.tone}
                    hint={tile.hint}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-3">
                <span className="label-mono mr-1">Active alerts</span>
                {(() => {
                  const alerts = activeAlertLabels(liveState.state);
                  return alerts.length ? (
                    alerts.map((label) => (
                      <Chip key={label} tone="rose" dot>
                        {label}
                      </Chip>
                    ))
                  ) : (
                    <Chip tone="moss" dot>
                      All clear
                    </Chip>
                  );
                })()}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
