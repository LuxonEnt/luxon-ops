"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  DollarSign,
  LogOut,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

const DEFAULT_SKILL_OPTIONS = [
  "A1",
  "A2",
  "L1",
  "L2",
  "LED Programmer",
  "LED Tech",
  "Video Engineer",
  "Camera Op",
  "Projectionist",
  "Stagehand",
  "RF Tech",
  "Broadcast Audio",
  "Lighting Programmer",
  "Rigger",
];

type EventItem = {
  id: number;
  name: string;
  venue?: string | null;
  address?: string | null;
  client?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type Contractor = {
  id: number;
  name: string;
  email?: string | null;
  role?: string | null;
  approved_skills?: string[] | null;
};

type CrewRequest = {
  id: number;
  event_id: number;
  title: string;
  position: string;
  work_date: string | null;
  call_time: string | null;
  end_time?: string | null;
  rate: number;
  rate_type: string;
  slots: number;
  filled_slots: number;
  notes?: string | null;
  status: string;
  selected_contractor_id?: number | null;
  required_skill?: string | null;
  created_at?: string;
};

type CrewResponse = {
  id: number;
  request_id: number;
  contractor_id: number;
  response_status: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
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

type AssignmentEmailPayload = {
  contractorName?: string | null;
  contractorEmail?: string | null;
  eventName?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  venue?: string | null;
  address?: string | null;
  position?: string | null;
  workDate?: string | null;
  callTime?: string | null;
  rate?: number | string | null;
  rateType?: string | null;
};

async function sendAssignmentConfirmationEmail(payload: AssignmentEmailPayload) {
  if (!payload.contractorEmail) {
    return { ok: false, error: "Contractor email is missing." };
  }

  try {
    const response = await fetch("/api/send-assignment-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error || "Email could not be sent.",
      };
    }

    return { ok: true, error: null };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Email could not be sent.",
    };
  }
}


type OpportunityEmailRecipient = {
  contractorName?: string | null;
  contractorEmail?: string | null;
};

type OpportunityEmailPayload = {
  recipients: OpportunityEmailRecipient[];
  eventName?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  venue?: string | null;
  address?: string | null;
  requestTitle?: string | null;
  position?: string | null;
  requiredSkill?: string | null;
  workDate?: string | null;
  callTime?: string | null;
  rate?: number | string | null;
  rateType?: string | null;
  notes?: string | null;
};

async function sendOpportunityAvailableEmail(payload: OpportunityEmailPayload) {
  const cleanRecipients = payload.recipients.filter(
    (recipient) => recipient.contractorEmail,
  );

  if (!cleanRecipients.length) {
    return {
      ok: true,
      sentCount: 0,
      error: null,
    };
  }

  try {
    const response = await fetch("/api/send-opportunity-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        recipients: cleanRecipients,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        sentCount: 0,
        error: data?.error || "Opportunity emails could not be sent.",
      };
    }

    return {
      ok: true,
      sentCount: Number(data?.sentCount || 0),
      error: null,
    };
  } catch (error: any) {
    return {
      ok: false,
      sentCount: 0,
      error: error?.message || "Opportunity emails could not be sent.",
    };
  }
}

