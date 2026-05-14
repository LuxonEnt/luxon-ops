"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  DollarSign,
  FileText,
  FolderOpen,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

type EventItem = {
  id: number;
  name: string;
  client?: string | null;
  venue?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_feet?: number | null;
};

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
  manual_time_correction?: boolean | null;
  time_correction_reason?: string | null;
  time_corrected_by?: string | null;
  time_corrected_at?: string | null;
};

type AssignmentRow = Assignment & {
  trackedHours: number;
  billedHours: number;
  total: number;
  event?: EventItem;
  contractor?: Contractor;
};

type AvailabilityItem = {
  id: number;
  contractor_id: number;
  start_date: string;
  end_date: string;
  availability_status: string;
  notes?: string | null;
  created_at?: string;
};

type StoredDoc = {
  name: string;
  path: string;
  contractor_id: number;
  contractor_name: string;
  updated_at?: string;
  size?: number;
};

type TabName =
  | "Overview"
  | "Schedule Board"
  | "Events"
  | "Contractors"
  | "Assignments"
  | "Payroll"
  | "Invoices"
  | "Documents";

const TABS: TabName[] = [
  "Overview",
  "Schedule Board",
  "Events",
  "Contractors",
  "Assignments",
  "Payroll",
  "Invoices",
  "Documents",
];

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

function fileSizeLabel(size?: number) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function geocodeAddress(address: string) {
  const cleanAddress = address.trim();

  if (!cleanAddress) {
    return {
      latitude: null as number | null,
      longitude: null as number | null,
      formatted_address: null as string | null,
    };
  }

  const response = await fetch("/api/geocode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: cleanAddress,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Could not geocode address.");
  }

  return {
    latitude: data.latitude as number,
    longitude: data.longitude as number,
    formatted_address: data.formatted_address as string,
  };
}

