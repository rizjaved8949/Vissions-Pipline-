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
type Range = (typeof ranges)[number];

export function DownloadDialog({
  reportName,
  trigger,
  open: openProp,
  onOpenChange,
  /** Which Period options currently have data behind them. Ranges not
   *  listed here render disabled/grayed-out rather than being removed -
   *  they light up automatically once that much history actually exists. */
  availableRanges = ranges,
  /** When provided, replaces the fake demo generation with a real one -
   *  called with the chosen format, expected to actually download the file. */
  onGenerate,
  /** Called when the dialog closes without generating a report (Cancel/X/
   *  clicking outside) - e.g. to clean up data that was being held for this. */
  onCancel,
}: {
  reportName: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  availableRanges?: readonly Range[];
  onGenerate?: (format: "PDF" | "CSV") => Promise<void>;
  onCancel?: () => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const [format, setFormat] = useState<"PDF" | "CSV">("PDF");
  const [range, setRange] = useState<Range>("Today");
  const [phase, setPhase] = useState<"idle" | "working" | "done">("idle");

  const setOpen = (v: boolean) => {
    if (!v && phase === "idle") onCancel?.();
    setOpenState(v);
    onOpenChange?.(v);
    if (!v) setPhase("idle");
  };

  const generate = async () => {
    if (onGenerate) {
      setPhase("working");
      try {
        await onGenerate(format);
        setPhase("done");
        setTimeout(() => setOpen(false), 900);
      } catch {
        setPhase("idle");
        toast.error("Could not generate the report");
      }
      return;
    }

    // No real generator wired up - fall back to the original demo behavior.
    setPhase("working");
    setTimeout(() => {
      setPhase("done");
      toast.success(`${reportName} ready`, {
        description: `${format} · ${range}`,
      });
      setTimeout(() => setOpen(false), 900);
    }, 1400);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm">
              <Download className="size-3.5" /> Download report
            </Button>
          )}
        </DialogTrigger>
      ) : null}
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
              {ranges.map((r) => {
                const available = availableRanges.includes(r);
                return (
                  <button
                    key={r}
                    disabled={!available}
                    onClick={() => available && setRange(r)}
                    title={available ? undefined : "No data for this period yet"}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 transition-colors",
                      !available
                        ? "cursor-not-allowed bg-panel text-faint/50 ring-line opacity-50"
                        : range === r
                          ? "bg-ink text-elev ring-ink"
                          : "bg-panel text-mute ring-line hover:text-ink",
                    )}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" onClick={() => void generate()} disabled={phase !== "idle"}>
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
