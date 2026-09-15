import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockCameras } from "@/lib/mock";
import { toast } from "sonner";

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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
      <div className="min-w-0">
        <Label className="text-[13px] font-semibold">{title}</Label>
        <p className="mt-0.5 text-[11px] leading-snug text-mute">{help}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsSheet({
  pipelineName,
  extra,
}: {
  pipelineName: string;
  extra?: { title: string; help: string; defaultOn?: boolean }[];
}) {
  const [quality, setQuality] = useState("1080p");
  const [camera, setCamera] = useState(mockCameras[0]?.id ?? "");
  const [sensitivity, setSensitivity] = useState(60);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="size-3.5" /> Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{pipelineName} settings</SheetTitle>
          <SheetDescription>
            Everyday preferences for this pipeline. Changes apply to your view only.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <section>
            <h4 className="label-mono">Camera</h4>
            <div className="divide-y divide-line">
              <Row title="Selected camera" help="Which camera this pipeline watches.">
                <Select value={camera} onValueChange={setCamera}>
                  <SelectTrigger className="w-[170px]">
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
              <Row title="Video quality" help="Higher quality uses more bandwidth.">
                <Select value={quality} onValueChange={setQuality}>
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
              <Row title="Camera enabled" help="Turn this camera off without removing it.">
                <Switch defaultChecked />
              </Row>
            </div>
          </section>

          <section>
            <h4 className="label-mono">Alerts</h4>
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
              <div className="py-3">
                <Label className="text-[13px] font-semibold">Alert sensitivity</Label>
                <p className="mt-0.5 text-[11px] text-mute">
                  Lower means fewer alerts, higher means you hear about everything.
                </p>
                <Slider
                  value={[sensitivity]}
                  onValueChange={(v) => setSensitivity(v[0] ?? 0)}
                  max={100}
                  step={5}
                  className="mt-3"
                />
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-mute">
                  {sensitivity < 40 ? "Relaxed" : sensitivity > 75 ? "Strict" : "Balanced"} ·{" "}
                  {sensitivity}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="label-mono">Display</h4>
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
              {extra?.map((e) => (
                <Row key={e.title} title={e.title} help={e.help}>
                  <Switch defaultChecked={e.defaultOn ?? false} />
                </Row>
              ))}
            </div>
          </section>

          <Button className="w-full" onClick={() => toast.success("Preferences saved")}>
            Save preferences
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
