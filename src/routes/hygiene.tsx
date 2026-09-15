import { useState } from "react";
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
import { FeedPanel } from "@/components/vision/feed-panel";
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
  const [severity, setSeverity] = useState("all");
  const list = violations.filter((v) => severity === "all" || v.severity === severity);
  const compliant = kitchenStaff.filter((s) => s.mask && s.gloves && s.hairCover).length;

  const [complianceFilter, setComplianceFilter] = useState("all");
  const filteredStaff = kitchenStaff.filter((s) => {
    const isCompliant = s.mask && s.gloves && s.hairCover;
    if (complianceFilter === "compliant") return isCompliant;
    if (complianceFilter === "violation") return !isCompliant;
    return true;
  });

  return (
    <>
      <SectionTitle title="Kitchen Line · Hygiene & PPE" sub="CAM-03 · PPE COMPLIANCE · SHIFT 2">
        <SettingsSheet
          pipelineName="Kitchen Hygiene"
          extra={[{ title: "Snapshot every violation", help: "Save a still image with each event.", defaultOn: true }]}
        />
        <DownloadDialog reportName="Compliance report" />
      </SectionTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Staff detected" value={kitchenStaff.length} hint="on the line now" />
        <Kpi label="Fully compliant" value={compliant} tone="moss" hint="all PPE worn" />
        <Kpi label="Open violations" value={2} tone="rose" hint="needs supervisor" />
        <Kpi label="Compliance score" value={84} unit="%" tone="amber" hint="target 95%" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <FeedPanel
            title="Kitchen line monitoring"
            cameraCode="CAM-03"
            sample={feedKitchen}
            sampleAlt="Commercial kitchen camera feed"
            overlay={
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
            }
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
            <div className="divide-y divide-line">
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
                            i.ok ? "bg-moss/10 text-moss ring-moss/20" : "bg-rose/10 text-rose ring-rose/20"
                          }`}
                        >
                          {i.ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                          {i.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <p className="label-mono">Compliance by requirement</p>
            <div className="mt-4 space-y-3">
              {categories.map((c) => {
                const pct = Math.round((c.worn / c.total) * 100);
                return (
                  <div key={c.key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium">{c.key}</span>
                      <span className="font-mono text-mute">
                        {c.worn}/{c.total} · {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className="mt-1.5 h-1.5" />
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="p-4">
            <p className="label-mono">Compliance score today</p>
            <div className="mt-3 h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={complianceTrend} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
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
                body="Everything on the line is compliant right now."
              />
            ) : (
              <div className="divide-y divide-line">
                {list.map((v) => (
                  <div key={v.id} className="row-in flex items-start gap-3 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line">
                      <HardHat className="size-4 text-mute" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold">{v.issue}</p>
                      <p className="truncate font-mono text-[10px] text-mute">
                        {v.staff} · {v.camera} · {v.time}
                      </p>
                    </div>
                    <SeverityChip severity={v.severity} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
