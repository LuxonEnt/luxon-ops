"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Activity,
  BadgeDollarSign,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  DollarSign,
  FileText,
  Filter,
  FolderOpen,
  LogOut,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

type Contractor = {
  id: number;
  user_id?: string | null;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  skills?: string[] | null;
  rate?: number | null;
  rate_type?: string | null;
  status?: string | null;
};

type EventItem = {
  id: number;
  name: string;
  client?: string | null;
  venue?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  geofence_radius_feet?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  notes?: string | null;
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
  contractor_id: number;
  contractor_name: string;
  name: string;
  path: string;
  updated_at?: string;
};

type TabKey =
  | "overview"
  | "schedule"
  | "events"
  | "contractors"
  | "assignments"
  | "payroll"
  | "invoices"
  | "documents";

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
  return new Date(2026, 0, 1, h, m).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function hoursBetween(
  start?: string | null,
  end?: string | null,
  breakHours = 0
) {
  if (!start || !end) return 0;
  const [sh, sm] = String(start).slice(0, 5).split(":").map(Number);
  const [eh, em] = String(end).slice(0, 5).split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60;
  return Math.max(0, (endMins - startMins) / 60 - Number(breakHours || 0));
}

function parseDates(text: string) {
  return text
    .split(/[\n,]+/)
    .map((d) => d.trim())
    .filter(Boolean);
}

function eventTone(status?: string | null) {
  switch (status) {
    case "Completed":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
    case "In Progress":
      return "border-amber-400/20 bg-amber-500/10 text-amber-300";
    case "Cancelled":
      return "border-red-400/20 bg-red-500/10 text-red-300";
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-300";
  }
}

