"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  Briefcase,
  Building2,
  CalendarDays,
  Clock3,
  DollarSign,
  FileText,
  LogOut,
  MapPin,
  Pencil,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  Phone,
  AlertCircle,
} from "lucide-react";

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

export default function ContractorPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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
      supabase.from("events").select("id,name,venue,address"),
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
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
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

  const eventMap = useMemo(() => {
    const map: Record<number, EventItem> = {};
    events.forEach((event) => {
      map[event.id] = event;
    });
    return map;
  }, [events]);

  const totalValue = assignments.reduce(
    (sum, row) => sum + Number(row.rate || 0),
    0
  );
  const paidCount = assignments.filter((row) => row.paid).length;

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
            value={String(assignments.length)}
            sublabel={`${paidCount} paid`}
          />
          <MetricCard
            icon={<FileText className="h-5 w-5" />}
            label="Assignment Value"
            value={money(totalValue)}
            sublabel="Total assigned value"
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

        <div className="mt-6">
          <GlassCard>
            <SectionTitle
              icon={<CalendarDays className="h-5 w-5" />}
              title="My Assignments"
              subtitle="Confirmed and scheduled work"
            />
            <div className="mt-5 space-y-3">
              {assignments.length ? (
                assignments.map((row) => {
                  const event = eventMap[row.event_id];
                  return (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
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
                        </div>

                        <div className="text-left md:text-right">
                          <div className="font-semibold text-amber-300">
                            {money(Number(row.rate || 0))} /{" "}
                            {row.rate_type || "day"}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {dateLabel(row.work_date)} · {timeLabel(row.call_time)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
                  No assignments yet.
                </div>
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
}: {
  children: React.ReactNode;
}) {
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
