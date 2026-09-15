import {
  ScanFace,
  ChefHat,
  Car,
  ShieldCheck,
  Siren,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export type PipelineMeta = {
  code: string;
  to: string;
  name: string;
  short: string;
  description: string;
  icon: LucideIcon;
};

export const pipelines: PipelineMeta[] = [
  {
    code: "01",
    to: "/attendance",
    name: "Smart Attendance",
    short: "Attendance",
    description: "Real-time face recognition & attendance monitoring",
    icon: ScanFace,
  },
  {
    code: "02",
    to: "/hygiene",
    name: "Kitchen Hygiene",
    short: "Hygiene",
    description: "PPE and hygiene compliance across kitchen stations",
    icon: ChefHat,
  },
  {
    code: "03",
    to: "/plates",
    name: "Plate Detection",
    short: "Plates",
    description: "Vehicle classification and licence plate reading",
    icon: Car,
  },
  {
    code: "04",
    to: "/guard",
    name: "Guard Activity",
    short: "Guard",
    description: "Post presence, alertness and duty verification",
    icon: ShieldCheck,
  },
  {
    code: "05",
    to: "/intrusion",
    name: "Restricted Zones",
    short: "Intrusion",
    description: "Perimeter and restricted area intrusion detection",
    icon: Siren,
  },
];

export const dashboardMeta: PipelineMeta = {
  code: "00",
  to: "/",
  name: "Operations Overview",
  short: "Overview",
  description: "All five vision pipelines at a glance",
  icon: LayoutGrid,
};

export function metaForPath(pathname: string): PipelineMeta {
  const hit = pipelines.find((p) => pathname.startsWith(p.to));
  if (hit) return hit;
  if (pathname.startsWith("/settings"))
    return {
      ...dashboardMeta,
      name: "Settings",
      short: "Settings",
      description: "Cameras, alerts and display preferences",
    };
  if (pathname.startsWith("/support"))
    return {
      ...dashboardMeta,
      name: "Help & Support",
      short: "Support",
      description: "Guides, shortcuts and contact options",
    };
  return dashboardMeta;
}
