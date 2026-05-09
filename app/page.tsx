"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  CalendarDays,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Users,
  Send,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  RadioTower,
  ShieldCheck,
  Navigation,
  Sparkles,
  Phone,
  Mail,
  Download,
  ClipboardCheck,
  UserPlus,
  Building2,
  Trash2,
  Pencil,
  Save,
  X,
  Crosshair,
} from "lucide-react";

type Contractor = {
  id: number;
  name: string;
  role: string;
  phone: string;
  email: string;
  rate: number;
  rateType: "day" | "hour";
  status: string;
};

type EventItem = {
  id: number;
  name: string;
  client: string;
  venue: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadiusFeet: number;
  startDate: string;
  endDate: string;
  status: string;
  notes: string;
};

type Assignment = {
  id: number;
  eventId: number;
  contractorId: number;
  position: string;
  workDate: string;
  callTime: string;
  clockIn: string;
  clockOut: string;
  clockInLocation: string;
  clockOutLocation: string;
  breakHours: number;
  rate: number;
  rateType: "day" | "hour";
  confirmed: boolean;
  approved: boolean;
  paid: boolean;
};

function contractorFromDb(row: any): Contractor {
  return {
    id: row.id,
    name: row.name || "",
    role: row.role || "",
    phone: row.phone || "",
    email: row.email || "",
    rate: Number(row.rate || 0),
    rateType: row.rate_type || "day",
    status: row.status || "Active",
  };
}

function eventFromDb(row: any): EventItem {
  return {
    id: row.id,
    name: row.name || "",
    client: row.client || "",
    venue: row.venue || "",
    address: row.address || "",
    latitude: row.latitude || "",
    longitude: row.longitude || "",
    geofenceRadiusFeet: Number(row.geofence_radius_feet || 750),
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status: row.status || "Scheduled",
    notes: row.notes || "",
  };
}

function assignmentFromDb(row: any): Assignment {
  return {
    id: row.id,
    eventId: row.event_id,
    contractorId: row.contractor_id,
    position: row.position || "",
    workDate: row.work_date || "",
    callTime: row.call_time ? String(row.call_time).slice(0, 5) : "",
    clockIn: row.clock_in ? String(row.clock_in).slice(0, 5) : "",
    clockOut: row.clock_out ? String(row.clock_out).slice(0, 5) : "",
    clockInLocation: row.clock_in_location || "",
    clockOutLocation: row.clock_out_location || "",
    breakHours: Number(row.break_hours || 0),
    rate: Number(row.rate || 0),
    rateType: row.rate_type || "day",
    confirmed: Boolean(row.confirmed),
    approved: Boolean(row.approved),
    paid: Boolean(row.paid),
  };
}

function contractorToDb(contractor: Partial<Contractor>) {
  return {
    name: contractor.name,
    role: contractor.role,
    phone: contractor.phone,
    email: contractor.email,
    rate: contractor.rate,
    rate_type: contractor.rateType,
    status: contractor.status,
  };
}

function eventToDb(event: Partial<EventItem>) {
  return {
    name: event.name,
    client: event.client,
    venue: event.venue,
    address: event.address,
    latitude: event.latitude,
    longitude: event.longitude,
    geofence_radius_feet: event.geofenceRadiusFeet,
    start_date: event.startDate || null,
    end_date: event.endDate || null,
    status: event.status,
    notes: event.notes,
  };
}

function assignmentToDb(assignment: Partial<Assignment>) {
  return {
    event_id: assignment.eventId,
    contractor_id: assignment.contractorId,
    position: assignment.position,
    work_date: assignment.workDate || null,
    call_time: assignment.callTime || null,
    clock_in: assignment.clockIn || null,
    clock_out: assignment.clockOut || null,
    clock_in_location: assignment.clockInLocation,
    clock_out_location: assignment.clockOutLocation,
    break_hours: assignment.breakHours,
    rate: assignment.rate,
    rate_type: assignment.rateType,
    confirmed: assignment.confirmed,
    approved: assignment.approved,
    paid: assignment.paid,
  };
}

