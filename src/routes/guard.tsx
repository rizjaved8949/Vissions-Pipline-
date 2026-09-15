import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Armchair, BedDouble, CircleSlash, Eye, PersonStanding } from "lucide-react";
import { FeedPanel } from "@/components/vision/feed-panel";
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
  const meta = stateMeta[current];
  const Icon = meta.icon;
  const critical = current === "sleeping" || current === "absent";

  const [eventSeverity, setEventSeverity] = useState("all");
  const filteredEvents = guardEvents.filter(
    (e) => eventSeverity === "all" || e.severity === eventSeverity,
  );

  return (
    <>
      <SectionTitle title="North Post · Guard Activity" sub="CAM-09 · POSTURE & PRESENCE · NIGHT SHIFT">
        <SettingsSheet
          pipelineName="Guard Activity"
          extra={[{ title: "Escalate after 5 minutes", help: "Raise a critical alert if the post stays empty.", defaultOn: true }]}
        />
        <DownloadDialog reportName="Activity report" />
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
            {guardStateLabels[current]}
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
            overlay={
              current === "absent" ? (
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
                  label={`GUARD · ${current.toUpperCase()}`}
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

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Duty duration" value="5h 42m" hint="since 09:00" />
            <Kpi label="Alert time" value="4h 51m" tone="moss" hint="85% of shift" />
            <Kpi label="Inactive time" value="45m" tone="amber" hint="seated periods" />
            <Kpi label="Sleep events" value={1} tone="rose" hint="4m 12s total" />
            <Kpi label="Absences" value={1} tone="rose" hint="12m 04s total" />
          </div>
        </div>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <PanelHead title="Duty timeline" hint="Shift started 09:00" />
            <ol className="space-y-0 px-4 py-2">
              {guardTimeline.map((t) => {
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
            </ol>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHead title="Alert history" hint="This shift">
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
                <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">{e.event}</p>
                    <p className="font-mono text-[10px] text-mute">
                      {e.time} · {e.duration}
                    </p>
                  </div>
                  <SeverityChip severity={e.severity} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
