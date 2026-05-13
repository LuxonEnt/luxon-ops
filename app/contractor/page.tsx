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
  ShieldCheck,
  Sparkles,
  Upload,
  User,
} from "lucide-react";

type Contractor = {
  id: number;
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
  const [message, setMessage] = useState("");
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        window.location.href = "/login";
        return;
      }

      const { data: contractorRow, error: contractorError } = await supabase
        .from("contractors")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (contractorError || !contractorRow) {
        window.location.href = "/login";
        return;
      }

      setContractor(contractorRow);

      const [{ data: assignmentRows }, { data: eventRows }] = await Promise.all([
        supabase
          .from("assignments")
          .select("*")
          .eq("contractor_id", contractorRow.id)
          .order("work_date", { ascending: false }),
        supabase.from("events").select("id,name,venue,address"),
      ]);

      setAssignments(assignmentRows || []);
      setEvents(eventRows || []);
      setLoading(false);
    }

    void boot();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const eventMap = useMemo(() => {
    const map: Record<number, EventItem> = {};
    events.forEach((event) => {
      map[event.id] = event;
    });
    return map;
  }, [events]);

  const totalValue = assignments.reduce((sum, row) => sum + Number(row.rate || 0), 0);
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
          <MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="My Role" value={contractor?.role || "Contractor"} sublabel="Current roster role" />
          <MetricCard icon={<DollarSign className="h-5 w-5" />} label="My Rate" value={`${money(Number(contractor?.rate || 0))} / ${contractor?.rate_type || "day"}`} sublabel="Configured pay rate" />
          <MetricCard icon={<CalendarDays className="h-5 w-5" />} label="Assignments" value={String(assignments.length)} sublabel={`${paidCount} paid`} />
          <MetricCard icon={<FileText className="h-5 w-5" />} label="Assignment Value" value={money(totalValue)} sublabel="Total assigned value" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <GlassCard>
            <SectionTitle
              icon={<User className="h-5 w-5" />}
              title="My Profile"
              subtitle="Contractor details on file"
            />

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <MiniInfo icon={<User className="h-4 w-4" />} label="Name" value={contractor?.name || "--"} />
              <MiniInfo icon={<Briefcase className="h-4 w-4" />} label="Role" value={contractor?.role || "--"} />
              <MiniInfo icon={<Building2 className="h-4 w-4" />} label="Company" value={contractor?.company || "--"} />
              <MiniInfo icon={<MapPin className="h-4 w-4" />} label="City / State" value={`${contractor?.city || "--"}${contractor?.state ? `, ${contractor.state}` : ""}`} />
              <MiniInfo icon={<User className="h-4 w-4" />} label="Phone" value={contractor?.phone || "--"} />
              <MiniInfo icon={<User className="h-4 w-4" />} label="Emergency Contact" value={contractor?.emergency_contact_name || "--"} />
            </div>
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
                          <div className="font-semibold">{row.position || "Assignment"}</div>
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
                            {money(Number(row.rate || 0))} / {row.rate_type || "day"}
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
