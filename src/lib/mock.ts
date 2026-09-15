/** Frontend-only mock data for the Sentinel Vision OS demo. */

export type Severity = "info" | "warning" | "critical";

export type Person = {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  status: "active" | "pending";
  lastSeen: string;
  initials: string;
};

export const registeredPeople: Person[] = [
  {
    id: "p1",
    name: "Marcus Chen",
    employeeId: "EMP-2214",
    department: "Operations",
    status: "active",
    lastSeen: "10:42 today",
    initials: "MC",
  },
  {
    id: "p2",
    name: "Rosa Okafor",
    employeeId: "EMP-1098",
    department: "Facilities",
    status: "active",
    lastSeen: "10:41 today",
    initials: "RO",
  },
  {
    id: "p3",
    name: "Lena Petrov",
    employeeId: "EMP-3320",
    department: "Engineering",
    status: "active",
    lastSeen: "10:39 today",
    initials: "LP",
  },
  {
    id: "p4",
    name: "Idris Bello",
    employeeId: "EMP-4471",
    department: "Security",
    status: "active",
    lastSeen: "09:58 today",
    initials: "IB",
  },
  {
    id: "p5",
    name: "Hana Sato",
    employeeId: "EMP-5019",
    department: "Finance",
    status: "pending",
    lastSeen: "Yesterday",
    initials: "HS",
  },
  {
    id: "p6",
    name: "Tomas Vidal",
    employeeId: "EMP-6602",
    department: "Logistics",
    status: "active",
    lastSeen: "08:31 today",
    initials: "TV",
  },
];

export type AttendanceRow = {
  id: string;
  name: string;
  employeeId: string;
  initials: string;
  time: string;
  confidence: number;
  status: "recognized" | "unknown";
};

export const attendanceLog: AttendanceRow[] = [
  { id: "a1", name: "Marcus Chen", employeeId: "EMP-2214", initials: "MC", time: "10:42:17", confidence: 94, status: "recognized" },
  { id: "a2", name: "Unregistered visitor", employeeId: "NO MATCH", initials: "?", time: "10:41:52", confidence: 78, status: "unknown" },
  { id: "a3", name: "Lena Petrov", employeeId: "EMP-3320", initials: "LP", time: "10:39:08", confidence: 97, status: "recognized" },
  { id: "a4", name: "Rosa Okafor", employeeId: "EMP-1098", initials: "RO", time: "10:31:44", confidence: 91, status: "recognized" },
  { id: "a5", name: "Idris Bello", employeeId: "EMP-4471", initials: "IB", time: "09:58:02", confidence: 96, status: "recognized" },
  { id: "a6", name: "Unregistered visitor", employeeId: "NO MATCH", initials: "?", time: "09:44:19", confidence: 65, status: "unknown" },
  { id: "a7", name: "Tomas Vidal", employeeId: "EMP-6602", initials: "TV", time: "08:31:56", confidence: 93, status: "recognized" },
];

export type FaceBox = {
  id: string;
  label: string;
  confidence: number;
  known: boolean;
  left: number;
  top: number;
  width: number;
};

export const faceBoxes: FaceBox[] = [
  { id: "f1", label: "M. CHEN", confidence: 94, known: true, left: 14, top: 30, width: 19 },
  { id: "f2", label: "R. OKAFOR", confidence: 91, known: true, left: 46, top: 26, width: 18 },
  { id: "f3", label: "UNKNOWN", confidence: 78, known: false, left: 70, top: 34, width: 17 },
];

/* ---------------- Kitchen hygiene ---------------- */

export type StaffCompliance = {
  id: string;
  name: string;
  station: string;
  mask: boolean;
  gloves: boolean;
  hairCover: boolean;
  left: number;
  top: number;
  width: number;
};

export const kitchenStaff: StaffCompliance[] = [
  { id: "k1", name: "Station A · Prep", station: "STAFF-01", mask: true, gloves: true, hairCover: true, left: 12, top: 26, width: 20 },
  { id: "k2", name: "Station B · Grill", station: "STAFF-02", mask: true, gloves: false, hairCover: true, left: 42, top: 32, width: 19 },
  { id: "k3", name: "Station C · Plating", station: "STAFF-03", mask: false, gloves: true, hairCover: false, left: 71, top: 28, width: 18 },
];

export type Violation = {
  id: string;
  issue: string;
  staff: string;
  camera: string;
  time: string;
  severity: Severity;
};

export const violations: Violation[] = [
  { id: "v1", issue: "Missing gloves", staff: "STAFF-02", camera: "Kitchen Cam 01", time: "10:42 AM", severity: "critical" },
  { id: "v2", issue: "Hair cover not worn", staff: "STAFF-03", camera: "Kitchen Cam 01", time: "10:37 AM", severity: "warning" },
  { id: "v3", issue: "Face mask lowered", staff: "STAFF-03", camera: "Kitchen Cam 02", time: "10:12 AM", severity: "warning" },
  { id: "v4", issue: "Apron not fastened", staff: "STAFF-05", camera: "Prep Cam 03", time: "09:48 AM", severity: "info" },
  { id: "v5", issue: "Missing gloves", staff: "STAFF-04", camera: "Kitchen Cam 02", time: "09:20 AM", severity: "critical" },
];