export default function ManagerRequestsPage() {
  const [status, setStatus] = useState("Checking access...");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [requests, setRequests] = useState<CrewRequest[]>([]);
  const [responses, setResponses] = useState<CrewResponse[]>([]);
  const [skillOptions, setSkillOptions] = useState<string[]>(DEFAULT_SKILL_OPTIONS);
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);

  const [requestForm, setRequestForm] = useState({
    event_id: "",
    title: "",
    position: "",
    required_skill: "",
    work_date: "",
    work_dates: "",
    call_time: "",
    end_time: "",
    rate: "",
    rate_type: "day",
    slots: "1",
    notes: "",
  });

  const [quickAssignForm, setQuickAssignForm] = useState({
    event_id: "",
    contractor_id: "",
    position: "",
    required_skill: "",
    work_date: "",
    call_time: "",
    end_time: "",
    rate: "",
    rate_type: "day",
  });

  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [editRequestForm, setEditRequestForm] = useState({
    event_id: "",
    title: "",
    position: "",
    required_skill: "",
    work_date: "",
    call_time: "",
    end_time: "",
    rate: "",
    rate_type: "day",
    slots: "1",
    filled_slots: "0",
    notes: "",
    status: "Open",
  });

  useEffect(() => {
    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        window.location.href = "/login";
        return;
      }

      const userEmail = session.user.email;
      setEmail(userEmail);

      const { data } = await supabase
        .from("admins")
        .select("email")
        .eq("email", userEmail)
        .maybeSingle();

      if (!data) {
        await supabase.auth.signOut();
        window.location.href = "/login";
        return;
      }

      setStatus("allowed");
      await loadAll();
    }

    void boot();
  }, []);

  async function loadAll() {
    setLoading(true);
    setMessage("");

    const [
      { data: eventsData, error: eventsError },
      { data: contractorsData, error: contractorsError },
      { data: requestsData, error: requestsError },
      { data: responsesData, error: responsesError },
      { data: availabilityData, error: availabilityError },
      { data: skillSetsData, error: skillSetsError },
    ] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: false }),
      supabase
        .from("contractors")
        .select("id,name,email,role,approved_skills")
        .order("name", { ascending: true }),
      supabase
        .from("crew_position_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("crew_request_responses")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("contractor_availability")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("skill_sets")
        .select("name")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (
      eventsError ||
      contractorsError ||
      requestsError ||
      responsesError ||
      availabilityError
    ) {
      setMessage(
        eventsError?.message ||
          contractorsError?.message ||
          requestsError?.message ||
          responsesError?.message ||
          availabilityError?.message ||
          "Could not load request management data."
      );
      setLoading(false);
      return;
    }

    setEvents(eventsData || []);
    setContractors(contractorsData || []);
    setRequests(requestsData || []);
    setResponses(responsesData || []);
    setAvailability(availabilityData || []);

    if (!skillSetsError && skillSetsData?.length) {
      setSkillOptions(skillSetsData.map((item: any) => item.name));
    } else {
      setSkillOptions(DEFAULT_SKILL_OPTIONS);
    }

    if ((eventsData || [])[0] && !quickAssignForm.event_id) {
      setQuickAssignForm((prev) => ({
        ...prev,
        event_id: String(eventsData![0].id),
      }));
    }

    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function parseRequestWorkDates() {
    const dateParts = requestForm.work_dates
      .split(/[,\n]/)
      .map((date) => date.trim())
      .filter(Boolean);

    const uniqueDates = Array.from(new Set(dateParts));

    if (uniqueDates.length) {
      return uniqueDates;
    }

    if (requestForm.work_date) {
      return [requestForm.work_date];
    }

    return [];
  }

  async function createRequest() {
    if (
      !requestForm.event_id ||
      !requestForm.title.trim() ||
      !requestForm.position.trim() ||
      !requestForm.required_skill
    ) {
      setMessage("Event, title, position, and required skill are required.");
      return;
    }

    const workDates = parseRequestWorkDates();

    if (!workDates.length) {
      setMessage("At least one work date is required.");
      return;
    }

    const rowsToInsert = workDates.map((workDate) => ({
      event_id: Number(requestForm.event_id),
      title: requestForm.title.trim(),
      position: requestForm.position.trim(),
      required_skill: requestForm.required_skill || null,
      work_date: workDate || null,
      call_time: requestForm.call_time || null,
      end_time: requestForm.end_time || null,
      rate: Number(requestForm.rate || 0),
      rate_type: requestForm.rate_type,
      slots: Number(requestForm.slots || 1),
      filled_slots: 0,
      notes: requestForm.notes.trim() || null,
      status: "Open",
    }));

    const { error } = await supabase
      .from("crew_position_requests")
      .insert(rowsToInsert);

    if (error) {
      setMessage(error.message);
      return;
    }

    const selectedEvent = events.find(
      (event) => event.id === Number(requestForm.event_id),
    );

    const matchingContractors = contractors.filter((contractor) => {
      const approvedSkills = contractor.approved_skills || [];
      return (
        !!contractor.email &&
        approvedSkills.includes(requestForm.required_skill)
      );
    });

    let totalEmailsSent = 0;
    let emailFailureMessage = "";

    for (const workDate of workDates) {
      const emailResult = await sendOpportunityAvailableEmail({
        recipients: matchingContractors.map((contractor) => ({
          contractorName: contractor.name,
          contractorEmail: contractor.email || null,
        })),
        eventName: selectedEvent?.name || null,
        eventStartDate: selectedEvent?.start_date || null,
        eventEndDate: selectedEvent?.end_date || null,
        venue: selectedEvent?.venue || null,
        address: selectedEvent?.address || null,
        requestTitle:
          workDates.length > 1
            ? `${requestForm.title.trim()} - ${dateLabel(workDate)}`
            : requestForm.title.trim(),
        position: requestForm.position.trim(),
        requiredSkill: requestForm.required_skill || null,
        workDate,
        callTime: requestForm.call_time || null,
        rate: Number(requestForm.rate || 0),
        rateType: requestForm.rate_type || "day",
        notes: requestForm.notes.trim() || null,
      });

      if (emailResult.ok) {
        totalEmailsSent += Number(emailResult.sentCount || 0);
      } else if (!emailFailureMessage) {
        emailFailureMessage = emailResult.error || "Opportunity emails could not be sent.";
      }
    }

    setRequestForm({
      event_id: "",
      title: "",
      position: "",
      required_skill: "",
      work_date: "",
      work_dates: "",
      call_time: "",
      end_time: "",
      rate: "",
      rate_type: "day",
      slots: "1",
      notes: "",
    });

    if (emailFailureMessage) {
      setMessage(
        `Created ${workDates.length} position request(s), but some opportunity emails were not sent: ${emailFailureMessage}`,
      );
    } else {
      setMessage(
        `Created ${workDates.length} position request(s). Opportunity emails sent to ${totalEmailsSent} matching contractor notification(s).`,
      );
    }

    await loadAll();
  }

  function startEditRequest(request: CrewRequest) {
    setEditingRequestId(request.id);
    setEditRequestForm({
      event_id: String(request.event_id || ""),
      title: request.title || "",
      position: request.position || "",
      required_skill: request.required_skill || "",
      work_date: request.work_date || "",
      call_time: request.call_time || "",
      end_time: request.end_time || "",
      rate: String(request.rate ?? ""),
      rate_type: request.rate_type || "day",
      slots: String(request.slots ?? 1),
      filled_slots: String(request.filled_slots ?? 0),
      notes: request.notes || "",
      status: request.status || "Open",
    });
    setMessage("Editing live position request.");
  }

  function cancelEditRequest() {
    setEditingRequestId(null);
    setEditRequestForm({
      event_id: "",
      title: "",
      position: "",
      required_skill: "",
      work_date: "",
      call_time: "",
      end_time: "",
      rate: "",
      rate_type: "day",
      slots: "1",
      filled_slots: "0",
      notes: "",
      status: "Open",
    });
  }

  async function saveEditedRequest(requestId: number) {
    if (
      !editRequestForm.event_id ||
      !editRequestForm.title.trim() ||
      !editRequestForm.position.trim() ||
      !editRequestForm.required_skill
    ) {
      setMessage("Event, title, position, and required skill are required.");
      return;
    }

    const filledSlots = Number(editRequestForm.filled_slots || 0);
    const slots = Number(editRequestForm.slots || 1);

    if (filledSlots > slots) {
      setMessage("Filled slots cannot be greater than total slots.");
      return;
    }

    const { error } = await supabase
      .from("crew_position_requests")
      .update({
        event_id: Number(editRequestForm.event_id),
        title: editRequestForm.title.trim(),
        position: editRequestForm.position.trim(),
        required_skill: editRequestForm.required_skill || null,
        work_date: editRequestForm.work_date || null,
        call_time: editRequestForm.call_time || null,
        end_time: editRequestForm.end_time || null,
        rate: Number(editRequestForm.rate || 0),
        rate_type: editRequestForm.rate_type || "day",
        slots,
        filled_slots: filledSlots,
        notes: editRequestForm.notes.trim() || null,
        status: editRequestForm.status || "Open",
      })
      .eq("id", requestId);

    if (error) {
      setMessage(error.message);
      return;
    }

    cancelEditRequest();
    setMessage("Live position request updated.");
    await loadAll();
  }

  async function duplicateRequest(request: CrewRequest) {
    const ok = window.confirm(
      `Duplicate this position request?\n\n${request.title}\n${request.position}`,
    );

    if (!ok) return;

    const { error } = await supabase.from("crew_position_requests").insert({
      event_id: request.event_id,
      title: `${request.title} Copy`,
      position: request.position,
      required_skill: request.required_skill || null,
      work_date: request.work_date || null,
      call_time: request.call_time || null,
      end_time: request.end_time || null,
      rate: Number(request.rate || 0),
      rate_type: request.rate_type || "day",
      slots: Number(request.slots || 1),
      filled_slots: 0,
      notes: request.notes || null,
      status: "Open",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Position request duplicated.");
    await loadAll();
  }

  async function quickAssign() {
    if (
      !quickAssignForm.event_id ||
      !quickAssignForm.contractor_id ||
      !quickAssignForm.position.trim()
    ) {
      setMessage("Event, contractor, and position are required.");
      return;
    }

    const { error } = await supabase.from("assignments").insert({
      event_id: Number(quickAssignForm.event_id),
      contractor_id: Number(quickAssignForm.contractor_id),
      position: quickAssignForm.position.trim(),
      work_date: quickAssignForm.work_date || null,
      call_time: quickAssignForm.call_time || null,
      break_hours: 1,
      rate: Number(quickAssignForm.rate || 0),
      rate_type: quickAssignForm.rate_type,
      confirmed: true,
      approved: false,
      paid: false,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const selectedContractor = contractors.find(
      (contractor) => contractor.id === Number(quickAssignForm.contractor_id),
    );
    const selectedEvent = events.find(
      (event) => event.id === Number(quickAssignForm.event_id),
    );

    const emailResult = await sendAssignmentConfirmationEmail({
      contractorName: selectedContractor?.name || null,
      contractorEmail: selectedContractor?.email || null,
      eventName: selectedEvent?.name || null,
      eventStartDate: selectedEvent?.start_date || null,
      eventEndDate: selectedEvent?.end_date || null,
      venue: selectedEvent?.venue || null,
      address: selectedEvent?.address || null,
      position: quickAssignForm.position.trim(),
      workDate: quickAssignForm.work_date || null,
      callTime: quickAssignForm.call_time || null,
      rate: Number(quickAssignForm.rate || 0),
      rateType: quickAssignForm.rate_type || "day",
    });

    setMessage(
      emailResult.ok
        ? "Contractor confirmed and assigned to event. Email confirmation sent."
        : `Contractor confirmed and assigned to event, but email confirmation was not sent: ${emailResult.error}`,
    );
    await loadAll();
  }

  async function confirmResponder(request: CrewRequest, response: CrewResponse) {
    const responder = contractorMap[response.contractor_id];
    if (request.required_skill && !(responder?.approved_skills || []).includes(request.required_skill)) {
      setMessage("This contractor is not approved for the required skill on this request.");
      return;
    }

    if (request.filled_slots >= request.slots || request.status === "Filled") {
      setMessage("This request is already filled.");
      return;
    }

    const insertAssignment = await supabase.from("assignments").insert({
      event_id: request.event_id,
      contractor_id: response.contractor_id,
      position: request.position,
      work_date: request.work_date,
      call_time: request.call_time,
      break_hours: 1,
      rate: Number(request.rate || 0),
      rate_type: request.rate_type || "day",
      confirmed: true,
      approved: false,
      paid: false,
    });

    if (insertAssignment.error) {
      setMessage(insertAssignment.error.message);
      return;
    }

    const nextFilledSlots = request.filled_slots + 1;
    const isFilled = nextFilledSlots >= request.slots;

    const updateRequest = await supabase
      .from("crew_position_requests")
      .update({
        filled_slots: nextFilledSlots,
        selected_contractor_id: response.contractor_id,
        status: isFilled ? "Filled" : "Open",
      })
      .eq("id", request.id);

    if (updateRequest.error) {
      setMessage(updateRequest.error.message);
      return;
    }

    const updateResponse = await supabase
      .from("crew_request_responses")
      .update({
        response_status: "confirmed",
      })
      .eq("id", response.id);

    if (updateResponse.error) {
      setMessage(updateResponse.error.message);
      return;
    }

    const selectedContractor = contractorMap[response.contractor_id];
    const selectedEvent = eventMap[request.event_id];

    const emailResult = await sendAssignmentConfirmationEmail({
      contractorName: selectedContractor?.name || null,
      contractorEmail: selectedContractor?.email || null,
      eventName: selectedEvent?.name || null,
      eventStartDate: selectedEvent?.start_date || null,
      eventEndDate: selectedEvent?.end_date || null,
      venue: selectedEvent?.venue || null,
      address: selectedEvent?.address || null,
      position: request.position,
      workDate: request.work_date || null,
      callTime: request.call_time || null,
      rate: Number(request.rate || 0),
      rateType: request.rate_type || "day",
    });

    setMessage(
      emailResult.ok
        ? "Responder confirmed and request marked filled. Email confirmation sent."
        : `Responder confirmed and request marked filled, but email confirmation was not sent: ${emailResult.error}`,
    );
    await loadAll();
  }

  async function deleteRequest(request: CrewRequest) {
    const ok = window.confirm(
      `Delete this position request?\n\n${request.title}\n${request.position}\n\nThis removes the posting and all responses from the request list. It will not delete any assignment already created.`
    );

    if (!ok) return;

    const deleteResponses = await supabase
      .from("crew_request_responses")
      .delete()
      .eq("request_id", request.id);

    if (deleteResponses.error) {
      setMessage(deleteResponses.error.message);
      return;
    }

    const deleteRequestResult = await supabase
      .from("crew_position_requests")
      .delete()
      .eq("id", request.id);

    if (deleteRequestResult.error) {
      setMessage(deleteRequestResult.error.message);
      return;
    }

    setMessage("Position request deleted.");
    await loadAll();
  }

  function useAvailabilityPerson(item: AvailabilityItem) {
    setQuickAssignForm((prev) => ({
      ...prev,
      contractor_id: String(item.contractor_id),
    }));
    setMessage("Contractor loaded into quick assign form.");
  }

  const eventMap = useMemo(() => {
    const map: Record<number, EventItem> = {};
    events.forEach((event) => {
      map[event.id] = event;
    });
    return map;
  }, [events]);

  const contractorMap = useMemo(() => {
    const map: Record<number, Contractor> = {};
    contractors.forEach((contractor) => {
      map[contractor.id] = contractor;
    });
    return map;
  }, [contractors]);

  const responsesByRequest = useMemo(() => {
    const map: Record<number, CrewResponse[]> = {};
    responses.forEach((response) => {
      if (!map[response.request_id]) map[response.request_id] = [];
      map[response.request_id].push(response);
    });
    return map;
  }, [responses]);

  const openRequests = requests.filter(
    (request) => request.status !== "Filled" && request.status !== "Cancelled",
  );
  const filledRequests = requests.filter((request) => request.status === "Filled");
  const activeProjectRequests = requests.filter(
    (request) => request.status !== "Cancelled",
  );

  if (status !== "allowed") {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-3xl font-bold">Manager Requests</h1>
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
              Crew Requests
            </h1>
            <p className="mt-2 text-zinc-400">Signed in as {email}</p>
          </div>

          <div className="flex gap-3">
            <a
              href="/manager"
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              Back to Manager
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

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        {loading ? (
          <GlassCard>
            <div className="text-zinc-300">Loading request tools...</div>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<ClipboardList className="h-5 w-5" />}
                label="Open Requests"
                value={String(openRequests.length)}
                sublabel="Still accepting responses"
              />
              <MetricCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Filled Requests"
                value={String(filledRequests.length)}
                sublabel="Completed postings"
              />
              <MetricCard
                icon={<Users className="h-5 w-5" />}
                label="Responses"
                value={String(responses.length)}
                sublabel="All contractor replies"
              />
              <MetricCard
                icon={<CalendarDays className="h-5 w-5" />}
                label="Availability Rows"
                value={String(availability.length)}
                sublabel="Manual availability submissions"
              />
            </div>

            <GlassCard>
              <div className="mb-5 flex items-center justify-between">
                <SectionTitle
                  icon={<RefreshCw className="h-5 w-5" />}
                  title="Refresh Data"
                  subtitle="Reload requests, responses, and availability"
                />
                <button
                  onClick={loadAll}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                >
                  Refresh
                </button>
              </div>
            </GlassCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <GlassCard>
                <SectionTitle
                  icon={<Plus className="h-5 w-5" />}
                  title="Create Position Request"
                  subtitle="Publish one or multiple work dates to matching approved contractors"
                />
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <SelectField
                    label="Event"
                    value={requestForm.event_id}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, event_id: v })
                    }
                    options={events.map((e) => ({
                      value: String(e.id),
                      label: e.name,
                    }))}
                  />
                  <Field
                    label="Request Title"
                    value={requestForm.title}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, title: v })
                    }
                  />
                  <Field
                    label="Position"
                    value={requestForm.position}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, position: v })
                    }
                  />
                  <SelectField
                    label="Required Skill"
                    value={requestForm.required_skill}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, required_skill: v })
                    }
                    options={skillOptions.map((skill) => ({
                      value: skill,
                      label: skill,
                    }))}
                  />
                  <Field
                    label="Slots"
                    type="number"
                    value={requestForm.slots}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, slots: v })
                    }
                  />
                  <Field
                    label="Single Work Date"
                    type="date"
                    value={requestForm.work_date}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, work_date: v })
                    }
                  />
                  <TextAreaField
                    label="Multiple Work Dates"
                    value={requestForm.work_dates}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, work_dates: v })
                    }
                    placeholder={"Optional. Enter one date per line or comma separated. Example:\n2026-06-17\n2026-06-18\n2026-06-19"}
                  />
                  <Field
                    label="Call Time"
                    type="time"
                    value={requestForm.call_time}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, call_time: v })
                    }
                  />
                  <Field
                    label="End Time"
                    type="time"
                    value={requestForm.end_time}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, end_time: v })
                    }
                  />
                  <Field
                    label="Rate"
                    type="number"
                    value={requestForm.rate}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, rate: v })
                    }
                  />
                  <SelectField
                    label="Rate Type"
                    value={requestForm.rate_type}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, rate_type: v })
                    }
                    options={[
                      { value: "day", label: "day" },
                      { value: "hour", label: "hour" },
                    ]}
                  />
                  <TextAreaField
                    label="Notes"
                    value={requestForm.notes}
                    onChange={(v) =>
                      setRequestForm({ ...requestForm, notes: v })
                    }
                  />
                </div>
                <button
                  onClick={createRequest}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                >
                  Publish Request
                </button>
              </GlassCard>

              <GlassCard>
                <SectionTitle
                  icon={<UserCheck className="h-5 w-5" />}
                  title="Quick Assign from Availability"
                  subtitle="Manually confirm someone into an event"
                />
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <SelectField
                    label="Event"
                    value={quickAssignForm.event_id}
                    onChange={(v) =>
                      setQuickAssignForm({ ...quickAssignForm, event_id: v })
                    }
                    options={events.map((e) => ({
                      value: String(e.id),
                      label: e.name,
                    }))}
                  />
                  <SelectField
                    label="Contractor"
                    value={quickAssignForm.contractor_id}
                    onChange={(v) =>
                      setQuickAssignForm({
                        ...quickAssignForm,
                        contractor_id: v,
                      })
                    }
                    options={contractors.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                    }))}
                  />
                  <Field
                    label="Position"
                    value={quickAssignForm.position}
                    onChange={(v) =>
                      setQuickAssignForm({
                        ...quickAssignForm,
                        position: v,
                      })
                    }
                  />
                  <Field
                    label="Work Date"
                    type="date"
                    value={quickAssignForm.work_date}
                    onChange={(v) =>
                      setQuickAssignForm({
                        ...quickAssignForm,
                        work_date: v,
                      })
                    }
                  />
                  <Field
                    label="Call Time"
                    type="time"
                    value={quickAssignForm.call_time}
                    onChange={(v) =>
                      setQuickAssignForm({
                        ...quickAssignForm,
                        call_time: v,
                      })
                    }
                  />
                  <Field
                    label="Rate"
                    type="number"
                    value={quickAssignForm.rate}
                    onChange={(v) =>
                      setQuickAssignForm({ ...quickAssignForm, rate: v })
                    }
                  />
                  <SelectField
                    label="Rate Type"
                    value={quickAssignForm.rate_type}
                    onChange={(v) =>
                      setQuickAssignForm({
                        ...quickAssignForm,
                        rate_type: v,
                      })
                    }
                    options={[
                      { value: "day", label: "day" },
                      { value: "hour", label: "hour" },
                    ]}
                  />
                </div>
                <button
                  onClick={quickAssign}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                >
                  Confirm Contractor to Event
                </button>
              </GlassCard>
            </div>

            <GlassCard>
              <div className="mb-5 flex items-center justify-between">
                <SectionTitle
                  icon={<RefreshCw className="h-5 w-5" />}
                  title="Project Position Requests"
                  subtitle="Open and filled positions together under the project"
                />
                <button
                  onClick={loadAll}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                >
                  Refresh
                </button>
              </div>

              <div className="space-y-4">
                {activeProjectRequests.length ? (
                  activeProjectRequests.map((request) => {
                    const requestResponses = responsesByRequest[request.id] || [];
                    const availableResponses = requestResponses.filter(
                      (r) =>
                        r.response_status === "available" ||
                        r.response_status === "confirmed"
                    );

                    return (
                      <div
                        key={request.id}
                        className="rounded-3xl border border-white/10 bg-black/25 p-5"
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-xl font-semibold">
                                {request.title}
                              </div>
                              <span
                                className={
                                  request.status === "Filled"
                                    ? "rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300"
                                    : "rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200"
                                }
                              >
                                {request.status === "Filled" ? "Filled" : "Open"}
                              </span>
                            </div>
                            <div className="text-sm text-zinc-400">
                              {request.position}{request.required_skill ? ` · ${request.required_skill}` : ""} ·{" "}
                              {eventMap[request.event_id]?.name || "Event"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {eventMap[request.event_id]?.venue || ""}
                              {eventMap[request.event_id]?.address
                                ? ` · ${eventMap[request.event_id]?.address}`
                                : ""}
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 text-left md:items-end md:text-right">
                            <div>
                              <div className="text-lg font-semibold text-amber-300">
                                {money(Number(request.rate || 0))} /{" "}
                                {request.rate_type || "day"}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {request.filled_slots} of {request.slots} filled
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <button
                                onClick={() => startEditRequest(request)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/20"
                              >
                                Edit Position
                              </button>

                              <button
                                onClick={() => duplicateRequest(request)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
                              >
                                Duplicate
                              </button>

                              <button
                                onClick={() => deleteRequest(request)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Position
                              </button>
                            </div>
                          </div>
                        </div>

                        {editingRequestId === request.id ? (
                          <div className="mb-5 rounded-3xl border border-amber-400/20 bg-amber-400/[0.07] p-5">
                            <div className="mb-4">
                              <div className="text-lg font-semibold text-amber-100">
                                Edit Live Position Request
                              </div>
                              <div className="text-sm text-zinc-400">
                                Update the posting details contractors see in the portal.
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <SelectField
                                label="Event"
                                value={editRequestForm.event_id}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    event_id: v,
                                  })
                                }
                                options={events.map((e) => ({
                                  value: String(e.id),
                                  label: e.name,
                                }))}
                              />

                              <Field
                                label="Request Title"
                                value={editRequestForm.title}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    title: v,
                                  })
                                }
                              />

                              <Field
                                label="Position"
                                value={editRequestForm.position}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    position: v,
                                  })
                                }
                              />

                              <SelectField
                                label="Required Skill"
                                value={editRequestForm.required_skill}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    required_skill: v,
                                  })
                                }
                                options={skillOptions.map((skill) => ({
                                  value: skill,
                                  label: skill,
                                }))}
                              />

                              <Field
                                label="Work Date"
                                type="date"
                                value={editRequestForm.work_date}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    work_date: v,
                                  })
                                }
                              />

                              <Field
                                label="Call Time"
                                type="time"
                                value={editRequestForm.call_time}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    call_time: v,
                                  })
                                }
                              />

                              <Field
                                label="End Time"
                                type="time"
                                value={editRequestForm.end_time}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    end_time: v,
                                  })
                                }
                              />

                              <Field
                                label="Rate"
                                type="number"
                                value={editRequestForm.rate}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    rate: v,
                                  })
                                }
                              />

                              <SelectField
                                label="Rate Type"
                                value={editRequestForm.rate_type}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    rate_type: v,
                                  })
                                }
                                options={[
                                  { value: "day", label: "day" },
                                  { value: "hour", label: "hour" },
                                ]}
                              />

                              <Field
                                label="Slots"
                                type="number"
                                value={editRequestForm.slots}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    slots: v,
                                  })
                                }
                              />

                              <Field
                                label="Filled Slots"
                                type="number"
                                value={editRequestForm.filled_slots}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    filled_slots: v,
                                  })
                                }
                              />

                              <SelectField
                                label="Status"
                                value={editRequestForm.status}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    status: v,
                                  })
                                }
                                options={[
                                  { value: "Open", label: "Open" },
                                  { value: "Filled", label: "Filled" },
                                  { value: "Cancelled", label: "Cancelled" },
                                ]}
                              />

                              <TextAreaField
                                label="Notes"
                                value={editRequestForm.notes}
                                onChange={(v) =>
                                  setEditRequestForm({
                                    ...editRequestForm,
                                    notes: v,
                                  })
                                }
                              />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                onClick={() => saveEditedRequest(request.id)}
                                className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-5 py-3 font-semibold text-black"
                              >
                                Save Position Changes
                              </button>

                              <button
                                onClick={cancelEditRequest}
                                className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white"
                              >
                                Cancel Edit
                              </button>
                            </div>
                          </div>
                        ) : null}

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
                            icon={<Clock3 className="h-4 w-4" />}
                            label="End Time"
                            value={timeLabel(request.end_time)}
                          />
                          <MiniInfo
                            icon={<DollarSign className="h-4 w-4" />}
                            label="Status"
                            value={request.status}
                          />
                          <MiniInfo
                            icon={<Users className="h-4 w-4" />}
                            label="Responses"
                            value={String(requestResponses.length)}
                          />
                        </div>

                        {request.notes ? (
                          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
                            {request.notes}
                          </div>
                        ) : null}

                        <div className="space-y-3">
                          {availableResponses.length ? (
                            availableResponses.map((response) => {
                              const contractor =
                                contractorMap[response.contractor_id];
                              const isAlreadyConfirmed =
                                request.status === "Filled" ||
                                response.response_status === "confirmed";

                              return (
                                <div
                                  key={response.id}
                                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
                                >
                                  <div>
                                    <div className="font-medium">
                                      {contractor?.name ||
                                        `Contractor #${response.contractor_id}`}
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                      {contractor?.role || ""}
                                      {request.required_skill && !(contractor?.approved_skills || []).includes(request.required_skill) ? " · Skill not approved" : ""}
                                      {contractor?.email
                                        ? ` · ${contractor.email}`
                                        : ""}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                      Status: {response.response_status}
                                      {response.notes ? ` · ${response.notes}` : ""}
                                    </div>
                                  </div>

                                  {isAlreadyConfirmed ? (
                                    <span className="inline-flex items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-300">
                                      Filled
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        confirmResponder(request, response)
                                      }
                                      disabled={
                                        request.filled_slots >= request.slots ||
                                        (!!request.required_skill && !(contractor?.approved_skills || []).includes(request.required_skill))
                                      }
                                      className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black disabled:opacity-50"
                                    >
                                      Confirm for Position
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <EmptyState text="No available responders yet." />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState text="No active project position requests right now." />
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <SectionTitle
                icon={<CalendarDays className="h-5 w-5" />}
                title="Contractor Availability Submissions"
                subtitle="Manual availability rows from contractor portal"
              />
              <div className="mt-5 space-y-3">
                {availability.length ? (
                  availability.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="font-medium">
                          {contractorMap[item.contractor_id]?.name ||
                            `Contractor #${item.contractor_id}`}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {dateLabel(item.start_date)} -{" "}
                          {dateLabel(item.end_date)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {item.availability_status}
                          {item.notes ? ` · ${item.notes}` : ""}
                        </div>
                      </div>

                      <button
                        onClick={() => useAvailabilityPerson(item)}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
                      >
                        Use in Quick Assign
                      </button>
                    </div>
                  ))
                ) : (
                  <EmptyState text="No availability rows yet." />
                )}
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </main>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      {children}
    </section>
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
      <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">
        {icon}
      </div>
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-zinc-400">{subtitle}</p>
      </div>
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
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400/40"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none focus:border-amber-400/40"
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
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
      {text}
    </div>
  );
}
