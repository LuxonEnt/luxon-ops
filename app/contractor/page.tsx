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

export default function ContractorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [eventsById, setEventsById] = useState<Record<number, EventItem>>({});
  const [message, setMessage] = useState("");
  const [editMode, setEditMode] = useState(false);

  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    company: "",
    city: "",
    state: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    notes: "",
    skillsText: "",
  });

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
      setProfileForm({
        first_name: contractorRow.first_name || "",
        last_name: contractorRow.last_name || "",
        phone: contractorRow.phone || "",
        company: contractorRow.company || "",
        city: contractorRow.city || "",
        state: contractorRow.state || "",
        emergency_contact_name: contractorRow.emergency_contact_name || "",
        emergency_contact_phone: contractorRow.emergency_contact_phone || "",
        notes: contractorRow.notes || "",
        skillsText: Array.isArray(contractorRow.skills)
          ? contractorRow.skills.join(", ")
          : "",
      });

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

      const uniqueEventIds = [
        ...new Set(loadedAssignments.map((row) => row.event_id).filter(Boolean)),
      ];

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

  async function saveProfile() {
    if (!contractor) return;

    try {
      setSaving(true);
      setMessage("");

      const firstName = profileForm.first_name.trim();
      const lastName = profileForm.last_name.trim();
      const fullName = `${firstName} ${lastName}`.trim() || contractor.email || "Contractor";

      const skills = profileForm.skillsText
        .split(/[\n,]+/)
        .map((skill) => skill.trim())
        .filter(Boolean);

      const updatePayload = {
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        phone: profileForm.phone.trim(),
        company: profileForm.company.trim(),
        city: profileForm.city.trim(),
        state: profileForm.state.trim(),
        emergency_contact_name: profileForm.emergency_contact_name.trim(),
        emergency_contact_phone: profileForm.emergency_contact_phone.trim(),
        notes: profileForm.notes.trim(),
        skills,
      };

      const { data, error } = await supabase
        .from("contractors")
        .update(updatePayload)
        .eq("id", contractor.id)
        .select()
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      setContractor(data);
      setProfileForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone: data.phone || "",
        company: data.company || "",
        city: data.city || "",
        state: data.state || "",
        emergency_contact_name: data.emergency_contact_name || "",
        emergency_contact_phone: data.emergency_contact_phone || "",
        notes: data.notes || "",
        skillsText: Array.isArray(data.skills) ? data.skills.join(", ") : "",
      });
      setEditMode(false);
      setMessage("Profile updated successfully.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (!contractor) return;
    setProfileForm({
      first_name: contractor.first_name || "",
      last_name: contractor.last_name || "",
      phone: contractor.phone || "",
      company: contractor.company || "",
      city: contractor.city || "",
      state: contractor.state || "",
      emergency_contact_name: contractor.emergency_contact_name || "",
      emergency_contact_phone: contractor.emergency_contact_phone || "",
      notes: contractor.notes || "",
      skillsText: Array.isArray(contractor.skills)
        ? contractor.skills.join(", ")
        : "",
    });
    setEditMode(false);
    setMessage("");
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
        <p className="mt-4 text-red-300">
          {message || "No contractor profile found."}
        </p>
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
          <div className="mt-2 text-2xl font-bold">
            {contractor.role || "Contractor"}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-zinc-500">My Rate</div>
          <div className="mt-2 text-2xl font-bold">
            {money(Number(contractor.rate || 0))} /{" "}
            {contractor.rate_type || "day"}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-zinc-500">Assignments</div>
          <div className="mt-2 text-2xl font-bold">{assignments.length}</div>
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">My Profile</h2>

          {editMode ? (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-2 text-sm font-semibold text-black"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
            >
              Edit Profile
            </button>
          )}
        </div>

        {editMode ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                First Name
              </span>
              <input
                value={profileForm.first_name}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, first_name: e.target.value })
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                Last Name
              </span>
              <input
                value={profileForm.last_name}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, last_name: e.target.value })
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                Phone
              </span>
              <input
                value={profileForm.phone}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, phone: e.target.value })
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                Company
              </span>
              <input
                value={profileForm.company}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, company: e.target.value })
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                City
              </span>
              <input
                value={profileForm.city}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, city: e.target.value })
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                State
              </span>
              <input
                value={profileForm.state}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, state: e.target.value })
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                Emergency Contact Name
              </span>
              <input
                value={profileForm.emergency_contact_name}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    emergency_contact_name: e.target.value,
                  })
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                Emergency Contact Phone
              </span>
              <input
                value={profileForm.emergency_contact_phone}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    emergency_contact_phone: e.target.value,
                  })
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                Skills
              </span>
              <textarea
                value={profileForm.skillsText}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, skillsText: e.target.value })
                }
                placeholder="A1, V1, L1, Stagehand, LED Tech"
                className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                Notes
              </span>
              <textarea
                value={profileForm.notes}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, notes: e.target.value })
                }
                className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none"
              />
            </label>
          </div>
        ) : (
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
                {[contractor.city, contractor.state].filter(Boolean).join(", ") ||
                  "Not added"}
              </div>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <div className="text-xs text-zinc-500">Skills</div>
              <div className="mt-1">
                {contractor.skills?.length
                  ? contractor.skills.join(", ")
                  : "Not added"}
              </div>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <div className="text-xs text-zinc-500">Emergency Contact</div>
              <div className="mt-1">
                {contractor.emergency_contact_name || "Not added"}
              </div>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <div className="text-xs text-zinc-500">Emergency Phone</div>
              <div className="mt-1">
                {contractor.emergency_contact_phone || "Not added"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="mb-4 text-2xl font-semibold">My Assignments</h2>

        <div className="space-y-4">
          {assignments.length ? (
            assignments.map((row) => {
              const event = eventsById[row.event_id];
              const hours = hoursBetween(
                row.clock_in,
                row.clock_out,
                row.break_hours || 0
              );
              const total =
                row.rate_type === "day"
                  ? Number(row.rate || 0)
                  : hours * Number(row.rate || 0);

              return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-lg font-semibold">
                        {row.position || "Assignment"}
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {event?.name || "Event"} · {event?.venue || ""}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500">
                        {dateLabel(row.work_date)}
                        {event?.address ? ` · ${event.address}` : ""}
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="font-semibold text-amber-300">
                        {money(total)}
                      </div>
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