export const complianceTrend = [
  { hour: "06", score: 88 },
  { hour: "07", score: 91 },
  { hour: "08", score: 86 },
  { hour: "09", score: 79 },
  { hour: "10", score: 84 },
  { hour: "11", score: 92 },
  { hour: "12", score: 95 },
];

/* ---------------- Plates ---------------- */

export type PlateRecord = {
  id: string;
  plate: string;
  type: "Car" | "Motorcycle";
  confidence: number;
  time: string;
  lane: string;
  color: string;
};

export const plateRecords: PlateRecord[] = [
  { id: "pl1", plate: "ABC-123", type: "Car", confidence: 98, time: "10:42:11", lane: "Gate A · In", color: "Graphite" },
  { id: "pl2", plate: "KHI-8842", type: "Motorcycle", confidence: 93, time: "10:39:47", lane: "Gate A · In", color: "Red" },
  { id: "pl3", plate: "LEB-2091", type: "Car", confidence: 96, time: "10:31:03", lane: "Gate B · Out", color: "Silver" },
  { id: "pl4", plate: "RWP-5510", type: "Car", confidence: 89, time: "10:22:38", lane: "Gate A · In", color: "White" },
  { id: "pl5", plate: "MTR-7734", type: "Motorcycle", confidence: 91, time: "10:04:56", lane: "Gate B · Out", color: "Black" },
  { id: "pl6", plate: "ABC-123", type: "Car", confidence: 97, time: "08:58:14", lane: "Gate A · In", color: "Graphite" },
];

export const plateTraffic = [
  { hour: "06", cars: 8, bikes: 3 },
  { hour: "07", cars: 22, bikes: 11 },
  { hour: "08", cars: 41, bikes: 19 },
  { hour: "09", cars: 33, bikes: 14 },
  { hour: "10", cars: 27, bikes: 9 },
  { hour: "11", cars: 18, bikes: 7 },
];

/* ---------------- Guard ---------------- */

export type GuardState = "on-duty" | "standing" | "sitting" | "sleeping" | "absent";

export const guardStateLabels: Record<GuardState, string> = {
  "on-duty": "On duty · alert",
  standing: "Standing at post",
  sitting: "Seated at post",
  sleeping: "Possible sleeping",
  absent: "Absent from position",
};

export type TimelineEntry = {
  id: string;
  time: string;
  state: GuardState;
  note: string;
  duration: string;
};

export const guardTimeline: TimelineEntry[] = [
  { id: "g1", time: "09:00", state: "on-duty", note: "Shift started, guard at post", duration: "1h 15m" },
  { id: "g2", time: "10:15", state: "standing", note: "Patrol of east corridor", duration: "1h 05m" },
  { id: "g3", time: "11:20", state: "sitting", note: "Seated at desk, monitors active", duration: "45m" },
  { id: "g4", time: "12:05", state: "absent", note: "No person detected at post", duration: "12m" },
  { id: "g5", time: "12:17", state: "on-duty", note: "Guard returned to post", duration: "48m" },
  { id: "g6", time: "13:05", state: "sleeping", note: "Head-down posture held 4m", duration: "4m" },
];

export const guardEvents = [
  { id: "ge1", event: "Possible sleeping detected", time: "13:05", duration: "4m 12s", severity: "critical" as Severity },
  { id: "ge2", event: "Absent from position", time: "12:05", duration: "12m 04s", severity: "warning" as Severity },
  { id: "ge3", event: "Extended seated period", time: "11:20", duration: "45m 00s", severity: "info" as Severity },
  { id: "ge4", event: "Patrol completed", time: "10:15", duration: "1h 05m", severity: "info" as Severity },
];

/* ---------------- Intrusion ---------------- */

export type IntrusionEvent = {
  id: string;
  zone: string;
  time: string;
  persons: number;
  status: "resolved" | "open" | "dismissed";
  severity: Severity;
};

export const intrusionEvents: IntrusionEvent[] = [
  { id: "i1", zone: "Restricted Zone A", time: "13:41", persons: 1, status: "open", severity: "critical" },
  { id: "i2", zone: "Loading Bay 2", time: "12:08", persons: 2, status: "resolved", severity: "warning" },
  { id: "i3", zone: "Restricted Zone A", time: "10:55", persons: 1, status: "resolved", severity: "warning" },
  { id: "i4", zone: "Server Corridor", time: "09:14", persons: 1, status: "dismissed", severity: "info" },
];

export const zoneCameras = [
  { id: "z1", name: "Warehouse Floor", code: "CAM-11", zone: "Restricted Zone A", online: true },
  { id: "z2", name: "Loading Bay", code: "CAM-12", zone: "Loading Bay 2", online: true },
  { id: "z3", name: "Server Corridor", code: "CAM-13", zone: "Server Corridor", online: true },
  { id: "z4", name: "Roof Access", code: "CAM-14", zone: "Roof Hatch", online: false },
];

export const mockCameras = [
  { id: "cam-01", label: "Front Entrance · CAM-01" },
  { id: "cam-02", label: "Main Lobby · CAM-02" },
  { id: "cam-03", label: "Kitchen Line · CAM-03" },
  { id: "cam-04", label: "Gate A · CAM-04" },
];