function hoursBetween(start: string, end: string, breakHours = 0) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60;
  return Math.max(0, (endMins - startMins) / 60 - Number(breakHours || 0));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function dateLabel(value: string) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeLabel(value: string) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  return new Date(2026, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function nowTimeInput() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function distanceFeet(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusFeet = 20902231;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusFeet * c;
}

export default function LuxonOpsDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number>(0);
  const [selectedInvoiceContractorId, setSelectedInvoiceContractorId] = useState<number>(0);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingContractorId, setEditingContractorId] = useState<number | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [newContractor, setNewContractor] = useState({ name: "", role: "", phone: "", email: "", rate: "", rateType: "day" as "day" | "hour" });
  const [newEvent, setNewEvent] = useState({ name: "", client: "", venue: "", address: "", latitude: "", longitude: "", geofenceRadiusFeet: "750", startDate: "", endDate: "", notes: "" });
  const [newAssignment, setNewAssignment] = useState({ eventId: 0, contractorId: 0, position: "", workDate: "", workDates: "", callTime: "09:00", rate: "", rateType: "day" as "day" | "hour" });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: contractorData, error: contractorError } = await supabase.from("contractors").select("*").order("name");
    const { data: eventData, error: eventError } = await supabase.from("events").select("*").order("start_date", { ascending: false });
    const { data: assignmentData, error: assignmentError } = await supabase.from("assignments").select("*").order("work_date", { ascending: true });

    if (contractorError || eventError || assignmentError) {
      console.error({ contractorError, eventError, assignmentError });
      alert("Supabase could not load data. Check your table names, policies, and environment variables.");
    }

    const loadedContractors = (contractorData || []).map(contractorFromDb);
    const loadedEvents = (eventData || []).map(eventFromDb);
    const loadedAssignments = (assignmentData || []).map(assignmentFromDb);

    setContractors(loadedContractors);
    setEvents(loadedEvents);
    setAssignments(loadedAssignments);

    if (!selectedEventId && loadedEvents[0]) setSelectedEventId(loadedEvents[0].id);
    if (!selectedInvoiceContractorId && loadedContractors[0]) setSelectedInvoiceContractorId(loadedContractors[0].id);
    setNewAssignment((prev) => ({
      ...prev,
      eventId: prev.eventId || loadedEvents[0]?.id || 0,
      contractorId: prev.contractorId || loadedContractors[0]?.id || 0,
    }));

    setLoading(false);
  }

  const contractorMap = useMemo(() => Object.fromEntries(contractors.map((c) => [c.id, c])), [contractors]);
  const eventMap = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e])), [events]);

  const rows = assignments.map((a) => {
    const contractor = contractorMap[a.contractorId];
    const event = eventMap[a.eventId];
    const hours = hoursBetween(a.clockIn, a.clockOut, a.breakHours);
    const total = a.rateType === "day" ? a.rate : hours * a.rate;
    return { ...a, contractor, event, hours, total };
  });

  const filteredRows = rows.filter((row) => {
    const term = search.toLowerCase();
    return !term || `${row.contractor?.name} ${row.event?.name} ${row.position} ${row.event?.venue}`.toLowerCase().includes(term);
  });

  const payrollTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const approvedPayroll = rows.filter((row) => row.approved).reduce((sum, row) => sum + row.total, 0);
  const pendingCount = rows.filter((row) => !row.approved || !row.confirmed).length;
  const todayJob = rows.find((row) => row.event?.status === "In Progress") || rows[0];
  const selectedEvent = eventMap[selectedEventId];
  const selectedInvoiceContractor = contractorMap[selectedInvoiceContractorId];
  const approvedContractorInvoiceRows = rows.filter((row) => row.eventId === selectedEventId && row.contractorId === selectedInvoiceContractorId && row.approved);

  const contractorInvoiceLines = approvedContractorInvoiceRows.map((row) => {
    const isHourly = row.rateType === "hour";
    const regularHours = isHourly ? Math.min(row.hours, 8) : row.hours;
    const overtimeHours = isHourly ? Math.max(row.hours - 8, 0) : 0;
    const regularPay = isHourly ? regularHours * row.rate : row.rate;
    const overtimePay = isHourly ? overtimeHours * row.rate * 1.5 : 0;
    const total = regularPay + overtimePay;
    return { ...row, regularHours, overtimeHours, regularPay, overtimePay, invoiceTotal: total };
  });

  const invoiceRegularHours = contractorInvoiceLines.reduce((sum, row) => sum + row.regularHours, 0);
  const invoiceOvertimeHours = contractorInvoiceLines.reduce((sum, row) => sum + row.overtimeHours, 0);
  const invoiceTotal = contractorInvoiceLines.reduce((sum, row) => sum + row.invoiceTotal, 0);

  function exportContractorInvoicePdf() {
    window.print();
  }

  async function addContractor() {
    if (!newContractor.name.trim()) return;
    const { error } = await supabase.from("contractors").insert(contractorToDb({
      name: newContractor.name,
      role: newContractor.role || "Contractor",
      phone: newContractor.phone,
      email: newContractor.email,
      rate: Number(newContractor.rate || 0),
      rateType: newContractor.rateType,
      status: "Active",
    }));
    if (error) return alert(error.message);
    setNewContractor({ name: "", role: "", phone: "", email: "", rate: "", rateType: "day" });
    loadData();
  }

  async function addEvent() {
    if (!newEvent.name.trim()) return;
    const { data, error } = await supabase.from("events").insert(eventToDb({
      name: newEvent.name,
      client: newEvent.client,
      venue: newEvent.venue,
      address: newEvent.address,
      latitude: newEvent.latitude,
      longitude: newEvent.longitude,
      geofenceRadiusFeet: Number(newEvent.geofenceRadiusFeet || 750),
      startDate: newEvent.startDate,
      endDate: newEvent.endDate || newEvent.startDate,
      notes: newEvent.notes,
      status: "Scheduled",
    })).select().single();
    if (error) return alert(error.message);
    if (data) setSelectedEventId(data.id);
    setNewEvent({ name: "", client: "", venue: "", address: "", latitude: "", longitude: "", geofenceRadiusFeet: "750", startDate: "", endDate: "", notes: "" });
    loadData();
  }

  async function addAssignment() {
    if (!newAssignment.position.trim()) return;

    const datesFromMultiField = newAssignment.workDates
      .split(/[\n,]+/)
      .map((date) => date.trim())
      .filter(Boolean);

    const datesToSchedule = datesFromMultiField.length > 0 ? datesFromMultiField : newAssignment.workDate ? [newAssignment.workDate] : [];

    if (datesToSchedule.length === 0) {
      window.alert("Please add at least one work date.");
      return;
    }

    const createdAssignments = datesToSchedule.map((date) => assignmentToDb({
      eventId: Number(newAssignment.eventId),
      contractorId: Number(newAssignment.contractorId),
      position: newAssignment.position,
      workDate: date,
      callTime: newAssignment.callTime,
      clockIn: "",
      clockOut: "",
      clockInLocation: "",
      clockOutLocation: "",
      breakHours: 1,
      rate: Number(newAssignment.rate || 0),
      rateType: newAssignment.rateType,
      confirmed: false,
      approved: false,
      paid: false,
    }));

    const { error } = await supabase.from("assignments").insert(createdAssignments);
    if (error) return alert(error.message);
    setNewAssignment({ eventId: events[0]?.id || 0, contractorId: contractors[0]?.id || 0, position: "", workDate: "", workDates: "", callTime: "09:00", rate: "", rateType: "day" });
    loadData();
  }

  async function updateEvent(id: number, field: keyof EventItem, value: string) {
    const current = events.find((event) => event.id === id);
    if (!current) return;
    const updated = { ...current, [field]: field === "geofenceRadiusFeet" ? Number(value || 0) : value } as EventItem;
    setEvents((prev) => prev.map((event) => (event.id === id ? updated : event)));
    await supabase.from("events").update(eventToDb(updated)).eq("id", id);
  }

  async function deleteEvent(id: number) {
    const ok = window.confirm("Delete this event and all crew assignments attached to it?");
    if (!ok) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return alert(error.message);
    if (selectedEventId === id) setSelectedEventId(events.find((event) => event.id !== id)?.id || 0);
    loadData();
  }

  async function updateContractor(id: number, field: keyof Contractor, value: string) {
    const current = contractors.find((contractor) => contractor.id === id);
    if (!current) return;
    const updated = { ...current, [field]: field === "rate" ? Number(value || 0) : value } as Contractor;
    setContractors((prev) => prev.map((contractor) => (contractor.id === id ? updated : contractor)));
    await supabase.from("contractors").update(contractorToDb(updated)).eq("id", id);
  }

  async function deleteContractor(id: number) {
    const ok = window.confirm("Delete this contractor and all their assignments?");
    if (!ok) return;
    const { error } = await supabase.from("contractors").delete().eq("id", id);
    if (error) return alert(error.message);
    loadData();
  }

  async function updateAssignment(id: number, field: keyof Assignment, value: string | number | boolean) {
    const current = assignments.find((assignment) => assignment.id === id);
    if (!current) return;
    const updated = { ...current, [field]: field === "rate" || field === "breakHours" || field === "eventId" || field === "contractorId" ? Number(value || 0) : value } as Assignment;
    setAssignments((prev) => prev.map((assignment) => (assignment.id === id ? updated : assignment)));
    await supabase.from("assignments").update(assignmentToDb(updated)).eq("id", id);
  }

  async function deleteAssignment(id: number) {
    const ok = window.confirm("Delete this crew assignment?");
    if (!ok) return;
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) return alert(error.message);
    loadData();
  }

  async function toggleAssignment(id: number, key: "confirmed" | "approved" | "paid") {
    const current = assignments.find((assignment) => assignment.id === id);
    if (!current) return;
    const updated = { ...current, [key]: !current[key] };
    setAssignments((prev) => prev.map((assignment) => (assignment.id === id ? updated : assignment)));
    await supabase.from("assignments").update({ [key]: updated[key] }).eq("id", id);
  }

  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) reject(new Error("Geolocation is not available on this phone/browser."));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }

  async function geofenceClock(id?: number, type: "in" | "out" = "in") {
    if (!id) return;
    const assignment = assignments.find((a) => a.id === id);
    const event = assignment ? eventMap[assignment.eventId] : null;
    if (!assignment || !event) return;

    if (!event.latitude || !event.longitude) {
      setGeoMessage("This event needs latitude and longitude before geofence clock-in can work. Add it in Schedule > Edit Event.");
      return;
    }

    try {
      setGeoMessage("Checking contractor location...");
      const position = await getCurrentPosition();
      const userLat = position.coords.latitude;
      const userLon = position.coords.longitude;
      const eventLat = Number(event.latitude);
      const eventLon = Number(event.longitude);
      const distance = distanceFeet(userLat, userLon, eventLat, eventLon);
      const radius = Number(event.geofenceRadiusFeet || 750);
      const locationStamp = `${userLat.toFixed(6)},${userLon.toFixed(6)} (${Math.round(distance)} ft from event)`;

      if (distance > radius) {
        setGeoMessage(`Clock-${type} blocked. You are about ${Math.round(distance)} ft away. Allowed radius is ${radius} ft.`);
        return;
      }

      const updated: Partial<Assignment> = type === "in"
        ? { clockIn: nowTimeInput(), clockInLocation: locationStamp }
        : { clockOut: nowTimeInput(), clockOutLocation: locationStamp };

      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a));
      await supabase.from("assignments").update(assignmentToDb(updated)).eq("id", id);
      setGeoMessage(`Clock-${type} approved. Location verified within ${Math.round(distance)} ft of event.`);
    } catch (error: any) {
      setGeoMessage(error?.message || "Location permission failed. Contractor must allow location access to clock in/out.");
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-160px] left-[-120px] h-[360px] w-[360px] rounded-full bg-amber-500/20 blur-[110px]" />
        <div className="absolute top-[20%] right-[-140px] h-[420px] w-[420px] rounded-full bg-yellow-300/10 blur-[130px]" />
        <div className="absolute bottom-[-180px] left-[20%] h-[420px] w-[420px] rounded-full bg-zinc-500/10 blur-[120px]" />
      </div>

      <section className="relative mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">
        <header className="mb-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200 backdrop-blur-xl"><RadioTower className="h-3.5 w-3.5" />Luxon Entertainment Operations</div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Contractor Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">Editable events, crew, rates, geofence clock-in, Google Maps directions, payroll, invoices, and Supabase database storage.</p>
          </div>
          <button onClick={() => setActiveTab("schedule")} className="group flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-6 font-semibold text-black shadow-[0_0_35px_rgba(245,158,11,0.28)] transition hover:scale-[1.02]"><Plus className="h-5 w-5" /> New Event</button>
        </header>

        {loading && <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">Loading saved data from Supabase...</div>}

        <nav className="mb-6 grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-xl md:flex md:w-fit">
          {[["dashboard", "Dashboard"], ["schedule", "Schedule"], ["crew", "Crew"], ["payroll", "Payroll"], ["invoices", "Invoices"], ["updates", "Updates"]].map(([key, label]) => <button key={key} onClick={() => setActiveTab(key)} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${activeTab === key ? "bg-amber-400 text-black shadow-lg shadow-amber-500/20" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}>{label}</button>)}
        </nav>

        {activeTab === "dashboard" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-4"><Metric icon={<CalendarDays className="h-5 w-5" />} label="Events" value={events.length.toString()} /><Metric icon={<Users className="h-5 w-5" />} label="Crew" value={contractors.length.toString()} /><Metric icon={<AlertTriangle className="h-5 w-5" />} label="Needs Review" value={pendingCount.toString()} /><Metric icon={<DollarSign className="h-5 w-5" />} label="Labor" value={money(payrollTotal)} /></div>
              <GlassCard><div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><SectionHeader icon={<ClipboardCheck className="h-6 w-6" />} title="Live Labor Board" subtitle="Edit assignments inside Schedule or Payroll." compact /><SearchBox search={search} setSearch={setSearch} /></div><CrewTable rows={filteredRows} onToggle={toggleAssignment} onEdit={(id) => { setActiveTab("payroll"); setEditingAssignmentId(id); }} onDelete={deleteAssignment} /></GlassCard>
            </div>

            <div className="space-y-5">
              <GlassCard>
                <div className="mb-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-300">Contractor View</p><h2 className="text-2xl font-bold">Today’s Job</h2></div><div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300"><ShieldCheck className="h-6 w-6" /></div></div>
                <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/15 to-white/[0.03] p-5">
                  <h3 className="text-xl font-bold">{todayJob?.event?.name || "No job scheduled"}</h3><p className="mt-1 text-sm text-zinc-400">{todayJob?.position || "Add an assignment to begin"}</p>
                  <div className="mt-5 space-y-3 text-sm"><InfoLine icon={<Clock className="h-4 w-4" />} label="Call Time" value={timeLabel(todayJob?.callTime || "")} /><InfoLine icon={<MapPin className="h-4 w-4" />} label="Venue" value={todayJob?.event?.venue || ""} /><InfoLine icon={<DollarSign className="h-4 w-4" />} label="Rate" value={`${money(todayJob?.rate || 0)} / ${todayJob?.rateType || "day"}`} /><InfoLine icon={<Crosshair className="h-4 w-4" />} label="Geofence" value={`${todayJob?.event?.geofenceRadiusFeet || 0} ft radius`} /></div>
                  {geoMessage && <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">{geoMessage}</div>}
                  <div className="mt-6 grid grid-cols-2 gap-3"><button onClick={() => geofenceClock(todayJob?.id, "in")} className="h-14 rounded-2xl bg-emerald-400 font-bold text-black shadow-lg shadow-emerald-500/20">Clock In</button><button onClick={() => geofenceClock(todayJob?.id, "out")} className="h-14 rounded-2xl border border-red-400/30 bg-red-500/10 font-bold text-red-200">Clock Out</button></div>
                  <a href={mapsUrl(todayJob?.event?.address || "")} target="_blank" rel="noreferrer" className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-zinc-200 hover:bg-white/10"><Navigation className="h-4 w-4" /> View Google Maps</a>
                </div>
              </GlassCard>
              <GlassCard><h2 className="mb-4 text-xl font-semibold">Operations Alerts</h2><Alert title="Database storage enabled" text="New events, contractors, assignments, and clock-ins now save in Supabase." tone="green" /><Alert title="Location-based clock-in enabled" text="Contractors must allow location access and be within the event radius." tone="green" /><Alert title="Payroll approval pending" text="Approve hours before invoice export." tone="red" /></GlassCard>
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              <GlassCard><SectionHeader icon={<CalendarDays className="h-6 w-6" />} title="Editable Event Schedule" subtitle="Edit or delete event details, Google Maps address, GPS coordinates, and geofence radius." /><div className="grid gap-4">{events.map((event) => <EditableEventCard key={event.id} event={event} isEditing={editingEventId === event.id} onEdit={() => setEditingEventId(event.id)} onCancel={() => setEditingEventId(null)} onSave={() => setEditingEventId(null)} onDelete={() => deleteEvent(event.id)} onChange={(field, value) => updateEvent(event.id, field, value)} />)}</div></GlassCard>
              <GlassCard><SectionHeader icon={<ClipboardCheck className="h-6 w-6" />} title="Editable Crew Assignments" subtitle="Edit event, contractor, position, date, call time, clock times, break, pay rate, and rate type." /><div className="grid gap-4">{rows.map((row) => <EditableAssignmentCard key={row.id} row={row} events={events} contractors={contractors} isEditing={editingAssignmentId === row.id} onEdit={() => setEditingAssignmentId(row.id)} onCancel={() => setEditingAssignmentId(null)} onSave={() => setEditingAssignmentId(null)} onDelete={() => deleteAssignment(row.id)} onChange={(field, value) => updateAssignment(row.id, field, value)} />)}</div></GlassCard>
              <GlassCard><SectionHeader icon={<UserPlus className="h-6 w-6" />} title="Add Crew Assignment" subtitle="Create a new crew position for any event." /><div className="grid gap-3 md:grid-cols-3"><Select label="Event" value={newAssignment.eventId} onChange={(v) => setNewAssignment({ ...newAssignment, eventId: Number(v) })} options={events.map((e) => ({ value: e.id, label: e.name }))} /><Select label="Contractor" value={newAssignment.contractorId} onChange={(v) => setNewAssignment({ ...newAssignment, contractorId: Number(v) })} options={contractors.map((c) => ({ value: c.id, label: c.name }))} /><Input label="Position" value={newAssignment.position} onChange={(v) => setNewAssignment({ ...newAssignment, position: v })} /><Input label="Single Work Date" type="date" value={newAssignment.workDate} onChange={(v) => setNewAssignment({ ...newAssignment, workDate: v })} /><Input label="Call Time" type="time" value={newAssignment.callTime} onChange={(v) => setNewAssignment({ ...newAssignment, callTime: v })} /><Input label="Rate" type="number" value={newAssignment.rate} onChange={(v) => setNewAssignment({ ...newAssignment, rate: v })} /><div className="md:col-span-3"><label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">Multiple Work Dates</span><textarea value={newAssignment.workDates} onChange={(e) => setNewAssignment({ ...newAssignment, workDates: e.target.value })} placeholder={`Optional: enter multiple dates, one per line or comma separated\n2026-05-11\n2026-05-12\n2026-05-17`} className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/60" /></label><p className="mt-2 text-xs text-zinc-500">Use this when a contractor is working multiple days on the same event. The app will create one assignment per date so communication stays clear.</p></div><Select label="Rate Type" value={newAssignment.rateType} onChange={(v) => setNewAssignment({ ...newAssignment, rateType: v as "day" | "hour" })} options={[{ value: "day", label: "Day Rate" }, { value: "hour", label: "Hourly" }]} /></div><div className="mt-4 flex justify-end"><GoldButton onClick={addAssignment}><UserPlus className="h-4 w-4" /> Add Crew Assignment</GoldButton></div></GlassCard>
            </div>
            <GlassCard><SectionHeader icon={<Plus className="h-6 w-6" />} title="Create Event" subtitle="Add address, coordinates, and radius for map/geofence features." /><div className="space-y-3"><Input label="Event Name" value={newEvent.name} onChange={(v) => setNewEvent({ ...newEvent, name: v })} /><Input label="Client" value={newEvent.client} onChange={(v) => setNewEvent({ ...newEvent, client: v })} /><Input label="Venue" value={newEvent.venue} onChange={(v) => setNewEvent({ ...newEvent, venue: v })} /><Input label="Address for Google Maps" value={newEvent.address} onChange={(v) => setNewEvent({ ...newEvent, address: v })} /><Input label="Latitude" value={newEvent.latitude} onChange={(v) => setNewEvent({ ...newEvent, latitude: v })} /><Input label="Longitude" value={newEvent.longitude} onChange={(v) => setNewEvent({ ...newEvent, longitude: v })} /><Input label="Allowed Clock-In Radius Feet" type="number" value={newEvent.geofenceRadiusFeet} onChange={(v) => setNewEvent({ ...newEvent, geofenceRadiusFeet: v })} /><Input label="Start Date" type="date" value={newEvent.startDate} onChange={(v) => setNewEvent({ ...newEvent, startDate: v })} /><Input label="End Date" type="date" value={newEvent.endDate} onChange={(v) => setNewEvent({ ...newEvent, endDate: v })} /><textarea className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/60" placeholder="Event notes" value={newEvent.notes} onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })} /><GoldButton onClick={addEvent}><Plus className="h-4 w-4" /> Create Event</GoldButton></div></GlassCard>
          </div>
        )}

        {activeTab === "crew" && <div className="grid gap-5 lg:grid-cols-3"><div className="lg:col-span-2"><GlassCard><SectionHeader icon={<Users className="h-6 w-6" />} title="Editable Crew Roster" subtitle="Edit contractor name, role, phone, email, rate, and rate type." /><div className="grid gap-4 md:grid-cols-2">{contractors.map((contractor) => <EditableContractorCard key={contractor.id} contractor={contractor} isEditing={editingContractorId === contractor.id} onEdit={() => setEditingContractorId(contractor.id)} onCancel={() => setEditingContractorId(null)} onSave={() => setEditingContractorId(null)} onDelete={() => deleteContractor(contractor.id)} onChange={(field, value) => updateContractor(contractor.id, field, value)} />)}</div></GlassCard></div><GlassCard><SectionHeader icon={<UserPlus className="h-6 w-6" />} title="Add Contractor" subtitle="Save contractor info for scheduling." /><div className="space-y-3"><Input label="Name" value={newContractor.name} onChange={(v) => setNewContractor({ ...newContractor, name: v })} /><Input label="Role" value={newContractor.role} onChange={(v) => setNewContractor({ ...newContractor, role: v })} /><Input label="Phone" value={newContractor.phone} onChange={(v) => setNewContractor({ ...newContractor, phone: v })} /><Input label="Email" value={newContractor.email} onChange={(v) => setNewContractor({ ...newContractor, email: v })} /><Input label="Default Rate" type="number" value={newContractor.rate} onChange={(v) => setNewContractor({ ...newContractor, rate: v })} /><Select label="Rate Type" value={newContractor.rateType} onChange={(v) => setNewContractor({ ...newContractor, rateType: v as "day" | "hour" })} options={[{ value: "day", label: "Day Rate" }, { value: "hour", label: "Hourly" }]} /><GoldButton onClick={addContractor}><UserPlus className="h-4 w-4" /> Save Contractor</GoldButton></div></GlassCard></div>}
        {activeTab === "payroll" && <GlassCard><SectionHeader icon={<DollarSign className="h-6 w-6" />} title="Payroll Approval" subtitle="Review, edit, approve, mark paid, or delete assignment pay." /><div className="mb-5 grid gap-4 md:grid-cols-3"><Metric icon={<Clock className="h-5 w-5" />} label="Clocked Labor" value={money(payrollTotal)} /><Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Approved" value={money(approvedPayroll)} /><Metric icon={<AlertTriangle className="h-5 w-5" />} label="Pending Items" value={pendingCount.toString()} /></div><div className="grid gap-4">{rows.map((row) => <EditableAssignmentCard key={row.id} row={row} events={events} contractors={contractors} isEditing={editingAssignmentId === row.id} onEdit={() => setEditingAssignmentId(row.id)} onCancel={() => setEditingAssignmentId(null)} onSave={() => setEditingAssignmentId(null)} onDelete={() => deleteAssignment(row.id)} onChange={(field, value) => updateAssignment(row.id, field, value)} showPayrollActions onToggle={toggleAssignment} />)}</div></GlassCard>}
        {activeTab === "invoices" && <div className="grid gap-5 lg:grid-cols-3"><GlassCard><SectionHeader icon={<FileText className="h-6 w-6" />} title="Contractor Invoice Builder" subtitle="Creates one invoice per contractor using only approved tracked hours." /><div className="space-y-4"><Select label="Select Event" value={selectedEventId} onChange={(v) => setSelectedEventId(Number(v))} options={events.map((e) => ({ value: e.id, label: e.name }))} /><Select label="Select Contractor" value={selectedInvoiceContractorId} onChange={(v) => setSelectedInvoiceContractorId(Number(v))} options={contractors.map((c) => ({ value: c.id, label: c.name }))} /><div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4"><p className="text-sm text-emerald-100">Approved invoice total</p><p className="text-3xl font-bold text-emerald-300">{money(invoiceTotal)}</p><p className="mt-2 text-xs text-emerald-100/80">Only approved hours are included. Pending or unapproved time is excluded.</p></div><div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300"><p>Regular / tracked hours: <span className="font-bold text-white">{invoiceRegularHours.toFixed(2)}</span></p><p>Overtime hours: <span className="font-bold text-amber-300">{invoiceOvertimeHours.toFixed(2)}</span></p><p className="mt-2 text-xs text-zinc-500">Hourly overtime is calculated after 8 tracked hours per assignment at 1.5x. Day-rate assignments are billed at the approved day rate.</p></div><GoldButton onClick={exportContractorInvoicePdf}><Download className="h-4 w-4" /> Export Contractor Invoice PDF</GoldButton></div></GlassCard><div className="lg:col-span-2"><GlassCard><SectionHeader icon={<FileText className="h-6 w-6" />} title="Invoice Preview" subtitle="This invoice is contractor-specific and payable by Luxon Entertainment LLC." /><div id="printable-invoice" className="rounded-3xl border border-white/10 bg-white p-6 text-sm leading-7 text-slate-900"><div className="mb-8 flex items-start justify-between border-b border-slate-200 pb-6"><div><p className="text-2xl font-bold text-slate-950">Luxon Entertainment LLC</p><p className="text-slate-500">Contractor Invoice Approval Record</p><p className="mt-3 text-xs uppercase tracking-wider text-slate-400">Bill To</p><p className="font-semibold">Luxon Entertainment LLC</p></div><div className="text-right"><p className="text-4xl font-bold text-slate-950">INVOICE</p><p className="mt-2 text-slate-500">Invoice #: AUTO-{selectedEventId}-{selectedInvoiceContractorId}</p><p className="text-slate-500">Date: {new Date().toLocaleDateString("en-US")}</p><p className="text-slate-500">Terms: Net 30</p></div></div><div className="mb-6 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Contractor</p><p className="text-lg font-bold">{selectedInvoiceContractor?.name || "Select contractor"}</p><p>{selectedInvoiceContractor?.role || ""}</p><p>{selectedInvoiceContractor?.email || ""}</p><p>{selectedInvoiceContractor?.phone || ""}</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Event</p><p className="text-lg font-bold">{selectedEvent?.name}</p><p>{selectedEvent?.client}</p><p>{selectedEvent?.venue}</p><p>{selectedEvent?.address}</p><p>{dateLabel(selectedEvent?.startDate || "")} - {dateLabel(selectedEvent?.endDate || "")}</p></div></div><div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b border-slate-300 bg-slate-100"><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Clocked Time</th><th className="p-3">Reg Hrs</th><th className="p-3">OT Hrs</th><th className="p-3">Rate</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{contractorInvoiceLines.length === 0 && <tr><td className="p-3" colSpan={7}>No approved hours found for this contractor on this event.</td></tr>}{contractorInvoiceLines.map((row) => <tr key={row.id} className="border-b border-slate-200"><td className="p-3">{dateLabel(row.workDate)}</td><td className="p-3">{row.position}<br /><span className="text-xs text-slate-500">Approved by management: {row.approved ? "Yes" : "No"}</span></td><td className="p-3">{row.clockIn || "--"} - {row.clockOut || "--"}<br /><span className="text-xs text-slate-500">Break: {row.breakHours} hr</span></td><td className="p-3">{row.regularHours.toFixed(2)}</td><td className="p-3">{row.overtimeHours.toFixed(2)}</td><td className="p-3">{money(row.rate)} / {row.rateType}</td><td className="p-3 text-right font-semibold">{money(row.invoiceTotal)}</td></tr>)}</tbody></table></div><div className="mt-8 flex justify-end"><div className="w-full max-w-sm space-y-2 rounded-2xl bg-slate-100 p-5"><div className="flex justify-between"><span>Regular / Approved Hours</span><span>{invoiceRegularHours.toFixed(2)}</span></div><div className="flex justify-between"><span>Overtime Hours</span><span>{invoiceOvertimeHours.toFixed(2)}</span></div><div className="flex justify-between border-t border-slate-300 pt-3 text-xl font-bold"><span>Total Due</span><span>{money(invoiceTotal)}</span></div></div></div><div className="mt-8 rounded-2xl border border-slate-200 p-4 text-xs text-slate-500"><p className="font-semibold text-slate-700">System Verification Note</p><p>This invoice only includes approved assignment records. Pending or unapproved hours are excluded. Totals are calculated from clock-in/out records, break deductions, management approval status, configured rate, and overtime rules.</p></div></div></GlassCard></div></div>}
        {activeTab === "updates" && <div className="grid gap-5 lg:grid-cols-2"><GlassCard><SectionHeader icon={<Send className="h-6 w-6" />} title="Crew Confirmation Message" subtitle="Copy and send this to contractors before the event." /><MessageBox text={`You have been added to the Luxon Entertainment roster. Please confirm your position, work date, call time, location, and rate by replying CONFIRMED. If you have any questions, contact Brayan.`} /><GoldButton><Send className="h-4 w-4" /> Send Confirmation</GoldButton></GlassCard><GlassCard><SectionHeader icon={<AlertTriangle className="h-6 w-6" />} title="Day-Of Crew Update" subtitle="Quick update for outdoor events, call time reminders, and show notes." /><MessageBox text={`Reminder: please arrive on time, dress appropriately for the event, bring water if outside, take your required break, and clock in/out through the Luxon Ops app. Call Brayan if anything changes.`} /><GoldButton><Send className="h-4 w-4" /> Send Day-Of Update</GoldButton></GlassCard><GlassCard><SectionHeader icon={<Sparkles className="h-6 w-6" />} title="Missing Clock-Out Reminder" subtitle="Use this when someone forgets to clock out." /><MessageBox text={`Hey, please update your clock-out time for today’s Luxon job so payroll can be approved. Thank you.`} /><GoldButton><Send className="h-4 w-4" /> Send Reminder</GoldButton></GlassCard><GlassCard><SectionHeader icon={<ClipboardCheck className="h-6 w-6" />} title="Payroll Approved Message" subtitle="Send after hours are reviewed." /><MessageBox text={`Your hours for the recent Luxon event have been reviewed and approved. Payment will be processed according to the agreed terms.`} /><GoldButton><Send className="h-4 w-4" /> Send Payroll Update</GoldButton></GlassCard></div>}
      </section>
    <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible !important;
          }
          #printable-invoice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
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

function EditableEventCard({ event, isEditing, onEdit, onCancel, onSave, onDelete, onChange }: { event: EventItem; isEditing: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; onDelete: () => void; onChange: (field: keyof EventItem, value: string) => void }) {
  return <div className="rounded-3xl border border-white/10 bg-black/25 p-5"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div>{isEditing ? <Input label="Event Name" value={event.name} onChange={(v) => onChange("name", v)} /> : <><h3 className="text-xl font-bold">{event.name}</h3><p className="text-sm text-zinc-400">{event.client}</p></>}</div><ActionButtons isEditing={isEditing} onEdit={onEdit} onCancel={onCancel} onSave={onSave} onDelete={onDelete} /></div>{isEditing ? <div className="grid gap-3 md:grid-cols-2"><Input label="Client" value={event.client} onChange={(v) => onChange("client", v)} /><Input label="Venue" value={event.venue} onChange={(v) => onChange("venue", v)} /><Input label="Address for Google Maps" value={event.address} onChange={(v) => onChange("address", v)} /><Input label="Latitude" value={event.latitude} onChange={(v) => onChange("latitude", v)} /><Input label="Longitude" value={event.longitude} onChange={(v) => onChange("longitude", v)} /><Input label="Allowed Radius Feet" type="number" value={String(event.geofenceRadiusFeet)} onChange={(v) => onChange("geofenceRadiusFeet", v)} /><Input label="Start Date" type="date" value={event.startDate} onChange={(v) => onChange("startDate", v)} /><Input label="End Date" type="date" value={event.endDate} onChange={(v) => onChange("endDate", v)} /><Select label="Status" value={event.status} onChange={(v) => onChange("status", v)} options={[{ value: "Scheduled", label: "Scheduled" }, { value: "In Progress", label: "In Progress" }, { value: "Completed", label: "Completed" }, { value: "Cancelled", label: "Cancelled" }]} /><textarea className="min-h-[100px] rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none md:col-span-2" value={event.notes} onChange={(e) => onChange("notes", e.target.value)} /></div> : <div className="grid gap-3 text-sm md:grid-cols-2"><InfoLine icon={<Building2 className="h-4 w-4" />} label="Venue" value={event.venue} /><InfoLine icon={<MapPin className="h-4 w-4" />} label="Address" value={event.address} /><InfoLine icon={<Crosshair className="h-4 w-4" />} label="Geofence" value={`${event.latitude}, ${event.longitude} · ${event.geofenceRadiusFeet} ft`} /><InfoLine icon={<CalendarDays className="h-4 w-4" />} label="Dates" value={`${dateLabel(event.startDate)} - ${dateLabel(event.endDate)}`} /><a href={mapsUrl(event.address)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 font-semibold text-zinc-200 hover:bg-white/10"><Navigation className="h-4 w-4" /> View Google Maps</a><InfoLine icon={<FileText className="h-4 w-4" />} label="Notes" value={event.notes} /></div>}</div>;
}

function EditableContractorCard({ contractor, isEditing, onEdit, onCancel, onSave, onDelete, onChange }: { contractor: Contractor; isEditing: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; onDelete: () => void; onChange: (field: keyof Contractor, value: string) => void }) { return <div className="rounded-3xl border border-white/10 bg-black/25 p-5"><div className="mb-4 flex items-start justify-between gap-3"><div className="flex-1">{isEditing ? <Input label="Name" value={contractor.name} onChange={(v) => onChange("name", v)} /> : <><h3 className="text-xl font-bold">{contractor.name}</h3><p className="text-sm text-zinc-400">{contractor.role}</p></>}</div><ActionButtons isEditing={isEditing} onEdit={onEdit} onCancel={onCancel} onSave={onSave} onDelete={onDelete} /></div>{isEditing ? <div className="grid gap-3"><Input label="Role" value={contractor.role} onChange={(v) => onChange("role", v)} /><Input label="Phone" value={contractor.phone} onChange={(v) => onChange("phone", v)} /><Input label="Email" value={contractor.email} onChange={(v) => onChange("email", v)} /><Input label="Rate" type="number" value={String(contractor.rate)} onChange={(v) => onChange("rate", v)} /><Select label="Rate Type" value={contractor.rateType} onChange={(v) => onChange("rateType", v)} options={[{ value: "day", label: "Day Rate" }, { value: "hour", label: "Hourly" }]} /><Select label="Status" value={contractor.status} onChange={(v) => onChange("status", v)} options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} /></div> : <div className="mt-5 space-y-3 text-sm"><InfoLine icon={<DollarSign className="h-4 w-4" />} label="Default Rate" value={`${money(contractor.rate)} / ${contractor.rateType}`} /><InfoLine icon={<Phone className="h-4 w-4" />} label="Phone" value={contractor.phone || "Not added"} /><InfoLine icon={<Mail className="h-4 w-4" />} label="Email" value={contractor.email || "Not added"} /></div>}</div>; }
function EditableAssignmentCard({ row, events, contractors, isEditing, onEdit, onCancel, onSave, onDelete, onChange, showPayrollActions = false, onToggle }: { row: any; events: EventItem[]; contractors: Contractor[]; isEditing: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; onDelete: () => void; onChange: (field: keyof Assignment, value: string | number | boolean) => void; showPayrollActions?: boolean; onToggle?: (id: number, key: "confirmed" | "approved" | "paid") => void }) { return <div className="rounded-3xl border border-white/10 bg-black/25 p-5"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h3 className="text-xl font-bold">{row.contractor?.name}</h3><p className="text-sm text-zinc-400">{row.position} · {row.event?.name}</p><p className="mt-1 text-amber-300 font-bold">{money(row.total)} · {row.hours.toFixed(2)} hrs</p></div><ActionButtons isEditing={isEditing} onEdit={onEdit} onCancel={onCancel} onSave={onSave} onDelete={onDelete} /></div>{isEditing ? <div className="grid gap-3 md:grid-cols-3"><Select label="Event" value={row.eventId} onChange={(v) => onChange("eventId", v)} options={events.map((e) => ({ value: e.id, label: e.name }))} /><Select label="Contractor" value={row.contractorId} onChange={(v) => onChange("contractorId", v)} options={contractors.map((c) => ({ value: c.id, label: c.name }))} /><Input label="Position" value={row.position} onChange={(v) => onChange("position", v)} /><Input label="Work Date" type="date" value={row.workDate} onChange={(v) => onChange("workDate", v)} /><Input label="Call Time" type="time" value={row.callTime} onChange={(v) => onChange("callTime", v)} /><Input label="Clock In" type="time" value={row.clockIn} onChange={(v) => onChange("clockIn", v)} /><Input label="Clock Out" type="time" value={row.clockOut} onChange={(v) => onChange("clockOut", v)} /><Input label="Break Hours" type="number" value={String(row.breakHours)} onChange={(v) => onChange("breakHours", v)} /><Input label="Rate" type="number" value={String(row.rate)} onChange={(v) => onChange("rate", v)} /><Select label="Rate Type" value={row.rateType} onChange={(v) => onChange("rateType", v)} options={[{ value: "day", label: "Day Rate" }, { value: "hour", label: "Hourly" }]} /></div> : <div className="grid gap-3 text-sm md:grid-cols-4"><InfoLine icon={<CalendarDays className="h-4 w-4" />} label="Date" value={dateLabel(row.workDate)} /><InfoLine icon={<Clock className="h-4 w-4" />} label="Call / Clock" value={`${timeLabel(row.callTime)} · ${row.clockIn || "--"}-${row.clockOut || "--"}`} /><InfoLine icon={<DollarSign className="h-4 w-4" />} label="Rate" value={`${money(row.rate)} / ${row.rateType}`} /><InfoLine icon={<MapPin className="h-4 w-4" />} label="Clock Location" value={row.clockInLocation || "Not verified yet"} /></div>}{showPayrollActions && onToggle && <div className="mt-4 flex flex-wrap gap-2"><SmallButton onClick={() => onToggle(row.id, "confirmed")}>Toggle Confirmed</SmallButton><SmallButton onClick={() => onToggle(row.id, "approved")}>Toggle Approved</SmallButton><SmallButton onClick={() => onToggle(row.id, "paid")}>Toggle Paid</SmallButton></div>}</div>; }
function ActionButtons({ isEditing, onEdit, onCancel, onSave, onDelete }: { isEditing: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; onDelete: () => void }) { return <div className="flex gap-2">{isEditing ? <><IconButton label="Save" onClick={onSave}><Save className="h-4 w-4" /></IconButton><IconButton label="Cancel" onClick={onCancel}><X className="h-4 w-4" /></IconButton></> : <IconButton label="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>}<IconButton label="Delete" onClick={onDelete} danger><Trash2 className="h-4 w-4" /></IconButton></div>; }
function GlassCard({ children }: { children: React.ReactNode }) { return <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl">{children}</div>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">{icon}</div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-zinc-500">{label}</div></div>; }
function SectionHeader({ icon, title, subtitle, compact = false }: { icon: React.ReactNode; title: string; subtitle: string; compact?: boolean }) { return <div className={`flex items-start gap-3 ${compact ? "" : "mb-5"}`}><div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">{icon}</div><div><h2 className="text-2xl font-bold">{title}</h2><p className="text-sm text-zinc-400">{subtitle}</p></div></div>; }
function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3"><div className="text-amber-300">{icon}</div><div><div className="text-xs text-zinc-500">{label}</div><div className="font-medium text-zinc-100 break-words">{value}</div></div></div>; }
function Alert({ title, text, tone }: { title: string; text: string; tone: "amber" | "red" | "green" }) { const tones = { amber: "border-amber-400/20 bg-amber-400/10 text-amber-200", red: "border-red-400/20 bg-red-400/10 text-red-200", green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" }; return <div className={`mb-3 rounded-2xl border p-4 ${tones[tone]}`}><div className="font-semibold">{title}</div><div className="mt-1 text-sm opacity-80">{text}</div></div>; }
function SearchBox({ search, setSearch }: { search: string; setSearch: (value: string) => void }) { return <div className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search crew, event, role..." className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400/60 md:w-80" /></div>; }
function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/60" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string | number; onChange: (value: string) => void; options: { value: string | number; label: string }[] }) { return <label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none focus:border-amber-400/60">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function GoldButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) { return <button onClick={onClick} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-5 font-semibold text-black shadow-lg shadow-amber-500/20 transition hover:scale-[1.01]">{children}</button>; }
function IconButton({ children, label, onClick, danger = false }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) { return <button title={label} onClick={onClick} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${danger ? "border-red-400/20 bg-red-400/10 text-red-300 hover:bg-red-400/20" : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"}`}>{children}</button>; }
function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10">{children}</button>; }
function MessageBox({ text }: { text: string }) { return <div className="mb-4 rounded-3xl border border-white/10 bg-black/40 p-5 text-sm leading-7 text-zinc-200">{text}</div>; }
function CrewTable({ rows, onToggle, onEdit, onDelete }: { rows: any[]; onToggle: (id: number, key: "confirmed" | "approved" | "paid") => void; onEdit: (id: number) => void; onDelete: (id: number) => void }) { return <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-zinc-500"><th className="pb-4">Contractor</th><th className="pb-4">Event</th><th className="pb-4">Date</th><th className="pb-4">Hours</th><th className="pb-4">Pay</th><th className="pb-4">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-white/5 last:border-0"><td className="py-4"><div className="font-semibold text-white">{row.contractor?.name}</div><div className="text-xs text-zinc-500">{row.position}</div></td><td className="py-4"><div className="font-medium text-zinc-200">{row.event?.name}</div><div className="text-xs text-zinc-500">{row.event?.venue}</div></td><td className="py-4 text-zinc-300">{dateLabel(row.workDate)}</td><td className="py-4 text-zinc-300">{row.hours.toFixed(2)}</td><td className="py-4 font-bold text-amber-300">{money(row.total)}</td><td className="py-4"><div className="flex flex-wrap gap-2"><SmallButton onClick={() => onToggle(row.id, "confirmed")}>{row.confirmed ? "Confirmed" : "Confirm"}</SmallButton><SmallButton onClick={() => onToggle(row.id, "approved")}>{row.approved ? "Approved" : "Approve"}</SmallButton><IconButton label="Edit" onClick={() => onEdit(row.id)}><Pencil className="h-4 w-4" /></IconButton><IconButton label="Delete" onClick={() => onDelete(row.id)} danger><Trash2 className="h-4 w-4" /></IconButton></div></td></tr>)}</tbody></table></div>; }
