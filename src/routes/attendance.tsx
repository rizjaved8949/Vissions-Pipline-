import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { faceBoxes } from "@/lib/mock";
import feedLobby from "@/assets/feed-lobby.jpg";

const API_BASE = "http://localhost:8000";

async function startBackendSession() {
  const res = await fetch(`${API_BASE}/api/session/start`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start backend session");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function stopBackendSession() {
  try {
    // Awaited by the caller so the physical camera is confirmed released
    // (the backend joins the capture thread) before anything reconnects.
    // Nothing is wiped yet at this point - the download dialog shown right
    // after this decides the format, and generating the report is what
    // actually wipes (see /api/session/report).
    await fetch(`${API_BASE}/api/session/stop`, { method: "POST" });
  } catch {
    // Backend unreachable - nothing more we can do client-side.
  }
}

type ReportFormat = "PDF" | "CSV";
const apiFormat = (format: ReportFormat) => (format === "PDF" ? "pdf" : "xlsx");

async function fetchSessionReport(format: ReportFormat) {
  const res = await fetch(`${API_BASE}/api/session/report?format=${apiFormat(format)}`);
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || "Failed to generate report");
  }
  const data: { media_type: string; report_base64: string; report_filename: string } = await res.json();
  return { blob: base64ToBlob(data.report_base64, data.media_type), name: data.report_filename };
}

async function fetchMediaReport(filename: string, summary: MediaSummary, format: ReportFormat) {
  const res = await fetch(`${API_BASE}/api/media_report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, summary, format: apiFormat(format) }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || "Failed to generate report");
  }
  const data: { media_type: string; report_base64: string; report_filename: string } = await res.json();
  return { blob: base64ToBlob(data.report_base64, data.media_type), name: data.report_filename };
}

async function wipeBackendData() {
  try {
    await fetch(`${API_BASE}/api/wipe_data`, { method: "POST" });
  } catch {
    // Backend unreachable - nothing more we can do client-side.
  }
}

type CheckInEntry = {
  name: string;
  status: "recognized" | "unknown";
  confidence: number;
  time: string;
};

type LiveStatus =
  | {
      is_capturing: true;
      session_id: number;
      start_time: string;
      frame_count: number;
      total_persons: number;
      present_persons: string[];
      absent_persons: string[];
      unknown_count: number;
      check_in_log: CheckInEntry[];
    }
  | {
      is_capturing: false;
      total_persons: number;
      total_sessions_recorded: number;
    };

type LivePerson = {
  name: string;
  status: "active";
  last_seen: string;
};

async function fetchLivePeople(): Promise<LivePerson[]> {
  const res = await fetch(`${API_BASE}/api/people`);
  if (!res.ok) throw new Error("Failed to fetch registered people");
  const data: { people: LivePerson[] } = await res.json();
  return data.people;
}

async function registerBackendPerson(name: string, photo: File): Promise<LivePerson[]> {
  const body = new FormData();
  body.append("name", name);
  body.append("file", photo);
  const res = await fetch(`${API_BASE}/api/people/register`, { method: "POST", body });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || "Failed to register person");
  }
  const data: { people: LivePerson[] } = await res.json();
  return data.people;
}

type MediaSummary = {
  recognized: string[];
  unknown_count: number;
  frame_count: number;
  detections: CheckInEntry[];
};

function base64ToBlob(base64: string, mediaType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mediaType });
}

async function processMediaOnBackend(
  file: File,
): Promise<{ url: string; summary: MediaSummary; filename: string }> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_BASE}/api/process_media`, { method: "POST", body });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || "Failed to process media");
  }
  const data: {
    media_type: string;
    media_base64: string;
    summary: MediaSummary;
    source_filename: string;
  } = await res.json();

  const blob = base64ToBlob(data.media_base64, data.media_type);
  return { url: URL.createObjectURL(blob), summary: data.summary, filename: data.source_filename };
}

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Smart Attendance — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Face recognition attendance monitoring with live check-ins, registered people and exportable attendance reports.",
      },
      { property: "og:title", content: "Smart Attendance — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Live face recognition attendance with check-in history and reports.",
      },
    ],
  }),
  component: Attendance,
});

