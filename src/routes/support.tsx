import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, LifeBuoy, MessageSquare, Play } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelHead, SectionTitle, Chip } from "@/components/vision/kit";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { pipelines } from "@/lib/pipelines";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Help & Support — Sentinel Vision OS" },
      {
        name: "description",
        content:
          "Getting-started guides, answers to common questions and ways to reach the Sentinel monitoring support team.",
      },
      { property: "og:title", content: "Help & Support — Sentinel Vision OS" },
      {
        property: "og:description",
        content: "Guides and support for the Sentinel vision monitoring platform.",
      },
    ],
  }),
  component: Support,
});

const faqs = [
  {
    q: "Why does the camera ask for permission?",
    a: "Your browser controls camera access. The first time you connect, it asks you to allow it. If you blocked it by mistake, open the lock icon in the address bar and allow camera access, then press Connect camera again.",
  },
  {
    q: "Can I review a recorded video instead of a live camera?",
    a: "Yes. On any pipeline press Upload media, or drag an image or video straight onto the feed. The results panel updates as if it were a live session.",
  },
  {
    q: "What do the coloured boxes mean?",
    a: "Green means everything checks out, amber means it needs a look, red means something is wrong. Every box also carries a written label, so colour is never the only signal.",
  },
  {
    q: "How do I get a report?",
    a: "Every pipeline has a Download report button. Pick PDF or CSV and a period, then press Generate report.",
  },
];

function Support() {
  return (
    <>
      <SectionTitle title="Help & Support" sub="RESPONSE WITHIN 2 BUSINESS HOURS">
        <Chip tone="moss" dot pulse>
          Support online
        </Chip>
      </SectionTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Play, title: "Quick start", body: "Connect a camera and read your first results in five minutes." },
          { icon: BookOpen, title: "Pipeline guides", body: "One short guide for each of the five monitoring pipelines." },
          { icon: MessageSquare, title: "Talk to us", body: "Message the monitoring team about anything unclear." },
        ].map((c) => (
          <Panel key={c.title} className="p-4">
            <c.icon className="size-4 text-amber" />
            <p className="mt-3 text-[13px] font-bold tracking-tight">{c.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-mute">{c.body}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => toast("Opening support workspace")}
            >
              Open
            </Button>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="overflow-hidden">
          <PanelHead title="Common questions" hint="Answers to what people ask most" />
          <Accordion type="single" collapsible className="px-4 py-1">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-[13px] font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[12px] leading-relaxed text-mute">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHead title="Jump to a pipeline" hint="Open a monitoring view" />
          <div className="divide-y divide-line">
            {pipelines.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.to}
                  to={p.to}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-panel/60"
                >
                  <Icon className="size-4 shrink-0 text-mute" />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">{p.name}</p>
                    <p className="truncate text-[11px] text-mute">{p.description}</p>
                  </div>
                  <span className="font-mono text-[10px] text-faint">{p.code}</span>
                </Link>
              );
            })}
          </div>
          <div className="border-t border-line p-3">
            <Button size="sm" className="w-full" onClick={() => toast.success("Support request sent")}>
              <LifeBuoy className="size-3.5" /> Contact support
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
