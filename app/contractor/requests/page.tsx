"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  LogOut,
  Sparkles,
  XCircle,
  RefreshCw,
  Edit3,
} from "lucide-react";

type Contractor = {
  id: number;
  user_id: string;
  name: string;
  email?: string | null;
};

type EventItem = {
  id: number;
  name: string;
  venue?: string | null;
  address?: string | null;
};

type CrewRequest = {
  id: number;
  event_id: number;
  title: string;
  position: string;
  work_date: string | null;
  call_time: string | null;
  rate: number;
  rate_type: string;
  slots: number;
  filled_slots: number;
  notes?: string | null;
  status: string;
};

type CrewResponse = {
  id: number;
  request_id: number;
  contractor_id: number;
  response_status: string;
  notes?: string | null;
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

  if (Number.isNaN(h) || Number.isNaN(m)) return value;

  return new Date(2026, 0, 1, h, m).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function responseLabel(status?: string | null) {
  if (!status) return "No response yet";
  if (status === "available") return "Applied / Available";
  if (status === "unavailable") return "Responded Unavailable";
  if (status === "confirmed") return "Confirmed by Manager";
  return status;
}

function responseDescription(status?: string | null) {
  if (!status) {
    return "You have not responded to this position yet.";
  }

  if (status === "available") {
    return "You applied for this position and marked yourself available. You can still change your availability below.";
  }

  if (status === "unavailable") {
    return "You responded that you are unavailable. You can still change your availability below.";
  }

  if (status === "confirmed") {
    return "You have been confirmed by the manager for this position.";
  }

  return "Your response has been saved.";
}

function responseBadgeClasses(status?: string | null) {
  if (status === "available") {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  }

  if (status === "confirmed") {
    return "border-amber-400/40 bg-amber-400/20 text-amber-200";
  }

  if (status === "unavailable") {
    return "border-red-500/30 bg-red-500/15 text-red-300";
  }

  return "border-white/10 bg-white/[0.05] text-zinc-300";
}

export default function ContractorRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [requests, setRequests] = useState<CrewRequest[]>([]);
  const [responses, setResponses] = useState<CrewResponse[]>([]);
  const [notesByRequest, setNotesByRequest] = useState<Record<number, string>>(
    {},
  );
  const [savingRequestId, setSavingRequestId] = useState<number | null>(null);

  useEffect(() => {
    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        window.location.href = "/login";
        return;
      }

      const { data: contractorRow, error } = await supabase
        .from("contractors")
        .select("id,user_id,name,email")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error || !contractorRow) {
        window.location.href = "/login";
        return;
      }

      setContractor(contractorRow);
      await loadAll(contractorRow.id);
    }

    void boot();
  }, []);

  async function loadAll(contractorId: number) {
    setLoading(true);
    setMessage("");

    const [
      { data: requestsData, error: requestsError },
      { data: responsesData, error: responsesError },
      { data: eventsData, error: eventsError },
    ] = await Promise.all([
      supabase
        .from("crew_position_requests")
        .select("*")
        .neq("status", "Filled")
        .neq("status", "Cancelled")
        .order("created_at", { ascending: false }),
      supabase
        .from("crew_request_responses")
        .select("*")
        .eq("contractor_id", contractorId)
        .order("updated_at", { ascending: false }),
      supabase.from("events").select("id,name,venue,address"),
    ]);

    if (requestsError || responsesError || eventsError) {
      setMessage(
        requestsError?.message ||
          responsesError?.message ||
          eventsError?.message ||
          "Could not load open requests.",
      );
      setLoading(false);
      return;
    }

    setRequests(requestsData || []);
    setResponses(responsesData || []);
    setEvents(eventsData || []);

    const initialNotes: Record<number, string> = {};
    (responsesData || []).forEach((response) => {
      initialNotes[response.request_id] = response.notes || "";
    });
    setNotesByRequest(initialNotes);

    setLoading(false);
  }

  async function refreshPage() {
    if (!contractor) return;
    await loadAll(contractor.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function respondToRequest(
    requestId: number,
    responseStatus: "available" | "unavailable",
  ) {
    if (!contractor) return;

    try {
      setSavingRequestId(requestId);
      setMessage("");

      const { error } = await supabase.from("crew_request_responses").upsert(
        {
          request_id: requestId,
          contractor_id: contractor.id,
          response_status: responseStatus,
          notes: (notesByRequest[requestId] || "").trim() || null,
        },
        {
          onConflict: "request_id,contractor_id",
        },
      );

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        responseStatus === "available"
          ? "You applied and marked yourself available for this position."
          : "Your response was updated to unavailable.",
      );

      await loadAll(contractor.id);
    } finally {
      setSavingRequestId(null);
    }
  }

  const eventMap = useMemo(() => {
    const map: Record<number, EventItem> = {};
    events.forEach((event) => {
      map[event.id] = event;
    });
    return map;
  }, [events]);

  const responseMap = useMemo(() => {
    const map: Record<number, CrewResponse> = {};
    responses.forEach((response) => {
      map[response.request_id] = response;
    });
    return map;
  }, [responses]);

  const appliedRequests = requests.filter((request) => {
    const response = responseMap[request.id];
    return response?.response_status === "available";
  });

  const unavailableRequests = requests.filter((request) => {
    const response = responseMap[request.id];
    return response?.response_status === "unavailable";
  });

  const openNoResponseRequests = requests.filter((request) => {
    const response = responseMap[request.id];
    return !response;
  });

  const confirmedRequests = requests.filter((request) => {
    const response = responseMap[request.id];
    return response?.response_status === "confirmed";
  });

  const sortedRequests = [
    ...confirmedRequests,
    ...appliedRequests,
    ...openNoResponseRequests,
    ...unavailableRequests,
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] p-8 text-white">
        Loading contractor requests...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-yellow-300/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Luxon Entertainment
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Open Position Requests
            </h1>
            <p className="mt-2 text-zinc-400">
              {contractor?.name} · Apply or update your availability
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshPage}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              <RefreshCw className="mr-2 inline h-4 w-4" />
              Refresh
            </button>

            <a
              href="/contractor"
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              Back to Contractor
            </a>

            <button
              onClick={signOut}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              <LogOut className="mr-2 inline h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <MetricCard
            label="Open"
            value={String(openNoResponseRequests.length)}
            sublabel="Need your response"
          />
          <MetricCard
            label="Applied"
            value={String(appliedRequests.length)}
            sublabel="You marked available"
          />
          <MetricCard
            label="Unavailable"
            value={String(unavailableRequests.length)}
            sublabel="You declined"
          />
          <MetricCard
            label="Confirmed"
            value={String(confirmedRequests.length)}
            sublabel="Manager confirmed"
          />
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        <div className="space-y-4">
          {sortedRequests.length ? (
            sortedRequests.map((request) => {
              const myResponse = responseMap[request.id];
              const event = eventMap[request.event_id];
              const isSaving = savingRequestId === request.id;
              const isAvailable = myResponse?.response_status === "available";
              const isUnavailable =
                myResponse?.response_status === "unavailable";
              const isConfirmed = myResponse?.response_status === "confirmed";

              return (
                <section
                  key={request.id}
                  className={`rounded-[28px] border p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6 ${
                    isAvailable
                      ? "border-emerald-500/30 bg-emerald-500/[0.08]"
                      : isUnavailable
                        ? "border-red-500/25 bg-red-500/[0.06]"
                        : isConfirmed
                          ? "border-amber-400/30 bg-amber-400/[0.08]"
                          : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${responseBadgeClasses(
                            myResponse?.response_status,
                          )}`}
                        >
                          {isAvailable || isConfirmed ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : isUnavailable ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            <Edit3 className="h-3.5 w-3.5" />
                          )}
                          {responseLabel(myResponse?.response_status)}
                        </span>

                        {myResponse ? (
                          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-zinc-400">
                            You already responded
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                            Response needed
                          </span>
                        )}
                      </div>

                      <h2 className="text-2xl font-semibold">
                        {request.title}
                      </h2>
                      <p className="text-zinc-400">
                        {request.position} · {event?.name || "Event"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {event?.venue || ""}
                        {event?.address ? ` · ${event.address}` : ""}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="text-lg font-semibold text-amber-300">
                        {money(Number(request.rate || 0))} /{" "}
                        {request.rate_type || "day"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {request.filled_slots} of {request.slots} filled
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mb-4 rounded-2xl border p-4 text-sm ${
                      isAvailable
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                        : isUnavailable
                          ? "border-red-500/20 bg-red-500/10 text-red-100"
                          : isConfirmed
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                            : "border-white/10 bg-black/20 text-zinc-300"
                    }`}
                  >
                    {responseDescription(myResponse?.response_status)}
                  </div>

                  <div className="mb-4 grid gap-3 md:grid-cols-4">
                    <MiniInfo
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Work Date"
                      value={dateLabel(request.work_date)}
                    />
                    <MiniInfo
                      icon={<Clock3 className="h-4 w-4" />}
                      label="Call Time"
                      value={timeLabel(request.call_time)}
                    />
                    <MiniInfo
                      icon={<DollarSign className="h-4 w-4" />}
                      label="Request Status"
                      value={request.status}
                    />
                    <MiniInfo
                      icon={
                        isAvailable || isConfirmed ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )
                      }
                      label="My Response"
                      value={responseLabel(myResponse?.response_status)}
                    />
                  </div>

                  {request.notes ? (
                    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
                      {request.notes}
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-zinc-500">
                      Note for Manager
                    </span>
                    <textarea
                      value={notesByRequest[request.id] || ""}
                      onChange={(e) =>
                        setNotesByRequest((prev) => ({
                          ...prev,
                          [request.id]: e.target.value,
                        }))
                      }
                      placeholder="Optional note. Example: I am available after 2 PM, I can drive, I have forklift certification, etc."
                      className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-[16px] text-white outline-none focus:border-amber-400/40"
                    />
                  </label>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <button
                      onClick={() => respondToRequest(request.id, "available")}
                      disabled={isSaving}
                      className={`min-h-[54px] rounded-2xl px-4 py-3 font-semibold disabled:opacity-60 ${
                        isAvailable
                          ? "border border-emerald-400/30 bg-emerald-500/20 text-emerald-200"
                          : "bg-emerald-500 text-black"
                      }`}
                    >
                      {isSaving
                        ? "Saving..."
                        : isAvailable
                          ? "Applied / Available"
                          : myResponse
                            ? "Change to Available"
                            : "I’m Available / Apply"}
                    </button>

                    <button
                      onClick={() =>
                        respondToRequest(request.id, "unavailable")
                      }
                      disabled={isSaving}
                      className={`min-h-[54px] rounded-2xl px-4 py-3 font-semibold disabled:opacity-60 ${
                        isUnavailable
                          ? "border border-red-400/30 bg-red-500/20 text-red-200"
                          : "border border-red-400/20 bg-red-500/10 text-red-200"
                      }`}
                    >
                      {isSaving
                        ? "Saving..."
                        : isUnavailable
                          ? "Marked Unavailable"
                          : myResponse
                            ? "Change to Unavailable"
                            : "I’m Unavailable"}
                    </button>
                  </div>
                </section>
              );
            })
          ) : (
            <section className="rounded-[28px] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
              No open requests right now.
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{sublabel}</div>
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