function Attendance() {
  const [regOpen, setRegOpen] = useState(false);
  const [form, setForm] = useState({ name: "" });
  const [regPhoto, setRegPhoto] = useState<File | null>(null);
  const [registering, setRegistering] = useState(false);
  const regPhotoRef = useRef<HTMLInputElement | null>(null);
  const [regCamActive, setRegCamActive] = useState(false);
  const [regCamError, setRegCamError] = useState("");
  const regVideoRef = useRef<HTMLVideoElement | null>(null);
  const regStreamRef = useRef<MediaStream | null>(null);

  const stopRegCamera = () => {
    regStreamRef.current?.getTracks().forEach((t) => t.stop());
    regStreamRef.current = null;
    if (regVideoRef.current) regVideoRef.current.srcObject = null;
    setRegCamActive(false);
  };

  const startRegCamera = async () => {
    setRegCamError("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRegCamError("This browser does not expose a camera device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      regStreamRef.current = stream;
      setRegCamActive(true);
      // The <video> element only mounts once regCamActive is true, so attach
      // the stream on the next tick once it's actually in the DOM.
      requestAnimationFrame(() => {
        if (regVideoRef.current) {
          regVideoRef.current.srcObject = stream;
          void regVideoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setRegCamError("Permission denied or no camera available.");
    }
  };

  const captureRegPhoto = () => {
    const video = regVideoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) setRegPhoto(new File([blob], "captured-photo.jpg", { type: "image/jpeg" }));
    }, "image/jpeg");
    stopRegCamera();
  };

  // Release the camera if the dialog is closed while it's active.
  useEffect(() => {
    if (!regOpen) stopRegCamera();
  }, [regOpen]);

  const [feedStatus, setFeedStatus] = useState<FeedStatus>("demo");
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [mediaSummary, setMediaSummary] = useState<MediaSummary | null>(null);
  const [mediaFilename, setMediaFilename] = useState("upload");
  const [sessionReportOpen, setSessionReportOpen] = useState(false);
  const [livePeople, setLivePeople] = useState<LivePerson[] | null>(null);
  const [hasEnrolledPeople, setHasEnrolledPeople] = useState(false);
  const isLiveSource = feedStatus === "live";
  // True whenever the feed panel is showing real backend output (a live
  // session or a processed upload), as opposed to the demo/mock feed.
  const backendConnected = feedStatus === "live" || feedStatus === "media";

  const refreshEnrolledPeople = async () => {
    try {
      const list = await fetchLivePeople();
      setLivePeople(list);
      setHasEnrolledPeople(list.length > 0);
      return list;
    } catch {
      return null;
    }
  };

  // Check once on mount whether anyone is enrolled yet, so Connect/Upload can
  // be gated even before the user ever tries to go live.
  useEffect(() => {
    refreshEnrolledPeople();
  }, []);

  // A stale processed-upload summary shouldn't linger once the user leaves
  // the "media" view (e.g. clears the upload or goes back to demo). If they
  // leave without having downloaded anything, wipe server-side data now -
  // it was only ever going to be useful for the view they just left.
  const prevFeedStatus = useRef<FeedStatus>("demo");
  useEffect(() => {
    const leavingMedia = prevFeedStatus.current === "media" && feedStatus !== "media";
    prevFeedStatus.current = feedStatus;

    if (feedStatus !== "media") setMediaSummary(null);

    if (leavingMedia) {
      void wipeBackendData().then(() => {
        setLivePeople([]);
        setHasEnrolledPeople(false);
      });
    }
  }, [feedStatus]);

  useEffect(() => {
    if (!isLiveSource) {
      setLiveStatus(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
          const data: LiveStatus = await res.json();
          if (!cancelled) setLiveStatus(data);
        }
      } catch {
        // backend unreachable, keep last known status
      }
      try {
        const people = await fetchLivePeople();
        if (!cancelled) {
          setLivePeople(people);
          setHasEnrolledPeople(people.length > 0);
        }
      } catch {
        // backend unreachable, keep last known people list
      }
    };
    poll();
    const t = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isLiveSource]);

  // Unifies the two real (non-demo) result sources - an active live session
  // and a processed upload - into one shape the results panels can render
  // without caring which one produced it.
  const resultsData = useMemo(() => {
    if (feedStatus === "live" && liveStatus?.is_capturing) {
      return {
        presentNames: liveStatus.present_persons,
        unknownCount: liveStatus.unknown_count,
        frameCount: liveStatus.frame_count,
        checkInLog: liveStatus.check_in_log,
        totalPersons: liveStatus.total_persons,
      };
    }
    if (feedStatus === "media" && mediaSummary) {
      return {
        presentNames: mediaSummary.recognized,
        unknownCount: mediaSummary.unknown_count,
        frameCount: mediaSummary.frame_count,
        checkInLog: mediaSummary.detections,
        totalPersons: livePeople?.length ?? 0,
      };
    }
    return null;
  }, [feedStatus, liveStatus, mediaSummary, livePeople]);

  const presentPersons = useMemo(() => resultsData?.presentNames ?? [], [resultsData]);
  const totalPersons = resultsData?.totalPersons ?? livePeople?.length ?? 0;
  const attendancePct = totalPersons > 0 ? Math.round((presentPersons.length / totalPersons) * 100) : 0;

  const initialsOf = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  type MergedPerson = {
    id: string;
    name: string;
    initials: string;
    tag: "Present" | "Pending";
    checkIn: string | null;
  };

  // Every registered person, tagged Present/Pending, with their check-in
  // time + confidence underneath (same info the old Check-ins list showed).
  const mergedPeople: MergedPerson[] = useMemo(() => {
    const checkInByName = new Map<string, string>();
    (resultsData?.checkInLog ?? []).forEach((entry) => {
      if (entry.status === "recognized" && !checkInByName.has(entry.name)) {
        checkInByName.set(entry.name, `${entry.time} · ${entry.confidence}%`);
      }
    });

    return (livePeople ?? []).map((p) => ({
      id: p.name,
      name: p.name,
      initials: initialsOf(p.name),
      tag: presentPersons.includes(p.name) ? "Present" : "Pending",
      checkIn: checkInByName.get(p.name) ?? null,
    }));
  }, [livePeople, presentPersons, resultsData]);

  const presentCount = mergedPeople.filter((p) => p.tag === "Present").length;

  const register = async () => {
    if (!form.name.trim()) {
      toast.error("Add a name to continue");
      return;
    }
    if (!regPhoto) {
      toast.error("Add a clear face photo to continue");
      return;
    }
    setRegistering(true);
    try {
      const updated = await registerBackendPerson(form.name.trim(), regPhoto);
      setLivePeople(updated);
      setHasEnrolledPeople(updated.length > 0);
      setRegOpen(false);
      setForm({ name: "" });
      setRegPhoto(null);
      toast.success("Person registered", { description: `${form.name.trim()} can now be recognized` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to register person");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <>
      <SectionTitle title="Front Entrance · Main Lobby" sub="CAM-01 · FACE RECOGNITION · MODEL v2.4">
        <SettingsSheet
          pipelineName="Smart Attendance"
          extra={[{ title: "Blur unknown faces", help: "Hide faces that have no match.", defaultOn: false }]}
        />
        <DownloadDialog reportName="Attendance report" />
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <FeedPanel
            title="Entrance recognition feed"
            cameraCode="CAM-01"
            sample={feedLobby}
            sampleAlt="Front entrance lobby camera feed"
            liveSrc={`${API_BASE}/api/video_feed`}
            onConnect={startBackendSession}
            onStop={async () => {
              await stopBackendSession();
              // Nothing is wiped yet - show the report dialog first; wiping
              // happens once a format is actually generated (or the dialog
              // is dismissed without generating one).
              setSessionReportOpen(true);
            }}
            onStatusChange={setFeedStatus}
            guard={async () => {
              const list = await refreshEnrolledPeople();
              // If the check itself fails (backend unreachable), fall back to
              // the last known state rather than always blocking.
              return list ? list.length > 0 : hasEnrolledPeople;
            }}
            onGuardBlocked={() => {
              toast.error("Register at least one person first", {
                description: "Enroll a face before connecting the camera or uploading media.",
              });
              setRegOpen(true);
            }}
            onProcessMedia={async (file) => {
              const { url, summary, filename } = await processMediaOnBackend(file);
              setMediaSummary(summary);
              setMediaFilename(filename);
              return url;
            }}
            onDownload={() => {
              // Downloading the raw processed result (not the report) still
              // wipes right away - only the report has a dialog gating it.
              void wipeBackendData().then(() => {
                setLivePeople([]);
                setHasEnrolledPeople(false);
                toast("Downloaded - registered people and session data were cleared", {
                  description: "Register again before your next session or upload.",
                });
              });
            }}
            overlay={
              feedStatus === "live" || feedStatus === "media" ? undefined : (
                <>
                  {faceBoxes.map((b) => (
                    <DetectionBox
                      key={b.id}
                      left={b.left}
                      top={b.top}
                      width={b.width}
                      tone={b.known ? "amber" : "rose"}
                      label={`${b.label} · ${b.confidence}%`}
                    />
                  ))}
                </>
              )
            }
          />

          {feedStatus === "media" && mediaSummary ? (
            <DownloadDialog
              reportName="Media report"
              availableRanges={["Today"]}
              onGenerate={async (format) => {
                const { blob, name } = await fetchMediaReport(mediaFilename, mediaSummary, format);
                downloadBlob(blob, name);
                void wipeBackendData().then(() => {
                  setLivePeople([]);
                  setHasEnrolledPeople(false);
                });
              }}
            />
          ) : null}

          {/* Fully dialog-controlled (no visible trigger) - opened
              programmatically right after Stop, before any data is wiped. */}
          <DownloadDialog
            reportName="Session report"
            trigger={null}
            open={sessionReportOpen}
            onOpenChange={setSessionReportOpen}
            availableRanges={["Today"]}
            onGenerate={async (format) => {
              const { blob, name } = await fetchSessionReport(format);
              downloadBlob(blob, name);
              setLivePeople([]);
              setHasEnrolledPeople(false);
              toast.success("Session report downloaded", {
                description: "Registered people and session data were cleared.",
              });
            }}
            onCancel={() => {
              void wipeBackendData().then(() => {
                setLivePeople([]);
                setHasEnrolledPeople(false);
              });
            }}
          />
        </div>

        <Panel className="flex flex-col overflow-hidden">
          <PanelHead title="Live" hint="Everyone enrolled, tagged as they're recognized">
            <span className="font-mono text-[11px] text-amber">
              {presentCount}/{mergedPeople.length} present
            </span>
          </PanelHead>

          {mergedPeople.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No one registered yet"
              body="Register a person to enroll their face for recognition."
            />
          ) : (
            <div className="divide-y divide-line overflow-y-auto">
              {mergedPeople.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      p.tag === "Present" ? "bg-amber/20 text-amber" : "bg-panel text-mute ring-1 ring-line"
                    }`}
                  >
                    {p.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">{p.name}</p>
                    <p className="truncate font-mono text-[10px] text-mute">
                      {p.checkIn ?? "Not seen yet"}
                    </p>
                  </div>
                  <Chip tone={p.tag === "Present" ? "moss" : "amber"}>{p.tag}</Chip>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto border-t border-line p-3">
            <Dialog open={regOpen} onOpenChange={setRegOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full">
                  <UserPlus className="size-3.5" /> Register new person
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Register a person</DialogTitle>
                  <DialogDescription>
                    Add a photo and details so the camera can greet them by name.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {regCamActive ? (
                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-lg bg-ink">
                        <video
                          ref={regVideoRef}
                          playsInline
                          muted
                          className="aspect-[4/3] w-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={stopRegCamera} className="flex-1">
                          Cancel
                        </Button>
                        <Button size="sm" onClick={captureRegPhoto} className="flex-1">
                          Capture
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) setRegPhoto(file);
                      }}
                      className="grid place-items-center gap-2 rounded-lg border border-dashed border-line bg-panel px-6 py-8 text-center"
                    >
                      <Users className="size-5 text-faint" />
                      <p className="text-[12px] font-semibold">
                        {regPhoto ? regPhoto.name : "Drop a clear face photo"}
                      </p>
                      <p className="text-[11px] text-mute">JPG or PNG, front facing, good lighting</p>
                      {regCamError ? <p className="text-[11px] text-rose">{regCamError}</p> : null}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => regPhotoRef.current?.click()}>
                          Choose photo
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void startRegCamera()}>
                          <Camera className="size-3.5" /> Take photo
                        </Button>
                      </div>
                      <input
                        ref={regPhotoRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => setRegPhoto(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="p-name">Full name</Label>
                    <Input
                      id="p-name"
                      value={form.name}
                      onChange={(e) => setForm({ name: e.target.value })}
                      placeholder="Amara Diallo"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRegOpen(false)} disabled={registering}>
                    Cancel
                  </Button>
                  <Button onClick={register} disabled={registering}>
                    {registering ? "Registering…" : "Register person"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="Detected"
          value={resultsData ? resultsData.frameCount : 0}
          hint={backendConnected ? "frames processed" : "connect or upload to start"}
        />
        <Kpi
          label="Recognized"
          value={backendConnected ? presentPersons.length : 0}
          tone="moss"
          hint={backendConnected ? "unique faces seen" : "connect or upload to start"}
        />
        <Kpi
          label="Unknown"
          value={resultsData ? resultsData.unknownCount : 0}
          tone="rose"
          hint={backendConnected ? "unrecognized face detections" : "connect or upload to start"}
        />
        <Kpi
          label="Present"
          value={backendConnected ? presentPersons.length : 0}
          hint={`of ${totalPersons} enrolled`}
        />
        <Kpi
          label="Attendance"
          value={backendConnected ? attendancePct : 0}
          unit="%"
          tone="amber"
          hint={backendConnected ? "this feed" : "connect or upload to start"}
        />
      </div>
    </>
  );
}
