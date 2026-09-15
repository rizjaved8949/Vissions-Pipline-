import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Siren, Video, VideoOff } from "lucide-react";
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

  const [eventStatus, setEventStatus] = useState("all");
  const filteredIntrusions = intrusionEvents.filter(
    (e) => eventStatus === "all" || e.status === eventStatus,
  );

  return (
    <>
      <SectionTitle title="Warehouse Floor · Restricted Zone A" sub="CAM-11 · ZONE PERIMETER · 24/7">
        <SettingsSheet
          pipelineName="Restricted Zones"
          extra={[{ title: "Show zone outline", help: "Draw the restricted area on the feed.", defaultOn: true }]}
        />
        <DownloadDialog reportName="Security report" />
      </SectionTitle>

      <div
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-4 py-4 ring-1",
          breach ? "bg-rose/8 ring-rose/25" : "bg-moss/8 ring-moss/25",
        )}
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-lg ring-1",
            breach ? "bg-rose/15 text-rose ring-rose/25" : "bg-moss/15 text-moss ring-moss/25",
          )}
        >
          {breach ? <Siren className="size-5" /> : <ShieldCheck className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="label-mono">Zone status</p>
          <p
            className={cn(
              "truncate text-base font-extrabold uppercase tracking-tight sm:text-lg",
              breach ? "text-rose" : "text-moss",
            )}
          >
            {breach ? "Intrusion detected" : "Secure"}
          </p>
          <p className="truncate text-[11px] text-mute">
            {breach
              ? "A person entered Restricted Zone A. Dispatch the nearest guard."
              : "No unauthorised activity detected in the monitored zone."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setBreach((b) => !b)} className="shrink-0">
          Simulate {breach ? "clear" : "breach"}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FeedPanel
          title="Zone A perimeter camera"
          cameraCode="CAM-11"
          sample={feedWarehouse}
          sampleAlt="Warehouse floor camera feed with restricted zone"
          overlay={
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
          }
        />

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Kpi
              label="Current status"
              value={breach ? "Breach" : "Secure"}
              tone={breach ? "rose" : "moss"}
              hint="Zone A"
            />
            <Kpi label="Intrusions today" value={breach ? 2 : 1} tone="rose" hint="1 unresolved" />
            <Kpi label="Persons detected" value={38} hint="all zones" />
            <Kpi label="Active cameras" value="3/4" tone="amber" hint="Roof access offline" />
          </div>

          <Panel className="overflow-hidden">
            <PanelHead title="Zone cameras" hint="Coverage of monitored areas" />
            <div className="divide-y divide-line">
              {zoneCameras.map((c) => (
                <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line">
                    {c.online ? (
                      <Video className="size-4 text-mute" />
                    ) : (
                      <VideoOff className="size-4 text-rose" />
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
          </Panel>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <PanelHead title="Intrusion event log" hint="Snapshots kept for 30 days">
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
          <DownloadDialog
            reportName="Intrusion log"
            trigger={
              <Button size="sm" variant="outline">
                Export
              </Button>
            }
          />
        </PanelHead>
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
          {filteredIntrusions.map((e) => (
            <article key={e.id} className="row-in overflow-hidden rounded-lg bg-panel ring-1 ring-line">
              <div className="relative aspect-video overflow-hidden bg-ink">
                <img
                  src={feedWarehouse}
                  alt={`Snapshot of ${e.zone} at ${e.time}`}
                  loading="lazy"
                  width={1280}
                  height={720}
                  className="size-full object-cover opacity-75"
                />
                <span className="absolute right-2 top-2">
                  <SeverityChip severity={e.severity} />
                </span>
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
      </Panel>
    </>
  );
}