export default function ManagerPage() {
  const [status, setStatus] = useState("Checking access...");
  const [email, setEmail] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [payrollFilter, setPayrollFilter] = useState("all");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);
  const [documents, setDocuments] = useState<StoredDoc[]>([]);

  const [newEvent, setNewEvent] = useState({
    name: "",
    client: "",
    venue: "",
    address: "",
    start_date: "",
    end_date: "",
    status: "Scheduled",
    notes: "",
  });

  const [newContractor, setNewContractor] = useState({
    first_name: "",
    last_name: "",
    role: "",
    phone: "",
    email: "",
    company: "",
    city: "",
    state: "",
    rate: "",
    rate_type: "day",
    status: "Active",
  });

  const [newAssignment, setNewAssignment] = useState({
    event_id: "",
    contractor_id: "",
    position: "",
    work_date: "",
    call_time: "",
    rate: "",
    rate_type: "day",
  });

  const [bulkAssignment, setBulkAssignment] = useState({
    event_id: "",
    contractor_ids: [] as number[],
    position: "",
    dates_text: "",
    call_time: "",
    rate: "",
    rate_type: "day",
  });

  const [invoiceEventId, setInvoiceEventId] = useState("");
  const [invoiceContractorId, setInvoiceContractorId] = useState("");

  useEffect(() => {
    async function checkManagerAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        window.location.href = "/login";
        return;
      }

      const userEmail = session.user.email;
      setEmail(userEmail);

      const { data, error } = await supabase
        .from("admins")
        .select("email")
        .eq("email", userEmail)
        .maybeSingle();

      if (error || !data) {
        await supabase.auth.signOut();
        window.location.href = "/login";
        return;
      }

      setStatus("allowed");
    }

    checkManagerAccess();
  }, []);

  useEffect(() => {
    if (status === "allowed") loadData();
  }, [status]);

  async function loadData() {
    setLoadingData(true);
    setMessage("");

    const [
      { data: eventsData, error: eventsError },
      { data: contractorsData, error: contractorsError },
      { data: assignmentsData, error: assignmentsError },
      { data: availabilityData, error: availabilityError },
    ] = await Promise.all([
      supabase.from("events").select("*").order("start_date", { ascending: false }),
      supabase.from("contractors").select("*").order("name", { ascending: true }),
      supabase.from("assignments").select("*").order("work_date", { ascending: false }),
      supabase
        .from("contractor_availability")
        .select("*")
        .order("start_date", { ascending: false }),
    ]);

    if (eventsError || contractorsError || assignmentsError || availabilityError) {
      setMessage("Could not load manager data.");
      setLoadingData(false);
      return;
    }

    const nextEvents = eventsData || [];
    const nextContractors = contractorsData || [];
    const nextAssignments = assignmentsData || [];

    setEvents(nextEvents);
    setContractors(nextContractors);
    setAssignments(nextAssignments);
    setAvailability(availabilityData || []);

    if (!invoiceEventId && nextEvents[0]) {
      setInvoiceEventId(String(nextEvents[0].id));
    }
    if (!invoiceContractorId && nextContractors[0]) {
      setInvoiceContractorId(String(nextContractors[0].id));
    }

    await loadDocuments(nextContractors);
    setLoadingData(false);
  }

  async function loadDocuments(contractorRows: Contractor[]) {
    const allDocs: StoredDoc[] = [];

    for (const contractor of contractorRows) {
      const { data, error } = await supabase.storage
        .from("contractor-documents")
        .list(String(contractor.id), {
          limit: 100,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) continue;

      (data || []).forEach((item: any) => {
        allDocs.push({
          contractor_id: contractor.id,
          contractor_name: contractor.name,
          name: item.name,
          path: `${contractor.id}/${item.name}`,
          updated_at: item.updated_at,
        });
      });
    }

    setDocuments(allDocs);
  }

  async function openDocument(path: string) {
    const { data, error } = await supabase.storage
      .from("contractor-documents")
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      setMessage("Could not open document.");
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function addEvent() {
    if (!newEvent.name.trim()) {
      setMessage("Event name is required.");
      return;
    }

    const { error } = await supabase.from("events").insert({
      name: newEvent.name.trim(),
      client: newEvent.client.trim() || null,
      venue: newEvent.venue.trim() || null,
      address: newEvent.address.trim() || null,
      start_date: newEvent.start_date || null,
      end_date: newEvent.end_date || null,
      status: newEvent.status || "Scheduled",
      notes: newEvent.notes.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewEvent({
      name: "",
      client: "",
      venue: "",
      address: "",
      start_date: "",
      end_date: "",
      status: "Scheduled",
      notes: "",
    });

    setMessage("Event created.");
    loadData();
  }

  async function addContractor() {
    if (!newContractor.first_name.trim() || !newContractor.last_name.trim()) {
      setMessage("Contractor first and last name are required.");
      return;
    }

    const fullName =
      `${newContractor.first_name.trim()} ${newContractor.last_name.trim()}`.trim();

    const { error } = await supabase.from("contractors").insert({
      first_name: newContractor.first_name.trim(),
      last_name: newContractor.last_name.trim(),
      name: fullName,
      role: newContractor.role.trim() || null,
      phone: newContractor.phone.trim() || null,
      email: newContractor.email.trim() || null,
      company: newContractor.company.trim() || null,
      city: newContractor.city.trim() || null,
      state: newContractor.state.trim() || null,
      rate: Number(newContractor.rate || 0),
      rate_type: newContractor.rate_type,
      status: newContractor.status,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewContractor({
      first_name: "",
      last_name: "",
      role: "",
      phone: "",
      email: "",
      company: "",
      city: "",
      state: "",
      rate: "",
      rate_type: "day",
      status: "Active",
    });

    setMessage("Contractor created.");
    loadData();
  }

  async function addAssignment() {
    if (
      !newAssignment.event_id ||
      !newAssignment.contractor_id ||
      !newAssignment.position.trim()
    ) {
      setMessage("Event, contractor, and position are required.");
      return;
    }

    const { error } = await supabase.from("assignments").insert({
      event_id: Number(newAssignment.event_id),
      contractor_id: Number(newAssignment.contractor_id),
      position: newAssignment.position.trim(),
      work_date: newAssignment.work_date || null,
      call_time: newAssignment.call_time || null,
      break_hours: 1,
      rate: Number(newAssignment.rate || 0),
      rate_type: newAssignment.rate_type,
      confirmed: false,
      approved: false,
      paid: false,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewAssignment({
      event_id: "",
      contractor_id: "",
      position: "",
      work_date: "",
      call_time: "",
      rate: "",
      rate_type: "day",
    });

    setMessage("Assignment created.");
    loadData();
  }

  async function addBulkAssignments() {
    if (
      !bulkAssignment.event_id ||
      bulkAssignment.contractor_ids.length === 0 ||
      !bulkAssignment.position.trim()
    ) {
      setMessage("Event, at least one contractor, and position are required.");
      return;
    }

    const dates = parseDates(bulkAssignment.dates_text);
    if (!dates.length) {
      setMessage("Add at least one work date for bulk assignments.");
      return;
    }

    const rows = bulkAssignment.contractor_ids.flatMap((contractorId) =>
      dates.map((workDate) => ({
        event_id: Number(bulkAssignment.event_id),
        contractor_id: contractorId,
        position: bulkAssignment.position.trim(),
        work_date: workDate,
        call_time: bulkAssignment.call_time || null,
        break_hours: 1,
        rate: Number(bulkAssignment.rate || 0),
        rate_type: bulkAssignment.rate_type,
        confirmed: false,
        approved: false,
        paid: false,
      }))
    );

    const { error } = await supabase.from("assignments").insert(rows);

    if (error) {
      setMessage(error.message);
      return;
    }

    setBulkAssignment({
      event_id: "",
      contractor_ids: [],
      position: "",
      dates_text: "",
      call_time: "",
      rate: "",
      rate_type: "day",
    });

    setMessage("Bulk assignments created.");
    loadData();
  }

  async function updateEventField(
    id: number,
    field: keyof EventItem,
    value: string
  ) {
    const payload: any = { [field]: value || null };
    const { error } = await supabase.from("events").update(payload).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    loadData();
  }

  async function updateContractorField(
    contractor: Contractor,
    field: keyof Contractor,
    value: string
  ) {
    const nextFirst =
      field === "first_name" ? value : contractor.first_name || "";
    const nextLast = field === "last_name" ? value : contractor.last_name || "";
    const nextName =
      `${nextFirst || ""} ${nextLast || ""}`.trim() || contractor.name || "";

    const payload: any = { [field]: value || null };
    if (field === "rate") payload[field] = Number(value || 0);
    if (field === "first_name" || field === "last_name") payload.name = nextName;

    const { error } = await supabase
      .from("contractors")
      .update(payload)
      .eq("id", contractor.id);

    if (error) {
      setMessage(error.message);
      return;
    }
    loadData();
  }

  async function updateAssignmentField(
    id: number,
    field: keyof Assignment,
    value: string | boolean
  ) {
    const payload: any = { [field]: value };
    if (field === "rate") payload[field] = Number(value || 0);

    const { error } = await supabase
      .from("assignments")
      .update(payload)
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }
    loadData();
  }

  async function removeEvent(id: number) {
    const ok = window.confirm("Delete this event?");
    if (!ok) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    loadData();
  }

  async function removeContractor(id: number) {
    const ok = window.confirm("Delete this contractor?");
    if (!ok) return;
    const { error } = await supabase.from("contractors").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    loadData();
  }

  async function removeAssignment(id: number) {
    const ok = window.confirm("Delete this assignment?");
    if (!ok) return;
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    loadData();
  }

  const eventMap = useMemo(() => {
    const map: Record<number, EventItem> = {};
    events.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [events]);

  const contractorMap = useMemo(() => {
    const map: Record<number, Contractor> = {};
    contractors.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [contractors]);

  const payrollRows = useMemo(() => {
    return assignments.map((row) => {
      const hours = hoursBetween(row.clock_in, row.clock_out, row.break_hours || 0);
      const total =
        row.rate_type === "day"
          ? Number(row.rate || 0)
          : hours * Number(row.rate || 0);

      return {
        ...row,
        hours,
        total,
        event: eventMap[row.event_id],
        contractor: contractorMap[row.contractor_id],
      };
    });
  }, [assignments, eventMap, contractorMap]);

  const totalPayroll = payrollRows.reduce((sum, row) => sum + row.total, 0);
  const approvedPayroll = payrollRows
    .filter((row) => row.approved)
    .reduce((sum, row) => sum + row.total, 0);
  const unpaidCount = payrollRows.filter((row) => !row.paid).length;
  const approvedCount = payrollRows.filter((row) => row.approved).length;

  const upcomingEvents = [...events]
    .filter((event) => event.start_date)
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

  const recentAssignments = [...payrollRows].slice(0, 6);

  const scheduleBoard = useMemo(() => {
    const grouped: Record<string, typeof payrollRows> = {};
    [...payrollRows]
      .sort((a, b) => String(a.work_date || "").localeCompare(String(b.work_date || "")))
      .forEach((row) => {
        const key = row.work_date || "No Date";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      });
    return grouped;
  }, [payrollRows]);

  const filteredEvents = events.filter((event) =>
    `${event.name} ${event.client || ""} ${event.venue || ""} ${event.address || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredContractors = contractors.filter((contractor) =>
    `${contractor.name} ${contractor.email || ""} ${contractor.role || ""} ${
      contractor.company || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredAssignments = payrollRows.filter((row) => {
    const matchesSearch = `${row.contractor?.name || ""} ${row.event?.name || ""} ${
      row.position || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (assignmentFilter === "confirmed") return !!row.confirmed;
    if (assignmentFilter === "approved") return !!row.approved;
    if (assignmentFilter === "paid") return !!row.paid;
    if (assignmentFilter === "pending")
      return !row.confirmed || !row.approved || !row.paid;

    return true;
  });

  const filteredPayrollRows = payrollRows.filter((row) => {
    const matchesSearch = `${row.contractor?.name || ""} ${row.event?.name || ""} ${
      row.position || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (payrollFilter === "approved") return !!row.approved;
    if (payrollFilter === "unpaid") return !row.paid;
    if (payrollFilter === "paid") return !!row.paid;
    if (payrollFilter === "pending") return !row.approved;

    return true;
  });

  const filteredDocuments = documents.filter((doc) =>
    `${doc.contractor_name} ${doc.name}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAvailability = availability.filter((item) => {
    const contractorName = contractorMap[item.contractor_id]?.name || "";
    return `${contractorName} ${item.availability_status} ${item.notes || ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const invoiceRows = payrollRows.filter(
    (row) =>
      String(row.event_id) === invoiceEventId &&
      String(row.contractor_id) === invoiceContractorId &&
      !!row.approved
  );

  const invoiceContractor = contractorMap[Number(invoiceContractorId)];
  const invoiceEvent = eventMap[Number(invoiceEventId)];
  const invoiceTotal = invoiceRows.reduce((sum, row) => sum + row.total, 0);
  const invoiceHours = invoiceRows.reduce((sum, row) => sum + row.hours, 0);

  function printInvoice() {
    window.print();
  }

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

          <div className="flex items-center gap-3">
            <div className="relative w-full min-w-[260px] lg:w-80">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search across manager portal..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </div>

            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" />
          <TabButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} label="Schedule Board" />
          <TabButton active={activeTab === "events"} onClick={() => setActiveTab("events")} label="Events" />
          <TabButton active={activeTab === "contractors"} onClick={() => setActiveTab("contractors")} label="Contractors" />
          <TabButton active={activeTab === "assignments"} onClick={() => setActiveTab("assignments")} label="Assignments" />
          <TabButton active={activeTab === "payroll"} onClick={() => setActiveTab("payroll")} label="Payroll" />
          <TabButton active={activeTab === "invoices"} onClick={() => setActiveTab("invoices")} label="Invoices" />
          <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")} label="Documents" />
        </div>

        {loadingData ? (
          <GlassCard>
            <div className="text-zinc-300">Loading manager data...</div>
          </GlassCard>
        ) : null}

        {activeTab === "overview" && !loadingData && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<CalendarDays className="h-5 w-5" />} label="Events" value={String(events.length)} sublabel="Active schedule items" />
              <MetricCard icon={<Users className="h-5 w-5" />} label="Contractors" value={String(contractors.length)} sublabel="Rostered crew" />
              <MetricCard icon={<ClipboardList className="h-5 w-5" />} label="Assignments" value={String(assignments.length)} sublabel={`${approvedCount} approved records`} />
              <MetricCard icon={<DollarSign className="h-5 w-5" />} label="Payroll" value={money(totalPayroll)} sublabel={`${unpaidCount} unpaid items`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <GlassCard className="xl:col-span-2">
                <SectionTitle
                  icon={<Activity className="h-5 w-5" />}
                  title="Recent Assignments"
                  subtitle="Latest crew activity and pay visibility"
                />
                <div className="mt-5 space-y-3">
                  {recentAssignments.length ? (
                    recentAssignments.map((row) => (
                      <div key={row.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-semibold">{row.contractor?.name || "Contractor"}</div>
                            <div className="text-sm text-zinc-400">
                              {row.position || "Assignment"} · {row.event?.name || "Event"}
                            </div>
                          </div>
                          <div className="text-left md:text-right">
                            <div className="font-semibold text-amber-300">{money(row.total)}</div>
                            <div className="text-xs text-zinc-500">
                              {dateLabel(row.work_date)} · {row.hours.toFixed(2)} hrs
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="No recent assignments yet." />
                  )}
                </div>
              </GlassCard>

              <GlassCard>
                <SectionTitle
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Upcoming Events"
                  subtitle="Next jobs on deck"
                />
                <div className="mt-5 space-y-3">
                  {upcomingEvents.slice(0, 5).length ? (
                    upcomingEvents.slice(0, 5).map((event) => (
                      <div key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="font-semibold">{event.name}</div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] ${eventTone(event.status)}`}>
                            {event.status || "Scheduled"}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-400">
                          {event.client || "No client"} {event.venue ? `· ${event.venue}` : ""}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {dateLabel(event.start_date)} - {dateLabel(event.end_date)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="No upcoming events yet." />
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {activeTab === "schedule" && !loadingData && (
          <GlassCard>
            <SectionTitle
              icon={<ClipboardList className="h-5 w-5" />}
              title="Schedule Board"
              subtitle="Crew assignments grouped by work date"
            />

            <div className="mt-6 space-y-6">
              {Object.keys(scheduleBoard).length ? (
                Object.entries(scheduleBoard).map(([date, rows]) => (
                  <div key={date}>
                    <div className="mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-amber-300" />
                      <h3 className="text-lg font-semibold">
                        {date === "No Date" ? "No Date" : dateLabel(date)}
                      </h3>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400">
                        {rows.length} items
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {rows.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-2xl border border-white/10 bg-black/25 p-4"
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{row.position || "Assignment"}</div>
                              <div className="text-sm text-zinc-400">
                                {row.contractor?.name || "--"}
                              </div>
                            </div>
                            <StatusStack row={row} />
                          </div>

                          <div className="space-y-2 text-sm text-zinc-300">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-zinc-500" />
                              {timeLabel(row.call_time)}
                            </div>
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-zinc-500" />
                              {row.event?.name || "--"}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-zinc-500" />
                              {row.event?.venue || "--"}
                            </div>
                            <div className="flex items-center gap-2 font-medium text-amber-300">
                              <BadgeDollarSign className="h-4 w-4" />
                              {money(row.total)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No schedule items yet." />
              )}
            </div>
          </GlassCard>
        )}

        {activeTab === "events" && !loadingData && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <GlassCard>
              <SectionTitle icon={<Plus className="h-5 w-5" />} title="Create Event" subtitle="Add a new event to the schedule" />
              <div className="mt-5 space-y-3">
                <Field label="Event Name" value={newEvent.name} onChange={(v) => setNewEvent({ ...newEvent, name: v })} />
                <Field label="Client" value={newEvent.client} onChange={(v) => setNewEvent({ ...newEvent, client: v })} />
                <Field label="Venue" value={newEvent.venue} onChange={(v) => setNewEvent({ ...newEvent, venue: v })} />
                <Field label="Address" value={newEvent.address} onChange={(v) => setNewEvent({ ...newEvent, address: v })} />
                <Field label="Start Date" type="date" value={newEvent.start_date} onChange={(v) => setNewEvent({ ...newEvent, start_date: v })} />
                <Field label="End Date" type="date" value={newEvent.end_date} onChange={(v) => setNewEvent({ ...newEvent, end_date: v })} />
                <SelectField
                  label="Status"
                  value={newEvent.status}
                  onChange={(v) => setNewEvent({ ...newEvent, status: v })}
                  options={["Scheduled", "In Progress", "Completed", "Cancelled"]}
                />
                <TextAreaField label="Notes" value={newEvent.notes} onChange={(v) => setNewEvent({ ...newEvent, notes: v })} />
                <PrimaryButton onClick={addEvent}>Create Event</PrimaryButton>
              </div>
            </GlassCard>

            <GlassCard>
              <SectionTitle icon={<CalendarDays className="h-5 w-5" />} title="Events" subtitle={`${filteredEvents.length} matching results`} />
              <div className="mt-5 space-y-4">
                {filteredEvents.length ? (
                  filteredEvents.map((event) => (
                    <EntityCard
                      key={event.id}
                      title={event.name}
                      subtitle={`${event.client || "No client"}${event.venue ? ` · ${event.venue}` : ""}`}
                      onDelete={() => removeEvent(event.id)}
                      rightBadge={
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] ${eventTone(event.status)}`}>
                          {event.status || "Scheduled"}
                        </span>
                      }
                    >
                      <div className="mb-4 grid gap-3 md:grid-cols-3">
                        <MiniInfo icon={<CalendarDays className="h-4 w-4" />} label="Start" value={dateLabel(event.start_date)} />
                        <MiniInfo icon={<CalendarDays className="h-4 w-4" />} label="End" value={dateLabel(event.end_date)} />
                        <MiniInfo icon={<MapPin className="h-4 w-4" />} label="Venue" value={event.venue || "--"} />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Name" value={event.name || ""} onChange={(v) => updateEventField(event.id, "name", v)} />
                        <Field label="Client" value={event.client || ""} onChange={(v) => updateEventField(event.id, "client", v)} />
                        <Field label="Venue" value={event.venue || ""} onChange={(v) => updateEventField(event.id, "venue", v)} />
                        <Field label="Address" value={event.address || ""} onChange={(v) => updateEventField(event.id, "address", v)} />
                        <Field label="Start Date" type="date" value={event.start_date || ""} onChange={(v) => updateEventField(event.id, "start_date", v)} />
                        <Field label="End Date" type="date" value={event.end_date || ""} onChange={(v) => updateEventField(event.id, "end_date", v)} />
                      </div>
                    </EntityCard>
                  ))
                ) : (
                  <EmptyState text="No events found." />
                )}
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "contractors" && !loadingData && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <GlassCard>
              <SectionTitle icon={<UserPlus className="h-5 w-5" />} title="Create Contractor" subtitle="Add someone to the roster" />
              <div className="mt-5 space-y-3">
                <Field label="First Name" value={newContractor.first_name} onChange={(v) => setNewContractor({ ...newContractor, first_name: v })} />
                <Field label="Last Name" value={newContractor.last_name} onChange={(v) => setNewContractor({ ...newContractor, last_name: v })} />
                <Field label="Role" value={newContractor.role} onChange={(v) => setNewContractor({ ...newContractor, role: v })} />
                <Field label="Phone" value={newContractor.phone} onChange={(v) => setNewContractor({ ...newContractor, phone: v })} />
                <Field label="Email" value={newContractor.email} onChange={(v) => setNewContractor({ ...newContractor, email: v })} />
                <Field label="Company" value={newContractor.company} onChange={(v) => setNewContractor({ ...newContractor, company: v })} />
                <Field label="City" value={newContractor.city} onChange={(v) => setNewContractor({ ...newContractor, city: v })} />
                <Field label="State" value={newContractor.state} onChange={(v) => setNewContractor({ ...newContractor, state: v })} />
                <Field label="Rate" type="number" value={newContractor.rate} onChange={(v) => setNewContractor({ ...newContractor, rate: v })} />
                <SelectField
                  label="Rate Type"
                  value={newContractor.rate_type}
                  onChange={(v) => setNewContractor({ ...newContractor, rate_type: v })}
                  options={["day", "hour"]}
                />
                <SelectField
                  label="Status"
                  value={newContractor.status}
                  onChange={(v) => setNewContractor({ ...newContractor, status: v })}
                  options={["Active", "Inactive"]}
                />
                <PrimaryButton onClick={addContractor}>Create Contractor</PrimaryButton>
              </div>
            </GlassCard>

            <GlassCard>
              <SectionTitle icon={<Users className="h-5 w-5" />} title="Contractors" subtitle={`${filteredContractors.length} matching results`} />
              <div className="mt-5 space-y-4">
                {filteredContractors.length ? (
                  filteredContractors.map((contractor) => (
                    <EntityCard
                      key={contractor.id}
                      title={contractor.name}
                      subtitle={`${contractor.email || "No email"}${contractor.role ? ` · ${contractor.role}` : ""}`}
                      onDelete={() => removeContractor(contractor.id)}
                      rightBadge={
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300">
                          {contractor.status || "Active"}
                        </span>
                      }
                    >
                      <div className="mb-4 grid gap-3 md:grid-cols-4">
                        <MiniInfo icon={<Briefcase className="h-4 w-4" />} label="Role" value={contractor.role || "--"} />
                        <MiniInfo icon={<BadgeDollarSign className="h-4 w-4" />} label="Rate" value={`${money(Number(contractor.rate || 0))} / ${contractor.rate_type || "day"}`} />
                        <MiniInfo icon={<Building2 className="h-4 w-4" />} label="Company" value={contractor.company || "--"} />
                        <MiniInfo icon={<Users className="h-4 w-4" />} label="Status" value={contractor.status || "Active"} />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="First Name" value={contractor.first_name || ""} onChange={(v) => updateContractorField(contractor, "first_name", v)} />
                        <Field label="Last Name" value={contractor.last_name || ""} onChange={(v) => updateContractorField(contractor, "last_name", v)} />
                        <Field label="Role" value={contractor.role || ""} onChange={(v) => updateContractorField(contractor, "role", v)} />
                        <Field label="Phone" value={contractor.phone || ""} onChange={(v) => updateContractorField(contractor, "phone", v)} />
                        <Field label="Email" value={contractor.email || ""} onChange={(v) => updateContractorField(contractor, "email", v)} />
                        <Field label="Rate" type="number" value={String(contractor.rate || 0)} onChange={(v) => updateContractorField(contractor, "rate", v)} />
                      </div>
                    </EntityCard>
                  ))
                ) : (
                  <EmptyState text="No contractors found." />
                )}
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "assignments" && !loadingData && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <GlassCard>
                <SectionTitle icon={<Plus className="h-5 w-5" />} title="Create Assignment" subtitle="Assign one contractor to one event" />
                <div className="mt-5 space-y-3">
                  <SelectField
                    label="Event"
                    value={newAssignment.event_id}
                    onChange={(v) => setNewAssignment({ ...newAssignment, event_id: v })}
                    options={events.map((e) => ({ value: String(e.id), label: e.name }))}
                  />
                  <SelectField
                    label="Contractor"
                    value={newAssignment.contractor_id}
                    onChange={(v) => setNewAssignment({ ...newAssignment, contractor_id: v })}
                    options={contractors.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                    }))}
                  />
                  <Field label="Position" value={newAssignment.position} onChange={(v) => setNewAssignment({ ...newAssignment, position: v })} />
                  <Field label="Work Date" type="date" value={newAssignment.work_date} onChange={(v) => setNewAssignment({ ...newAssignment, work_date: v })} />
                  <Field label="Call Time" type="time" value={newAssignment.call_time} onChange={(v) => setNewAssignment({ ...newAssignment, call_time: v })} />
                  <Field label="Rate" type="number" value={newAssignment.rate} onChange={(v) => setNewAssignment({ ...newAssignment, rate: v })} />
                  <SelectField
                    label="Rate Type"
                    value={newAssignment.rate_type}
                    onChange={(v) => setNewAssignment({ ...newAssignment, rate_type: v })}
                    options={["day", "hour"]}
                  />
                  <PrimaryButton onClick={addAssignment}>Create Assignment</PrimaryButton>
                </div>
              </GlassCard>

              <GlassCard>
                <SectionTitle icon={<ClipboardList className="h-5 w-5" />} title="Bulk Assignments" subtitle="Assign multiple contractors across multiple dates" />
                <div className="mt-5 space-y-3">
                  <SelectField
                    label="Event"
                    value={bulkAssignment.event_id}
                    onChange={(v) => setBulkAssignment({ ...bulkAssignment, event_id: v })}
                    options={events.map((e) => ({ value: String(e.id), label: e.name }))}
                  />

                  <label className="block">
                    <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
                      Contractors
                    </span>
                    <div className="max-h-44 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3">
                      {contractors.length ? (
                        contractors.map((contractor) => {
                          const checked = bulkAssignment.contractor_ids.includes(contractor.id);
                          return (
                            <label
                              key={contractor.id}
                              className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/[0.04]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...bulkAssignment.contractor_ids, contractor.id]
                                    : bulkAssignment.contractor_ids.filter((id) => id !== contractor.id);
                                  setBulkAssignment({
                                    ...bulkAssignment,
                                    contractor_ids: next,
                                  });
                                }}
                              />
                              <span className="text-sm">
                                {contractor.name}
                                {contractor.role ? ` · ${contractor.role}` : ""}
                              </span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-sm text-zinc-400">No contractors available.</div>
                      )}
                    </div>
                  </label>

                  <Field label="Position" value={bulkAssignment.position} onChange={(v) => setBulkAssignment({ ...bulkAssignment, position: v })} />
                  <TextAreaField
                    label="Dates (one per line or comma separated)"
                    value={bulkAssignment.dates_text}
                    onChange={(v) => setBulkAssignment({ ...bulkAssignment, dates_text: v })}
                  />
                  <Field label="Call Time" type="time" value={bulkAssignment.call_time} onChange={(v) => setBulkAssignment({ ...bulkAssignment, call_time: v })} />
                  <Field label="Rate" type="number" value={bulkAssignment.rate} onChange={(v) => setBulkAssignment({ ...bulkAssignment, rate: v })} />
                  <SelectField
                    label="Rate Type"
                    value={bulkAssignment.rate_type}
                    onChange={(v) => setBulkAssignment({ ...bulkAssignment, rate_type: v })}
                    options={["day", "hour"]}
                  />
                  <PrimaryButton onClick={addBulkAssignments}>Create Bulk Assignments</PrimaryButton>
                </div>
              </GlassCard>
            </div>

            <GlassCard>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <SectionTitle icon={<Filter className="h-5 w-5" />} title="Assignments" subtitle={`${filteredAssignments.length} matching results`} />
                <div className="w-full md:w-56">
                  <SimpleSelect
                    label="Filter"
                    value={assignmentFilter}
                    onChange={setAssignmentFilter}
                    options={[
                      { value: "all", label: "All" },
                      { value: "pending", label: "Pending" },
                      { value: "confirmed", label: "Confirmed" },
                      { value: "approved", label: "Approved" },
                      { value: "paid", label: "Paid" },
                    ]}
                  />
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {filteredAssignments.length ? (
                  filteredAssignments.map((row) => (
                    <EntityCard
                      key={row.id}
                      title={row.position || "Assignment"}
                      subtitle={`${row.contractor?.name || "Contractor"} · ${row.event?.name || "Event"}`}
                      onDelete={() => removeAssignment(row.id)}
                      rightBadge={<StatusStack row={row} />}
                    >
                      <div className="mb-4 grid gap-3 md:grid-cols-4">
                        <MiniInfo icon={<CalendarDays className="h-4 w-4" />} label="Work Date" value={dateLabel(row.work_date)} />
                        <MiniInfo icon={<Clock3 className="h-4 w-4" />} label="Call Time" value={timeLabel(row.call_time)} />
                        <MiniInfo icon={<Briefcase className="h-4 w-4" />} label="Contractor" value={row.contractor?.name || "--"} />
                        <MiniInfo icon={<BadgeDollarSign className="h-4 w-4" />} label="Rate" value={`${money(Number(row.rate || 0))} / ${row.rate_type || "day"}`} />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Position" value={row.position || ""} onChange={(v) => updateAssignmentField(row.id, "position", v)} />
                        <Field label="Work Date" type="date" value={row.work_date || ""} onChange={(v) => updateAssignmentField(row.id, "work_date", v)} />
                        <Field label="Call Time" type="time" value={String(row.call_time || "").slice(0, 5)} onChange={(v) => updateAssignmentField(row.id, "call_time", v)} />
                        <Field label="Rate" type="number" value={String(row.rate || 0)} onChange={(v) => updateAssignmentField(row.id, "rate", v)} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <ToggleButton active={!!row.confirmed} label="Confirmed" onClick={() => updateAssignmentField(row.id, "confirmed", !row.confirmed)} />
                        <ToggleButton active={!!row.approved} label="Approved" onClick={() => updateAssignmentField(row.id, "approved", !row.approved)} />
                        <ToggleButton active={!!row.paid} label="Paid" onClick={() => updateAssignmentField(row.id, "paid", !row.paid)} />
                      </div>
                    </EntityCard>
                  ))
                ) : (
                  <EmptyState text="No assignments found." />
                )}
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "payroll" && !loadingData && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard icon={<DollarSign className="h-5 w-5" />} label="Total Payroll" value={money(totalPayroll)} sublabel="All assignment totals" />
              <MetricCard icon={<CheckCircle2 className="h-5 w-5" />} label="Approved Payroll" value={money(approvedPayroll)} sublabel="Approved only" />
              <MetricCard icon={<ClipboardList className="h-5 w-5" />} label="Unpaid Items" value={String(unpaidCount)} sublabel="Assignments not marked paid" />
            </div>

            <GlassCard>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <SectionTitle icon={<DollarSign className="h-5 w-5" />} title="Payroll Review" subtitle={`${filteredPayrollRows.length} matching results`} />
                <div className="w-full md:w-56">
                  <SimpleSelect
                    label="Filter"
                    value={payrollFilter}
                    onChange={setPayrollFilter}
                    options={[
                      { value: "all", label: "All" },
                      { value: "pending", label: "Pending Approval" },
                      { value: "approved", label: "Approved" },
                      { value: "unpaid", label: "Unpaid" },
                      { value: "paid", label: "Paid" },
                    ]}
                  />
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-500">
                      <th className="pb-3 pr-4 font-medium">Contractor</th>
                      <th className="pb-3 pr-4 font-medium">Event</th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 pr-4 font-medium">Hours</th>
                      <th className="pb-3 pr-4 font-medium">Rate</th>
                      <th className="pb-3 pr-4 font-medium">Total</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayrollRows.length ? (
                      filteredPayrollRows.map((row) => (
                        <tr key={row.id} className="border-b border-white/5">
                          <td className="py-4 pr-4">
                            <div className="font-medium text-white">
                              {row.contractor?.name || "--"}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {row.position || "Assignment"}
                            </div>
                          </td>
                          <td className="py-4 pr-4">{row.event?.name || "--"}</td>
                          <td className="py-4 pr-4">{dateLabel(row.work_date)}</td>
                          <td className="py-4 pr-4">{row.hours.toFixed(2)}</td>
                          <td className="py-4 pr-4">
                            {money(Number(row.rate || 0))} / {row.rate_type || "day"}
                          </td>
                          <td className="py-4 pr-4 font-semibold text-amber-300">
                            {money(row.total)}
                          </td>
                          <td className="py-4 pr-4">
                            <StatusStack row={row} />
                          </td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2">
                              <ToggleButton active={!!row.confirmed} label="Confirmed" onClick={() => updateAssignmentField(row.id, "confirmed", !row.confirmed)} />
                              <ToggleButton active={!!row.approved} label="Approved" onClick={() => updateAssignmentField(row.id, "approved", !row.approved)} />
                              <ToggleButton active={!!row.paid} label="Paid" onClick={() => updateAssignmentField(row.id, "paid", !row.paid)} />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-zinc-400">
                          No payroll items found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "invoices" && !loadingData && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <GlassCard>
              <SectionTitle icon={<FileText className="h-5 w-5" />} title="Invoice Builder" subtitle="Build contractor invoice from approved assignments" />
              <div className="mt-5 space-y-3">
                <SelectField
                  label="Event"
                  value={invoiceEventId}
                  onChange={setInvoiceEventId}
                  options={events.map((e) => ({ value: String(e.id), label: e.name }))}
                />
                <SelectField
                  label="Contractor"
                  value={invoiceContractorId}
                  onChange={setInvoiceContractorId}
                  options={contractors.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  }))}
                />
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Invoice Total
                  </div>
                  <div className="mt-2 text-3xl font-bold text-amber-300">
                    {money(invoiceTotal)}
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    {invoiceRows.length} approved lines · {invoiceHours.toFixed(2)} hours
                  </div>
                </div>
                <PrimaryButton onClick={printInvoice}>Print Invoice</PrimaryButton>
              </div>
            </GlassCard>

            <GlassCard className="print-area">
              <SectionTitle icon={<FileText className="h-5 w-5" />} title="Invoice Preview" subtitle="Approved items only" />

              <div id="manager-invoice-print" className="mt-6 rounded-3xl border border-white/10 bg-white p-10 text-slate-900">
                <div className="mb-8 flex items-start justify-between border-b border-slate-200 pb-6">
                  <div>
                    <div className="text-2xl font-bold">Luxon Entertainment LLC</div>
                    <div className="text-slate-500">Contractor Invoice</div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold">INVOICE</div>
                    <div className="mt-2 text-slate-500">
                      Date: {new Date().toLocaleDateString("en-US")}
                    </div>
                  </div>
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Contractor
                    </div>
                    <div className="mt-2 text-lg font-bold">
                      {invoiceContractor?.name || "Select contractor"}
                    </div>
                    <div>{invoiceContractor?.email || ""}</div>
                    <div>{invoiceContractor?.phone || ""}</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Event
                    </div>
                    <div className="mt-2 text-lg font-bold">
                      {invoiceEvent?.name || "Select event"}
                    </div>
                    <div>{invoiceEvent?.client || ""}</div>
                    <div>{invoiceEvent?.venue || ""}</div>
                    <div>{invoiceEvent?.address || ""}</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-100">
                        <th className="p-3">Date</th>
                        <th className="p-3">Position</th>
                        <th className="p-3">Hours</th>
                        <th className="p-3">Rate</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceRows.length ? (
                        invoiceRows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-200">
                            <td className="p-3">{dateLabel(row.work_date)}</td>
                            <td className="p-3">{row.position || "Assignment"}</td>
                            <td className="p-3">{row.hours.toFixed(2)}</td>
                            <td className="p-3">
                              {money(Number(row.rate || 0))} / {row.rate_type || "day"}
                            </td>
                            <td className="p-3 text-right font-semibold">
                              {money(row.total)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="p-3" colSpan={5}>
                            No approved invoice rows for this selection.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-end">
                  <div className="w-full max-w-sm rounded-2xl bg-slate-100 p-5">
                    <div className="mb-2 flex justify-between">
                      <span>Approved Hours</span>
                      <span>{invoiceHours.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-3 text-xl font-bold">
                      <span>Total Due</span>
                      <span>{money(invoiceTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "documents" && !loadingData && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <GlassCard>
                <SectionTitle
                  icon={<FolderOpen className="h-5 w-5" />}
                  title="Uploaded Contractor Documents"
                  subtitle={`${filteredDocuments.length} matching files`}
                />

                <div className="mt-5 space-y-3">
                  {filteredDocuments.length ? (
                    filteredDocuments.map((doc) => (
                      <div
                        key={doc.path}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 p-4"
                      >
                        <div>
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-sm text-zinc-400">
                            {doc.contractor_name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {doc.updated_at
                              ? new Date(doc.updated_at).toLocaleString()
                              : ""}
                          </div>
                        </div>

                        <button
                          onClick={() => openDocument(doc.path)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                        >
                          <Upload className="h-4 w-4" />
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
                  subtitle={`${filteredAvailability.length} matching rows`}
                />

                <div className="mt-5 space-y-3">
                  {filteredAvailability.length ? (
                    filteredAvailability.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-white/10 bg-black/25 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {contractorMap[row.contractor_id]?.name || "Contractor"}
                            </div>
                            <div className="text-sm text-zinc-400">
                              {dateLabel(row.start_date)} - {dateLabel(row.end_date)}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {row.notes || "No notes"}
                            </div>
                          </div>

                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
                            {row.availability_status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="No availability submissions found." />
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #manager-invoice-print,
          #manager-invoice-print * {
            visibility: visible !important;
          }
          #manager-invoice-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          @page {
            size: letter;
            margin: 0.5in;
          }
        }
      `}</style>
    </main>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl ${className}`}
    >
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

function EntityCard({
  title,
  subtitle,
  children,
  onDelete,
  rightBadge,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onDelete: () => void;
  rightBadge?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">{title}</div>
          <div className="text-sm text-zinc-400">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          {rightBadge}
          <button
            onClick={onDelete}
            className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300 transition hover:bg-red-400/20"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
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

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-5 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-amber-400 text-black shadow-lg shadow-amber-500/20"
          : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]"
      }`}
    >
      {label}
    </button>
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
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400/40"
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
        className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400/40"
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
  options: Array<string | { value: string; label: string }>;
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
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function SimpleSelect({
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

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black transition hover:scale-[1.01]"
    >
      {children}
    </button>
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
      className={`rounded-2xl border px-4 py-2 text-sm transition ${
        active
          ? "border-emerald-400/20 bg-emerald-500/20 text-emerald-300"
          : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]"
      }`}
    >
      {label}
    </button>
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

function StatusStack({
  row,
}: {
  row: { confirmed?: boolean | null; approved?: boolean | null; paid?: boolean | null };
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusPill active={!!row.confirmed} text="Confirmed" />
      <StatusPill active={!!row.approved} text="Approved" />
      <StatusPill active={!!row.paid} text="Paid" />
    </div>
  );
}
