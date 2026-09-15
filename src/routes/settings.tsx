import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Panel, PanelHead, SectionTitle, Chip } from "@/components/vision/kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockCameras } from "@/lib/mock";
import { pipelines } from "@/lib/pipelines";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Everyday preferences for cameras, alerts and how detections are displayed across every vision pipeline.",
      },
      { property: "og:title", content: "Settings — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Camera, alert and display preferences for your monitoring workspace.",
      },
    ],
  }),
  component: SettingsPage,
});

function Row({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <Label className="text-[13px] font-semibold">{title}</Label>
        <p className="mt-0.5 text-[11px] leading-snug text-mute">{help}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>

  );
}

function SettingsPage() {
  const [camera, setCamera] = useState(mockCameras[0]?.id ?? "");

  return (
    <>
      <SectionTitle title="Workspace settings" sub="APPLIES TO YOUR ACCOUNT ONLY">
        <Button size="sm" onClick={() => toast.success("Preferences saved")}>
          Save changes
        </Button>
      </SectionTitle>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHead title="Cameras" hint="Default device and video quality" />
          <div className="divide-y divide-line">
            <Row title="Default camera" help="Used whenever a pipeline starts a live session.">
              <Select value={camera} onValueChange={setCamera}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mockCameras.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row title="Camera name" help="A friendly name shown above the feed.">
              <Input defaultValue="Front Entrance" className="h-9 w-[180px]" />
            </Row>
            <Row title="Video quality" help="Higher quality uses more bandwidth.">
              <Select defaultValue="1080p">
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="1440p">1440p</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row title="Start sessions automatically" help="Begin watching as soon as a pipeline opens.">
              <Switch defaultChecked />
            </Row>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHead title="Notifications" hint="How you hear about events" />
          <div className="divide-y divide-line">
            <Row title="Enable alerts" help="Show a banner when something needs attention.">
              <Switch defaultChecked />
            </Row>
            <Row title="Browser notifications" help="Notify me even when this tab is in the background.">
              <Switch />
            </Row>
            <Row title="Sound alerts" help="Play a short chime for critical events.">
              <Switch />
            </Row>
            <Row title="Daily summary email" help="One digest at the end of each day.">
              <Switch defaultChecked />
            </Row>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHead title="Display" hint="What is drawn on top of each feed" />
          <div className="divide-y divide-line">
            <Row title="Show detection boxes" help="Outline what the camera has found.">
              <Switch defaultChecked />
            </Row>
            <Row title="Show labels" help="Print names or categories next to each box.">
              <Switch defaultChecked />
            </Row>
            <Row title="Show confidence" help="Display how sure the system is about each result.">
              <Switch defaultChecked />
            </Row>
            <Row title="Compact view" help="Tighter spacing to fit more on screen.">
              <Switch />
            </Row>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHead title="Pipelines" hint="Turn individual pipelines on or off" />
          <div className="divide-y divide-line">
            {pipelines.map((p) => (
              <Row key={p.to} title={p.name} help={p.description}>
                <div className="flex items-center gap-3">
                  <Chip tone="moss" dot>
                    Running
                  </Chip>
                  <Switch defaultChecked />
                </div>
              </Row>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
