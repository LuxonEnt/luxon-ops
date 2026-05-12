"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  CalendarDays,
  Users,
  ClipboardList,
  DollarSign,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
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

export default function ManagerPage() {
  const [status, setStatus] = useState("Checking access...");
  const [email, setEmail] = useState("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "events" | "contractors" | "assignments" | "payroll"
  >("overview");
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState("");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

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
    if (status === "allowed") {
      loadData();
    }
  }, [status]);

  async function loadData() {
    setLoadingData(true);
    setMessage("");

    const [{ data: eventsData, error: eventsError }, { data: contractorsData, error: contractorsError }, { data: assignmentsData, error: assignmentsError }] =
      await Promise.all([
        supabase.from("events").select("*").order("start_date", { ascending: false }),
        supabase.from("contractors").select("*").order("name", { ascending: true }),
        supabase.from("assignments").select("*").order("work_date", { ascending: false }),
      ]);

    if (eventsError || contractorsError || assignmentsError) {
      setMessage("Could not load manager data.");
      setLoadingData(false);
      return;
    }

    setEvents(eventsData || []);
    setContractors(contractorsData || []);
    setAssignments(assignmentsData || []);
    setLoadingData(false);
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
    if (field === "first_name" || field === "last_name") {
      payload.name = nextName;
    }

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

  if (status !== "allowed") {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-3xl font-bold">Manager Portal</h1>
        <p className="mt-4 text-zinc-400">{status}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
              Luxon Entertainment
            </div>
            <h1 className="text-4xl font-bold">Manager Portal</h1>
            <p className="mt-2 text-zinc-400">Signed in as {email}</p>
          </div>

          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          {[
            ["overview", "Overview"],
            ["events", "Events"],
            ["contractors", "Contractors"],
            ["assignments", "Assignments"],
            ["payroll", "Payroll"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() =>
                setActiveTab(
                  key as
                    | "overview"
                    | "events"
                    | "contractors"
                    | "assignments"
                    | "payroll"
                )
              }
              className={`rounded-2xl px-4 py-2 text-sm ${
                activeTab === key
                  ? "bg-amber-400 text-black"
                  : "border border-white/10 bg-white/5 text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingData ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            Loading manager data...
          </div>
        ) : null}

        {activeTab === "overview" && !loadingData && (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Events" value={String(events.length)} />
            <StatCard icon={<Users className="h-5 w-5" />} label="Contractors" value={String(contractors.length)} />
            <StatCard icon={<ClipboardList className="h-5 w-5" />} label="Assignments" value={String(assignments.length)} />
            <StatCard icon={<DollarSign className="h-5 w-5" />} label="Payroll" value={money(totalPayroll)} />
          </div>
        )}

        {activeTab === "events" && !loadingData && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-300" />
                <h2 className="text-2xl font-semibold">Create Event</h2>
              </div>

              <div className="space-y-3">
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
                <button
                  onClick={addEvent}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                >
                  Create Event
                </button>
              </div>
            </section>

            <section className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-4 text-2xl font-semibold">Events</h2>
              <div className="space-y-4">
                {events.length ? (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold">{event.name}</div>
                          <div className="text-sm text-zinc-400">
                            {event.client || ""} {event.venue ? `· ${event.venue}` : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => removeEvent(event.id)}
                          className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Name" value={event.name || ""} onChange={(v) => updateEventField(event.id, "name", v)} />
                        <Field label="Client" value={event.client || ""} onChange={(v) => updateEventField(event.id, "client", v)} />
                        <Field label="Venue" value={event.venue || ""} onChange={(v) => updateEventField(event.id, "venue", v)} />
                        <Field label="Address" value={event.address || ""} onChange={(v) => updateEventField(event.id, "address", v)} />
                        <Field label="Start Date" type="date" value={event.start_date || ""} onChange={(v) => updateEventField(event.id, "start_date", v)} />
                        <Field label="End Date" type="date" value={event.end_date || ""} onChange={(v) => updateEventField(event.id, "end_date", v)} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-400">No events yet.</div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "contractors" && !loadingData && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-300" />
                <h2 className="text-2xl font-semibold">Create Contractor</h2>
              </div>

              <div className="space-y-3">
                <Field label="First Name" value={newContractor.first_name} onChange={(v) => setNewContractor({ ...newContractor, first_name: v })} />
                <Field label="Last Name" value={newContractor.last_name} onChange={(v) => setNewContractor({ ...newContractor, last_name: v })} />
                <Field label="Role" value={newContractor.role} onChange={(v) => setNewContractor({ ...newContractor, role: v })} />
                <Field label="Phone" value={newContractor.phone} onChange={(v) => setNewContractor({ ...newContractor, phone: v })} />
                <Field label="Email" value={newContractor.email} onChange={(v) => setNewContractor({ ...newContractor, email: v })} />
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
                <button
                  onClick={addContractor}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                >
                  Create Contractor
                </button>
              </div>
            </section>

            <section className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-4 text-2xl font-semibold">Contractors</h2>
              <div className="space-y-4">
                {contractors.length ? (
                  contractors.map((contractor) => (
                    <div
                      key={contractor.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold">{contractor.name}</div>
                          <div className="text-sm text-zinc-400">
                            {contractor.email || ""} {contractor.role ? `· ${contractor.role}` : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => removeContractor(contractor.id)}
                          className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="First Name" value={contractor.first_name || ""} onChange={(v) => updateContractorField(contractor, "first_name", v)} />
                        <Field label="Last Name" value={contractor.last_name || ""} onChange={(v) => updateContractorField(contractor, "last_name", v)} />
                        <Field label="Role" value={contractor.role || ""} onChange={(v) => updateContractorField(contractor, "role", v)} />
                        <Field label="Phone" value={contractor.phone || ""} onChange={(v) => updateContractorField(contractor, "phone", v)} />
                        <Field label="Email" value={contractor.email || ""} onChange={(v) => updateContractorField(contractor, "email", v)} />
                        <Field label="Rate" type="number" value={String(contractor.rate || 0)} onChange={(v) => updateContractorField(contractor, "rate", v)} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-400">No contractors yet.</div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "assignments" && !loadingData && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-300" />
                <h2 className="text-2xl font-semibold">Create Assignment</h2>
              </div>

              <div className="space-y-3">
                <SelectField
                  label="Event"
                  value={newAssignment.event_id}
                  onChange={(v) => setNewAssignment({ ...newAssignment, event_id: v })}
                  options={events.map((e) => ({ value: String(e.id), label: e.name }))}
                />
                <SelectField
                  label="Contractor"
                  value={newAssignment.contractor_id}
                  onChange={(v) =>
                    setNewAssignment({ ...newAssignment, contractor_id: v })
                  }
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
                <button
                  onClick={addAssignment}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                >
                  Create Assignment
                </button>
              </div>
            </section>

            <section className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-4 text-2xl font-semibold">Assignments</h2>
              <div className="space-y-4">
                {assignments.length ? (
                  assignments.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold">
                            {row.position || "Assignment"}
                          </div>
                          <div className="text-sm text-zinc-400">
                            {contractorMap[row.contractor_id]?.name || "Contractor"} ·{" "}
                            {eventMap[row.event_id]?.name || "Event"}
                          </div>
                        </div>
                        <button
                          onClick={() => removeAssignment(row.id)}
                          className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Position" value={row.position || ""} onChange={(v) => updateAssignmentField(row.id, "position", v)} />
                        <Field label="Work Date" type="date" value={row.work_date || ""} onChange={(v) => updateAssignmentField(row.id, "work_date", v)} />
                        <Field label="Call Time" type="time" value={String(row.call_time || "").slice(0, 5)} onChange={(v) => updateAssignmentField(row.id, "call_time", v)} />
                        <Field label="Rate" type="number" value={String(row.rate || 0)} onChange={(v) => updateAssignmentField(row.id, "rate", v)} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <ToggleButton
                          active={!!row.confirmed}
                          label="Confirmed"
                          onClick={() =>
                            updateAssignmentField(row.id, "confirmed", !row.confirmed)
                          }
                        />
                        <ToggleButton
                          active={!!row.approved}
                          label="Approved"
                          onClick={() =>
                            updateAssignmentField(row.id, "approved", !row.approved)
                          }
                        />
                        <ToggleButton
                          active={!!row.paid}
                          label="Paid"
                          onClick={() =>
                            updateAssignmentField(row.id, "paid", !row.paid)
                          }
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-400">No assignments yet.</div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "payroll" && !loadingData && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard icon={<DollarSign className="h-5 w-5" />} label="Total Payroll" value={money(totalPayroll)} />
              <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Approved Payroll" value={money(approvedPayroll)} />
              <StatCard icon={<ClipboardList className="h-5 w-5" />} label="Unpaid Items" value={String(unpaidCount)} />
            </div>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-4 text-2xl font-semibold">Payroll Review</h2>
              <div className="space-y-4">
                {payrollRows.length ? (
                  payrollRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-lg font-semibold">
                            {row.contractor?.name || "Contractor"}
                          </div>
                          <div className="text-sm text-zinc-400">
                            {row.position || "Assignment"} ·{" "}
                            {row.event?.name || "Event"}
                          </div>
                          <div className="mt-1 text-sm text-zinc-500">
                            {dateLabel(row.work_date)} · Call {timeLabel(row.call_time)}
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <div className="font-semibold text-amber-300">
                            {money(row.total)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {row.hours.toFixed(2)} hrs · {money(Number(row.rate || 0))} /{" "}
                            {row.rate_type || "day"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <ToggleButton
                          active={!!row.confirmed}
                          label="Confirmed"
                          onClick={() =>
                            updateAssignmentField(row.id, "confirmed", !row.confirmed)
                          }
                        />
                        <ToggleButton
                          active={!!row.approved}
                          label="Approved"
                          onClick={() =>
                            updateAssignmentField(row.id, "approved", !row.approved)
                          }
                        />
                        <ToggleButton
                          active={!!row.paid}
                          label="Paid"
                          onClick={() =>
                            updateAssignmentField(row.id, "paid", !row.paid)
                          }
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-400">No payroll items yet.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-3 inline-flex rounded-2xl bg-amber-400/10 p-3 text-amber-300">
        {icon}
      </div>
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
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
      <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
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
      <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none"
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
      <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
      >
        <option value="">Select</option>
        {options.map((option) => {
          const value =
            typeof option === "string" ? option : option.value;
          const label =
            typeof option === "string" ? option : option.label;
          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
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
      className={`rounded-2xl px-4 py-2 text-sm ${
        active
          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/20"
          : "bg-white/5 text-white border border-white/10"
      }`}
    >
      {label}
    </button>
  );
}
