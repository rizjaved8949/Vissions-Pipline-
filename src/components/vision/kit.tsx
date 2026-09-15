import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Tone = "amber" | "moss" | "rose" | "slate" | "mute";

const toneText: Record<Tone, string> = {
  amber: "text-amber",
  moss: "text-moss",
  rose: "text-rose",
  slate: "text-slate",
  mute: "text-mute",
};

const toneChip: Record<Tone, string> = {
  amber: "bg-amber/12 text-amber ring-amber/25",
  moss: "bg-moss/12 text-moss ring-moss/25",
  rose: "bg-rose/12 text-rose ring-rose/25",
  slate: "bg-slate/12 text-slate ring-slate/25",
  mute: "bg-panel text-mute ring-line",
};

const toneDot: Record<Tone, string> = {
  amber: "bg-amber",
  moss: "bg-moss",
  rose: "bg-rose",
  slate: "bg-slate",
  mute: "bg-faint",
};

export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl bg-elev ring-1 ring-line", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-[13px] font-bold tracking-tight">{title}</h3>
        {hint ? <p className="mt-0.5 truncate text-[11px] text-mute">{hint}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Chip({
  tone = "mute",
  children,
  className,
  dot,
  pulse,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ring-1",
        toneChip[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", toneDot[tone], pulse && "pulse-dot")}
        />
      ) : null}
      {children}
    </span>
  );
}

export function Kpi({
  label,
  value,
  unit,
  hint,
  tone = "mute",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Panel className="p-4">
      <p className="label-mono truncate">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
          tone === "mute" ? "text-ink" : toneText[tone],
        )}
      >
        {value}
        {unit ? <span className="text-base">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 truncate text-[10px] text-faint">{hint}</p> : null}
    </Panel>
  );
}

export function SectionTitle({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold leading-tight tracking-tight text-balance sm:truncate sm:text-xl md:text-2xl">
          {title}
        </h2>
        {sub ? <p className="mt-1 truncate font-mono text-[11px] text-mute">{sub}</p> : null}
      </div>

      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="text-faint">{icon}</div> : null}
      <p className="text-[13px] font-semibold">{title}</p>
      {body ? <p className="max-w-xs text-[12px] text-mute">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-panel" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-panel" />
            <div className="h-2 w-1/5 animate-pulse rounded bg-panel" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Detection bounding box drawn over a feed. */
export function DetectionBox({
  left,
  top,
  width,
  height,
  tone = "amber",
  label,
  sublabel,
  className,
}: {
  left: number;
  top: number;
  width: number;
  height?: number;
  tone?: Tone;
  label: string;
  sublabel?: string;
  className?: string;
}) {
  const ring = {
    amber: "ring-amber/90",
    moss: "ring-moss/90",
    rose: "ring-rose/90",
    slate: "ring-slate/90",
    mute: "ring-white/60",
  }[tone];
  const badge = {
    amber: "bg-amber text-ink",
    moss: "bg-moss text-elev",
    rose: "bg-rose text-elev",
    slate: "bg-slate text-elev",
    mute: "bg-elev text-ink",
  }[tone];

  return (
    <div
      className={cn("absolute rounded-sm ring-2 row-in", ring, className)}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: height ? `${height}%` : undefined,
        aspectRatio: height ? undefined : "3 / 4",
      }}
    >
      <span
        className={cn(
          "absolute -top-5 left-0 whitespace-nowrap rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold",
          badge,
        )}
      >
        {label}
      </span>
      {sublabel ? (
        <span className="absolute -bottom-5 left-0 whitespace-nowrap rounded-sm bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-elev">
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

export function SeverityChip({ severity }: { severity: "info" | "warning" | "critical" }) {
  const map = {
    info: { tone: "slate" as Tone, text: "Info" },
    warning: { tone: "amber" as Tone, text: "Warning" },
    critical: { tone: "rose" as Tone, text: "Critical" },
  }[severity];
  return (
    <Chip tone={map.tone} dot>
      {map.text}
    </Chip>
  );
}
