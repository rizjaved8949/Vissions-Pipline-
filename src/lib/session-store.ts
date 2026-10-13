import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FeedStatus } from "@/components/vision/feed-panel";

/** One entry per module page that can hold a live session or an upload job. */
export type ModuleKey = "attendance" | "guard" | "hygiene" | "intrusion" | "plates";

export type UploadPhase = "processing" | "loading" | "done" | "failed";

/** A live camera session. The backend can end this on its own (source EOF,
 *  failure), so restoring one has to be confirmed against the backend. */
export type LiveEntry = {
  kind: "live";
  status: FeedStatus;
  sessionId: string;
};

/** An upload/sample being processed, or its finished result. No backend check
 *  is needed to restore this: the driver promise lives in this same document,
 *  so if the entry is still here the work is genuinely still running (a full
 *  page reload clears the store outright). */
export type UploadEntry<T = unknown> = {
  kind: "upload";
  /** Backend job/session id, once the upload call has returned one. */
  sessionId: string | null;
  phase: UploadPhase;
  /** Progress text for FeedPanel's busyLabel; cleared once there is a result. */
  label?: string | undefined;
  error?: string | undefined;
  /** Derived from the picked file up front, so a resumed panel can name the
   *  output before processing finishes. */
  output: { kind: "image" | "video"; name: string };
  /** Object URL of the processed media; set once phase is "done". */
  url?: string;
  /** Module-specific results (summary, events, dashboard, plates, ...). */
  data?: T;
};

export type ModuleEntry<T = unknown> = LiveEntry | UploadEntry<T>;

// Lives outside the React tree on purpose: route components unmount on every
// navigation, so anything kept in their useState is destroyed. The backend
// keeps working regardless (each module's capture/processing loop is its own
// background thread), so without this the page came back up at "idle", fell
// back to demo data, and threw away a result that had actually completed.
const entries = new Map<ModuleKey, ModuleEntry>();
const listeners = new Set<() => void>();

/** Driver promises, kept out of the snapshot so snapshot identity stays stable. */
const inflight = new Map<ModuleKey, Promise<string>>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getModuleEntry(key: ModuleKey): ModuleEntry | undefined {
  return entries.get(key);
}

export function setLiveSession(key: ModuleKey, sessionId: string) {
  const prev = entries.get(key);
  if (prev?.kind === "live" && prev.sessionId === sessionId) return;
  revokeUrl(prev);
  entries.set(key, { kind: "live", status: "live", sessionId });
  emit();
}

export function clearModuleSession(key: ModuleKey) {
  const prev = entries.get(key);
  if (prev === undefined) return;
  revokeUrl(prev);
  entries.delete(key);
  inflight.delete(key);
  emit();
}

/** Object URLs stay alive for the document's lifetime, so a module that is
 *  used repeatedly would otherwise pile them up. */
function revokeUrl(entry: ModuleEntry | undefined) {
  if (entry?.kind === "upload" && entry.url) URL.revokeObjectURL(entry.url);
}

/** Snapshot identity is stable unless the entry really changed, which
 *  useSyncExternalStore requires to avoid re-rendering forever. */
