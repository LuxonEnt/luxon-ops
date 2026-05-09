"use client";

import React, { useMemo, useState } from "react";
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
  BriefcaseBusiness,
  Phone,
  Mail,
  Download,
  ClipboardCheck,
  UserPlus,
  Building2,
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
  breakHours: number;
  rate: number;
  rateType: "day" | "hour";
  confirmed: boolean;
  approved: boolean;
  paid: boolean;
};

const startingContractors: Contractor[] = [
  { id: 1, name: "Chris Ayala", role: "L1 / Lighting Tech", phone: "", email: "", rate: 400, rateType: "day", status: "Active" },
  { id: 2, name: "Morris Ramos", role: "Video Engineer", phone: "", email: "", rate: 550, rateType: "day", status: "Active" },
  { id: 3, name: "James Barber", role: "A1 / FOH Engineer", phone: "", email: "", rate: 650, rateType: "day", status: "Active" },
  { id: 4, name: "Bryant Aquino", role: "Stagehand", phone: "", email: "", rate: 35, rateType: "hour", status: "Active" },
];

const startingEvents: EventItem[] = [
  {
    id: 101,
    name: "CSUDH Graduation",
    client: "Cal State University Dominguez Hills",
    venue: "Dignity Health Sports Park",
    address: "18400 Avalon Blvd, Carson, CA 90746",
    startDate: "2026-05-11",
    endDate: "2026-05-17",
    status: "Scheduled",
    notes: "Tennis Court. Setup, show, and strike labor.",
  },
  {
    id: 102,
    name: "Rosemont Middle School Event",
    client: "Rosemont Middle School",
    venue: "Rosemont Middle School",
    address: "4725 Rosemont Ave, La Crescenta-Montrose, CA 91214",
    startDate: "2026-05-09",
    endDate: "2026-05-09",
    status: "In Progress",
    notes: "Outdoor event. Crew should bring water and dress accordingly.",
  },
];

