import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bike, Car, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
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

export const Route = createFileRoute("/plates")({
  head: () => ({
    meta: [
      { title: "Vehicle Plate Detection — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Detect cars and motorcycles at the gate, read licence plates and search a searchable history of every pass.",
      },
      { property: "og:title", content: "Vehicle Plate Detection — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Gate camera vehicle classification and licence plate reading.",
      },
    ],
  }),
  component: Plates,
});

function Plates() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [detail, setDetail] = useState<PlateRecord | null>(null);

  const rows = useMemo(
    () =>
      plateRecords.filter((r) => {
        const q = query.trim().toLowerCase();
        return (
          (type === "all" || r.type.toLowerCase() === type) &&
          (!q || r.plate.toLowerCase().includes(q))
        );
      }),
    [query, type],
  );

  const unique = new Set(plateRecords.map((r) => r.plate)).size;

  return (
    <>
      <SectionTitle title="Gate A · Vehicle & Plate Reading" sub="CAM-04 · ANPR · TWO LANES">
        <SettingsSheet
          pipelineName="Plate Detection"
          extra={[{ title: "Highlight repeat vehicles", help: "Mark plates seen more than once today.", defaultOn: true }]}
        />
        <DownloadDialog reportName="Vehicle log" />
      </SectionTitle>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FeedPanel
          title="Gate approach camera"
          cameraCode="CAM-04"
          sample={feedGate}
          sampleAlt="Parking gate camera feed with vehicles"
          overlay={
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
          }
        >
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { type: "Car", plate: "ABC-123", conf: 98, icon: Car, lane: "Gate A · In" },
              { type: "Motorcycle", plate: "KHI-8842", conf: 93, icon: Bike, lane: "Gate A · In" },
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
        </FeedPanel>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Vehicles today" value={149} hint="both lanes" />
            <Kpi label="Cars" value={96} tone="amber" hint="64% of traffic" />
            <Kpi label="Motorcycles" value={53} tone="slate" hint="36% of traffic" />
            <Kpi label="Unique plates" value={unique + 121} tone="moss" hint="12 repeat visitors" />
          </div>
          <Panel className="p-4">
            <p className="label-mono">Traffic by hour</p>
            <div className="mt-3 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plateTraffic} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--mute)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--mute)" }} axisLine={false} tickLine={false} />
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
        <PanelHead title="Plate history" hint="Every read from both lanes today">
          <DownloadDialog
            reportName="Plate history"
            trigger={
              <Button size="sm" variant="outline">
                Export
              </Button>
            }
          />
        </PanelHead>

        <div className="grid gap-3 border-b border-line px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plate number"
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
            title="No plates match that search"
            body="Check the spelling or clear the filter."
          />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setDetail(r)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel/60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-panel ring-1 ring-line">
                  {r.type === "Car" ? (
                    <Car className="size-4 text-mute" />
                  ) : (
                    <Bike className="size-4 text-mute" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-[13px] font-bold tracking-[0.14em]">
                    {r.plate}
                  </p>
                  <p className="truncate font-mono text-[10px] text-mute">
                    {r.type} · {r.lane} · {r.time}
                  </p>
                </div>
                <Chip tone={r.confidence > 94 ? "moss" : "amber"}>{r.confidence}%</Chip>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono tracking-[0.14em]">{detail?.plate}</DialogTitle>
            <DialogDescription>
              {detail?.type} · {detail?.lane}
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
              ["Confidence", `${detail?.confidence}%`],
              ["Time", detail?.time ?? ""],
              ["Colour", detail?.color ?? ""],
              ["Lane", detail?.lane ?? ""],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-panel p-3 ring-1 ring-line">
                <p className="label-mono">{k}</p>
                <p className="mt-1 truncate font-mono text-[12px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
