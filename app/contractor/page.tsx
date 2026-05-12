"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Contractor = {
  id: number;
  user_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  phone?: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  skills?: string[];
  rate?: number;
  rate_type?: string;
  status?: string;
};

type Assignment = {
  id: number;
  contractor_id: number;
  event_id: number;
  position: string;
  work_date: string;
  call_time: string | null;
  clock_in: string | null;
  clock_out: string | null;
  break_hours: number;
  rate: number;
  rate_type: string;
  confirmed: boolean;
  approved: boolean;
  paid: boolean;
};

type EventItem = {
  id: number;
  name: string;
  client: string | null;
  venue: string | null;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function dateLabel(value?: string | null) {
  if (!value) return "";
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

function hoursBetween(start?: string | null, end?: string | null, breakHours = 0) {
  if (!start || !end) return 0;
  const [sh, sm] = String(start).slice(0, 5).split(":").map(Number);
  const [eh, em] = String(end).slice(0, 5).split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60;
  return Math.max(0, (endMins - startMins) / 60 - Number(breakHours || 0));
}

export default function ContractorPage() {
  const [loading, setLoading] = useState(true);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [eventsById, setEventsById] = useState<Record<number, EventItem>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadContractorPortal() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        window.location.href = "/login";
        return;
      }

      const userId = session.user.id;

      const { data: contractorRow, error: contractorError } = await supabase
        .from("contractors")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (contractorError || !contractorRow) {
        setMessage("Could not find your contractor profile.");
        setLoading(false);
        return;
      }

      setContractor(contractorRow);

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from("assignments")
        .select("*")
        .eq("contractor_id", contractorRow.id)
        .order("work_date", { ascending: true });

      if (assignmentError) {
        setMessage("Could not load your assignments.");
        setAssignments([]);
        setLoading(false);
        return;
      }

      const loadedAssignments = assignmentRows || [];
      setAssignments(loadedAssignments);

      const uniqueEventIds = [...new Set(loadedAssignments.map((row) => row.event_id).filter(Boolean))];

      if (uniqueEventIds.length > 0) {
        const { data: eventRows } = await supabase
          .from("events")
          .select("*")
          .in("id", uniqueEventIds);

        const map: Record<number, EventItem> = {};
        (eventRows || []).forEach((event) => {
          map[event.id] = event;
        });
        setEventsById(map);
      }

      setLoading(false);
    }

    loadContractorPortal();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        Loading contractor portal...
      </main>
    );
  }

  if (!contractor) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-4xl font-bold">Contractor Portal</h1>
        <p className="mt-4 text-red-300">{message || "No contractor profile found."}</p>
        <button
          onClick={signOut}
          className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
        >
          Sign Out
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Contractor Portal</h1>
          <p className="mt-2 text-zinc-400">
            {contractor.name} · {contractor.email || ""}
          </p>
        </div>

        <button
          onClick={signOut}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
        >
          Sign Out
        </button>
      </div>

      {message && (
        <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          {message}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-zinc-500">My Role</div>
          <div className="mt-2 text-2xl font-bold">{contractor.role || "Contractor"}</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-zinc-500">My Rate</div>
          <div className="mt-2 text-2xl font-bold">
            {money(Number(contractor.rate || 0))} / {contractor.rate_type || "day"}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-zinc-500">Assignments</div>
          <div className="mt-2 text-2xl font-bold">{assignments.length}</div>
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="mb-4 text-2xl font-semibold">My Profile</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-black/20 p-4">
            <div className="text-xs text-zinc-500">Phone</div>
            <div className="mt-1">{contractor.phone || "Not added"}</div>
          </div>
          <div className="rounded-2xl bg-black/20 p-4">
            <div className="text-xs text-zinc-500">Company</div>
            <div className="mt-1">{contractor.company || "Not added"}</div>
          </div>
          <div className="rounded-2xl bg-black/20 p-4">
            <div className="text-xs text-zinc-500">City / State</div>
            <div className="mt-1">
              {[contractor.city, contractor.state].filter(Boolean).join(", ") || "Not added"}
            </div>
          </div>
          <div className="rounded-2xl bg-black/20 p-4">
            <div className="text-xs text-zinc-500">Skills</div>
            <div className="mt-1">
              {contractor.skills?.length ? contractor.skills.join(", ") : "Not added"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="mb-4 text-2xl font-semibold">My Assignments</h2>

        <div className="space-y-4">
          {assignments.length ? (
            assignments.map((row) => {
              const event = eventsById[row.event_id];
              const hours = hoursBetween(row.clock_in, row.clock_out, row.break_hours || 0);
              const total =
                row.rate_type === "day" ? Number(row.rate || 0) : hours * Number(row.rate || 0);

              return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-lg font-semibold">{row.position || "Assignment"}</div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {event?.name || "Event"} · {event?.venue || ""}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500">
                        {dateLabel(row.work_date)}
                        {event?.address ? ` · ${event.address}` : ""}
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="font-semibold text-amber-300">{money(total)}</div>
                      <div className="text-xs text-zinc-500">
                        {money(Number(row.rate || 0))} / {row.rate_type || "day"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl bg-black/20 p-3">
                      <div className="text-xs text-zinc-500">Call Time</div>
                      <div className="mt-1">{timeLabel(row.call_time)}</div>
                    </div>
                    <div className="rounded-2xl bg-black/20 p-3">
                      <div className="text-xs text-zinc-500">Clock In / Out</div>
                      <div className="mt-1">
                        {timeLabel(row.clock_in)} - {timeLabel(row.clock_out)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-black/20 p-3">
                      <div className="text-xs text-zinc-500">Tracked Hours</div>
                      <div className="mt-1">{hours.toFixed(2)}</div>
                    </div>
                    <div className="rounded-2xl bg-black/20 p-3">
                      <div className="text-xs text-zinc-500">Status</div>
                      <div className="mt-1">
                        {row.paid
                          ? "Paid"
                          : row.approved
                          ? "Approved"
                          : row.confirmed
                          ? "Confirmed"
                          : "Pending"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-zinc-400">No assignments yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}