const startingAssignments: Assignment[] = [
  {
    id: 1001,
    eventId: 101,
    contractorId: 1,
    position: "Crew Lead / Stagehand",
    workDate: "2026-05-11",
    callTime: "08:00",
    clockIn: "08:02",
    clockOut: "18:01",
    breakHours: 1,
    rate: 400,
    rateType: "day",
    confirmed: true,
    approved: true,
    paid: false,
  },
  {
    id: 1002,
    eventId: 101,
    contractorId: 4,
    position: "Stagehand",
    workDate: "2026-05-17",
    callTime: "09:00",
    clockIn: "09:00",
    clockOut: "21:00",
    breakHours: 1,
    rate: 35,
    rateType: "hour",
    confirmed: false,
    approved: false,
    paid: false,
  },
  {
    id: 1003,
    eventId: 102,
    contractorId: 3,
    position: "A1 / FOH Engineer",
    workDate: "2026-05-09",
    callTime: "12:00",
    clockIn: "12:00",
    clockOut: "22:00",
    breakHours: 1,
    rate: 650,
    rateType: "day",
    confirmed: true,
    approved: true,
    paid: false,
  },
];

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
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeLabel(value: string) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  return new Date(2026, 0, 1, h, m).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LuxonOpsDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [contractors, setContractors] = useState<Contractor[]>(startingContractors);
  const [events, setEvents] = useState<EventItem[]>(startingEvents);
  const [assignments, setAssignments] = useState<Assignment[]>(startingAssignments);
  const [selectedEventId, setSelectedEventId] = useState(101);
  const [newContractor, setNewContractor] = useState({ name: "", role: "", phone: "", email: "", rate: "", rateType: "day" as "day" | "hour" });
  const [newEvent, setNewEvent] = useState({ name: "", client: "", venue: "", address: "", startDate: "", endDate: "", notes: "" });
  const [newAssignment, setNewAssignment] = useState({ eventId: 101, contractorId: 1, position: "", workDate: "", callTime: "09:00", rate: "", rateType: "day" as "day" | "hour" });

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
  const selectedEventRows = rows.filter((row) => row.eventId === selectedEventId);
  const selectedEvent = eventMap[selectedEventId];
  const invoiceTotal = selectedEventRows.reduce((sum, row) => sum + row.total, 0);

  function addContractor() {
    if (!newContractor.name.trim()) return;
    setContractors((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newContractor.name,
        role: newContractor.role || "Contractor",
        phone: newContractor.phone,
        email: newContractor.email,
        rate: Number(newContractor.rate || 0),
        rateType: newContractor.rateType,
        status: "Active",
      },
    ]);
    setNewContractor({ name: "", role: "", phone: "", email: "", rate: "", rateType: "day" });
  }

  function addEvent() {
    if (!newEvent.name.trim()) return;
    const id = Date.now();
    setEvents((prev) => [
      ...prev,
      {
        id,
        name: newEvent.name,
        client: newEvent.client,
        venue: newEvent.venue,
        address: newEvent.address,
        startDate: newEvent.startDate,
        endDate: newEvent.endDate || newEvent.startDate,
        notes: newEvent.notes,
        status: "Scheduled",
      },
    ]);
    setSelectedEventId(id);
    setNewEvent({ name: "", client: "", venue: "", address: "", startDate: "", endDate: "", notes: "" });
  }

  function addAssignment() {
    if (!newAssignment.position.trim()) return;
    setAssignments((prev) => [
      ...prev,
      {
        id: Date.now(),
        eventId: Number(newAssignment.eventId),
        contractorId: Number(newAssignment.contractorId),
        position: newAssignment.position,
        workDate: newAssignment.workDate,
        callTime: newAssignment.callTime,
        clockIn: "",
        clockOut: "",
        breakHours: 1,
        rate: Number(newAssignment.rate || 0),
        rateType: newAssignment.rateType,
        confirmed: false,
        approved: false,
        paid: false,
      },
    ]);
    setNewAssignment({ eventId: events[0]?.id || 0, contractorId: contractors[0]?.id || 0, position: "", workDate: "", callTime: "09:00", rate: "", rateType: "day" });
  }

  function toggleAssignment(id: number, key: "confirmed" | "approved" | "paid") {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, [key]: !a[key] } : a)));
  }

  function clockIn(id: number) {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, clockIn: "09:00" } : a)));
  }

  function clockOut(id: number) {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, clockOut: "17:00" } : a)));
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
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200 backdrop-blur-xl">
              <RadioTower className="h-3.5 w-3.5" />
              Luxon Entertainment Operations
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Contractor Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
              Schedule crew, track hours, approve payroll, send updates, and generate labor invoices.
            </p>
          </div>

          <button onClick={() => setActiveTab("schedule")} className="group flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-6 font-semibold text-black shadow-[0_0_35px_rgba(245,158,11,0.28)] transition hover:scale-[1.02]">
            <Plus className="h-5 w-5" />
            New Event
          </button>
        </header>

        <nav className="mb-6 grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-xl md:flex md:w-fit">
          {[
            ["dashboard", "Dashboard"],
            ["schedule", "Schedule"],
            ["crew", "Crew"],
            ["payroll", "Payroll"],
            ["invoices", "Invoices"],
            ["updates", "Updates"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${activeTab === key ? "bg-amber-400 text-black shadow-lg shadow-amber-500/20" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </nav>

        {activeTab === "dashboard" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-4">
                <Metric icon={<CalendarDays className="h-5 w-5" />} label="Events" value={events.length.toString()} />
                <Metric icon={<Users className="h-5 w-5" />} label="Crew" value={contractors.length.toString()} />
                <Metric icon={<AlertTriangle className="h-5 w-5" />} label="Needs Review" value={pendingCount.toString()} />
                <Metric icon={<DollarSign className="h-5 w-5" />} label="Labor" value={money(payrollTotal)} />
              </div>

              <GlassCard>
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Live Labor Board</h2>
                    <p className="text-sm text-zinc-400">Track confirmations, clocked hours, and pay totals.</p>
                  </div>
                  <SearchBox search={search} setSearch={setSearch} />
                </div>
                <CrewTable rows={filteredRows} onToggle={toggleAssignment} />
              </GlassCard>
            </div>

            <div className="space-y-5">
              <GlassCard>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Contractor View</p>
                    <h2 className="text-2xl font-bold">Today’s Job</h2>
                  </div>
                  <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/15 to-white/[0.03] p-5">
                  <h3 className="text-xl font-bold">{todayJob?.event?.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{todayJob?.position}</p>

                  <div className="mt-5 space-y-3 text-sm">
                    <InfoLine icon={<Clock className="h-4 w-4" />} label="Call Time" value={timeLabel(todayJob?.callTime || "")} />
                    <InfoLine icon={<MapPin className="h-4 w-4" />} label="Venue" value={todayJob?.event?.venue || ""} />
                    <InfoLine icon={<DollarSign className="h-4 w-4" />} label="Rate" value={`${money(todayJob?.rate || 0)} / ${todayJob?.rateType || "day"}`} />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button onClick={() => clockIn(todayJob?.id)} className="h-14 rounded-2xl bg-emerald-400 font-bold text-black shadow-lg shadow-emerald-500/20">Clock In</button>
                    <button onClick={() => clockOut(todayJob?.id)} className="h-14 rounded-2xl border border-red-400/30 bg-red-500/10 font-bold text-red-200">Clock Out</button>
                  </div>

                  <button className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-zinc-200">
                    <Navigation className="h-4 w-4" /> Open Maps
                  </button>
                </div>
              </GlassCard>

              <GlassCard>
                <h2 className="mb-4 text-xl font-semibold">Operations Alerts</h2>
                <Alert title="Missing confirmations" text="Send reminder before final roster lock." tone="amber" />
                <Alert title="Payroll approval pending" text="Approve hours before invoice export." tone="red" />
                <Alert title="Invoice draft ready" text="Labor summary can be generated." tone="green" />
              </GlassCard>
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              <GlassCard>
                <SectionHeader icon={<CalendarDays className="h-6 w-6" />} title="Event Schedule" subtitle="Manage active events, venues, dates, and job notes." />
                <div className="grid gap-4">
                  {events.map((event) => (
                    <div key={event.id} className="rounded-3xl border border-white/10 bg-black/25 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-bold">{event.name}</h3>
                            <StatusBadge label={event.status} tone={event.status === "In Progress" ? "green" : "blue"} />
                          </div>
                          <p className="text-zinc-400">{event.client}</p>
                          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                            <InfoLine icon={<Building2 className="h-4 w-4" />} label="Venue" value={event.venue} />
                            <InfoLine icon={<MapPin className="h-4 w-4" />} label="Address" value={event.address} />
                            <InfoLine icon={<CalendarDays className="h-4 w-4" />} label="Dates" value={`${dateLabel(event.startDate)} - ${dateLabel(event.endDate)}`} />
                            <InfoLine icon={<FileText className="h-4 w-4" />} label="Notes" value={event.notes} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard>
                <SectionHeader icon={<ClipboardCheck className="h-6 w-6" />} title="Assign Crew" subtitle="Add a contractor to an event with call time and rate." />
                <div className="grid gap-3 md:grid-cols-3">
                  <Select label="Event" value={newAssignment.eventId} onChange={(v) => setNewAssignment({ ...newAssignment, eventId: Number(v) })} options={events.map((e) => ({ value: e.id, label: e.name }))} />
                  <Select label="Contractor" value={newAssignment.contractorId} onChange={(v) => setNewAssignment({ ...newAssignment, contractorId: Number(v) })} options={contractors.map((c) => ({ value: c.id, label: c.name }))} />
                  <Input label="Position" value={newAssignment.position} onChange={(v) => setNewAssignment({ ...newAssignment, position: v })} />
                  <Input label="Work Date" type="date" value={newAssignment.workDate} onChange={(v) => setNewAssignment({ ...newAssignment, workDate: v })} />
                  <Input label="Call Time" type="time" value={newAssignment.callTime} onChange={(v) => setNewAssignment({ ...newAssignment, callTime: v })} />
                  <Input label="Rate" type="number" value={newAssignment.rate} onChange={(v) => setNewAssignment({ ...newAssignment, rate: v })} />
                </div>
                <div className="mt-4 flex justify-end">
                  <GoldButton onClick={addAssignment}><UserPlus className="h-4 w-4" /> Add Crew Assignment</GoldButton>
                </div>
              </GlassCard>
            </div>

            <GlassCard>
              <SectionHeader icon={<Plus className="h-6 w-6" />} title="Create Event" subtitle="Add a new job to the schedule." />
              <div className="space-y-3">
                <Input label="Event Name" value={newEvent.name} onChange={(v) => setNewEvent({ ...newEvent, name: v })} />
                <Input label="Client" value={newEvent.client} onChange={(v) => setNewEvent({ ...newEvent, client: v })} />
                <Input label="Venue" value={newEvent.venue} onChange={(v) => setNewEvent({ ...newEvent, venue: v })} />
                <Input label="Address" value={newEvent.address} onChange={(v) => setNewEvent({ ...newEvent, address: v })} />
                <Input label="Start Date" type="date" value={newEvent.startDate} onChange={(v) => setNewEvent({ ...newEvent, startDate: v })} />
                <Input label="End Date" type="date" value={newEvent.endDate} onChange={(v) => setNewEvent({ ...newEvent, endDate: v })} />
                <textarea className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/60" placeholder="Event notes" value={newEvent.notes} onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })} />
                <GoldButton onClick={addEvent}><Plus className="h-4 w-4" /> Create Event</GoldButton>
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "crew" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <GlassCard>
                <SectionHeader icon={<Users className="h-6 w-6" />} title="Crew Roster" subtitle="Manage contractor profiles, roles, rates, and contact info." />
                <div className="grid gap-4 md:grid-cols-2">
                  {contractors.map((contractor) => (
                    <div key={contractor.id} className="rounded-3xl border border-white/10 bg-black/25 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold">{contractor.name}</h3>
                          <p className="text-sm text-zinc-400">{contractor.role}</p>
                        </div>
                        <StatusBadge label={contractor.status} tone="green" />
                      </div>
                      <div className="mt-5 space-y-3 text-sm">
                        <InfoLine icon={<DollarSign className="h-4 w-4" />} label="Default Rate" value={`${money(contractor.rate)} / ${contractor.rateType}`} />
                        <InfoLine icon={<Phone className="h-4 w-4" />} label="Phone" value={contractor.phone || "Not added"} />
                        <InfoLine icon={<Mail className="h-4 w-4" />} label="Email" value={contractor.email || "Not added"} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            <GlassCard>
              <SectionHeader icon={<UserPlus className="h-6 w-6" />} title="Add Contractor" subtitle="Save contractor info for scheduling." />
              <div className="space-y-3">
                <Input label="Name" value={newContractor.name} onChange={(v) => setNewContractor({ ...newContractor, name: v })} />
                <Input label="Role" value={newContractor.role} onChange={(v) => setNewContractor({ ...newContractor, role: v })} />
                <Input label="Phone" value={newContractor.phone} onChange={(v) => setNewContractor({ ...newContractor, phone: v })} />
                <Input label="Email" value={newContractor.email} onChange={(v) => setNewContractor({ ...newContractor, email: v })} />
                <Input label="Default Rate" type="number" value={newContractor.rate} onChange={(v) => setNewContractor({ ...newContractor, rate: v })} />
                <Select label="Rate Type" value={newContractor.rateType} onChange={(v) => setNewContractor({ ...newContractor, rateType: v as "day" | "hour" })} options={[{ value: "day", label: "Day Rate" }, { value: "hour", label: "Hourly" }]} />
                <GoldButton onClick={addContractor}><UserPlus className="h-4 w-4" /> Save Contractor</GoldButton>
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "payroll" && (
          <GlassCard>
            <SectionHeader icon={<DollarSign className="h-6 w-6" />} title="Payroll Approval" subtitle="Review clocked hours, approve contractor pay, and mark paid." />
            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <Metric icon={<Clock className="h-5 w-5" />} label="Clocked Labor" value={money(payrollTotal)} />
              <Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Approved" value={money(approvedPayroll)} />
              <Metric icon={<AlertTriangle className="h-5 w-5" />} label="Pending Items" value={pendingCount.toString()} />
            </div>
            <CrewTable rows={rows} onToggle={toggleAssignment} showPaid />
          </GlassCard>
        )}

        {activeTab === "invoices" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <GlassCard>
              <SectionHeader icon={<FileText className="h-6 w-6" />} title="Invoice Builder" subtitle="Generate labor invoice drafts from selected event hours." />
              <div className="space-y-4">
                <Select label="Select Event" value={selectedEventId} onChange={(v) => setSelectedEventId(Number(v))} options={events.map((e) => ({ value: e.id, label: e.name }))} />
                <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4">
                  <p className="text-sm text-amber-100">Invoice total</p>
                  <p className="text-3xl font-bold text-amber-300">{money(invoiceTotal)}</p>
                </div>
                <GoldButton><Download className="h-4 w-4" /> Export Invoice PDF</GoldButton>
              </div>
            </GlassCard>

            <div className="lg:col-span-2">
              <GlassCard>
                <SectionHeader icon={<FileText className="h-6 w-6" />} title="Invoice Preview" subtitle="Copy this into your invoice system or export later." />
                <div className="rounded-3xl border border-white/10 bg-black/40 p-5 font-mono text-sm leading-7 text-zinc-200">
                  <p className="text-xl font-bold text-white">Luxon Entertainment LLC</p>
                  <p>Invoice Draft</p>
                  <br />
                  <p>Client: {selectedEvent?.client}</p>
                  <p>Event: {selectedEvent?.name}</p>
                  <p>Venue: {selectedEvent?.venue}</p>
                  <p>Dates: {dateLabel(selectedEvent?.startDate || "")} - {dateLabel(selectedEvent?.endDate || "")}</p>
                  <br />
                  <p className="text-amber-300">Labor</p>
                  {selectedEventRows.map((row) => (
                    <p key={row.id}>{row.contractor?.name} — {row.position} — {dateLabel(row.workDate)} — {row.hours.toFixed(2)} hrs — {money(row.total)}</p>
                  ))}
                  <br />
                  <p className="text-lg font-bold text-white">Total: {money(invoiceTotal)}</p>
                  <p>Payment Terms: Net 30</p>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {activeTab === "updates" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <GlassCard>
              <SectionHeader icon={<Send className="h-6 w-6" />} title="Crew Confirmation Message" subtitle="Copy and send this to contractors before the event." />
              <MessageBox text={`You have been added to the Luxon Entertainment roster. Please confirm your position, work date, call time, location, and rate by replying CONFIRMED. If you have any questions, contact Brayan.`} />
              <GoldButton><Send className="h-4 w-4" /> Send Confirmation</GoldButton>
            </GlassCard>

            <GlassCard>
              <SectionHeader icon={<AlertTriangle className="h-6 w-6" />} title="Day-Of Crew Update" subtitle="Quick update for outdoor events, call time reminders, and show notes." />
              <MessageBox text={`Reminder: please arrive on time, dress appropriately for the event, bring water if outside, take your required break, and clock in/out through the Luxon Ops app. Call Brayan if anything changes.`} />
              <GoldButton><Send className="h-4 w-4" /> Send Day-Of Update</GoldButton>
            </GlassCard>

            <GlassCard>
              <SectionHeader icon={<Sparkles className="h-6 w-6" />} title="Missing Clock-Out Reminder" subtitle="Use this when someone forgets to clock out." />
              <MessageBox text={`Hey, please update your clock-out time for today’s Luxon job so payroll can be approved. Thank you.`} />
              <GoldButton><Send className="h-4 w-4" /> Send Reminder</GoldButton>
            </GlassCard>

            <GlassCard>
              <SectionHeader icon={<ClipboardCheck className="h-6 w-6" />} title="Payroll Approved Message" subtitle="Send after hours are reviewed." />
              <MessageBox text={`Your hours for the recent Luxon event have been reviewed and approved. Payment will be processed according to the agreed terms.`} />
              <GoldButton><Send className="h-4 w-4" /> Send Payroll Update</GoldButton>
            </GlassCard>
          </div>
        )}
      </section>
    </main>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl">{children}</div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">{icon}</div>
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3">
      <div className="text-amber-300">{icon}</div>
      <div>
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="font-medium text-zinc-100">{value}</div>
      </div>
    </div>
  );
}

function Alert({ title, text, tone }: { title: string; text: string; tone: "amber" | "red" | "green" }) {
  const tones = {
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    red: "border-red-400/20 bg-red-400/10 text-red-200",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  };
  return (
    <div className={`mb-3 rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm opacity-80">{text}</div>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "green" | "blue" | "amber" | "red" }) {
  const tones = {
    green: "bg-emerald-400/10 text-emerald-300",
    blue: "bg-blue-400/10 text-blue-300",
    amber: "bg-amber-400/10 text-amber-300",
    red: "bg-red-400/10 text-red-300",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</span>;
}

function SearchBox({ search, setSearch }: { search: string; setSearch: (value: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search crew, event, role..." className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400/60 md:w-80" />
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/60" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string | number; onChange: (value: string) => void; options: { value: string | number; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none focus:border-amber-400/60">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function GoldButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-5 font-semibold text-black shadow-lg shadow-amber-500/20 transition hover:scale-[1.01]">{children}</button>;
}

function MessageBox({ text }: { text: string }) {
  return <div className="mb-4 rounded-3xl border border-white/10 bg-black/40 p-5 text-sm leading-7 text-zinc-200">{text}</div>;
}

function CrewTable({ rows, onToggle, showPaid = false }: { rows: any[]; onToggle: (id: number, key: "confirmed" | "approved" | "paid") => void; showPaid?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-zinc-500">
            <th className="pb-4">Contractor</th>
            <th className="pb-4">Event</th>
            <th className="pb-4">Date</th>
            <th className="pb-4">Hours</th>
            <th className="pb-4">Pay</th>
            <th className="pb-4">Status</th>
            <th className="pb-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-white/5 last:border-0">
              <td className="py-4">
                <div className="font-semibold text-white">{row.contractor?.name}</div>
                <div className="text-xs text-zinc-500">{row.position}</div>
              </td>
              <td className="py-4">
                <div className="font-medium text-zinc-200">{row.event?.name}</div>
                <div className="text-xs text-zinc-500">{row.event?.venue}</div>
              </td>
              <td className="py-4 text-zinc-300">{dateLabel(row.workDate)}</td>
              <td className="py-4 text-zinc-300">{row.hours.toFixed(2)}</td>
              <td className="py-4 font-bold text-amber-300">{money(row.total)}</td>
              <td className="py-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={row.confirmed ? "Confirmed" : "Needs Confirm"} tone={row.confirmed ? "green" : "amber"} />
                  <StatusBadge label={row.approved ? "Approved" : "Pending"} tone={row.approved ? "blue" : "red"} />
                  {showPaid && <StatusBadge label={row.paid ? "Paid" : "Unpaid"} tone={row.paid ? "green" : "amber"} />}
                </div>
              </td>
              <td className="py-4">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onToggle(row.id, "confirmed")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10">Confirm</button>
                  <button onClick={() => onToggle(row.id, "approved")} className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-400/20">Approve</button>
                  {showPaid && <button onClick={() => onToggle(row.id, "paid")} className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-400/20">Paid</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