export default function ManagerPage() {
  const [activeTab, setActiveTab] = useState<TabName>("Overview");
  const [status, setStatus] = useState("Checking access...");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);
  const [documents, setDocuments] = useState<StoredDoc[]>([]);

  const [eventForm, setEventForm] = useState({
    name: "",
    client: "",
    venue: "",
    address: "",
    start_date: "",
    end_date: "",
    status: "Scheduled",
    notes: "",
    geofence_radius_feet: "750",
  });

  const [contractorForm, setContractorForm] = useState({
    name: "",
    role: "Contractor",
    phone: "",
    email: "",
    rate: "",
    rate_type: "day",
    company: "",
    city: "",
    state: "",
  });

  const [assignmentForm, setAssignmentForm] = useState({
    event_id: "",
    contractor_id: "",
    position: "",
    work_date: "",
    call_time: "",
    rate: "",
    rate_type: "day",
  });

  useEffect(() => {
    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        window.location.href = "/login";
        return;
      }

      const userEmail = session.user.email;
      setEmail(userEmail);

      const { data } = await supabase
        .from("admins")
        .select("email")
        .eq("email", userEmail)
        .maybeSingle();

      if (!data) {
        await supabase.auth.signOut();
        window.location.href = "/login";
        return;
      }

      setStatus("allowed");
      await loadAll();
    }

    void boot();
  }, []);

  async function loadAll() {
    setLoading(true);
    setMessage("");

    const [
      eventsResult,
      contractorsResult,
      assignmentsResult,
      availabilityResult,
    ] = await Promise.all([
      supabase.from("events").select("*").order("start_date", { ascending: false }),
      supabase.from("contractors").select("*").order("name", { ascending: true }),
      supabase.from("assignments").select("*").order("work_date", { ascending: false }),
      supabase
        .from("contractor_availability")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (
      eventsResult.error ||
      contractorsResult.error ||
      assignmentsResult.error ||
      availabilityResult.error
    ) {
      setMessage(
        eventsResult.error?.message ||
          contractorsResult.error?.message ||
          assignmentsResult.error?.message ||
          availabilityResult.error?.message ||
          "Could not load manager data."
      );
      setLoading(false);
      return;
    }

    setEvents(eventsResult.data || []);
    setContractors(contractorsResult.data || []);
    setAssignments(assignmentsResult.data || []);
    setAvailability(availabilityResult.data || []);

    if ((eventsResult.data || [])[0] && !assignmentForm.event_id) {
      setAssignmentForm((prev) => ({
        ...prev,
        event_id: String(eventsResult.data![0].id),
      }));
    }

    await loadDocuments(contractorsResult.data || []);
    setLoading(false);
  }

  async function loadDocuments(contractorRows: Contractor[]) {
    const allDocs: StoredDoc[] = [];

    for (const contractor of contractorRows) {
      const { data } = await supabase.storage
        .from("contractor-documents")
        .list(String(contractor.id), {
          limit: 100,
          sortBy: { column: "updated_at", order: "desc" },
        });

      (data || []).forEach((item: any) => {
        allDocs.push({
          name: item.name,
          path: `${contractor.id}/${item.name}`,
          contractor_id: contractor.id,
          contractor_name: contractor.name,
          updated_at: item.updated_at,
          size: item.metadata?.size ?? item.size,
        });
      });
    }

    setDocuments(allDocs);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function createEvent() {
    if (!eventForm.name.trim()) {
      setMessage("Event name is required.");
      return;
    }

    setMessage("Creating event and checking address GPS location...");

    let geo = {
      latitude: null as number | null,
      longitude: null as number | null,
      formatted_address: null as string | null,
    };

    try {
      if (eventForm.address.trim()) {
        geo = await geocodeAddress(eventForm.address);
      }
    } catch (error: any) {
      setMessage(error?.message || "Could not geocode event address.");
      return;
    }

    const { error } = await supabase.from("events").insert({
      name: eventForm.name.trim(),
      client: eventForm.client.trim() || null,
      venue: eventForm.venue.trim() || null,
      address: geo.formatted_address || eventForm.address.trim() || null,
      start_date: eventForm.start_date || null,
      end_date: eventForm.end_date || null,
      status: eventForm.status || "Scheduled",
      notes: eventForm.notes.trim() || null,
      latitude: geo.latitude,
      longitude: geo.longitude,
      geofence_radius_feet: Number(eventForm.geofence_radius_feet || 750),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setEventForm({
      name: "",
      client: "",
      venue: "",
      address: "",
      start_date: "",
      end_date: "",
      status: "Scheduled",
      notes: "",
      geofence_radius_feet: "750",
    });

    setMessage("Event created with GPS location.");
    await loadAll();
  }

  async function saveEvent(row: EventItem) {
    if (!row.name?.trim()) {
      setMessage("Event name is required.");
      return;
    }

    setMessage("Saving event and checking address GPS location...");

    let geo = {
      latitude: row.latitude || null,
      longitude: row.longitude || null,
      formatted_address: row.address || null,
    };

    try {
      if (row.address?.trim()) {
        geo = await geocodeAddress(row.address);
      }
    } catch (error: any) {
      setMessage(error?.message || "Could not geocode event address.");
      return;
    }

    const { error } = await supabase
      .from("events")
      .update({
        name: row.name.trim(),
        client: row.client?.trim() || null,
        venue: row.venue?.trim() || null,
        address: geo.formatted_address || row.address?.trim() || null,
        start_date: row.start_date || null,
        end_date: row.end_date || null,
        status: row.status || "Scheduled",
        notes: row.notes?.trim() || null,
        latitude: geo.latitude,
        longitude: geo.longitude,
        geofence_radius_feet: row.geofence_radius_feet || 750,
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Event updated with GPS location.");
    await loadAll();
  }

  async function deleteEvent(id: number) {
    const ok = window.confirm("Delete this event?");
    if (!ok) return;

    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Event deleted.");
    await loadAll();
  }

  async function createContractor() {
    if (!contractorForm.name.trim() || !contractorForm.email.trim()) {
      setMessage("Contractor name and email are required.");
      return;
    }

    const { error } = await supabase.from("contractors").insert({
      name: contractorForm.name.trim(),
      role: contractorForm.role.trim() || "Contractor",
      phone: contractorForm.phone.trim() || null,
      email: contractorForm.email.trim(),
      rate: Number(contractorForm.rate || 0),
      rate_type: contractorForm.rate_type || "day",
      company: contractorForm.company.trim() || null,
      city: contractorForm.city.trim() || null,
      state: contractorForm.state.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setContractorForm({
      name: "",
      role: "Contractor",
      phone: "",
      email: "",
      rate: "",
      rate_type: "day",
      company: "",
      city: "",
      state: "",
    });

    setMessage("Contractor created.");
    await loadAll();
  }

  async function saveContractor(row: Contractor) {
    const { error } = await supabase
      .from("contractors")
      .update({
        name: row.name?.trim() || null,
        role: row.role?.trim() || null,
        phone: row.phone?.trim() || null,
        email: row.email?.trim() || null,
        rate: Number(row.rate || 0),
        rate_type: row.rate_type || "day",
        company: row.company?.trim() || null,
        city: row.city?.trim() || null,
        state: row.state?.trim() || null,
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Contractor updated.");
    await loadAll();
  }

  async function createAssignment() {
    if (
      !assignmentForm.event_id ||
      !assignmentForm.contractor_id ||
      !assignmentForm.position.trim()
    ) {
      setMessage("Event, contractor, and position are required.");
      return;
    }

    const { error } = await supabase.from("assignments").insert({
      event_id: Number(assignmentForm.event_id),
      contractor_id: Number(assignmentForm.contractor_id),
      position: assignmentForm.position.trim(),
      work_date: assignmentForm.work_date || null,
      call_time: assignmentForm.call_time || null,
      break_hours: 0,
      rate: Number(assignmentForm.rate || 0),
      rate_type: assignmentForm.rate_type || "day",
      confirmed: true,
      approved: false,
      paid: false,
      hours_approved: false,
      manager_approved_hours: null,
      manager_notes: null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setAssignmentForm({
      event_id: "",
      contractor_id: "",
      position: "",
      work_date: "",
      call_time: "",
      rate: "",
      rate_type: "day",
    });

    setMessage("Assignment created.");
    await loadAll();
  }

  async function updateAssignment(row: Assignment, updates: Partial<Assignment>) {
    const { error } = await supabase
      .from("assignments")
      .update(updates)
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Assignment updated.");
    await loadAll();
  }

  async function saveTimeCorrection(
    row: AssignmentRow,
    values: {
      clockIn: string;
      lunchOut: string;
      lunchIn: string;
      clockOut: string;
      reason: string;
    }
  ) {
    const reason = values.reason.trim();

    if (!reason) {
      setMessage("A correction reason is required before saving manual time changes.");
      return;
    }

    const correctionStamp = new Date().toISOString();
    const manualLocationNote = `Manual correction by ${email} at ${new Date().toLocaleString()} | GPS not verified`;

    const clockInChanged = (values.clockIn || null) !== (row.clock_in || null);
    const clockOutChanged = (values.clockOut || null) !== (row.clock_out || null);

    const { error } = await supabase
      .from("assignments")
      .update({
        clock_in: values.clockIn || null,
        lunch_clock_out: values.lunchOut || null,
        lunch_clock_in: values.lunchIn || null,
        clock_out: values.clockOut || null,
        clock_in_location: clockInChanged ? manualLocationNote : row.clock_in_location || null,
        clock_out_location: clockOutChanged ? manualLocationNote : row.clock_out_location || null,
        manual_time_correction: true,
        time_correction_reason: reason,
        time_corrected_by: email,
        time_corrected_at: correctionStamp,
        hours_approved: false,
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Manual time correction saved. Review and approve the updated hours before approving payroll.");
    await loadAll();
  }

  async function deleteAssignment(id: number) {
    const ok = window.confirm(
      "Delete this assignment? This will remove it from Schedule Board, Assignments, Payroll, Invoices, and the contractor portal."
    );

    if (!ok) return;

    const { error } = await supabase.from("assignments").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Assignment deleted.");
    await loadAll();
  }

  async function saveManagerReview(
    row: AssignmentRow,
    managerApprovedHours: string,
    managerNotes: string
  ) {
    const cleanHours =
      managerApprovedHours.trim() === ""
        ? null
        : Number(managerApprovedHours || 0);

    if (cleanHours !== null && (Number.isNaN(cleanHours) || cleanHours < 0)) {
      setMessage("Approved hours must be a valid number.");
      return;
    }

    const { error } = await supabase
      .from("assignments")
      .update({
        manager_approved_hours: cleanHours,
        manager_notes: managerNotes.trim() || null,
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Manager review saved.");
    await loadAll();
  }

  async function approveHours(row: AssignmentRow) {
    const approvedHours =
      row.manager_approved_hours !== null &&
      row.manager_approved_hours !== undefined
        ? Number(row.manager_approved_hours)
        : Number(row.trackedHours || 0);

    const { error } = await supabase
      .from("assignments")
      .update({
        manager_approved_hours: approvedHours,
        hours_approved: true,
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Hours approved.");
    await loadAll();
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

  const eventMap = useMemo(() => {
    const map: Record<number, EventItem> = {};
    events.forEach((event) => {
      map[event.id] = event;
    });
    return map;
  }, [events]);

  const contractorMap = useMemo(() => {
    const map: Record<number, Contractor> = {};
    contractors.forEach((contractor) => {
      map[contractor.id] = contractor;
    });
    return map;
  }, [contractors]);

  const assignmentRows: AssignmentRow[] = useMemo(() => {
    return assignments.map((row) => {
      const trackedHours = hoursBetween(
        row.clock_in,
        row.clock_out,
        row.lunch_clock_out,
        row.lunch_clock_in
      );

      const billedHours =
        row.manager_approved_hours !== null &&
        row.manager_approved_hours !== undefined
          ? Number(row.manager_approved_hours)
          : trackedHours;

      const total =
        row.rate_type === "hour"
          ? billedHours * Number(row.rate || 0)
          : Number(row.rate || 0);

      return {
        ...row,
        trackedHours,
        billedHours,
        total,
        event: eventMap[row.event_id],
        contractor: contractorMap[row.contractor_id],
      };
    });
  }, [assignments, eventMap, contractorMap]);

  const filteredEvents = events.filter((event) =>
    `${event.name} ${event.client || ""} ${event.venue || ""} ${
      event.address || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredContractors = contractors.filter((contractor) =>
    `${contractor.name} ${contractor.email || ""} ${contractor.role || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredAssignments = assignmentRows.filter((row) =>
    `${row.position || ""} ${row.contractor?.name || ""} ${
      row.event?.name || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalPayroll = assignmentRows.reduce((sum, row) => sum + row.total, 0);
  const approvedPayroll = assignmentRows
    .filter((row) => row.approved)
    .reduce((sum, row) => sum + row.total, 0);
  const unpaidCount = assignmentRows.filter(
    (row) => row.approved && !row.paid
  ).length;

  if (status !== "allowed") {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-3xl font-bold">Manager Portal</h1>
        <p className="mt-4 text-zinc-400">{status}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
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
              Manager Portal
            </h1>
            <p className="mt-2 text-zinc-400">Signed in as {email}</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search across manager portal..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-11 pr-4 text-sm outline-none focus:border-amber-400/40 md:w-80"
              />
            </div>

            <button
              onClick={signOut}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              <LogOut className="mr-2 inline h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                activeTab === tab
                  ? "bg-gradient-to-r from-amber-300 to-yellow-600 text-black shadow-[0_0_30px_rgba(245,158,11,0.25)]"
                  : "border border-white/10 bg-white/[0.05] text-white"
              }`}
            >
              {tab}
            </button>
          ))}

          <a
            href="/manager/requests"
            className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-200"
          >
            Open Position Requests
          </a>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        {loading ? (
          <GlassCard>
            <div className="text-zinc-300">Loading manager portal...</div>
          </GlassCard>
        ) : (
          <>
            {activeTab === "Overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    icon={<CalendarDays className="h-5 w-5" />}
                    label="Events"
                    value={String(events.length)}
                    sublabel="Total scheduled events"
                  />
                  <MetricCard
                    icon={<Users className="h-5 w-5" />}
                    label="Contractors"
                    value={String(contractors.length)}
                    sublabel="Active roster"
                  />
                  <MetricCard
                    icon={<ClipboardList className="h-5 w-5" />}
                    label="Assignments"
                    value={String(assignments.length)}
                    sublabel="Confirmed work"
                  />
                  <MetricCard
                    icon={<DollarSign className="h-5 w-5" />}
                    label="Payroll"
                    value={money(totalPayroll)}
                    sublabel="Total assignment value"
                  />
                </div>

                <GlassCard>
                  <SectionTitle
                    icon={<MapPin className="h-5 w-5" />}
                    title="GPS Clock-In Status"
                    subtitle="Events must have latitude and longitude for contractor geofence clock-in."
                  />

                  <div className="mt-5 space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="font-semibold">{event.name}</div>
                          <div className="text-sm text-zinc-400">
                            {event.address || "--"}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            Radius: {event.geofence_radius_feet || 750} ft
                          </div>
                        </div>

                        {event.latitude && event.longitude ? (
                          <span className="rounded-2xl border border-emerald-500/20 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300">
                            GPS Ready
                          </span>
                        ) : (
                          <span className="rounded-2xl border border-red-500/20 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300">
                            GPS Missing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Schedule Board" && (
              <GlassCard>
                <SectionTitle
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Schedule Board"
                  subtitle="Confirmed assignments by date"
                />

                <div className="mt-5 space-y-3">
                  {filteredAssignments.length ? (
                    filteredAssignments.map((row) => (
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
                              {row.contractor?.name || "Contractor"} ·{" "}
                              {row.event?.name || "Event"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {row.event?.venue || ""}{" "}
                              {row.event?.address ? `· ${row.event.address}` : ""}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {dateLabel(row.work_date)} · Call{" "}
                              {timeLabel(row.call_time)} · Clock{" "}
                              {timeLabel(row.clock_in)} -{" "}
                              {timeLabel(row.clock_out)}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 md:items-end">
                            <div className="text-left md:text-right">
                              <div className="font-semibold text-amber-300">
                                {dateLabel(row.work_date)} ·{" "}
                                {timeLabel(row.call_time)}
                              </div>
                              <div className="text-xs text-zinc-500">
                                Tracked {row.trackedHours.toFixed(2)} hrs ·
                                Approved {row.billedHours.toFixed(2)} hrs ·{" "}
                                {money(row.total)}
                              </div>
                            </div>

                            <button
                              onClick={() => deleteAssignment(row.id)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Assignment
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="No assignments yet." />
                  )}
                </div>
              </GlassCard>
            )}

            {activeTab === "Events" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_2.1fr]">
                <GlassCard>
                  <SectionTitle
                    icon={<Plus className="h-5 w-5" />}
                    title="Create Event"
                    subtitle="Address will automatically save GPS coordinates"
                  />

                  <div className="mt-5 space-y-3">
                    <Field
                      label="Event Name"
                      value={eventForm.name}
                      onChange={(v) => setEventForm({ ...eventForm, name: v })}
                    />
                    <Field
                      label="Client"
                      value={eventForm.client}
                      onChange={(v) => setEventForm({ ...eventForm, client: v })}
                    />
                    <Field
                      label="Venue"
                      value={eventForm.venue}
                      onChange={(v) => setEventForm({ ...eventForm, venue: v })}
                    />
                    <Field
                      label="Address"
                      value={eventForm.address}
                      onChange={(v) => setEventForm({ ...eventForm, address: v })}
                    />
                    <Field
                      label="Start Date"
                      type="date"
                      value={eventForm.start_date}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, start_date: v })
                      }
                    />
                    <Field
                      label="End Date"
                      type="date"
                      value={eventForm.end_date}
                      onChange={(v) => setEventForm({ ...eventForm, end_date: v })}
                    />
                    <SelectField
                      label="Status"
                      value={eventForm.status}
                      onChange={(v) => setEventForm({ ...eventForm, status: v })}
                      options={[
                        { value: "Scheduled", label: "Scheduled" },
                        { value: "Completed", label: "Completed" },
                        { value: "Cancelled", label: "Cancelled" },
                      ]}
                    />
                    <Field
                      label="Geofence Radius Feet"
                      type="number"
                      value={eventForm.geofence_radius_feet}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, geofence_radius_feet: v })
                      }
                    />
                    <TextAreaField
                      label="Notes"
                      value={eventForm.notes}
                      onChange={(v) => setEventForm({ ...eventForm, notes: v })}
                    />

                    <button
                      onClick={createEvent}
                      className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                    >
                      Create Event
                    </button>
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<CalendarDays className="h-5 w-5" />}
                    title="Events"
                    subtitle={`${filteredEvents.length} matching results`}
                  />

                  <div className="mt-5 space-y-4">
                    {filteredEvents.length ? (
                      filteredEvents.map((event) => (
                        <EditableEventCard
                          key={event.id}
                          event={event}
                          onSave={saveEvent}
                          onDelete={deleteEvent}
                        />
                      ))
                    ) : (
                      <EmptyState text="No events found." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Contractors" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_2.1fr]">
                <GlassCard>
                  <SectionTitle
                    icon={<Plus className="h-5 w-5" />}
                    title="Create Contractor"
                    subtitle="Add contractor profile"
                  />

                  <div className="mt-5 space-y-3">
                    <Field
                      label="Name"
                      value={contractorForm.name}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, name: v })
                      }
                    />
                    <Field
                      label="Role"
                      value={contractorForm.role}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, role: v })
                      }
                    />
                    <Field
                      label="Phone"
                      value={contractorForm.phone}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, phone: v })
                      }
                    />
                    <Field
                      label="Email"
                      value={contractorForm.email}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, email: v })
                      }
                    />
                    <Field
                      label="Rate"
                      type="number"
                      value={contractorForm.rate}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, rate: v })
                      }
                    />
                    <SelectField
                      label="Rate Type"
                      value={contractorForm.rate_type}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, rate_type: v })
                      }
                      options={[
                        { value: "day", label: "day" },
                        { value: "hour", label: "hour" },
                      ]}
                    />
                    <Field
                      label="Company"
                      value={contractorForm.company}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, company: v })
                      }
                    />
                    <Field
                      label="City"
                      value={contractorForm.city}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, city: v })
                      }
                    />
                    <Field
                      label="State"
                      value={contractorForm.state}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, state: v })
                      }
                    />

                    <button
                      onClick={createContractor}
                      className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                    >
                      Create Contractor
                    </button>
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<Users className="h-5 w-5" />}
                    title="Contractors"
                    subtitle={`${filteredContractors.length} matching results`}
                  />

                  <div className="mt-5 space-y-4">
                    {filteredContractors.length ? (
                      filteredContractors.map((contractor) => (
                        <EditableContractorCard
                          key={contractor.id}
                          contractor={contractor}
                          onSave={saveContractor}
                        />
                      ))
                    ) : (
                      <EmptyState text="No contractors found." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Assignments" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_2.1fr]">
                <GlassCard>
                  <SectionTitle
                    icon={<Plus className="h-5 w-5" />}
                    title="Create Assignment"
                    subtitle="Assign one contractor to one event"
                  />

                  <div className="mt-5 space-y-3">
                    <SelectField
                      label="Event"
                      value={assignmentForm.event_id}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, event_id: v })
                      }
                      options={events.map((e) => ({
                        value: String(e.id),
                        label: e.name,
                      }))}
                    />
                    <SelectField
                      label="Contractor"
                      value={assignmentForm.contractor_id}
                      onChange={(v) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          contractor_id: v,
                        })
                      }
                      options={contractors.map((c) => ({
                        value: String(c.id),
                        label: c.name,
                      }))}
                    />
                    <Field
                      label="Position"
                      value={assignmentForm.position}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, position: v })
                      }
                    />
                    <Field
                      label="Work Date"
                      type="date"
                      value={assignmentForm.work_date}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, work_date: v })
                      }
                    />
                    <Field
                      label="Call Time"
                      type="time"
                      value={assignmentForm.call_time}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, call_time: v })
                      }
                    />
                    <Field
                      label="Rate"
                      type="number"
                      value={assignmentForm.rate}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, rate: v })
                      }
                    />
                    <SelectField
                      label="Rate Type"
                      value={assignmentForm.rate_type}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, rate_type: v })
                      }
                      options={[
                        { value: "day", label: "day" },
                        { value: "hour", label: "hour" },
                      ]}
                    />

                    <button
                      onClick={createAssignment}
                      className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                    >
                      Create Assignment
                    </button>
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<ClipboardList className="h-5 w-5" />}
                    title="Assignments"
                    subtitle="Approve hours, approve invoice, mark paid, delete assignment, and review clock-in/out"
                  />

                  <div className="mt-5 space-y-3">
                    {filteredAssignments.length ? (
                      filteredAssignments.map((row) => (
                        <ManagerAssignmentCard
                          key={row.id}
                          row={row}
                          onSaveReview={saveManagerReview}
                          onApproveHours={approveHours}
                          onUpdateAssignment={updateAssignment}
                          onDeleteAssignment={deleteAssignment}
                          onSaveTimeCorrection={saveTimeCorrection}
                        />
                      ))
                    ) : (
                      <EmptyState text="No assignments yet." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Payroll" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard
                    icon={<DollarSign className="h-5 w-5" />}
                    label="Total Payroll"
                    value={money(totalPayroll)}
                    sublabel="All assignment value"
                  />
                  <MetricCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    label="Approved Payroll"
                    value={money(approvedPayroll)}
                    sublabel="Approved invoice items"
                  />
                  <MetricCard
                    icon={<ClipboardList className="h-5 w-5" />}
                    label="Unpaid Items"
                    value={String(unpaidCount)}
                    sublabel="Approved but not paid"
                  />
                </div>

                <GlassCard>
                  <SectionTitle
                    icon={<DollarSign className="h-5 w-5" />}
                    title="Payroll Review"
                    subtitle="Approve hours, approve invoices, mark paid, and delete assignments"
                  />

                  <div className="mt-5 space-y-3">
                    {filteredAssignments.length ? (
                      filteredAssignments.map((row) => (
                        <ManagerAssignmentCard
                          key={row.id}
                          row={row}
                          onSaveReview={saveManagerReview}
                          onApproveHours={approveHours}
                          onUpdateAssignment={updateAssignment}
                          onDeleteAssignment={deleteAssignment}
                          onSaveTimeCorrection={saveTimeCorrection}
                        />
                      ))
                    ) : (
                      <EmptyState text="No payroll items yet." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Invoices" && (
              <GlassCard>
                <SectionTitle
                  icon={<FileText className="h-5 w-5" />}
                  title="Invoices"
                  subtitle="Approve hours, approve invoices, mark paid, delete assignments, and adjust manager-approved hours"
                />

                <div className="mt-5 space-y-3">
                  {assignmentRows.length ? (
                    assignmentRows.map((row) => (
                      <ManagerAssignmentCard
                        key={row.id}
                        row={row}
                        onSaveReview={saveManagerReview}
                        onApproveHours={approveHours}
                        onUpdateAssignment={updateAssignment}
                        onDeleteAssignment={deleteAssignment}
                      />
                    ))
                  ) : (
                    <EmptyState text="No invoice records yet." />
                  )}
                </div>
              </GlassCard>
            )}

            {activeTab === "Documents" && (
              <div className="grid gap-6 xl:grid-cols-2">
                <GlassCard>
                  <SectionTitle
                    icon={<FolderOpen className="h-5 w-5" />}
                    title="Uploaded Contractor Documents"
                    subtitle={`${documents.length} files found`}
                  />

                  <div className="mt-5 space-y-3">
                    <button
                      onClick={loadAll}
                      className="mb-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                    >
                      <RefreshCw className="mr-2 inline h-4 w-4" />
                      Refresh Files
                    </button>

                    {documents.length ? (
                      documents.map((doc) => (
                        <div
                          key={doc.path}
                          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold">{doc.name}</div>
                            <div className="text-sm text-zinc-400">
                              {doc.contractor_name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              folder: {doc.contractor_id}
                              {doc.updated_at
                                ? ` · ${new Date(doc.updated_at).toLocaleString()}`
                                : ""}
                              {doc.size ? ` · ${fileSizeLabel(doc.size)}` : ""}
                            </div>
                          </div>

                          <button
                            onClick={() => openDocument(doc.path)}
                            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                          >
                            Open
                          </button>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="No contractor documents found." />
                    )}
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<CalendarDays className="h-5 w-5" />}
                    title="Availability Submissions"
                    subtitle={`${availability.length} rows found`}
                  />

                  <div className="mt-5 space-y-3">
                    {availability.length ? (
                      availability.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-white/10 bg-black/25 p-4"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold">
                                {contractorMap[item.contractor_id]?.name ||
                                  `Contractor #${item.contractor_id}`}
                              </div>
                              <div className="text-sm text-zinc-400">
                                {dateLabel(item.start_date)} -{" "}
                                {dateLabel(item.end_date)}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {item.availability_status}
                                {item.notes ? ` · ${item.notes}` : ""}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="No availability submissions yet." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function ManagerAssignmentCard({
  row,
  onSaveReview,
  onApproveHours,
  onUpdateAssignment,
  onDeleteAssignment,
  onSaveTimeCorrection,
}: {
  row: AssignmentRow;
  onSaveReview: (
    row: AssignmentRow,
    managerApprovedHours: string,
    managerNotes: string
  ) => void;
  onApproveHours: (row: AssignmentRow) => void;
  onUpdateAssignment: (row: AssignmentRow, updates: Partial<Assignment>) => void;
  onDeleteAssignment: (id: number) => void;
  onSaveTimeCorrection: (
    row: AssignmentRow,
    values: {
      clockIn: string;
      lunchOut: string;
      lunchIn: string;
      clockOut: string;
      reason: string;
    }
  ) => void;
}) {
  const [approvedHours, setApprovedHours] = useState(
    row.manager_approved_hours !== null &&
      row.manager_approved_hours !== undefined
      ? String(row.manager_approved_hours)
      : ""
  );
  const [notes, setNotes] = useState(row.manager_notes || "");
  const [clockIn, setClockIn] = useState(row.clock_in || "");
  const [lunchOut, setLunchOut] = useState(row.lunch_clock_out || "");
  const [lunchIn, setLunchIn] = useState(row.lunch_clock_in || "");
  const [clockOut, setClockOut] = useState(row.clock_out || "");
  const [correctionReason, setCorrectionReason] = useState(
    row.time_correction_reason || ""
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold">
            Invoice Record #{row.id} · {row.position || "Assignment"}
          </div>
          <div className="text-sm text-zinc-400">
            {row.contractor?.name || "Contractor"} · {row.event?.name || "Event"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {dateLabel(row.work_date)} · Call {timeLabel(row.call_time)} · Clock{" "}
            {timeLabel(row.clock_in)} - {timeLabel(row.clock_out)}
          </div>
          {row.manual_time_correction ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <AlertCircle className="h-3.5 w-3.5" />
              Manual time correction saved
            </div>
          ) : null}
        </div>

        <div className="text-left md:text-right">
          <div className="text-xl font-bold text-amber-300">
            {money(row.total)}
          </div>
          <div className="text-xs text-zinc-500">
            {money(Number(row.rate || 0))} / {row.rate_type || "day"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="Tracked Hours"
          value={row.trackedHours.toFixed(2)}
        />
        <MiniInfo
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Approved Hours"
          value={row.billedHours.toFixed(2)}
        />
        <MiniInfo
          icon={<DollarSign className="h-4 w-4" />}
          label="Invoice Total"
          value={money(row.total)}
        />
        <MiniInfo
          icon={<ClipboardList className="h-4 w-4" />}
          label="Status"
          value={`${row.hours_approved ? "Hours Approved" : "Hours Pending"} · ${
            row.approved ? "Invoice Approved" : "Invoice Pending"
          } · ${row.paid ? "Paid" : "Unpaid"}`}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Clock3 className="h-4 w-4 text-amber-300" />
          Time Correction / Audit
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Field label="Clock In" type="time" value={clockIn} onChange={setClockIn} />
          <Field label="Lunch Out" type="time" value={lunchOut} onChange={setLunchOut} />
          <Field label="Lunch In" type="time" value={lunchIn} onChange={setLunchIn} />
          <Field label="Clock Out" type="time" value={clockOut} onChange={setClockOut} />
        </div>
        <TextAreaField
          label="Correction Reason / Audit Notes"
          value={correctionReason}
          onChange={setCorrectionReason}
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <MiniInfo
            icon={<MapPin className="h-4 w-4" />}
            label="Clock In GPS / Audit"
            value={row.clock_in_location || "No GPS / not clocked in"}
          />
          <MiniInfo
            icon={<MapPin className="h-4 w-4" />}
            label="Clock Out GPS / Audit"
            value={row.clock_out_location || "No GPS / not clocked out"}
          />
        </div>
        {row.time_corrected_by || row.time_corrected_at ? (
          <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
            Last correction by {row.time_corrected_by || "manager"}
            {row.time_corrected_at
              ? ` on ${new Date(row.time_corrected_at).toLocaleString()}`
              : ""}
            {row.time_correction_reason ? ` · ${row.time_correction_reason}` : ""}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <Field
          label="Manager Approved Hours"
          type="number"
          value={approvedHours}
          onChange={setApprovedHours}
        />
        <TextAreaField
          label="Manager Notes"
          value={notes}
          onChange={setNotes}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() =>
            onSaveTimeCorrection(row, {
              clockIn,
              lunchOut,
              lunchIn,
              clockOut,
              reason: correctionReason,
            })
          }
          className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200"
        >
          <Clock3 className="h-4 w-4" />
          Save Time Correction
        </button>

        <button
          onClick={() => onSaveReview(row, approvedHours, notes)}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
        >
          <Save className="h-4 w-4" />
          Save Hours / Notes
        </button>

        <ToggleButton
          active={!!row.hours_approved}
          label={row.hours_approved ? "Hours Approved" : "Approve Hours"}
          onClick={() => onApproveHours(row)}
        />

        <ToggleButton
          active={!!row.approved}
          label={row.approved ? "Invoice Approved" : "Approve Invoice"}
          onClick={() => onUpdateAssignment(row, { approved: !row.approved })}
        />

        <ToggleButton
          active={!!row.paid}
          label={row.paid ? "Paid" : "Mark Paid"}
          onClick={() => onUpdateAssignment(row, { paid: !row.paid })}
        />

        <button
          onClick={() => onDeleteAssignment(row.id)}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300"
        >
          <Trash2 className="h-4 w-4" />
          Delete Assignment
        </button>
      </div>
    </div>
  );
}

function EditableEventCard({
  event,
  onSave,
  onDelete,
}: {
  event: EventItem;
  onSave: (event: EventItem) => void;
  onDelete: (id: number) => void;
}) {
  const [row, setRow] = useState<EventItem>(event);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold">{event.name}</div>
          <div className="text-sm text-zinc-400">
            {event.client || "--"} · {event.venue || "--"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {event.address || "--"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {event.latitude && event.longitude ? (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
              GPS Ready
            </span>
          ) : (
            <span className="rounded-full border border-red-500/20 bg-red-500/15 px-3 py-1 text-xs text-red-300">
              GPS Missing
            </span>
          )}
          <button
            onClick={() => onDelete(event.id)}
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="Start"
          value={dateLabel(event.start_date)}
        />
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="End"
          value={dateLabel(event.end_date)}
        />
        <MiniInfo
          icon={<MapPin className="h-4 w-4" />}
          label="GPS Radius"
          value={`${event.geofence_radius_feet || 750} ft`}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Name"
          value={row.name || ""}
          onChange={(v) => setRow({ ...row, name: v })}
        />
        <Field
          label="Client"
          value={row.client || ""}
          onChange={(v) => setRow({ ...row, client: v })}
        />
        <Field
          label="Venue"
          value={row.venue || ""}
          onChange={(v) => setRow({ ...row, venue: v })}
        />
        <Field
          label="Address"
          value={row.address || ""}
          onChange={(v) => setRow({ ...row, address: v })}
        />
        <Field
          label="Start Date"
          type="date"
          value={row.start_date || ""}
          onChange={(v) => setRow({ ...row, start_date: v })}
        />
        <Field
          label="End Date"
          type="date"
          value={row.end_date || ""}
          onChange={(v) => setRow({ ...row, end_date: v })}
        />
        <Field
          label="Geofence Radius Feet"
          type="number"
          value={String(row.geofence_radius_feet || 750)}
          onChange={(v) =>
            setRow({ ...row, geofence_radius_feet: Number(v || 750) })
          }
        />
        <SelectField
          label="Status"
          value={row.status || "Scheduled"}
          onChange={(v) => setRow({ ...row, status: v })}
          options={[
            { value: "Scheduled", label: "Scheduled" },
            { value: "Completed", label: "Completed" },
            { value: "Cancelled", label: "Cancelled" },
          ]}
        />
      </div>

      <button
        onClick={() => onSave(row)}
        className="mt-4 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
      >
        Save Event + Update GPS
      </button>
    </div>
  );
}

function EditableContractorCard({
  contractor,
  onSave,
}: {
  contractor: Contractor;
  onSave: (contractor: Contractor) => void;
}) {
  const [row, setRow] = useState<Contractor>(contractor);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
      <div className="mb-4">
        <div className="text-xl font-semibold">{contractor.name}</div>
        <div className="text-sm text-zinc-400">
          {contractor.email || "--"} · {contractor.role || "--"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Name"
          value={row.name || ""}
          onChange={(v) => setRow({ ...row, name: v })}
        />
        <Field
          label="Role"
          value={row.role || ""}
          onChange={(v) => setRow({ ...row, role: v })}
        />
        <Field
          label="Phone"
          value={row.phone || ""}
          onChange={(v) => setRow({ ...row, phone: v })}
        />
        <Field
          label="Email"
          value={row.email || ""}
          onChange={(v) => setRow({ ...row, email: v })}
        />
        <Field
          label="Rate"
          type="number"
          value={String(row.rate || "")}
          onChange={(v) => setRow({ ...row, rate: Number(v || 0) })}
        />
        <SelectField
          label="Rate Type"
          value={row.rate_type || "day"}
          onChange={(v) => setRow({ ...row, rate_type: v })}
          options={[
            { value: "day", label: "day" },
            { value: "hour", label: "hour" },
          ]}
        />
      </div>

      <button
        onClick={() => onSave(row)}
        className="mt-4 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
      >
        Save Contractor
      </button>
    </div>
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
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400/40"
      />
    </label>
  );
}

function TextAreaField({
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
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none focus:border-amber-400/40"
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
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

function ToggleButton({
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
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
        active
          ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-300"
          : "border-white/10 bg-white/[0.05] text-white"
      }`}
    >
      {label}
    </button>
  );
}
