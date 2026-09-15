import { useState } from "react";
import { Check, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ranges = ["Today", "Last 7 days", "Last 30 days", "Custom range"] as const;

export function DownloadDialog({
  reportName,
  trigger,
}: {
  reportName: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"PDF" | "CSV">("PDF");
  const [range, setRange] = useState<(typeof ranges)[number]>("Today");
  const [phase, setPhase] = useState<"idle" | "working" | "done">("idle");

  const generate = () => {
    setPhase("working");
    setTimeout(() => {
      setPhase("done");
      toast.success(`${reportName} ready`, {
        description: `${format} · ${range}`,
      });
      setTimeout(() => {
        setOpen(false);
        setPhase("idle");
      }, 900);
    }, 1400);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPhase("idle");
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Download className="size-3.5" /> Download report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{reportName}</DialogTitle>
          <DialogDescription>
            Choose a format and period. The file is prepared in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="label-mono">Format</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "PDF", icon: FileText, hint: "Formatted summary" },
                  { key: "CSV", icon: FileSpreadsheet, hint: "Raw rows" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={cn(
                    "flex items-start gap-2 rounded-lg p-3 text-left ring-1 transition-colors",
                    format === f.key
                      ? "bg-amber/10 ring-amber/40"
                      : "bg-panel ring-line hover:bg-elev",
                  )}
                >
                  <f.icon className={cn("mt-0.5 size-4", format === f.key ? "text-amber" : "text-mute")} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{f.key}</span>
                    <span className="block text-[11px] text-mute">{f.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="label-mono">Period</Label>
            <div className="flex flex-wrap gap-2">
              {ranges.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 transition-colors",
                    range === r
                      ? "bg-ink text-elev ring-ink"
                      : "bg-panel text-mute ring-line hover:text-ink",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={generate} disabled={phase !== "idle"}>
            {phase === "working" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Generating…
              </>
            ) : phase === "done" ? (
              <>
                <Check className="size-4" /> Report ready
              </>
            ) : (
              <>
                <Download className="size-4" /> Generate report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
