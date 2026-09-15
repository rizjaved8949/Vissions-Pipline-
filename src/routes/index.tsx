import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Activity } from "lucide-react";
import { pipelines } from "@/lib/pipelines";
import { Chip, Kpi, Panel, PanelHead, SectionTitle, SeverityChip } from "@/components/vision/kit";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import feedLobby from "@/assets/feed-lobby.jpg";
import feedKitchen from "@/assets/feed-kitchen.jpg";
import feedGate from "@/assets/feed-gate.jpg";
import feedGuard from "@/assets/feed-guard.jpg";
import feedWarehouse from "@/assets/feed-warehouse.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations Overview — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Live status across five computer vision pipelines: attendance, kitchen hygiene, plate reading, guard activity and restricted zones.",
      },
      { property: "og:title", content: "Operations Overview — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Live status across five computer vision pipelines in one control room.",
      },
    ],
  }),
  component: Overview,
});

const tiles = [
  {
    meta: pipelines[0]!,
    image: feedLobby,
    headline: "121 present",
    detail: "86% attendance · 9 unknown faces",
    tone: "moss" as const,
    state: "Nominal",
  },
  {
    meta: pipelines[1]!,
    image: feedKitchen,
    headline: "84% compliant",
    detail: "3 staff on line · 2 open violations",
    tone: "amber" as const,
    state: "Attention",
  },
  {
    meta: pipelines[2]!,
    image: feedGate,
    headline: "149 vehicles",
    detail: "96 cars · 53 motorcycles today",
    tone: "moss" as const,
    state: "Nominal",
  },
  {
    meta: pipelines[3]!,
    image: feedGuard,
    headline: "Post covered",
    detail: "1 sleep event · 12m absence today",
    tone: "amber" as const,
    state: "Attention",
  },
  {
    meta: pipelines[4]!,
    image: feedWarehouse,
    headline: "1 open intrusion",
    detail: "Zone A · 13:41 · unresolved",
    tone: "rose" as const,
    state: "Alert",
  },
];

const stream = [
  { id: "s1", text: "Person entered Restricted Zone A", src: "CAM-11", time: "13:41", severity: "critical" as const },
  { id: "s2", text: "Guard head-down posture held 4m", src: "CAM-09", time: "13:05", severity: "critical" as const },
  { id: "s3", text: "Missing gloves at grill station", src: "CAM-03", time: "10:42", severity: "warning" as const },
  { id: "s4", text: "Unknown face at front entrance", src: "CAM-01", time: "10:41", severity: "warning" as const },
  { id: "s5", text: "Plate ABC-123 entered Gate A", src: "CAM-04", time: "10:42", severity: "info" as const },
  { id: "s6", text: "Hair cover not worn, plating station", src: "CAM-03", time: "10:37", severity: "warning" as const },
];

function Overview() {
  const [streamSeverity, setStreamSeverity] = useState("all");
  const filteredStream = stream.filter(
    (e) => streamSeverity === "all" || e.severity === streamSeverity,
  );

  return (
    <>
      <SectionTitle title="Operations Overview" sub="14 CAMERAS · 5 PIPELINES · MODEL v2.4">
        <Chip tone="moss" dot pulse>
          All pipelines running
        </Chip>
      </SectionTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Events today" value="1,284" hint="across all pipelines" />
        <Kpi label="Open alerts" value="3" tone="rose" hint="1 critical" />
        <Kpi label="Cameras online" value="13/14" tone="moss" hint="Roof Access offline" />
        <Kpi label="Uptime" value="99.8" unit="%" tone="amber" hint="rolling 30 days" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {tiles.map((t) => {
            const Icon = t.meta.icon;
            return (
              <Link
                key={t.meta.to}
                to={t.meta.to}
                className="group overflow-hidden rounded-xl bg-elev ring-1 ring-line transition-shadow hover:shadow-[0_8px_24px_-16px_var(--ink)]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-ink">
                  <img
                    src={t.image}
                    alt={`${t.meta.name} camera feed`}
                    loading="lazy"
                    width={1280}
                    height={720}
                    className="size-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-widest text-elev/70">
                    {t.meta.code}
                  </span>
                  <span className="absolute right-3 top-3">
                    <Chip tone={t.tone} dot pulse={t.tone === "rose"}>
                      {t.state}
                    </Chip>
                  </span>
                </div>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
                  <Icon className="size-4 shrink-0 text-mute" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold tracking-tight">{t.meta.name}</p>
                    <p className="truncate text-[11px] text-mute">{t.detail}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-ink">
                    {t.headline}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <Panel className="flex flex-col overflow-hidden">
          <PanelHead title="Live event stream" hint="All pipelines">
            <Chip tone="rose" dot pulse>
              Live
            </Chip>
            <Select value={streamSeverity} onValueChange={setStreamSeverity}>
              <SelectTrigger className="w-[110px]">
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
            {filteredStream.map((e) => (
              <div key={e.id} className="row-in px-4 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">{e.text}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-mute">
                      {e.src} · {e.time}
                    </p>
                  </div>
                  <SeverityChip severity={e.severity} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-line p-3">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/intrusion">
                <Activity className="size-3.5" /> Open incident board
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
