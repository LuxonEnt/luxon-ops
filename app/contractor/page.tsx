"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  Clock3,
  DollarSign,
  Download,
  Eye,
  FileText,
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
  break_hours?: number | null;
  rate?: number | null;
  rate_type?: string | null;
  confirmed?: boolean | null;
  approved?: boolean | null;
  paid?: boolean | null;
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
  total: number;
  event?: EventItem;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function dateLabel(value?: string | null) {
  if (!value) return "--";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function currentTimeForDb() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hoursBetween(
  start?: string | null,
  end?: string | null,
  breakHours = 0
) {
  if (!start || !end) return 0;
  const [sh, sm] = String(start).slice(0, 5).split(":").map(Number);
  const [eh, em] = String(end).slice(0, 5).split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;

  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60;

  return Math.max(0, (endMins - startMins) / 60 - Number(breakHours || 0));
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
      font-size: 14px;
    }
    thead tr {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
    }
    th, td {
      padding: 12px;
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
        <img src="${escapeHtml(logoUrl)}" alt="Luxon Entertainment Logo" class="logo" />
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
        <div class="subtle" style="margin-top: 10px;">Record #${assignment.id}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Contractor</div>
        <div class="value-title">${escapeHtml(contractor.name || "--")}</div>
        <div>${escapeHtml(contractor.email || "")}</div>
        <div>${escapeHtml(contractor.phone || "")}</div>
        <div>${escapeHtml(
          `${contractor.city || ""}${contractor.state ? `, ${contractor.state}` : ""}`
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
          <th>Hours</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(dateLabel(assignment.work_date))}</td>
          <td>${escapeHtml(assignment.position || "Assignment")}</td>
          <td>${escapeHtml(timeLabel(assignment.call_time))}</td>
          <td>${escapeHtml(assignment.hours.toFixed(2))}</td>
          <td>${escapeHtml(
            `${money(Number(assignment.rate || 0))} / ${assignment.rate_type || "day"}`
          )}</td>
          <td>${escapeHtml(money(assignment.total))}</td>
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
        <div style="font-size: 14px;">Paid: ${assignment.paid ? "Yes" : "No"}</div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span>Hours</span>
          <span>${escapeHtml(assignment.hours.toFixed(2))}</span>
        </div>
        <div class="summary-row">
          <span>Rate</span>
          <span>${escapeHtml(
            `${money(Number(assignment.rate || 0))} / ${assignment.rate_type || "day"}`
          )}</span>
        </div>
        <div class="summary-total">
          <span>Total</span>
          <span>${escapeHtml(money(assignment.total))}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      This record is generated from the contractor portal for your files.
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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [documents, setDocuments] = useState<StoredDoc[]>([]);
  const [selectedInvoiceAssignmentId, setSelectedInvoiceAssignmentId] =
    useState<string>("");
  const [selectedInvoiceView, setSelectedInvoiceView] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    company: "",
    city: "",
    state: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
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

    const [{ data: assignmentRows }, { data: eventRows }] = await Promise.all([
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
    ]);

    setContractor(contractorRow);
    setAssignments(assignmentRows || []);
    setEvents(eventRows || []);
    setProfileForm({
      name: contractorRow.name || "",
      phone: contractorRow.phone || "",
      company: contractorRow.company || "",
      city: contractorRow.city || "",
      state: contractorRow.state || "",
      emergency_contact_name: contractorRow.emergency_contact_name || "",
      emergency_contact_phone: contractorRow.emergency_contact_phone || "",
    });

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

    const allowedRadius = Number(event.geofence_radius_feet || 500);
    const distance = distanceFeet(userLat, userLon, event.latitude, event.longitude);

    if (distance > allowedRadius) {
      throw new Error(
        `You are ${Math.round(
          distance
        )} ft away from the venue. You must be within ${allowedRadius} ft to clock in/out. GPS accuracy: ${Math.round(
          accuracyFeet
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
      )} | distance ${Math.round(distance)} ft | accuracy ${Math.round(
        accuracyFeet
      )} ft`,
    };
  }

  async function clockIn(row: AssignmentSummary) {
    if (row.clock_in) {
      setMessage("You are already clocked in for this assignment.");
      return;
    }

    setClockingId(row.id);
    setMessage("Checking your location...");

    try {
      const geo = await validateGeofence(row.event);

      const { error } = await supabase
        .from("assignments")
        .update({
          clock_in: currentTimeForDb(),
          clock_in_location: geo.locationString,
        })
        .eq("id", row.id)
        .eq("contractor_id", row.contractor_id);

      if (error) {
        setMessage(error.message);
        return;
      }

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

  async function clockOut(row: AssignmentSummary) {
    if (!row.clock_in) {
      setMessage("You must clock in before clocking out.");
      return;
    }

    if (row.clock_out) {
      setMessage("You are already clocked out for this assignment.");
      return;
    }

    setClockingId(row.id);
    setMessage("Checking your location...");

    try {
      const geo = await validateGeofence(row.event);

      const { error } = await supabase
        .from("assignments")
        .update({
          clock_out: currentTimeForDb(),
          clock_out_location: geo.locationString,
        })
        .eq("id", row.id)
        .eq("contractor_id", row.contractor_id);

      if (error) {
        setMessage(error.message);
        return;
      }

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
    });
    setIsEditingProfile(true);
    setMessage("");
  }

  function cancelEditingProfile() {
    setIsEditingProfile(false);
    setMessage("");
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
      const hours = hoursBetween(row.clock_in, row.clock_out, row.break_hours || 0);
      const total =
        row.rate_type === "hour"
          ? hours * Number(row.rate || 0)
          : Number(row.rate || 0);

      return {
        ...row,
        hours,
        total,
        event: eventMap[row.event_id],
      };
    });
  }, [assignments, eventMap]);

  const totalValue = assignmentSummaries.reduce((sum, row) => sum + row.total, 0);
  const paidCount = assignmentSummaries.filter((row) => row.paid).length;
  const approvedAssignments = assignmentSummaries.filter((row) => row.approved);
  const selectedInvoiceAssignment =
    approvedAssignments.find(
      (row) => String(row.id) === selectedInvoiceAssignmentId
    ) || approvedAssignments[0] || null;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] p-8 text-white">
        Loading contractor portal...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-yellow-300/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Luxon Entertainment
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Contractor Portal
            </h1>
            <p className="mt-2 text-zinc-400">
              {contractor?.name} · {contractor?.email || ""}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/contractor/requests"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
            >
              <Briefcase className="h-4 w-4" />
              Open Position Requests
            </Link>

            <button
              onClick={signOut}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              <LogOut className="mr-2 inline h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <GlassCard>
            <div className="flex items-start justify-between gap-4">
              <SectionTitle
                icon={<User className="h-5 w-5" />}
                title="My Profile"
                subtitle="Contractor details on file"
              />

              {!isEditingProfile ? (
                <button
                  onClick={startEditingProfile}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={cancelEditingProfile}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {savingProfile ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {!isEditingProfile ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <MiniInfo icon={<User className="h-4 w-4" />} label="Name" value={contractor?.name || "--"} />
                <MiniInfo icon={<Briefcase className="h-4 w-4" />} label="Role" value={contractor?.role || "--"} />
                <MiniInfo icon={<Building2 className="h-4 w-4" />} label="Company" value={contractor?.company || "--"} />
                <MiniInfo
                  icon={<MapPin className="h-4 w-4" />}
                  label="City / State"
                  value={`${contractor?.city || "--"}${
                    contractor?.state ? `, ${contractor.state}` : ""
                  }`}
                />
                <MiniInfo icon={<Phone className="h-4 w-4" />} label="Phone" value={contractor?.phone || "--"} />
                <MiniInfo icon={<User className="h-4 w-4" />} label="Emergency Contact" value={contractor?.emergency_contact_name || "--"} />
                <MiniInfo icon={<AlertCircle className="h-4 w-4" />} label="Emergency Phone" value={contractor?.emergency_contact_phone || "--"} />
                <MiniInfo icon={<FileText className="h-4 w-4" />} label="Email" value={contractor?.email || "--"} />
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Field label="Name" value={profileForm.name} onChange={(v) => setProfileForm({ ...profileForm, name: v })} />
                <ReadOnlyField label="Role" value={contractor?.role || "Contractor"} />
                <Field label="Company" value={profileForm.company} onChange={(v) => setProfileForm({ ...profileForm, company: v })} />
                <Field label="Phone" value={profileForm.phone} onChange={(v) => setProfileForm({ ...profileForm, phone: v })} />
                <Field label="City" value={profileForm.city} onChange={(v) => setProfileForm({ ...profileForm, city: v })} />
                <Field label="State" value={profileForm.state} onChange={(v) => setProfileForm({ ...profileForm, state: v })} />
                <Field
                  label="Emergency Contact"
                  value={profileForm.emergency_contact_name}
                  onChange={(v) =>
                    setProfileForm({ ...profileForm, emergency_contact_name: v })
                  }
                />
                <Field
                  label="Emergency Phone"
                  value={profileForm.emergency_contact_phone}
                  onChange={(v) =>
                    setProfileForm({ ...profileForm, emergency_contact_phone: v })
                  }
                />
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <SectionTitle
              icon={<Briefcase className="h-5 w-5" />}
              title="Open Positions"
              subtitle="See positions posted to all contractors"
            />
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-sm text-zinc-300">
                Managers can post open positions without selecting a contractor first.
              </div>
              <div className="mt-2 text-sm text-zinc-400">
                Open the requests page to respond Available or Unavailable.
              </div>
              <Link
                href="/contractor/requests"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
              >
                <Upload className="h-4 w-4" />
                View Open Position Requests
              </Link>
            </div>
          </GlassCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <GlassCard>
            <div className="flex items-start justify-between gap-4">
              <SectionTitle
                icon={<Receipt className="h-5 w-5" />}
                title="Approved Invoice / Pay Stub"
                subtitle="View and download approved assignment records"
              />
              {selectedInvoiceAssignment ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedInvoiceView(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() => downloadInvoiceRecord(selectedInvoiceAssignment)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-semibold text-black"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              ) : null}
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
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-amber-300">
                            {money(selectedInvoiceAssignment.total)}
                          </div>
                          <div className="text-xs text-zinc-500">Approved</div>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <MiniInfo icon={<CalendarDays className="h-4 w-4" />} label="Work Date" value={dateLabel(selectedInvoiceAssignment.work_date)} />
                        <MiniInfo icon={<Clock3 className="h-4 w-4" />} label="Call Time" value={timeLabel(selectedInvoiceAssignment.call_time)} />
                        <MiniInfo
                          icon={<DollarSign className="h-4 w-4" />}
                          label="Rate"
                          value={`${money(
                            Number(selectedInvoiceAssignment.rate || 0)
                          )} / ${selectedInvoiceAssignment.rate_type || "day"}`}
                        />
                        <MiniInfo icon={<Receipt className="h-4 w-4" />} label="Calculated Total" value={money(selectedInvoiceAssignment.total)} />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState text="No approved invoice items yet." />
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-start justify-between gap-4">
              <SectionTitle
                icon={<Upload className="h-5 w-5" />}
                title="Documents / Receipts"
                subtitle="Upload receipts, backup, and files for manager review"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDoc}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {uploadingDoc ? "Uploading..." : "Upload File"}
                </button>
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
            </div>

            <div className="mt-5 space-y-3">
              {loadingDocs ? (
                <EmptyState text="Loading documents..." />
              ) : documents.length ? (
                documents.map((doc) => (
                  <div
                    key={doc.path}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium">{doc.name}</div>
                      <div className="text-xs text-zinc-500">
                        {doc.updated_at
                          ? new Date(doc.updated_at).toLocaleString()
                          : ""}
                        {doc.size ? ` · ${fileSizeLabel(doc.size)}` : ""}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openDocument(doc.path)}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                      >
                        View
                      </button>
                      <button
                        onClick={() => downloadDocument(doc.path, doc.name)}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No documents uploaded yet." />
              )}
            </div>
          </GlassCard>
        </div>

        <div className="mt-6">
          <GlassCard>
            <SectionTitle
              icon={<CalendarDays className="h-5 w-5" />}
              title="My Assignments"
              subtitle="Confirmed and scheduled work"
            />
            <div className="mt-5 space-y-3">
              {assignmentSummaries.length ? (
                assignmentSummaries.map((row) => {
                  const event = row.event;
                  const directionsUrl = buildDirectionsUrl(event);
                  const geofenceReady = !!event?.latitude && !!event?.longitude;
                  const radius = Number(event?.geofence_radius_feet || 500);

                  return (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-semibold">
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
                            <StatusPill active={geofenceReady} text={geofenceReady ? `GPS Ready ${radius} ft` : "GPS Not Set"} />
                          </div>
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

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <MiniInfo icon={<Clock3 className="h-4 w-4" />} label="Clock In" value={timeLabel(row.clock_in)} />
                        <MiniInfo icon={<Clock3 className="h-4 w-4" />} label="Clock Out" value={timeLabel(row.clock_out)} />
                        <MiniInfo icon={<Clock3 className="h-4 w-4" />} label="Tracked Hours" value={row.hours.toFixed(2)} />
                        <MiniInfo icon={<MapPin className="h-4 w-4" />} label="GPS Radius" value={geofenceReady ? `${radius} ft` : "Not Set"} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
                        >
                          <Navigation className="h-4 w-4" />
                          Directions
                        </a>

                        {!row.clock_in ? (
                          <button
                            onClick={() => clockIn(row)}
                            disabled={clockingId === row.id}
                            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                          >
                            <Clock3 className="h-4 w-4" />
                            {clockingId === row.id ? "Checking GPS..." : "Clock In"}
                          </button>
                        ) : null}

                        {row.clock_in && !row.clock_out ? (
                          <button
                            onClick={() => clockOut(row)}
                            disabled={clockingId === row.id}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                          >
                            <Clock3 className="h-4 w-4" />
                            {clockingId === row.id ? "Checking GPS..." : "Clock Out"}
                          </button>
                        ) : null}

                        {row.clock_in && row.clock_out ? (
                          <span className="inline-flex items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-300">
                            Shift Complete
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState text="No assignments yet." />
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {selectedInvoiceView && selectedInvoiceAssignment ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto max-h-[95vh] max-w-4xl overflow-auto rounded-[28px] border border-white/10 bg-[#0b0b0b] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xl font-semibold text-white">
                Approved Invoice / Pay Stub
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadInvoiceRecord(selectedInvoiceAssignment)}
                  className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 text-sm font-semibold text-black"
                >
                  Download / Print
                </button>
                <button
                  onClick={() => setSelectedInvoiceView(false)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-10 text-slate-900">
              <div className="mb-8 flex items-start justify-between border-b border-slate-200 pb-6">
                <div className="flex items-start gap-4">
                  <img
                    src={COMPANY_LOGO_PATH}
                    alt="Luxon Entertainment Logo"
                    className="h-20 w-auto object-contain"
                  />
                  <div>
                    <div className="text-3xl font-bold">Luxon Entertainment LLC</div>
                    <div className="mt-1 text-slate-500">
                      Contractor Pay Stub / Invoice Record
                    </div>
                    <div className="mt-3 text-sm text-slate-500">
                      Generated: {new Date().toLocaleDateString("en-US")}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-4xl font-bold">APPROVED</div>
                  <div className="mt-2 text-slate-500">
                    Record #{selectedInvoiceAssignment.id}
                  </div>
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
                    {selectedInvoiceAssignment.event?.name || "--"}
                  </div>
                  <div>{selectedInvoiceAssignment.event?.client || ""}</div>
                  <div>{selectedInvoiceAssignment.event?.venue || ""}</div>
                  <div>{selectedInvoiceAssignment.event?.address || ""}</div>
                </div>
              </div>

              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100">
                    <th className="p-3">Date</th>
                    <th className="p-3">Position</th>
                    <th className="p-3">Call Time</th>
                    <th className="p-3">Hours</th>
                    <th className="p-3">Rate</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-3">{dateLabel(selectedInvoiceAssignment.work_date)}</td>
                    <td className="p-3">
                      {selectedInvoiceAssignment.position || "Assignment"}
                    </td>
                    <td className="p-3">
                      {timeLabel(selectedInvoiceAssignment.call_time)}
                    </td>
                    <td className="p-3">
                      {selectedInvoiceAssignment.hours.toFixed(2)}
                    </td>
                    <td className="p-3">
                      {money(Number(selectedInvoiceAssignment.rate || 0))} /{" "}
                      {selectedInvoiceAssignment.rate_type || "day"}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {money(selectedInvoiceAssignment.total)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Status
                  </div>
                  <div className="mt-2 text-sm">
                    Confirmed: {selectedInvoiceAssignment.confirmed ? "Yes" : "No"}
                  </div>
                  <div className="text-sm">
                    Approved: {selectedInvoiceAssignment.approved ? "Yes" : "No"}
                  </div>
                  <div className="text-sm">
                    Paid: {selectedInvoiceAssignment.paid ? "Yes" : "No"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-100 p-5">
                  <div className="mb-2 flex justify-between">
                    <span>Hours</span>
                    <span>{selectedInvoiceAssignment.hours.toFixed(2)}</span>
                  </div>
                  <div className="mb-2 flex justify-between">
                    <span>Rate</span>
                    <span>
                      {money(Number(selectedInvoiceAssignment.rate || 0))} /{" "}
                      {selectedInvoiceAssignment.rate_type || "day"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-3 text-xl font-bold">
                    <span>Total</span>
                    <span>{money(selectedInvoiceAssignment.total)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-xs text-slate-500">
                This record is generated from the contractor portal for your files.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
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
      <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">{icon}</div>
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
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
      <div className="mt-1 text-3xl font-bold">{value}</div>
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
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400/40"
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
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400/40"
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

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex h-12 items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-white">
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

function StatusPill({
  active,
  text,
}: {
  active: boolean;
  text: string;
}) {
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
