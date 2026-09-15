import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardMeta, metaForPath, pipelines } from "@/lib/pipelines";
import { Chip } from "./kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItems = [dashboardMeta, ...pipelines];
const utilityItems = [
  { to: "/settings", name: "Settings", icon: Settings },
  { to: "/support", name: "Help & Support", icon: CircleHelp },
];

function NavList({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {!collapsed ? <p className="label-mono px-3 pb-2">Pipelines</p> : null}
        {navItems.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          const link = (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-amber/10 font-semibold text-amber ring-1 ring-amber/15"
                  : "font-medium text-mute hover:bg-elev hover:text-ink",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? (
                <>
                  <span className="truncate">{item.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-faint">{item.code}</span>
                </>
              ) : null}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.name}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-line px-3 py-4">
        {utilityItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.to);
          const link = (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                collapsed && "justify-center px-0",
                active ? "bg-elev text-ink" : "text-mute hover:bg-elev hover:text-ink",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? <span className="truncate">{item.name}</span> : null}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.name}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </div>
    </>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-16 items-center gap-2.5 border-b border-line px-5",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ink font-mono text-[11px] font-semibold tracking-tight text-elev">
        SV
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold leading-none tracking-tight">
            Sentinel
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-mute">VISION OS</span>
        </span>
      ) : null}
    </div>
  );
}

function UserBlock({ collapsed }: { collapsed?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "mx-3 mb-4 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-elev",
          collapsed && "mx-auto justify-center px-0",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber/20 text-[11px] font-semibold text-amber ring-1 ring-amber/30">
          AR
        </span>
        {!collapsed ? (
          <span className="min-w-0 text-[12px] leading-tight">
            <span className="block truncate font-semibold">A. Reyes</span>
            <span className="block font-mono text-[10px] text-mute">SUPERVISOR</span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Alicia Reyes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">Preferences</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const meta = metaForPath(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date()
          .toLocaleString([], {
            weekday: "short",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .toUpperCase(),
      );
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-background text-foreground">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-panel/60 transition-[width] duration-200 md:flex",
            collapsed ? "w-[76px]" : "w-[240px] lg:w-[264px]",
          )}
        >
          <Brand collapsed={collapsed} />
          <NavList pathname={pathname} collapsed={collapsed} />
          <UserBlock collapsed={collapsed} />
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="mx-3 mb-4 flex items-center justify-center gap-2 rounded-md py-2 text-[11px] font-medium text-mute ring-1 ring-line transition-colors hover:bg-elev hover:text-ink"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed ? "Collapse" : null}
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-elev/80 px-4 backdrop-blur-sm md:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                aria-label="Open navigation"
                className="grid size-9 shrink-0 place-items-center rounded-md text-ink ring-1 ring-line md:hidden"
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] bg-panel p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col">
                  <Brand />
                  <NavList
                    pathname={pathname}
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <UserBlock />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-bold leading-none tracking-tight">
                {meta.name}
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-mute">{meta.description}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2 md:gap-3">
              <Chip tone="moss" dot pulse className="hidden sm:inline-flex">
                System ready
              </Chip>
              <span className="hidden font-mono text-[11px] text-mute lg:block">{clock}</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Notifications"
                  className="relative grid size-9 place-items-center rounded-md text-mute ring-1 ring-line transition-colors hover:text-ink"
                >
                  <Bell className="size-4" />
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-rose" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex-col items-start gap-0.5">
                    <span className="text-[12px] font-semibold">Intrusion · Zone A</span>
                    <span className="text-[11px] text-mute">Person entered restricted area · 13:41</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex-col items-start gap-0.5">
                    <span className="text-[12px] font-semibold">Missing gloves</span>
                    <span className="text-[11px] text-mute">Kitchen Cam 01 · 10:42</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex-col items-start gap-0.5">
                    <span className="text-[12px] font-semibold">Unknown face</span>
                    <span className="text-[11px] text-mute">Front entrance · 10:41</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export { X };
