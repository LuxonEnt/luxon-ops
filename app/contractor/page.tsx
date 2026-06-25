"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  DollarSign,
  Download,
  Eye,
  FileText,
  Home,
  LogOut,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  Receipt,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
} from "lucide-react";

const COMPANY_LOGO_PATH = "/luxon-logo.png";

const PORTAL_BACKGROUND_STYLE = {
  backgroundImage:
    "linear-gradient(rgba(5, 5, 5, 0.82), rgba(5, 5, 5, 0.92)), url('/luxon-dashboard-bg.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
} as React.CSSProperties;

const IRS_BUSINESS_MILEAGE_RATE = 0.725;

type MileageTrip = {
  id: number;
  assignment_id: number;
  contractor_id: number;
  event_id: number;
  status: "active" | "submitted" | "approved" | "rejected";
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  gps_miles?: number | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  approved_miles?: number | null;
  irs_rate?: number | null;
  mileage_total?: number | null;
  notes?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
};

const DEFAULT_SKILL_OPTIONS = [
  "A1",
  "A2",
  "L1",
  "L2",
  "LED Programmer",
  "LED Tech",
  "Video Engineer",
  "Camera Op",
  "Projectionist",
  "Stagehand",
  "RF Tech",
  "Broadcast Audio",
  "Lighting Programmer",
  "Rigger",
];

type Contractor = {
  id: number;
  user_id?: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
  phone?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  skills?: string[] | null;
  requested_skills?: string[] | null;
  approved_skills?: string[] | null;
  rate?: number | null;
  rate_type?: string | null;
};

type Assignment = {
  id: number;
  event_id: number;
  contractor_id: number;
  position?: string | null;
  work_date?: string | null;
  call_time?: string | null;
  clock_in?: string | null;
  clock_out?: string | null;
  clock_in_location?: string | null;
  clock_out_location?: string | null;
  lunch_clock_out?: string | null;
  lunch_clock_in?: string | null;
  break_hours?: number | null;
  rate?: number | null;
  rate_type?: string | null;
  confirmed?: boolean | null;
  approved?: boolean | null;
  paid?: boolean | null;
  manager_approved_hours?: number | null;
  manager_notes?: string | null;
  hours_approved?: boolean | null;
  hours_approved_at?: string | null;
  lunch_sms_sent_at?: string | null;
  manual_time_correction?: boolean | null;
  time_correction_reason?: string | null;
  time_corrected_by?: string | null;
  time_corrected_at?: string | null;
};

type EventItem = {
  id: number;
  name: string;
  venue?: string | null;
  address?: string | null;
  client?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_feet?: number | null;
};

type StoredDoc = {
  name: string;
  path: string;
  updated_at?: string;
  size?: number;
};

type AssignmentSummary = Assignment & {
  hours: number;
  baseHourlyRate: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  straightTimePay: number;
  overtimePay: number;
  doubleTimePay: number;
  laborTotal: number;
  mileageMiles: number;
  mileageTotal: number;
  total: number;
  event?: EventItem;
  mileageTrips: MileageTrip[];
};

type MobileTab = "home" | "schedule" | "requests" | "files" | "profile";
type AssignmentFilter = "today" | "upcoming" | "completed" | "all";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}


function milesBetweenPoints(
  pointA: { latitude: number; longitude: number },
  pointB: { latitude: number; longitude: number },
) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);
  const deltaLat = toRadians(pointB.latitude - pointA.latitude);
  const deltaLng = toRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalMilesFromPoints(
  points: Array<{ latitude: number; longitude: number }>,
) {
  if (points.length < 2) return 0;

  return points.reduce((sum, point, index) => {
    if (index === 0) return sum;
    return sum + milesBetweenPoints(points[index - 1], point);
  }, 0);
}

function getMileagePosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS is not available on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function dateLabel(value?: string | null) {
  if (!value) return "--";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortDateLabel(value?: string | null) {
  if (!value) return "--";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}


function addDaysToDate(value?: string | null, days = 30) {
  if (!value) return null;

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function invoiceDueDateLabel(
  hoursApprovedAt?: string | null,
  fallbackDate?: string | null,
) {
  const dueDate = addDaysToDate(hoursApprovedAt || fallbackDate, 30);
  return dueDate ? dateLabel(dueDate) : "--";
}

function timeLabel(value?: string | null) {
  if (!value) return "--";
  const clean = String(value).slice(0, 5);
  const [h, m] = clean.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  return new Date(2026, 0, 1, h, m).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentTimeForDb() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function timeToMinutes(value?: string | null) {
  if (!value) return null;
  const [h, m] = String(value).slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function hoursBetween(
  start?: string | null,
  end?: string | null,
  lunchOut?: string | null,
  lunchIn?: string | null
) {
  if (!start || !end) return 0;

  const startMins = timeToMinutes(start);
  let endMins = timeToMinutes(end);

  if (startMins === null || endMins === null) return 0;
  if (endMins < startMins) endMins += 24 * 60;

  let totalMins = endMins - startMins;

  if (lunchOut && lunchIn) {
    const lunchOutMins = timeToMinutes(lunchOut);
    let lunchInMins = timeToMinutes(lunchIn);

    if (lunchOutMins !== null && lunchInMins !== null) {
      if (lunchInMins < lunchOutMins) lunchInMins += 24 * 60;
      totalMins -= Math.max(0, lunchInMins - lunchOutMins);
    }
  }

  return Math.max(0, totalMins / 60);
}


function calculateLaborBreakdown(
  hours: number,
  rate?: number | null,
  rateType?: string | null,
) {
  const cleanHours = Math.max(0, Number(hours || 0));
  const cleanRate = Number(rate || 0);
  const isHourly = rateType === "hour";
  const baseHourlyRate = isHourly ? cleanRate : cleanRate / 10;

  const regularHours = Math.min(cleanHours, 10);
  const overtimeHours = Math.min(Math.max(cleanHours - 10, 0), 2);
  const doubleTimeHours = Math.max(cleanHours - 12, 0);

  let straightTimePay = regularHours * baseHourlyRate;

  if (!isHourly) {
    if (cleanHours <= 0) {
      straightTimePay = 0;
    } else if (cleanHours <= 5) {
      straightTimePay = cleanRate / 2;
    } else {
      straightTimePay = cleanRate;
    }
  }

  const overtimePay = overtimeHours * baseHourlyRate * 1.5;
  const doubleTimePay = doubleTimeHours * baseHourlyRate * 2;
  const laborTotal = straightTimePay + overtimePay + doubleTimePay;

  return {
    baseHourlyRate,
    regularHours,
    overtimeHours,
    doubleTimeHours,
    straightTimePay,
    overtimePay,
    doubleTimePay,
    laborTotal,
  };
}

function fileSizeLabel(size?: number) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function distanceFeet(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusFeet = 20902231;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusFeet * c;
}

function buildDirectionsUrl(event?: EventItem) {
  if (!event) return "#";

  if (event.latitude && event.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
  }

  if (event.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      event.address
    )}`;
  }

  return "#";
}

function buildInvoiceHtml(
  contractor: Contractor,
  assignment: AssignmentSummary
) {
  const event = assignment.event;
  const logoUrl = `${window.location.origin}${COMPANY_LOGO_PATH}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Luxon Invoice Record #${assignment.id}</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
    }
    .sheet {
      width: 100%;
      background: white;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 24px;
      margin-bottom: 24px;
      align-items: flex-start;
    }
    .brand {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .logo {
      width: 120px;
      height: auto;
      object-fit: contain;
      display: block;
    }
    .company {
      font-size: 30px;
      font-weight: 700;
      line-height: 1.15;
    }
    .subtle {
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }
    .approved { text-align: right; }
    .approved .big {
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
    }
    .label {
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .value-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    thead tr {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th:last-child, td:last-child { text-align: right; }
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 16px;
      align-items: start;
    }
    .summary {
      background: #f8fafc;
      border-radius: 16px;
      padding: 18px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      font-size: 24px;
      font-weight: 700;
    }
    .footer {
      margin-top: 28px;
      color: #64748b;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <img src="${escapeHtml(
          logoUrl
        )}" alt="Luxon Entertainment Logo" class="logo" />
        <div>
          <div class="company">Luxon Entertainment LLC</div>
          <div class="subtle">Contractor Pay Stub / Invoice Record</div>
          <div class="subtle" style="margin-top: 10px;">Generated: ${escapeHtml(
            new Date().toLocaleDateString("en-US")
          )}</div>
        </div>
      </div>

      <div class="approved">
        <div class="big">APPROVED</div>
        <div class="subtle" style="margin-top: 10px;">Record #${
          assignment.id
        }</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Contractor</div>
        <div class="value-title">${escapeHtml(contractor.name || "--")}</div>
        <div>${escapeHtml(contractor.email || "")}</div>
        <div>${escapeHtml(contractor.phone || "")}</div>
        <div>${escapeHtml(
          `${contractor.city || ""}${
            contractor.state ? `, ${contractor.state}` : ""
          }`
        )}</div>
      </div>

      <div class="card">
        <div class="label">Event</div>
        <div class="value-title">${escapeHtml(event?.name || "--")}</div>
        <div>${escapeHtml(event?.client || "")}</div>
        <div>${escapeHtml(event?.venue || "")}</div>
        <div>${escapeHtml(event?.address || "")}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Position</th>
          <th>Call Time</th>
          <th>Clock In</th>
          <th>Lunch Out</th>
          <th>Lunch In</th>
          <th>Clock Out</th>
          <th>Hours</th>
          <th>Rate</th>
          <th>Due Date</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(dateLabel(assignment.work_date))}</td>
          <td>${escapeHtml(assignment.position || "Assignment")}</td>
          <td>${escapeHtml(timeLabel(assignment.call_time))}</td>
          <td>${escapeHtml(timeLabel(assignment.clock_in))}</td>
          <td>${escapeHtml(timeLabel(assignment.lunch_clock_out))}</td>
          <td>${escapeHtml(timeLabel(assignment.lunch_clock_in))}</td>
          <td>${escapeHtml(timeLabel(assignment.clock_out))}</td>
          <td>${escapeHtml(assignment.hours.toFixed(2))}</td>
          <td>${escapeHtml(
            `${money(Number(assignment.rate || 0))} / ${
              assignment.rate_type || "day"
            }`
          )}</td>
          <td>${escapeHtml(money(assignment.laborTotal))}</td>
        </tr>
      </tbody>
    </table>

    <div class="bottom-grid">
      <div class="card">
        <div class="label">Status</div>
        <div style="font-size: 14px; margin-bottom: 6px;">Confirmed: ${
          assignment.confirmed ? "Yes" : "No"
        }</div>
        <div style="font-size: 14px; margin-bottom: 6px;">Approved: ${
          assignment.approved ? "Yes" : "No"
        }</div>
        <div style="font-size: 14px; margin-bottom: 6px;">Paid: ${
          assignment.paid ? "Yes" : "No"
        }</div>
        <div style="font-size: 14px;">Manual Correction: ${
          assignment.manual_time_correction ? "Yes" : "No"
        }</div>
        ${
          assignment.time_correction_reason
            ? `<div style="font-size: 12px; color: #64748b; margin-top: 8px;">Reason: ${escapeHtml(assignment.time_correction_reason)}</div>`
            : ""
        }
      </div>

      <div class="summary">
        <div class="summary-row">
          <span>Hours after lunch</span>
          <span>${escapeHtml(assignment.hours.toFixed(2))}</span>
        </div>
        <div class="summary-row">
          <span>Rate</span>
          <span>${escapeHtml(
            `${money(Number(assignment.rate || 0))} / ${
              assignment.rate_type || "day"
            }`
          )}</span>
        </div>
        <div class="summary-row">
          <span>Straight Time / Base Day</span>
          <span>${escapeHtml(money(assignment.straightTimePay))}</span>
        </div>
        <div class="summary-row">
          <span>Overtime 1.5×</span>
          <span>${escapeHtml(
            `${assignment.overtimeHours.toFixed(2)} hrs = ${money(assignment.overtimePay)}`
          )}</span>
        </div>
        <div class="summary-row">
          <span>Double Time 2×</span>
          <span>${escapeHtml(
            `${assignment.doubleTimeHours.toFixed(2)} hrs = ${money(assignment.doubleTimePay)}`
          )}</span>
        </div>
        <div class="summary-row">
          <span>Labor</span>
          <span>${escapeHtml(money(assignment.laborTotal))}</span>
        </div>
        <div class="summary-row">
          <span>Mileage</span>
          <span>${escapeHtml(
            `${assignment.mileageMiles.toFixed(2)} miles × ${money(IRS_BUSINESS_MILEAGE_RATE)} = ${money(assignment.mileageTotal)}`
          )}</span>
        </div>
        <div class="summary-total">
          <span>Total</span>
          <span>${escapeHtml(money(assignment.total))}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      This record is generated from the contractor portal for your files.<br />
      Payment Terms: All Luxon Entertainment shows are paid on Net 30 terms unless otherwise agreed in writing. Due date is usually 30 days after hours are approved.
    </div>
  </div>
</body>
</html>
  `;
}

export default function ContractorPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [clockingId, setClockingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [mileageTrips, setMileageTrips] = useState<MileageTrip[]>([]);
  const [activeMileageTripId, setActiveMileageTripId] = useState<number | null>(null);
  const [skillOptions, setSkillOptions] = useState<string[]>(DEFAULT_SKILL_OPTIONS);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [documents, setDocuments] = useState<StoredDoc[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [assignmentFilter, setAssignmentFilter] =
    useState<AssignmentFilter>("today");
  const [expandedSection, setExpandedSection] = useState<string>("today");

  const [selectedInvoiceAssignmentId, setSelectedInvoiceAssignmentId] =
    useState<string>("");
  const [selectedInvoiceView, setSelectedInvoiceView] = useState(false);
  const [lunchTimes, setLunchTimes] = useState<
    Record<number, { lunchOut: string; lunchIn: string }>
  >({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mileageWatchRef = useRef<number | null>(null);

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    company: "",
    city: "",
    state: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    requested_skills: [] as string[],
  });

  useEffect(() => {
    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        window.location.href = "/login";
        return;
      }

      await loadPortal(session.user.id);
    }

    void boot();
  }, []);

  async function loadPortal(userId: string) {
    setLoading(true);
    setMessage("");

    const { data: contractorRow, error: contractorError } = await supabase
      .from("contractors")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (contractorError || !contractorRow) {
      window.location.href = "/login";
      return;
    }

    const [
      { data: assignmentRows },
      { data: eventRows },
      { data: mileageRows },
      { data: skillSetsData, error: skillSetsError },
    ] = await Promise.all([
      supabase
        .from("assignments")
        .select("*")
        .eq("contractor_id", contractorRow.id)
        .order("work_date", { ascending: false }),
      supabase
        .from("events")
        .select(
          "id,name,venue,address,client,latitude,longitude,geofence_radius_feet"
        ),
      supabase
        .from("mileage_trips")
        .select("*")
        .eq("contractor_id", contractorRow.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("skill_sets")
        .select("name")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    setContractor(contractorRow);
    setAssignments(assignmentRows || []);
    setEvents(eventRows || []);
    setMileageTrips((mileageRows || []) as MileageTrip[]);

    if (!skillSetsError && skillSetsData?.length) {
      setSkillOptions(skillSetsData.map((item: any) => item.name));
    } else {
      setSkillOptions(DEFAULT_SKILL_OPTIONS);
    }
    setProfileForm({
      name: contractorRow.name || "",
      phone: contractorRow.phone || "",
      company: contractorRow.company || "",
      city: contractorRow.city || "",
      state: contractorRow.state || "",
      emergency_contact_name: contractorRow.emergency_contact_name || "",
      emergency_contact_phone: contractorRow.emergency_contact_phone || "",
      requested_skills: contractorRow.requested_skills || contractorRow.skills || [],
    });

    const existingLunchTimes: Record<
      number,
      { lunchOut: string; lunchIn: string }
    > = {};

    (assignmentRows || []).forEach((row) => {
      existingLunchTimes[row.id] = {
        lunchOut: row.lunch_clock_out || "",
        lunchIn: row.lunch_clock_in || "",
      };
    });

    setLunchTimes(existingLunchTimes);

    await loadDocumentsForContractor(contractorRow.id);

    const approved = (assignmentRows || []).filter((row) => row.approved);
    if (approved[0]) {
      setSelectedInvoiceAssignmentId(String(approved[0].id));
    }

    setLoading(false);
  }

  async function refreshPortal() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.id) {
      await loadPortal(session.user.id);
    }
  }

  async function loadDocumentsForContractor(contractorId: number) {
    setLoadingDocs(true);

    const { data, error } = await supabase.storage
      .from("contractor-documents")
      .list(String(contractorId), {
        limit: 100,
        sortBy: { column: "updated_at", order: "desc" },
      });

    if (error) {
      setLoadingDocs(false);
      return;
    }

    setDocuments(
      (data || []).map((item: any) => ({
        name: item.name,
        path: `${contractorId}/${item.name}`,
        updated_at: item.updated_at,
        size: item.metadata?.size ?? item.size,
      }))
    );

    setLoadingDocs(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported on this device."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });
  }

  async function validateGeofence(event?: EventItem) {
    if (!event?.latitude || !event?.longitude) {
      throw new Error(
        "This event does not have GPS coordinates set yet. Manager must add latitude and longitude before clock-in is allowed."
      );
    }

    const position = await getCurrentPosition();
    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;
    const accuracyFeet = position.coords.accuracy * 3.28084;

    const allowedRadius = Number(event.geofence_radius_feet || 750);
    const distance = distanceFeet(userLat, userLon, event.latitude, event.longitude);

    // Phone GPS can drift, especially when the browser is also tracking mileage.
    // Keep the manager radius as the rule, but allow a capped GPS accuracy buffer
    // so contractors are not blocked when their phone reports a wider accuracy circle.
    const gpsBufferFeet = Math.min(Math.max(accuracyFeet, 0), 500);
    const allowedDistance = allowedRadius + gpsBufferFeet;

    if (distance > allowedDistance) {
      throw new Error(
        `You are ${Math.round(
          distance
        )} ft away from the venue. You must be within ${allowedRadius} ft to clock in/out. GPS accuracy buffer applied: ${Math.round(
          gpsBufferFeet
        )} ft.`
      );
    }

    return {
      lat: userLat,
      lon: userLon,
      distance,
      accuracyFeet,
      locationString: `${userLat.toFixed(6)},${userLon.toFixed(
        6
      )} | distance ${Math.round(distance)} ft | radius ${Math.round(
        allowedRadius
      )} ft | accuracy ${Math.round(accuracyFeet)} ft | buffer ${Math.round(
        gpsBufferFeet
      )} ft`,
    };
  }

  async function clockIn(row: AssignmentSummary) {
    if (row.clock_in) {
      setMessage("You are already clocked in for this assignment.");
      return;
    }

    setClockingId(row.id);
    setMessage("Checking your GPS location...");

    try {
      const geo = await validateGeofence(row.event);
      const clockInTime = currentTimeForDb();

      const { error } = await supabase
        .from("assignments")
        .update({
          clock_in: clockInTime,
          clock_in_location: geo.locationString,
        })
        .eq("id", row.id)
        .eq("contractor_id", row.contractor_id);

      if (error) {
        setMessage(error.message);
        return;
      }

      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === row.id
            ? {
                ...assignment,
                clock_in: clockInTime,
                clock_in_location: geo.locationString,
              }
            : assignment
        )
      );

      setMessage(
        `Clocked in. You were ${Math.round(geo.distance)} ft from the venue.`
      );

      await refreshPortal();
    } catch (error: any) {
      setMessage(error?.message || "Could not clock in.");
    } finally {
      setClockingId(null);
    }
  }

  async function lunchClockOut(row: AssignmentSummary) {
    if (!row.clock_in) {
      setMessage("You must clock in for the day before clocking out for lunch.");
      return;
    }

    if (row.clock_out) {
      setMessage("This shift is already complete.");
      return;
    }

    if (row.lunch_clock_out) {
      setMessage("You already clocked out for lunch.");
      return;
    }

    const lunchOutTime = currentTimeForDb();

    const { error } = await supabase
      .from("assignments")
      .update({
        lunch_clock_out: lunchOutTime,
      })
      .eq("id", row.id)
      .eq("contractor_id", row.contractor_id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setAssignments((prev) =>
      prev.map((assignment) =>
        assignment.id === row.id
          ? { ...assignment, lunch_clock_out: lunchOutTime }
          : assignment,
      ),
    );

    setMessage(`Lunch clock-out saved at ${timeLabel(lunchOutTime)}.`);
    await refreshPortal();
  }

  async function lunchClockIn(row: AssignmentSummary) {
    if (!row.clock_in) {
      setMessage("You must clock in for the day before clocking back in from lunch.");
      return;
    }

    if (!row.lunch_clock_out) {
      setMessage("Clock out for lunch first.");
      return;
    }

    if (row.lunch_clock_in) {
      setMessage("You already clocked back in from lunch.");
      return;
    }

    if (row.clock_out) {
      setMessage("This shift is already complete.");
      return;
    }

    const lunchInTime = currentTimeForDb();
    const lunchOutMins = timeToMinutes(row.lunch_clock_out);
    const lunchInMins = timeToMinutes(lunchInTime);

    if (lunchOutMins !== null && lunchInMins !== null && lunchInMins <= lunchOutMins) {
      setMessage("Lunch clock-in must be after lunch clock-out.");
      return;
    }

    const { error } = await supabase
      .from("assignments")
      .update({
        lunch_clock_in: lunchInTime,
      })
      .eq("id", row.id)
      .eq("contractor_id", row.contractor_id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setAssignments((prev) =>
      prev.map((assignment) =>
        assignment.id === row.id
          ? { ...assignment, lunch_clock_in: lunchInTime }
          : assignment,
      ),
    );

    setMessage(`Lunch clock-in saved at ${timeLabel(lunchInTime)}.`);
    await refreshPortal();
  }

  async function clockOut(row: AssignmentSummary) {
    if (!row.clock_in) {
      setMessage("You must clock in before clocking out.");
      return;
    }

    if (row.clock_out) {
      setMessage("You are already clocked out for this assignment.");
      return;
    }

    const workedHoursSoFar = hoursBetween(
      row.clock_in,
      currentTimeForDb(),
      row.lunch_clock_out,
      row.lunch_clock_in,
    );

    if (row.lunch_clock_out && !row.lunch_clock_in) {
      setMessage("You are still on lunch. Clock back in from lunch before clocking out for the day.");
      return;
    }

    // Lunch reminder is allowed after 5 hours, but do not block clock-out.
    // Some production days cannot take lunch exactly at the 5-hour mark.
    const lunchOut = row.lunch_clock_out || null;
    const lunchIn = row.lunch_clock_in || null;

    setClockingId(row.id);
    setMessage("Checking your GPS location...");

    try {
      const geo = await validateGeofence(row.event);
      const clockOutTime = currentTimeForDb();

      const { error } = await supabase
        .from("assignments")
        .update({
          lunch_clock_out: lunchOut,
          lunch_clock_in: lunchIn,
          clock_out: clockOutTime,
          clock_out_location: geo.locationString,
        })
        .eq("id", row.id)
        .eq("contractor_id", row.contractor_id);

      if (error) {
        setMessage(error.message);
        return;
      }

      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === row.id
            ? {
                ...assignment,
                lunch_clock_out: lunchOut,
                lunch_clock_in: lunchIn,
                clock_out: clockOutTime,
                clock_out_location: geo.locationString,
              }
            : assignment
        )
      );

      setMessage(
        `Clocked out. You were ${Math.round(geo.distance)} ft from the venue.`
      );

      await refreshPortal();
    } catch (error: any) {
      setMessage(error?.message || "Could not clock out.");
    } finally {
      setClockingId(null);
    }
  }

  function startEditingProfile() {
    if (!contractor) return;

    setProfileForm({
      name: contractor.name || "",
      phone: contractor.phone || "",
      company: contractor.company || "",
      city: contractor.city || "",
      state: contractor.state || "",
      emergency_contact_name: contractor.emergency_contact_name || "",
      emergency_contact_phone: contractor.emergency_contact_phone || "",
      requested_skills: contractor.requested_skills || contractor.skills || [],
    });
    setIsEditingProfile(true);
    setMessage("");
  }

  function cancelEditingProfile() {
    setIsEditingProfile(false);
    setMessage("");
  }

  async function refreshMileageTrips(contractorId = contractor?.id) {
    if (!contractorId) return;

    const { data, error } = await supabase
      .from("mileage_trips")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false });

    if (!error) {
      setMileageTrips((data || []) as MileageTrip[]);
    }
  }

  async function startMileageTrip(row: AssignmentSummary) {
    if (!contractor) return;

    try {
      setMessage("Starting GPS mileage trip...");
      const position = await getMileagePosition();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const { data: trip, error } = await supabase
        .from("mileage_trips")
        .insert({
          assignment_id: row.id,
          contractor_id: contractor.id,
          event_id: row.event_id,
          status: "active",
          start_lat: latitude,
          start_lng: longitude,
          irs_rate: IRS_BUSINESS_MILEAGE_RATE,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      await supabase.from("mileage_trip_points").insert({
        trip_id: trip.id,
        latitude,
        longitude,
        recorded_at: new Date().toISOString(),
      });

      setActiveMileageTripId(trip.id);
      await refreshMileageTrips(contractor.id);

      if (mileageWatchRef.current !== null) {
        navigator.geolocation.clearWatch(mileageWatchRef.current);
      }

      mileageWatchRef.current = navigator.geolocation.watchPosition(
        async (watchPosition) => {
          await supabase.from("mileage_trip_points").insert({
            trip_id: trip.id,
            latitude: watchPosition.coords.latitude,
            longitude: watchPosition.coords.longitude,
            recorded_at: new Date().toISOString(),
          });
        },
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        },
      );

      setMessage("Mileage trip started. Keep this page open while driving.");
    } catch (error: any) {
      setMessage(error?.message || "Could not start mileage trip.");
    }
  }

  async function endMileageTrip(row: AssignmentSummary, trip: MileageTrip) {
    if (!contractor) return;

    try {
      setMessage("Ending GPS mileage trip...");
      const position = await getMileagePosition();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      await supabase.from("mileage_trip_points").insert({
        trip_id: trip.id,
        latitude,
        longitude,
        recorded_at: new Date().toISOString(),
      });

      if (mileageWatchRef.current !== null) {
        navigator.geolocation.clearWatch(mileageWatchRef.current);
        mileageWatchRef.current = null;
      }

      const { data: points } = await supabase
        .from("mileage_trip_points")
        .select("latitude,longitude")
        .eq("trip_id", trip.id)
        .order("recorded_at", { ascending: true });

      const gpsPoints =
        points?.map((point: any) => ({
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
        })) || [];

      const fallbackMiles =
        trip.start_lat && trip.start_lng
          ? milesBetweenPoints(
              {
                latitude: Number(trip.start_lat),
                longitude: Number(trip.start_lng),
              },
              { latitude, longitude },
            )
          : 0;

      const gpsMiles =
        gpsPoints.length > 1 ? totalMilesFromPoints(gpsPoints) : fallbackMiles;

      const mileageTotal = gpsMiles * IRS_BUSINESS_MILEAGE_RATE;

      const { error } = await supabase
        .from("mileage_trips")
        .update({
          status: "approved",
          end_lat: latitude,
          end_lng: longitude,
          gps_miles: gpsMiles,
          approved_miles: gpsMiles,
          irs_rate: IRS_BUSINESS_MILEAGE_RATE,
          mileage_total: mileageTotal,
          ended_at: new Date().toISOString(),
        })
        .eq("id", trip.id);

      if (error) {
        setMessage(error.message);
        return;
      }

      setActiveMileageTripId(null);
      await refreshMileageTrips(contractor.id);
      setMessage(`Mileage trip saved: ${gpsMiles.toFixed(2)} miles · ${money(mileageTotal)}`);
    } catch (error: any) {
      setMessage(error?.message || "Could not end mileage trip.");
    }
  }

  async function saveManualMileage(row: AssignmentSummary) {
    if (!contractor) return;

    const input = window.prompt("Enter total round-trip business miles", "0");
    if (input === null) return;

    const miles = Number(input);

    if (!Number.isFinite(miles) || miles <= 0) {
      setMessage("Mileage must be greater than 0.");
      return;
    }

    const mileageTotal = miles * IRS_BUSINESS_MILEAGE_RATE;

    const { error } = await supabase.from("mileage_trips").insert({
      assignment_id: row.id,
      contractor_id: contractor.id,
      event_id: row.event_id,
      status: "approved",
      gps_miles: miles,
      approved_miles: miles,
      irs_rate: IRS_BUSINESS_MILEAGE_RATE,
      mileage_total: mileageTotal,
      notes: "Manual mileage entry",
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await refreshMileageTrips(contractor.id);
    setMessage(`Mileage saved: ${miles.toFixed(2)} miles · ${money(mileageTotal)}`);
  }

  async function saveProfile() {
    if (!contractor) return;

    if (!profileForm.name.trim()) {
      setMessage("Name is required.");
      return;
    }

    setSavingProfile(true);
    setMessage("");

    const { data, error } = await supabase
      .from("contractors")
      .update({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || null,
        company: profileForm.company.trim() || null,
        city: profileForm.city.trim() || null,
        state: profileForm.state.trim() || null,
        emergency_contact_name: profileForm.emergency_contact_name.trim() || null,
        emergency_contact_phone: profileForm.emergency_contact_phone.trim() || null,
        requested_skills: profileForm.requested_skills || [],
      })
      .eq("id", contractor.id)
      .select("*")
      .single();

    setSavingProfile(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setContractor(data);
    setProfileForm({
      name: data.name || "",
      phone: data.phone || "",
      company: data.company || "",
      city: data.city || "",
      state: data.state || "",
      emergency_contact_name: data.emergency_contact_name || "",
      emergency_contact_phone: data.emergency_contact_phone || "",
      requested_skills: data.requested_skills || data.skills || [],
    });
    setIsEditingProfile(false);
    setMessage("Profile updated.");
  }

  async function uploadDocument(file: File) {
    if (!contractor) return;

    setUploadingDoc(true);
    setMessage("");

    const safeName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const path = `${contractor.id}/${safeName}`;

    const { error } = await supabase.storage
      .from("contractor-documents")
      .upload(path, file, {
        upsert: false,
      });

    setUploadingDoc(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadDocumentsForContractor(contractor.id);
    setMessage("Document uploaded.");
  }

  async function openDocument(path: string) {
    const { data, error } = await supabase.storage
      .from("contractor-documents")
      .createSignedUrl(path, 120);

    if (error || !data?.signedUrl) {
      setMessage("Could not open file.");
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function downloadDocument(path: string, name: string) {
    const { data, error } = await supabase.storage
      .from("contractor-documents")
      .download(path);

    if (error || !data) {
      setMessage("Could not download file.");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadInvoiceRecord(assignment: AssignmentSummary) {
    if (!contractor) return;

    const html = buildInvoiceHtml(contractor, assignment);
    const printWindow = window.open("", "_blank", "width=1000,height=900");

    if (!printWindow) {
      setMessage("Popup blocked. Please allow popups and try again.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  const eventMap = useMemo(() => {
    const map: Record<number, EventItem> = {};
    events.forEach((event) => {
      map[event.id] = event;
    });
    return map;
  }, [events]);

  const assignmentSummaries = useMemo(() => {
    return assignments.map((row) => {
      const hours = hoursBetween(
        row.clock_in,
        row.clock_out,
        row.lunch_clock_out,
        row.lunch_clock_in
      );

      const approvedHours =
        row.manager_approved_hours !== null &&
        row.manager_approved_hours !== undefined
          ? Number(row.manager_approved_hours)
          : hours;

      const labor = calculateLaborBreakdown(
        approvedHours,
        row.rate,
        row.rate_type,
      );

      const rowMileageTrips = mileageTrips.filter(
        (trip) => trip.assignment_id === row.id,
      );
      const approvedMileageTrips = rowMileageTrips.filter(
        (trip) => trip.status === "approved",
      );
      const mileageMiles = approvedMileageTrips.reduce(
        (sum, trip) => sum + Number(trip.approved_miles || trip.gps_miles || 0),
        0,
      );
      const mileageTotal = approvedMileageTrips.reduce(
        (sum, trip) => sum + Number(trip.mileage_total || 0),
        0,
      );

      return {
        ...row,
        hours: approvedHours,
        baseHourlyRate: labor.baseHourlyRate,
        regularHours: labor.regularHours,
        overtimeHours: labor.overtimeHours,
        doubleTimeHours: labor.doubleTimeHours,
        straightTimePay: labor.straightTimePay,
        overtimePay: labor.overtimePay,
        doubleTimePay: labor.doubleTimePay,
        laborTotal: labor.laborTotal,
        mileageMiles,
        mileageTotal,
        total: labor.laborTotal + mileageTotal,
        event: eventMap[row.event_id],
        mileageTrips: rowMileageTrips,
      };
    });
  }, [assignments, eventMap, mileageTrips]);

  const today = todayIsoDate();

  const todayAssignments = assignmentSummaries.filter(
    (row) => row.work_date === today && !row.clock_out
  );

  const upcomingAssignments = assignmentSummaries.filter(
    (row) => row.work_date && row.work_date > today && !row.clock_out
  );

  const completedAssignments = assignmentSummaries.filter((row) => row.clock_out);

  const activeAssignments = assignmentSummaries.filter(
    (row) => row.clock_in && !row.clock_out
  );

  const nextAssignment =
    activeAssignments[0] ||
    todayAssignments[0] ||
    assignmentSummaries
      .filter((row) => !row.clock_out)
      .sort((a, b) =>
        String(a.work_date || "").localeCompare(String(b.work_date || ""))
      )[0] ||
    null;

  const filteredAssignments = useMemo(() => {
    if (assignmentFilter === "today") return todayAssignments;
    if (assignmentFilter === "upcoming") return upcomingAssignments;
    if (assignmentFilter === "completed") return completedAssignments;
    return assignmentSummaries;
  }, [
    assignmentFilter,
    assignmentSummaries,
    completedAssignments,
    todayAssignments,
    upcomingAssignments,
  ]);

  const totalValue = assignmentSummaries.reduce((sum, row) => sum + row.total, 0);
  const paidCount = assignmentSummaries.filter((row) => row.paid).length;
  const approvedAssignments = assignmentSummaries.filter((row) => row.approved);
  const selectedInvoiceAssignment =
    approvedAssignments.find(
      (row) => String(row.id) === selectedInvoiceAssignmentId
    ) || approvedAssignments[0] || null;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] p-8 text-white" style={PORTAL_BACKGROUND_STYLE}>
        Loading contractor portal...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] pb-28 text-white md:pb-8" style={PORTAL_BACKGROUND_STYLE}>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-yellow-300/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
        <div className="mb-5 flex items-start justify-between gap-3 md:mb-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Luxon Ops
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Contractor Portal
            </h1>
            <p className="mt-1 text-sm text-zinc-400 md:text-base">
              {contractor?.name} · {contractor?.role || "Contractor"}
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm text-white md:px-4"
          >
            <LogOut className="h-4 w-4 md:mr-2 md:inline" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>

        {message && (
          <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        <div className="hidden md:mb-6 md:flex md:flex-wrap md:gap-3">
          <DesktopTabButton
            active={mobileTab === "home"}
            onClick={() => setMobileTab("home")}
            icon={<Home className="h-4 w-4" />}
            label="Home"
          />
          <DesktopTabButton
            active={mobileTab === "schedule"}
            onClick={() => setMobileTab("schedule")}
            icon={<CalendarDays className="h-4 w-4" />}
            label="Schedule"
          />
          <DesktopTabButton
            active={mobileTab === "requests"}
            onClick={() => setMobileTab("requests")}
            icon={<Briefcase className="h-4 w-4" />}
            label="Requests"
          />
          <DesktopTabButton
            active={mobileTab === "files"}
            onClick={() => setMobileTab("files")}
            icon={<Upload className="h-4 w-4" />}
            label="Files / Invoices"
          />
          <DesktopTabButton
            active={mobileTab === "profile"}
            onClick={() => setMobileTab("profile")}
            icon={<User className="h-4 w-4" />}
            label="Profile"
          />
        </div>

        {mobileTab === "home" && (
          <div className="space-y-5">
            <MobileHeroCard
              contractor={contractor}
              nextAssignment={nextAssignment}
              clockingId={clockingId}
              lunchTimes={lunchTimes}
              setLunchTimes={setLunchTimes}
              clockIn={clockIn}
              clockOut={clockOut}
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<ShieldCheck className="h-5 w-5" />}
                label="My Role"
                value={contractor?.role || "Contractor"}
                sublabel="Current roster role"
              />
              <MetricCard
                icon={<DollarSign className="h-5 w-5" />}
                label="My Rate"
                value={`${money(Number(contractor?.rate || 0))} / ${
                  contractor?.rate_type || "day"
                }`}
                sublabel="Configured pay rate"
              />
              <MetricCard
                icon={<CalendarDays className="h-5 w-5" />}
                label="Assignments"
                value={String(assignmentSummaries.length)}
                sublabel={`${paidCount} paid`}
              />
              <MetricCard
                icon={<Clock3 className="h-5 w-5" />}
                label="Tracked Hours"
                value={assignmentSummaries
                  .reduce((sum, row) => sum + row.hours, 0)
                  .toFixed(2)}
                sublabel={money(totalValue)}
              />
            </div>

            <QuickActions
              onTab={setMobileTab}
              onUpload={() => fileInputRef.current?.click()}
            />

            <CollapsibleSection
              title="Today"
              subtitle={`${todayAssignments.length} assignment(s)`}
              open={expandedSection === "today"}
              onClick={() =>
                setExpandedSection(expandedSection === "today" ? "" : "today")
              }
            >
              <AssignmentList
                rows={todayAssignments}
                clockingId={clockingId}
                lunchTimes={lunchTimes}
                setLunchTimes={setLunchTimes}
                clockIn={clockIn}
                lunchClockOut={lunchClockOut}
                lunchClockIn={lunchClockIn}
                clockOut={clockOut}
                startMileageTrip={startMileageTrip}
                endMileageTrip={endMileageTrip}
                saveManualMileage={saveManualMileage}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Approved Invoices"
              subtitle={`${approvedAssignments.length} available`}
              open={expandedSection === "invoices"}
              onClick={() =>
                setExpandedSection(
                  expandedSection === "invoices" ? "" : "invoices"
                )
              }
            >
              <InvoicesPanel
                contractor={contractor}
                approvedAssignments={approvedAssignments}
                selectedInvoiceAssignmentId={selectedInvoiceAssignmentId}
                setSelectedInvoiceAssignmentId={setSelectedInvoiceAssignmentId}
                selectedInvoiceAssignment={selectedInvoiceAssignment}
                setSelectedInvoiceView={setSelectedInvoiceView}
                downloadInvoiceRecord={downloadInvoiceRecord}
              />
            </CollapsibleSection>
          </div>
        )}

        {mobileTab === "schedule" && (
          <div className="space-y-5">
            <GlassCard>
              <SectionTitle
                icon={<CalendarDays className="h-5 w-5" />}
                title="My Schedule"
                subtitle="Today, upcoming, completed, and all assignments"
              />

              <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
                <FilterButton
                  active={assignmentFilter === "today"}
                  label={`Today (${todayAssignments.length})`}
                  onClick={() => setAssignmentFilter("today")}
                />
                <FilterButton
                  active={assignmentFilter === "upcoming"}
                  label={`Upcoming (${upcomingAssignments.length})`}
                  onClick={() => setAssignmentFilter("upcoming")}
                />
                <FilterButton
                  active={assignmentFilter === "completed"}
                  label={`Completed (${completedAssignments.length})`}
                  onClick={() => setAssignmentFilter("completed")}
                />
                <FilterButton
                  active={assignmentFilter === "all"}
                  label={`All (${assignmentSummaries.length})`}
                  onClick={() => setAssignmentFilter("all")}
                />
              </div>
            </GlassCard>

            <AssignmentList
              rows={filteredAssignments}
              clockingId={clockingId}
              lunchTimes={lunchTimes}
              setLunchTimes={setLunchTimes}
              clockIn={clockIn}
              lunchClockOut={lunchClockOut}
              lunchClockIn={lunchClockIn}
              clockOut={clockOut}
              startMileageTrip={startMileageTrip}
              endMileageTrip={endMileageTrip}
              saveManualMileage={saveManualMileage}
            />
          </div>
        )}

        {mobileTab === "requests" && (
          <div className="space-y-5">
            <GlassCard>
              <SectionTitle
                icon={<Briefcase className="h-5 w-5" />}
                title="Open Position Requests"
                subtitle="View available requests and submit availability"
              />

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-sm text-zinc-300">
                  Managers can post open positions to the full contractor roster.
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  Open the requests page to respond Available or Unavailable.
                </div>
                <Link
                  href="/contractor/requests"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-4 font-semibold text-black"
                >
                  <Briefcase className="h-4 w-4" />
                  View Open Requests
                </Link>
              </div>
            </GlassCard>
          </div>
        )}

        {mobileTab === "files" && (
          <div className="space-y-5">
            <InvoicesPanel
              contractor={contractor}
              approvedAssignments={approvedAssignments}
              selectedInvoiceAssignmentId={selectedInvoiceAssignmentId}
              setSelectedInvoiceAssignmentId={setSelectedInvoiceAssignmentId}
              selectedInvoiceAssignment={selectedInvoiceAssignment}
              setSelectedInvoiceView={setSelectedInvoiceView}
              downloadInvoiceRecord={downloadInvoiceRecord}
            />

            <DocumentsPanel
              documents={documents}
              loadingDocs={loadingDocs}
              uploadingDoc={uploadingDoc}
              fileInputRef={fileInputRef}
              uploadDocument={uploadDocument}
              openDocument={openDocument}
              downloadDocument={downloadDocument}
            />
          </div>
        )}

        {mobileTab === "profile" && (
          <div className="space-y-5">
            <ProfilePanel
              contractor={contractor}
              isEditingProfile={isEditingProfile}
              savingProfile={savingProfile}
              profileForm={profileForm}
              skillOptions={skillOptions}
              setProfileForm={setProfileForm}
              startEditingProfile={startEditingProfile}
              cancelEditingProfile={cancelEditingProfile}
              saveProfile={saveProfile}
            />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void uploadDocument(file);
            }
            e.currentTarget.value = "";
          }}
        />
      </div>

      <MobileBottomNav active={mobileTab} setActive={setMobileTab} />

      {selectedInvoiceView && selectedInvoiceAssignment ? (
        <InvoiceModal
          contractor={contractor}
          assignment={selectedInvoiceAssignment}
          onClose={() => setSelectedInvoiceView(false)}
          onDownload={() => downloadInvoiceRecord(selectedInvoiceAssignment)}
        />
      ) : null}
    </main>
  );
}

function MobileHeroCard({
  contractor,
  nextAssignment,
  clockingId,
  lunchTimes,
  setLunchTimes,
  clockIn,
  clockOut,
}: {
  contractor: Contractor | null;
  nextAssignment: AssignmentSummary | null;
  clockingId: number | null;
  lunchTimes: Record<number, { lunchOut: string; lunchIn: string }>;
  setLunchTimes: React.Dispatch<
    React.SetStateAction<Record<number, { lunchOut: string; lunchIn: string }>>
  >;
  clockIn: (row: AssignmentSummary) => void;
  clockOut: (row: AssignmentSummary) => void;
}) {
  if (!nextAssignment) {
    return (
      <GlassCard>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">
              Welcome, {contractor?.name?.split(" ")[0] || "Contractor"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              No active assignment right now. Once Luxon confirms you for an
              event, it will appear here.
            </p>
          </div>
        </div>
      </GlassCard>
    );
  }

  const event = nextAssignment.event;
  const directionsUrl = buildDirectionsUrl(event);
  const geofenceReady = !!event?.latitude && !!event?.longitude;
  const radius = Number(event?.geofence_radius_feet || 750);

  return (
    <section className="overflow-hidden rounded-[32px] border border-amber-400/20 bg-gradient-to-br from-amber-400/20 via-white/[0.06] to-black/30 p-5 shadow-[0_20px_80px_rgba(245,158,11,0.12)] backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-xs text-amber-200">
            <Clock3 className="h-3.5 w-3.5" />
            {nextAssignment.clock_in && !nextAssignment.clock_out
              ? "Currently Clocked In"
              : nextAssignment.work_date === todayIsoDate()
              ? "Today’s Assignment"
              : "Next Assignment"}
          </div>
          <h2 className="text-2xl font-bold">
            {nextAssignment.position || "Assignment"}
          </h2>
          <p className="mt-1 text-sm text-zinc-300">
            {event?.name || "Event"}
            {event?.venue ? ` · ${event.venue}` : ""}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{event?.address || ""}</p>
          {nextAssignment.manual_time_correction ? (
            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
              Time corrected by manager
              {nextAssignment.time_corrected_at
                ? ` on ${new Date(nextAssignment.time_corrected_at).toLocaleString()}`
                : ""}
              {nextAssignment.time_correction_reason
                ? ` · ${nextAssignment.time_correction_reason}`
                : ""}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-right">
          <div className="text-xs text-zinc-400">Call</div>
          <div className="text-sm font-semibold text-white">
            {timeLabel(nextAssignment.call_time)}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="Date"
          value={shortDateLabel(nextAssignment.work_date)}
        />
        <MiniInfo
          icon={<Clock3 className="h-4 w-4" />}
          label="Clock In"
          value={timeLabel(nextAssignment.clock_in)}
        />
        <MiniInfo
          icon={<Clock3 className="h-4 w-4" />}
          label="Clock Out"
          value={timeLabel(nextAssignment.clock_out)}
        />
        <MiniInfo
          icon={<MapPin className="h-4 w-4" />}
          label="GPS"
          value={geofenceReady ? `${radius} ft` : "Not Set"}
        />
      </div>

      {nextAssignment.clock_in && !nextAssignment.clock_out ? (
        <LunchStatusBox row={nextAssignment} />
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm font-semibold text-white"
        >
          <Navigation className="h-4 w-4" />
          Directions
        </a>

        {!nextAssignment.clock_in ? (
          <button
            onClick={() => clockIn(nextAssignment)}
            disabled={clockingId === nextAssignment.id}
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-bold text-black disabled:opacity-60"
          >
            <Clock3 className="h-4 w-4" />
            {clockingId === nextAssignment.id ? "Checking GPS..." : "Clock In"}
          </button>
        ) : null}

        {nextAssignment.clock_in && !nextAssignment.clock_out ? (
          <button
            onClick={() => clockOut(nextAssignment)}
            disabled={clockingId === nextAssignment.id}
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-4 text-sm font-bold text-black disabled:opacity-60"
          >
            <Clock3 className="h-4 w-4" />
            {clockingId === nextAssignment.id
              ? "Checking GPS..."
              : "Clock Out"}
          </button>
        ) : null}

        {nextAssignment.clock_in && nextAssignment.clock_out ? (
          <span className="inline-flex min-h-[56px] items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-4 text-sm font-bold text-emerald-300 md:col-span-2">
            Shift Complete
          </span>
        ) : null}
      </div>
    </section>
  );
}

function AssignmentList({
  rows,
  clockingId,
  lunchTimes,
  setLunchTimes,
  clockIn,
  lunchClockOut,
  lunchClockIn,
  clockOut,
  startMileageTrip,
  endMileageTrip,
  saveManualMileage,
}: {
  rows: AssignmentSummary[];
  clockingId: number | null;
  lunchTimes: Record<number, { lunchOut: string; lunchIn: string }>;
  setLunchTimes: React.Dispatch<
    React.SetStateAction<Record<number, { lunchOut: string; lunchIn: string }>>
  >;
  clockIn: (row: AssignmentSummary) => void;
  lunchClockOut: (row: AssignmentSummary) => void;
  lunchClockIn: (row: AssignmentSummary) => void;
  clockOut: (row: AssignmentSummary) => void;
  startMileageTrip: (row: AssignmentSummary) => void;
  endMileageTrip: (row: AssignmentSummary, trip: MileageTrip) => void;
  saveManualMileage: (row: AssignmentSummary) => void;
}) {
  if (!rows.length) {
    return (
      <EmptyState text="No assignments in this section yet. Once Luxon confirms you for an event, it will appear here." />
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const event = row.event;
        const directionsUrl = buildDirectionsUrl(event);
        const geofenceReady = !!event?.latitude && !!event?.longitude;
        const radius = Number(event?.geofence_radius_feet || 750);

        return (
          <div
            key={row.id}
            className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl md:p-5"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-lg font-semibold">
                  {row.position || "Assignment"}
                </div>
                <div className="text-sm text-zinc-400">
                  {event?.name || "Event"}
                  {event?.venue ? ` · ${event.venue}` : ""}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {event?.address || ""}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill active={!!row.confirmed} text="Confirmed" />
                  <StatusPill active={!!row.approved} text="Approved" />
                  <StatusPill active={!!row.paid} text="Paid" />
                  <StatusPill
                    active={!!row.manual_time_correction}
                    text={row.manual_time_correction ? "Manager Corrected" : "No Corrections"}
                  />
                  <StatusPill
                    active={geofenceReady}
                    text={geofenceReady ? `GPS ${radius} ft` : "GPS Not Set"}
                  />
                </div>
                {row.manual_time_correction ? (
                  <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
                    Time corrected by manager
                    {row.time_corrected_at
                      ? ` on ${new Date(row.time_corrected_at).toLocaleString()}`
                      : ""}
                    {row.time_correction_reason ? ` · ${row.time_correction_reason}` : ""}
                  </div>
                ) : null}
              </div>

              <div className="text-left md:text-right">
                <div className="font-semibold text-amber-300">
                  {money(Number(row.rate || 0))} / {row.rate_type || "day"}
                </div>
                <div className="text-xs text-zinc-500">
                  {dateLabel(row.work_date)} · {timeLabel(row.call_time)}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-7">
              <MiniInfo
                icon={<Clock3 className="h-4 w-4" />}
                label="Clock In"
                value={timeLabel(row.clock_in)}
              />
              <MiniInfo
                icon={<Clock3 className="h-4 w-4" />}
                label="Lunch Out"
                value={timeLabel(row.lunch_clock_out)}
              />
              <MiniInfo
                icon={<Clock3 className="h-4 w-4" />}
                label="Lunch In"
                value={timeLabel(row.lunch_clock_in)}
              />
              <MiniInfo
                icon={<Clock3 className="h-4 w-4" />}
                label="Clock Out"
                value={timeLabel(row.clock_out)}
              />
              <MiniInfo
                icon={<Clock3 className="h-4 w-4" />}
                label="Hours"
                value={row.hours.toFixed(2)}
              />
              <MiniInfo
                icon={<DollarSign className="h-4 w-4" />}
                label="OT / DT"
                value={`${row.overtimeHours.toFixed(2)} / ${row.doubleTimeHours.toFixed(2)}`}
              />
              <MiniInfo
                icon={<MapPin className="h-4 w-4" />}
                label="GPS"
                value={geofenceReady ? `${radius} ft` : "Not Set"}
              />
            </div>
            <MileageTrackerPanel
              row={row}
              startMileageTrip={startMileageTrip}
              endMileageTrip={endMileageTrip}
              saveManualMileage={saveManualMileage}
            />

            {row.clock_in && !row.clock_out ? (
              <LunchStatusBox row={row} />
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white"
              >
                <Navigation className="h-4 w-4" />
                Directions
              </a>

              {!row.clock_in ? (
                <button
                  onClick={() => clockIn(row)}
                  disabled={clockingId === row.id}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black disabled:opacity-60 md:col-span-2"
                >
                  <Clock3 className="h-4 w-4" />
                  {clockingId === row.id ? "Checking GPS..." : "Clock In Day"}
                </button>
              ) : null}

              {row.clock_in && !row.clock_out && !row.lunch_clock_out ? (
                <button
                  onClick={() => lunchClockOut(row)}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-bold text-blue-200"
                >
                  <Clock3 className="h-4 w-4" />
                  Clock Out Lunch
                </button>
              ) : null}

              {row.clock_in && !row.clock_out && row.lunch_clock_out && !row.lunch_clock_in ? (
                <button
                  onClick={() => lunchClockIn(row)}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-black"
                >
                  <Clock3 className="h-4 w-4" />
                  Clock Back In Lunch
                </button>
              ) : null}

              {row.clock_in && !row.clock_out ? (
                <button
                  onClick={() => clockOut(row)}
                  disabled={clockingId === row.id || (!!row.lunch_clock_out && !row.lunch_clock_in)}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
                >
                  <Clock3 className="h-4 w-4" />
                  {clockingId === row.id ? "Checking GPS..." : "Clock Out Day"}
                </button>
              ) : null}

              {row.clock_in && row.clock_out ? (
                <span className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-sm font-bold text-emerald-300 md:col-span-2">
                  Shift Complete
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function MileageTrackerPanel({
  row,
  startMileageTrip,
  endMileageTrip,
  saveManualMileage,
}: {
  row: AssignmentSummary;
  startMileageTrip: (row: AssignmentSummary) => void;
  endMileageTrip: (row: AssignmentSummary, trip: MileageTrip) => void;
  saveManualMileage: (row: AssignmentSummary) => void;
}) {
  const activeTrip = row.mileageTrips.find((trip) => trip.status === "active");
  const completedTrips = row.mileageTrips.filter(
    (trip) => trip.status !== "active",
  );

  return (
    <div className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-blue-100">
            Mileage Tracker
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            IRS rate: {money(IRS_BUSINESS_MILEAGE_RATE)} / mile · Approved mileage is added to this invoice.
          </div>
          <div className="mt-2 text-sm text-white">
            Approved: {row.mileageMiles.toFixed(2)} miles · {money(row.mileageTotal)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {activeTrip ? (
            <button
              type="button"
              onClick={() => endMileageTrip(row, activeTrip)}
              className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-2 text-sm font-bold text-black"
            >
              End Mileage Trip
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startMileageTrip(row)}
              className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200"
            >
              Start GPS Mileage
            </button>
          )}

          <button
            type="button"
            onClick={() => saveManualMileage(row)}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
          >
            Manual Miles
          </button>
        </div>
      </div>

      {activeTrip ? (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
          Mileage tracking is active. Keep this page open until you end the trip.
        </div>
      ) : null}

      {completedTrips.length ? (
        <div className="mt-3 space-y-2">
          {completedTrips.map((trip) => (
            <div
              key={trip.id}
              className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-zinc-300 md:flex-row md:items-center md:justify-between"
            >
              <div>
                {trip.status.toUpperCase()} · {(Number(trip.approved_miles || trip.gps_miles || 0)).toFixed(2)} miles
                {trip.ended_at ? ` · ${new Date(trip.ended_at).toLocaleDateString()}` : ""}
              </div>
              <div className="font-semibold text-amber-300">
                {money(Number(trip.mileage_total || 0))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LunchStatusBox({ row }: { row: AssignmentSummary }) {
  const lunchOut = row.lunch_clock_out;
  const lunchIn = row.lunch_clock_in;

  return (
    <div className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
      <div className="mb-2 text-sm font-semibold text-blue-100">
        Lunch Break
      </div>

      {!lunchOut ? (
        <div className="text-xs text-zinc-300">
          Lunch has not been recorded yet. Use Clock Out Lunch when lunch starts, or continue the shift if lunch is not possible yet.
        </div>
      ) : null}

      {lunchOut && !lunchIn ? (
        <div className="text-xs text-amber-100">
          Currently on lunch since {timeLabel(lunchOut)}. Clock back in from lunch before clocking out for the day.
        </div>
      ) : null}

      {lunchOut && lunchIn ? (
        <div className="text-xs text-emerald-200">
          Lunch recorded: {timeLabel(lunchOut)} - {timeLabel(lunchIn)}
        </div>
      ) : null}
    </div>
  );
}

function InvoicesPanel({
  contractor,
  approvedAssignments,
  selectedInvoiceAssignmentId,
  setSelectedInvoiceAssignmentId,
  selectedInvoiceAssignment,
  setSelectedInvoiceView,
  downloadInvoiceRecord,
}: {
  contractor: Contractor | null;
  approvedAssignments: AssignmentSummary[];
  selectedInvoiceAssignmentId: string;
  setSelectedInvoiceAssignmentId: (value: string) => void;
  selectedInvoiceAssignment: AssignmentSummary | null;
  setSelectedInvoiceView: (value: boolean) => void;
  downloadInvoiceRecord: (assignment: AssignmentSummary) => void;
}) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          icon={<Receipt className="h-5 w-5" />}
          title="Approved Invoice / Pay Stub"
          subtitle="View and download approved records"
        />
      </div>

      <div className="mt-5 space-y-3">
        {approvedAssignments.length ? (
          <>
            <SelectField
              label="Approved Assignment"
              value={selectedInvoiceAssignmentId}
              onChange={setSelectedInvoiceAssignmentId}
              options={approvedAssignments.map((row) => ({
                value: String(row.id),
                label: `${row.position || "Assignment"} · ${
                  row.event?.name || "Event"
                } · ${dateLabel(row.work_date)}`,
              }))}
            />

            {selectedInvoiceAssignment ? (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {selectedInvoiceAssignment.position || "Assignment"}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {selectedInvoiceAssignment.event?.name || "Event"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {contractor?.name || ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-amber-300">
                      {money(selectedInvoiceAssignment.total)}
                    </div>
                    <div className="text-xs text-zinc-500">Approved</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <MiniInfo
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Work Date"
                    value={dateLabel(selectedInvoiceAssignment.work_date)}
                  />
                  <MiniInfo
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Hours"
                    value={selectedInvoiceAssignment.hours.toFixed(2)}
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <button
                    onClick={() => setSelectedInvoiceView(true)}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() =>
                      downloadInvoiceRecord(selectedInvoiceAssignment)
                    }
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-bold text-black"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState text="No approved invoice items yet. Once a manager approves your invoice, it will appear here." />
        )}
      </div>
    </GlassCard>
  );
}

function DocumentsPanel({
  documents,
  loadingDocs,
  uploadingDoc,
  fileInputRef,
  uploadDocument,
  openDocument,
  downloadDocument,
}: {
  documents: StoredDoc[];
  loadingDocs: boolean;
  uploadingDoc: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploadDocument: (file: File) => void;
  openDocument: (path: string) => void;
  downloadDocument: (path: string, name: string) => void;
}) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          icon={<Upload className="h-5 w-5" />}
          title="Documents / Receipts"
          subtitle="Upload receipts, backup, and files for manager review"
        />
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadingDoc}
        className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-4 text-sm font-bold text-black disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {uploadingDoc ? "Uploading..." : "Upload File"}
      </button>

      <div className="mt-5 space-y-3">
        {loadingDocs ? (
          <EmptyState text="Loading documents..." />
        ) : documents.length ? (
          documents.map((doc) => (
            <div
              key={doc.path}
              className="rounded-2xl border border-white/10 bg-black/25 p-4"
            >
              <div>
                <div className="font-medium">{doc.name}</div>
                <div className="text-xs text-zinc-500">
                  {doc.updated_at ? new Date(doc.updated_at).toLocaleString() : ""}
                  {doc.size ? ` · ${fileSizeLabel(doc.size)}` : ""}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => openDocument(doc.path)}
                  className="min-h-[48px] rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
                >
                  View
                </button>
                <button
                  onClick={() => downloadDocument(doc.path, doc.name)}
                  className="min-h-[48px] rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
                >
                  Download
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="No documents uploaded yet. Upload receipts, backup files, W-9s, or other requested documents here." />
        )}
      </div>
    </GlassCard>
  );
}

function ProfilePanel({
  contractor,
  isEditingProfile,
  savingProfile,
  profileForm,
  skillOptions,
  setProfileForm,
  startEditingProfile,
  cancelEditingProfile,
  saveProfile,
}: {
  contractor: Contractor | null;
  isEditingProfile: boolean;
  savingProfile: boolean;
  profileForm: {
    name: string;
    phone: string;
    company: string;
    city: string;
    state: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    requested_skills: string[];
  };
  skillOptions: string[];
  setProfileForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      phone: string;
      company: string;
      city: string;
      state: string;
      emergency_contact_name: string;
      emergency_contact_phone: string;
      requested_skills: string[];
    }>
  >;
  startEditingProfile: () => void;
  cancelEditingProfile: () => void;
  saveProfile: () => void;
}) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          icon={<User className="h-5 w-5" />}
          title="My Profile"
          subtitle="Keep your contractor details updated"
        />

        {!isEditingProfile ? (
          <button
            onClick={startEditingProfile}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        ) : null}
      </div>

      {!isEditingProfile ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <MiniInfo
            icon={<User className="h-4 w-4" />}
            label="Name"
            value={contractor?.name || "--"}
          />
          <MiniInfo
            icon={<Briefcase className="h-4 w-4" />}
            label="Role"
            value={contractor?.role || "--"}
          />
          <MiniInfo
            icon={<Building2 className="h-4 w-4" />}
            label="Company"
            value={contractor?.company || "--"}
          />
          <MiniInfo
            icon={<MapPin className="h-4 w-4" />}
            label="City / State"
            value={`${contractor?.city || "--"}${
              contractor?.state ? `, ${contractor.state}` : ""
            }`}
          />
          <MiniInfo
            icon={<Phone className="h-4 w-4" />}
            label="Phone"
            value={contractor?.phone || "--"}
          />
          <MiniInfo
            icon={<User className="h-4 w-4" />}
            label="Emergency Contact"
            value={contractor?.emergency_contact_name || "--"}
          />
          <MiniInfo
            icon={<AlertCircle className="h-4 w-4" />}
            label="Emergency Phone"
            value={contractor?.emergency_contact_phone || "--"}
          />
          <MiniInfo
            icon={<FileText className="h-4 w-4" />}
            label="Email"
            value={contractor?.email || "--"}
          />
          <MiniInfo
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Approved Skills"
            value={(contractor?.approved_skills || []).length ? (contractor?.approved_skills || []).join(", ") : "None approved yet"}
          />
          <MiniInfo
            icon={<Briefcase className="h-4 w-4" />}
            label="Requested Skills"
            value={(contractor?.requested_skills || contractor?.skills || []).length ? (contractor?.requested_skills || contractor?.skills || []).join(", ") : "No skills requested"}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Field
            label="Name"
            value={profileForm.name}
            onChange={(v) => setProfileForm({ ...profileForm, name: v })}
          />
          <ReadOnlyField label="Role" value={contractor?.role || "Contractor"} />
          <Field
            label="Company"
            value={profileForm.company}
            onChange={(v) => setProfileForm({ ...profileForm, company: v })}
          />
          <Field
            label="Phone"
            value={profileForm.phone}
            onChange={(v) => setProfileForm({ ...profileForm, phone: v })}
          />
          <Field
            label="City"
            value={profileForm.city}
            onChange={(v) => setProfileForm({ ...profileForm, city: v })}
          />
          <Field
            label="State"
            value={profileForm.state}
            onChange={(v) => setProfileForm({ ...profileForm, state: v })}
          />
          <Field
            label="Emergency Contact"
            value={profileForm.emergency_contact_name}
            onChange={(v) =>
              setProfileForm({
                ...profileForm,
                emergency_contact_name: v,
              })
            }
          />
          <Field
            label="Emergency Phone"
            value={profileForm.emergency_contact_phone}
            onChange={(v) =>
              setProfileForm({
                ...profileForm,
                emergency_contact_phone: v,
              })
            }
          />

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 md:col-span-2">
            <div className="mb-2 text-sm font-semibold text-white">Request Skill Approval</div>
            <div className="mb-3 text-xs text-zinc-400">Select the skills you want managers to approve for future crew requests.</div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {skillOptions.map((skill) => {
                const active = profileForm.requested_skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() =>
                      setProfileForm((prev) => ({
                        ...prev,
                        requested_skills: active
                          ? prev.requested_skills.filter((item) => item !== skill)
                          : [...prev.requested_skills, skill],
                      }))
                    }
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                      active
                        ? "border-amber-400/30 bg-amber-400/20 text-amber-200"
                        : "border-white/10 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <button
              onClick={cancelEditingProfile}
              className="min-h-[52px] rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white"
            >
              Cancel
            </button>
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingProfile ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function QuickActions({
  onTab,
  onUpload,
}: {
  onTab: (tab: MobileTab) => void;
  onUpload: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <button
        onClick={() => onTab("schedule")}
        className="min-h-[76px] rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"
      >
        <CalendarDays className="mb-2 h-5 w-5 text-amber-300" />
        <div className="text-sm font-semibold">Schedule</div>
        <div className="text-xs text-zinc-500">View jobs</div>
      </button>
      <button
        onClick={() => onTab("requests")}
        className="min-h-[76px] rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"
      >
        <Briefcase className="mb-2 h-5 w-5 text-amber-300" />
        <div className="text-sm font-semibold">Requests</div>
        <div className="text-xs text-zinc-500">Open calls</div>
      </button>
      <button
        onClick={onUpload}
        className="min-h-[76px] rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"
      >
        <Upload className="mb-2 h-5 w-5 text-amber-300" />
        <div className="text-sm font-semibold">Upload</div>
        <div className="text-xs text-zinc-500">Receipt/file</div>
      </button>
      <button
        onClick={() => onTab("files")}
        className="min-h-[76px] rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"
      >
        <Receipt className="mb-2 h-5 w-5 text-amber-300" />
        <div className="text-sm font-semibold">Invoices</div>
        <div className="text-xs text-zinc-500">Records</div>
      </button>
    </div>
  );
}

function InvoiceModal({
  contractor,
  assignment,
  onClose,
  onDownload,
}: {
  contractor: Contractor | null;
  assignment: AssignmentSummary;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-3 backdrop-blur-sm md:p-4">
      <div className="mx-auto max-h-[95vh] max-w-4xl overflow-auto rounded-[28px] border border-white/10 bg-[#0b0b0b] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-white md:text-xl">
            Approved Invoice / Pay Stub
          </div>
          <div className="flex gap-2">
            <button
              onClick={onDownload}
              className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-semibold text-black"
            >
              Download
            </button>
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-900 md:p-10">
          <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <img
                src={COMPANY_LOGO_PATH}
                alt="Luxon Entertainment Logo"
                className="h-16 w-auto object-contain md:h-20"
              />
              <div>
                <div className="text-2xl font-bold md:text-3xl">
                  Luxon Entertainment LLC
                </div>
                <div className="mt-1 text-slate-500">
                  Contractor Pay Stub / Invoice Record
                </div>
                <div className="mt-3 text-sm text-slate-500">
                  Generated: {new Date().toLocaleDateString("en-US")}
                </div>
              </div>
            </div>

            <div className="md:text-right">
              <div className="text-3xl font-bold md:text-4xl">APPROVED</div>
              <div className="mt-2 text-slate-500">Record #{assignment.id}</div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Contractor
              </div>
              <div className="mt-2 text-lg font-bold">
                {contractor?.name || "--"}
              </div>
              <div>{contractor?.email || ""}</div>
              <div>{contractor?.phone || ""}</div>
              <div>
                {contractor?.city || ""}
                {contractor?.state ? `, ${contractor.state}` : ""}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Event
              </div>
              <div className="mt-2 text-lg font-bold">
                {assignment.event?.name || "--"}
              </div>
              <div>{assignment.event?.client || ""}</div>
              <div>{assignment.event?.venue || ""}</div>
              <div>{assignment.event?.address || ""}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  <th className="p-3">Date</th>
                  <th className="p-3">Position</th>
                  <th className="p-3">Clock In</th>
                  <th className="p-3">Lunch Out</th>
                  <th className="p-3">Lunch In</th>
                  <th className="p-3">Clock Out</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">Rate</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-3">{dateLabel(assignment.work_date)}</td>
                  <td className="p-3">{assignment.position || "Assignment"}</td>
                  <td className="p-3">{timeLabel(assignment.clock_in)}</td>
                  <td className="p-3">
                    {timeLabel(assignment.lunch_clock_out)}
                  </td>
                  <td className="p-3">{timeLabel(assignment.lunch_clock_in)}</td>
                  <td className="p-3">{timeLabel(assignment.clock_out)}</td>
                  <td className="p-3">{assignment.hours.toFixed(2)}</td>
                  <td className="p-3">
                    {money(Number(assignment.rate || 0))} /{" "}
                    {assignment.rate_type || "day"}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {money(assignment.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-100 p-5">
            <div className="mb-2 flex justify-between">
              <span>Hours after lunch</span>
              <span>{assignment.hours.toFixed(2)}</span>
            </div>
            <div className="mb-2 flex justify-between">
              <span>Rate</span>
              <span>
                {money(Number(assignment.rate || 0))} /{" "}
                {assignment.rate_type || "day"}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-3 text-xl font-bold">
              <span>Total</span>
              <span>{money(assignment.total)}</span>
            </div>
          </div>

          {assignment.manual_time_correction ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Manager time correction:</strong> This record includes manually corrected time.
              {assignment.time_correction_reason ? ` Reason: ${assignment.time_correction_reason}` : ""}
              {assignment.time_corrected_at
                ? ` Corrected on ${new Date(assignment.time_corrected_at).toLocaleString()}.`
                : ""}
            </div>
          ) : null}

          <div className="mt-8 text-xs text-slate-500">
            This record is generated from the contractor portal for your files.
            <br />
            Payment Terms: All Luxon Entertainment shows are paid on Net 30 terms unless otherwise agreed in writing. Due date is usually 30 days after hours are approved.
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileBottomNav({
  active,
  setActive,
}: {
  active: MobileTab;
  setActive: (tab: MobileTab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#070707]/95 px-2 py-2 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5 gap-1">
        <MobileNavButton
          active={active === "home"}
          onClick={() => setActive("home")}
          icon={<Home className="h-5 w-5" />}
          label="Home"
        />
        <MobileNavButton
          active={active === "schedule"}
          onClick={() => setActive("schedule")}
          icon={<CalendarDays className="h-5 w-5" />}
          label="Schedule"
        />
        <MobileNavButton
          active={active === "requests"}
          onClick={() => setActive("requests")}
          icon={<Briefcase className="h-5 w-5" />}
          label="Requests"
        />
        <MobileNavButton
          active={active === "files"}
          onClick={() => setActive("files")}
          icon={<Upload className="h-5 w-5" />}
          label="Files"
        />
        <MobileNavButton
          active={active === "profile"}
          onClick={() => setActive("profile")}
          icon={<User className="h-5 w-5" />}
          label="Profile"
        />
      </div>
    </nav>
  );
}

function MobileNavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold ${
        active
          ? "bg-gradient-to-r from-amber-300 to-yellow-600 text-black"
          : "text-zinc-400"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DesktopTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold ${
        active
          ? "bg-gradient-to-r from-amber-300 to-yellow-600 text-black"
          : "border border-white/10 bg-white/[0.05] text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  open,
  onClick,
  children,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <GlassCard>
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <div className="text-xl font-semibold">{title}</div>
          <div className="text-sm text-zinc-400">{subtitle}</div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-zinc-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? <div className="mt-5">{children}</div> : null}
    </GlassCard>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[48px] rounded-2xl px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-gradient-to-r from-amber-300 to-yellow-600 text-black"
          : "border border-white/10 bg-white/[0.05] text-white"
      }`}
    >
      {label}
    </button>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
      {children}
    </section>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
        <p className="text-sm text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <GlassCard>
      <div className="mb-4 inline-flex rounded-2xl bg-amber-400/10 p-3 text-amber-300">
        {icon}
      </div>
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold md:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{sublabel}</div>
    </GlassCard>
  );
}

function MiniInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-[10px] uppercase tracking-wide md:text-xs">
          {label}
        </span>
      </div>
      <div className="text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[52px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-[16px] text-white outline-none focus:border-amber-400/40"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[52px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-[16px] text-white outline-none focus:border-amber-400/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex h-[52px] items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-white">
        {value}
      </div>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
      {text}
    </div>
  );
}

function StatusPill({ active, text }: { active: boolean; text: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] ${
        active
          ? "border-emerald-400/20 bg-emerald-500/20 text-emerald-300"
          : "border-white/10 bg-white/[0.04] text-zinc-400"
      }`}
    >
      {text}
    </span>
  );
}
