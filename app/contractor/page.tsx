"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BadgeDollarSign,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  Sparkles,
  User,
  X,
} from "lucide-react";

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
  status?: string | null;
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

  const assignmentRows = useMemo(() => {
    return assignments.map((row) => {
      const event = eventsById[row.event_id];
      const hours = hoursBetween(row.clock_in, row.clock_out, row.break_hours || 0);
      const total =
        row.rate_type === "day" ? Number(row.rate || 0) : hours * Number(row.rate || 0);

      return {
        ...row,
        event,
        hours,
        total,
      };
    });
  }, [assignments, eventsById]);

  const totalTrackedHours = assignmentRows.reduce((sum, row) => sum + row.hours, 0);
  const approvedJobs = assignmentRows.filter((row) => row.approved).length;
  const paidJobs = assignmentRows.filter((row) => row.paid).length;
  const totalEarned = assignmentRows.reduce((sum, row) => sum + row.total, 0);

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
      const fullName =
        `${firstName} ${lastName}`.trim() || contractor.email || "Contractor";

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
      <main className="min-h-screen bg-[#050505] p-8 text-white">
        Loading contractor portal...
      </main>
    );
  }

  if (!contractor) {
    return (
      <main className="min-h-screen bg-[#050505] p-8 text-white">
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
              {contractor.name} · {contractor.email || ""}
            </p>
          </div>

          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
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

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Briefcase className="h-5 w-5" />}
            label="My Role"
            value={contractor.role || "Contractor"}
            sublabel="Current roster role"
          />
          <MetricCard
            icon={<BadgeDollarSign className="h-5 w-5" />}
            label="My Rate"
            value={`${money(Number(contractor.rate || 0))} / ${contractor.rate_type || "day"}`}
            sublabel="Configured pay rate"
          />
          <MetricCard
            icon={<CalendarDays className="h-5 w-5" />}
            label="Assignments"
            value={String(assignments.length)}
            sublabel={`${approvedJobs} approved · ${paidJobs} paid`}
          />
          <MetricCard
            icon={<Clock3 className="h-5 w-5" />}
            label="Tracked Hours"
            value={totalTrackedHours.toFixed(2)}
            sublabel={`${money(totalEarned)} total value`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <GlassCard>
            <div className="mb-5 flex items-center justify-between">
              <SectionTitle
                icon={<User className="h-5 w-5" />}
                title="My Profile"
                subtitle="Keep your contractor details up to date"
              />

              {editMode ? (
                <div className="flex gap-2">
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-2 text-sm font-semibold text-black"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {editMode ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="First Name"
                  value={profileForm.first_name}
                  onChange={(v) => setProfileForm({ ...profileForm, first_name: v })}
                />
                <Field
                  label="Last Name"
                  value={profileForm.last_name}
                  onChange={(v) => setProfileForm({ ...profileForm, last_name: v })}
                />
                <Field
                  label="Phone"
                  value={profileForm.phone}
                  onChange={(v) => setProfileForm({ ...profileForm, phone: v })}
                />
                <Field
                  label="Company"
                  value={profileForm.company}
                  onChange={(v) => setProfileForm({ ...profileForm, company: v })}
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
                  label="Emergency Contact Name"
                  value={profileForm.emergency_contact_name}
                  onChange={(v) =>
                    setProfileForm({ ...profileForm, emergency_contact_name: v })
                  }
                />
                <Field
                  label="Emergency Contact Phone"
                  value={profileForm.emergency_contact_phone}
                  onChange={(v) =>
                    setProfileForm({ ...profileForm, emergency_contact_phone: v })
                  }
                />
                <TextAreaField
                  label="Skills"
                  value={profileForm.skillsText}
                  onChange={(v) => setProfileForm({ ...profileForm, skillsText: v })}
                />
                <TextAreaField
                  label="Notes"
                  value={profileForm.notes}
                  onChange={(v) => setProfileForm({ ...profileForm, notes: v })}
                />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard icon={<Phone className="h-4 w-4" />} label="Phone" value={contractor.phone || "Not added"} />
                <InfoCard icon={<Building2 className="h-4 w-4" />} label="Company" value={contractor.company || "Not added"} />
                <InfoCard
                  icon={<MapPin className="h-4 w-4" />}
                  label="City / State"
                  value={
                    [contractor.city, contractor.state].filter(Boolean).join(", ") ||
                    "Not added"
                  }
                />
                <InfoCard
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Skills"
                  value={contractor.skills?.length ? contractor.skills.join(", ") : "Not added"}
                />
                <InfoCard
                  icon={<User className="h-4 w-4" />}
                  label="Emergency Contact"
                  value={contractor.emergency_contact_name || "Not added"}
                />
                <InfoCard
                  icon={<Phone className="h-4 w-4" />}
                  label="Emergency Phone"
                  value={contractor.emergency_contact_phone || "Not added"}
                />
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <SectionTitle
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Summary"
              subtitle="Quick stats from your current assignments"
            />

            <div className="mt-5 space-y-4">
              <SummaryRow label="Approved Jobs" value={String(approvedJobs)} />
              <SummaryRow label="Paid Jobs" value={String(paidJobs)} />
              <SummaryRow label="Tracked Hours" value={totalTrackedHours.toFixed(2)} />
              <SummaryRow label="Total Assignment Value" value={money(totalEarned)} />
              <SummaryRow
                label="Primary Email"
                value={contractor.email || "Not added"}
              />
              <SummaryRow
                label="Rate Type"
                value={contractor.rate_type || "day"}
              />
            </div>
          </GlassCard>
        </div>

        <div className="mt-6">
          <GlassCard>
            <SectionTitle
              icon={<CalendarDays className="h-5 w-5" />}
              title="My Assignments"
              subtitle="Your jobs, details, and current status"
            />

            <div className="mt-6 space-y-4">
              {assignmentRows.length ? (
                assignmentRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-3xl border border-white/10 bg-black/25 p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="text-xl font-semibold">
                            {row.position || "Assignment"}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] ${eventTone(
                              row.event?.status
                            )}`}
                          >
                            {row.event?.status || "Scheduled"}
                          </span>
                        </div>

                        <div className="text-sm text-zinc-400">
                          {row.event?.name || "Event"} · {row.event?.venue || ""}
                        </div>
                        <div className="mt-1 text-sm text-zinc-500">
                          {row.event?.address ? `· ${row.event.address}` : ""}
                        </div>
                      </div>

                      <div className="text-left md:text-right">
                        <div className="text-2xl font-semibold text-amber-300">
                          {money(row.total)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {money(Number(row.rate || 0))} / {row.rate_type || "day"}
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 grid gap-3 md:grid-cols-4">
                      <MiniInfo
                        icon={<CalendarDays className="h-4 w-4" />}
                        label="Work Date"
                        value={dateLabel(row.work_date)}
                      />
                      <MiniInfo
                        icon={<Clock3 className="h-4 w-4" />}
                        label="Call Time"
                        value={timeLabel(row.call_time)}
                      />
                      <MiniInfo
                        icon={<Clock3 className="h-4 w-4" />}
                        label="Clock In / Out"
                        value={`${timeLabel(row.clock_in)} - ${timeLabel(row.clock_out)}`}
                      />
                      <MiniInfo
                        icon={<BadgeDollarSign className="h-4 w-4" />}
                        label="Tracked Hours"
                        value={row.hours.toFixed(2)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <StatusPill active={!!row.confirmed} text="Confirmed" />
                      <StatusPill active={!!row.approved} text="Approved" />
                      <StatusPill active={!!row.paid} text="Paid" />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No assignments yet." />
              )}
            </div>
          </GlassCard>
        </div>
      </div>
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

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-2 flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
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
    <label className="block md:col-span-2">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none placeholder:text-zinc-500 focus:border-amber-400/40"
      />
    </label>
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
      className={`rounded-full border px-3 py-1 text-xs ${
        active
          ? "border-emerald-400/20 bg-emerald-500/20 text-emerald-300"
          : "border-white/10 bg-white/[0.04] text-zinc-400"
      }`}
    >
      {text}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
      {text}
    </div>
  );
}