export function useModuleEntry(key: ModuleKey): ModuleEntry | undefined {
  const getSnapshot = useCallback(() => entries.get(key), [key]);
  const getServerSnapshot = useCallback(() => undefined, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getInflightUpload(key: ModuleKey): Promise<string> | undefined {
  return inflight.get(key);
}

/**
 * The feed status a page should START at, given what the store already holds.
 *
 * Routes must seed their own `feedStatus` with this rather than defaulting to
 * "demo", because each page has effects that wipe result state whenever the
 * status is not "media"/"live" - those would fire on the first render and erase
 * the very results being restored.
 */
export function initialFeedStatus(entry: ModuleEntry | undefined): FeedStatus {
  if (entry === undefined) return "demo";
  if (entry.kind === "live") return entry.status;
  if (entry.phase === "done") return "media";
  if (entry.phase === "failed") return "demo";
  return "connecting";
}

/**
 * The FeedPanel props that hand the panel back whatever this module had going
 * before the last navigation: a live feed, a finished upload to play, or an
 * upload still processing to re-attach to.
 *
 * Spread into <FeedPanel> together with a `key` that flips when `ready` does,
 * since the panel only reads these on mount.
 */
export function restoreFeedProps(
  key: ModuleKey,
  ready: boolean,
  entry: ModuleEntry | undefined,
): {
  initialStatus?: FeedStatus;
  initialUpload?: { url: string; kind: "image" | "video"; name: string };
  resumeUpload?: { promise: Promise<string>; output: { kind: "image" | "video"; name: string } };
} {
  if (!ready || entry === undefined) return {};

  if (entry.kind === "live") return { initialStatus: entry.status };

  if (entry.phase === "done" && entry.url !== undefined) {
    return {
      initialStatus: "media",
      initialUpload: { url: entry.url, kind: entry.output.kind, name: entry.output.name },
    };
  }

  if (entry.phase === "processing" || entry.phase === "loading") {
    const promise = inflight.get(key);
    if (promise !== undefined) {
      return { initialStatus: "connecting", resumeUpload: { promise, output: entry.output } };
    }
  }

  return {};
}

/** Narrowing helpers, so routes don't repeat the discriminant check. */
export function asLiveEntry(entry: ModuleEntry | undefined): LiveEntry | undefined {
  return entry?.kind === "live" ? entry : undefined;
}

export function asUploadEntry<T>(entry: ModuleEntry | undefined): UploadEntry<T> | undefined {
  return entry?.kind === "upload" ? (entry as UploadEntry<T>) : undefined;
}

/** Progress reporter handed to an upload driver. `data` merges shallowly, so a
 *  driver can publish something the page needs mid-flight (e.g. the frame to
 *  draw zones on) without waiting for the final result.
 *
 *  Returns false once this upload has been superseded (the user pressed Stop,
 *  or started another one). A driver that waits on something open-ended should
 *  check it and give up rather than polling forever. */
export type UploadReport<T> = (patch: {
  phase?: UploadPhase;
  label?: string;
  sessionId?: string;
  data?: Partial<T>;
}) => boolean;

/**
 * Runs an upload to completion independently of whether any component is
 * mounted, recording progress and the final result in the store as it goes.
 *
 * The route's `onProcessMedia` delegates here and returns the promise
 * unchanged, so FeedPanel's existing "await, then show the processed video"
 * path is untouched for a fresh upload. A page that remounts mid-flight picks
 * the same promise back up via `getInflightUpload`, rather than starting the
 * work again.
 */
export function runUpload<T>(
  key: ModuleKey,
  file: File,
  driver: (report: UploadReport<T>) => Promise<{ url: string; data: T }>,
): Promise<string> {
  const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
  const base = file.name.replace(/\.[^./]+$/, "");
  const name = `${base}-processed.${kind === "video" ? "mp4" : "jpg"}`;

  revokeUrl(entries.get(key));
  const start: UploadEntry<T> = {
    kind: "upload",
    sessionId: null,
    phase: "processing",
    output: { kind, name },
  };
  entries.set(key, start as ModuleEntry);
  emit();

  const patch = (changes: Partial<UploadEntry<T>>) => {
    const current = entries.get(key);
    // A Stop or a newer upload replaced this one - drop the late update rather
    // than resurrecting a job the user already moved on from.
    if (current?.kind !== "upload") return false;
    entries.set(key, { ...(current as UploadEntry<T>), ...changes } as ModuleEntry);
    emit();
    return true;
  };

  const report: UploadReport<T> = ({ phase, label, sessionId, data }) => {
    const current = asUploadEntry<T>(entries.get(key));
    return patch({
      ...(phase !== undefined ? { phase } : {}),
      ...(label !== undefined ? { label } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(data !== undefined ? { data: { ...(current?.data ?? {}), ...data } as T } : {}),
    });
  };

  const promise = driver(report).then(
    ({ url, data }) => {
      patch({ phase: "done", url, data, label: undefined });
      inflight.delete(key);
      return url;
    },
    (err: unknown) => {
      patch({
        phase: "failed",
        error: err instanceof Error ? err.message : "Processing failed",
        label: undefined,
      });
      inflight.delete(key);
      throw err;
    },
  );

  inflight.set(key, promise);
  return promise;
}

/**
 * Restores whatever this module had going before the last navigation.
 *
 * A live session is confirmed against the backend first, since a remembered id
 * can be stale (video reached its end, job failed, backend restarted) and
 * restoring that blindly would show a dead feed instead of the demo one. An
 * upload needs no such check (see `UploadEntry`), so it is ready immediately.
 *
 * `validateLive` must be referentially stable (declare it at module scope, or
 * memoize it), since it keys the effect that runs the check.
 *
 * `ready` is false only while that live check is in flight.
 */
export function useRestoredSession(
  key: ModuleKey,
  validateLive: (sessionId: string) => Promise<boolean>,
) {
  const restored = useModuleEntry(key);
  const checkedRef = useRef(false);
  const [ready, setReady] = useState(() => entries.get(key)?.kind !== "live");

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const entry = entries.get(key);
    if (entry?.kind !== "live") {
      setReady(true);
      return;
    }

    // Deliberately not cancelled on unmount: the store is global, so a session
    // that turns out to be dead should be cleared even if the user navigated on
    // while the check was still in flight - otherwise the next visit restores it
    // again and re-runs the same doomed check.
    validateLive(entry.sessionId)
      .then((alive) => {
        if (!alive) clearModuleSession(key);
      })
      .catch(() => {
        // Unreachable backend counts as "not running" - better to fall back to
        // the demo feed than to leave a live-looking panel with no frames.
        clearModuleSession(key);
      })
      .finally(() => setReady(true));
  }, [key, validateLive]);

  return { ready, restored };
}
