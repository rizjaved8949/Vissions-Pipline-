import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { attendanceLog, faceBoxes, registeredPeople, type Person } from "@/lib/mock";
import feedLobby from "@/assets/feed-lobby.jpg";

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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [people, setPeople] = useState<Person[]>(registeredPeople);
  const [regOpen, setRegOpen] = useState(false);
  const [form, setForm] = useState({ name: "", id: "" });
  const [peopleStatus, setPeopleStatus] = useState("all");
  const filteredPeople = people.filter(
    (p) => peopleStatus === "all" || p.status === peopleStatus,
  );

  const rows = useMemo(
    () =>
      attendanceLog.filter((r) => {
        const matchesFilter = filter === "all" || r.status === filter;
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q || r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q);
        return matchesFilter && matchesQuery;
      }),
    [query, filter],
  );

  const register = () => {
    if (!form.name.trim() || !form.id.trim()) {
      toast.error("Add a name and an ID to continue");
      return;
    }
    setPeople((p) => [
      {
        id: `new-${p.length}`,
        name: form.name,
        employeeId: form.id,
        department: "Unassigned",
        status: "pending",
        lastSeen: "Not seen yet",
        initials: form.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      },
      ...p,
    ]);
    setRegOpen(false);
    setForm({ name: "", id: "" });
    toast.success("Person registered", { description: "Face profile queued for enrolment" });
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
        <FeedPanel
          title="Entrance recognition feed"
          cameraCode="CAM-01"
          sample={feedLobby}
          sampleAlt="Front entrance lobby camera feed"
          overlay={
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
          }
        />

        <Panel className="flex flex-col overflow-hidden">
          <PanelHead title="Live results" hint="Faces in frame right now">
            <span className="font-mono text-[11px] text-amber">3 active</span>
          </PanelHead>
          <div className="divide-y divide-line">
            {faceBoxes.map((b, i) => (
              <div key={b.id} className="row-in flex items-center gap-2.5 px-4 py-3">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                    b.known ? "bg-amber/20 text-amber" : "bg-rose/20 text-rose"
                  }`}
                >
                  {b.known ? b.label.slice(0, 2) : "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold">
                    {b.known ? b.label : "Unregistered"}
                  </p>
                  <p className="font-mono text-[10px] text-mute">
                    {b.known ? `EMP-${2200 + i * 7}` : "NO MATCH"} · 10:4{i}
                  </p>
                </div>
                <Chip tone={b.known ? "moss" : "rose"}>{b.confidence}%</Chip>
              </div>
            ))}
          </div>
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
                  <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-line bg-panel px-6 py-8 text-center">
                    <Users className="size-5 text-faint" />
                    <p className="text-[12px] font-semibold">Drop a clear face photo</p>
                    <p className="text-[11px] text-mute">JPG or PNG, front facing, good lighting</p>
                    <Button size="sm" variant="outline" onClick={() => toast("Photo selected")}>
                      Choose photo
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="p-name">Full name</Label>
                      <Input
                        id="p-name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Amara Diallo"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="p-id">Person / employee ID</Label>
                      <Input
                        id="p-id"
                        value={form.id}
                        onChange={(e) => setForm({ ...form, id: e.target.value })}
                        placeholder="EMP-7788"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRegOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={register}>Register person</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Detected" value={148} hint="total today" />
        <Kpi label="Recognized" value={139} tone="moss" hint="94% match rate" />
        <Kpi label="Unknown" value={9} tone="rose" hint="needs review" />
        <Kpi label="Present" value={121} hint="of 140 staff" />
        <Kpi label="Attendance" value={86} unit="%" tone="amber" hint="vs 84% average" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <PanelHead title="Check-in history" hint="Today · 14 June">
            <DownloadDialog
              reportName="Check-in log"
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
                placeholder="Search name or ID"
                className="h-9 pl-9"
              />
            </div>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="recognized">Recognized</TabsTrigger>
                <TabsTrigger value="unknown">Unknown</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="No matching check-ins"
              body="Try a different name, ID or filter."
            />
          ) : (
            <div className="divide-y divide-line">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-panel/60"
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      r.status === "recognized" ? "bg-amber/20 text-amber" : "bg-rose/20 text-rose"
                    }`}
                  >
                    {r.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">{r.name}</p>
                    <p className="font-mono text-[10px] text-mute">
                      {r.employeeId} · {r.time} · {r.confidence}%
                    </p>
                  </div>
                  <Chip tone={r.status === "recognized" ? "moss" : "rose"}>
                    {r.status === "recognized" ? "Check-in" : "Unknown"}
                  </Chip>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHead title="Registered people" hint={`${people.length} enrolled profiles`}>
            <Tabs value={peopleStatus} onValueChange={setPeopleStatus}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
            </Tabs>
          </PanelHead>
          <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {filteredPeople.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-panel text-[11px] font-bold text-mute ring-1 ring-line">
                  {p.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">{p.name}</p>
                  <p className="truncate font-mono text-[10px] text-mute">
                    {p.employeeId} · {p.department}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-faint">Last seen {p.lastSeen}</p>
                </div>
                <Chip tone={p.status === "active" ? "moss" : "amber"}>{p.status}</Chip>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
