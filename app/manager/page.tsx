"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  DollarSign,
  FileText,
  FolderOpen,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

const PORTAL_BACKGROUND_STYLE = {
  backgroundImage:
    "linear-gradient(rgba(5, 5, 5, 0.82), rgba(5, 5, 5, 0.92)), url('/luxon-dashboard-bg.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
} as React.CSSProperties;

type EventItem = {
  id: number;
  name: string;
  client?: string | null;
  venue?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_feet?: number | null;
};

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
  rate?: number | null;
  rate_type?: string | null;
  requested_skills?: string[] | null;
  approved_skills?: string[] | null;
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
  lunch_clock_out?: string | null;
  lunch_clock_in?: string | null;
  break_hours?: number | null;
  rate?: number | null;
  rate_type?: string | null;
  confirmed?: boolean | null;
  approved?: boolean | null;
  paid?: boolean | null;
  paid_at?: string | null;
  manager_approved_hours?: number | null;
  manager_notes?: string | null;
  hours_approved?: boolean | null;
  hours_approved_at?: string | null;
  manual_time_correction?: boolean | null;
  time_correction_reason?: string | null;
  time_corrected_by?: string | null;
  time_corrected_at?: string | null;
  assignment_display_title?: string | null;
};

type AssignmentRow = Assignment & {
  trackedHours: number;
  billedHours: number;
  total: number;
  event?: EventItem;
  contractor?: Contractor;
};

type EventAssignmentGroup = {
  key: string;
  event?: EventItem;
  rows: AssignmentRow[];
  crewCount: number;
  confirmedCount: number;
  approvedCount: number;
  paidCount: number;
  totalValue: number;
  earliestDate?: string | null;
  latestDate?: string | null;
};

type ContractorEventInvoiceGroup = {
  key: string;
  event?: EventItem;
  contractor?: Contractor;
  rows: AssignmentRow[];
  invoiceTotal: number;
  approvedCount: number;
  paidCount: number;
  hoursApprovedCount: number;
  totalHours: number;
  earliestDate?: string | null;
  latestDate?: string | null;
};

type ClientLaborInvoiceGroup = {
  key: string;
  event?: EventItem;
  rows: AssignmentRow[];
  laborTotal: number;
  paidTotal: number;
  balanceDue: number;
  totalHours: number;
  paidHours: number;
  unpaidHours: number;
  contractorCount: number;
  positionCount: number;
  earliestDate?: string | null;
  latestDate?: string | null;
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

type StoredDoc = {
  name: string;
  path: string;
  contractor_id: number;
  contractor_name: string;
  updated_at?: string;
  size?: number;
};

type TabName =
  | "Overview"
  | "Schedule Board"
  | "Events"
  | "Contractors"
  | "Assignments"
  | "Payroll"
  | "Invoices"
  | "Documents";

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

const TABS: TabName[] = [
  "Overview",
  "Schedule Board",
  "Events",
  "Contractors",
  "Assignments",
  "Payroll",
  "Invoices",
  "Documents",
];

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


function dateInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}


function addDaysToDate(value?: string | null, days = 30) {
  if (!value) return null;

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function invoiceDueDateLabel(
  hoursApprovedAt?: string | null,
  fallbackDate?: string | null,
) {
  const dueDate = addDaysToDate(hoursApprovedAt || fallbackDate, 30);
  return dueDate ? dateLabel(dueDate) : "--";
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

function timeToMinutes(value?: string | null) {
  if (!value) return null;
  const [h, m] = String(value).slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function hoursBetween(
  start?: string | null,
  end?: string | null,
  lunchOut?: string | null,
  lunchIn?: string | null,
) {
  if (!start || !end) return 0;

  const startMins = timeToMinutes(start);
  let endMins = timeToMinutes(end);

  if (startMins === null || endMins === null) return 0;
  if (endMins < startMins) endMins += 24 * 60;

  let totalMins = endMins - startMins;

  if (lunchOut && lunchIn) {
    const lunchOutMins = timeToMinutes(lunchOut);
    let lunchInMins = timeToMinutes(lunchIn);

    if (lunchOutMins !== null && lunchInMins !== null) {
      if (lunchInMins < lunchOutMins) lunchInMins += 24 * 60;
      totalMins -= Math.max(0, lunchInMins - lunchOutMins);
    }
  }

  return Math.max(0, totalMins / 60);
}

function fileSizeLabel(size?: number) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function geocodeAddress(address: string) {
  const cleanAddress = address.trim();

  if (!cleanAddress) {
    return {
      latitude: null as number | null,
      longitude: null as number | null,
      formatted_address: null as string | null,
    };
  }

  const response = await fetch("/api/geocode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: cleanAddress,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Could not geocode address.");
  }

  return {
    latitude: data.latitude as number,
    longitude: data.longitude as number,
    formatted_address: data.formatted_address as string,
  };
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

async function sendScheduleCancellationEmail(payload: AssignmentEmailPayload) {
  if (!payload.contractorEmail) {
    return { ok: false, error: "Contractor email is missing." };
  }

  try {
    const response = await fetch("/api/send-schedule-update-email", {
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
        error: data?.error || "Cancellation email could not be sent.",
      };
    }

    return { ok: true, error: null };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Cancellation email could not be sent.",
    };
  }
}

async function sendAssignmentReminderEmail(payload: AssignmentEmailPayload) {
  if (!payload.contractorEmail) {
    return { ok: false, error: "Contractor email is missing." };
  }

  try {
    const response = await fetch("/api/send-assignment-reminder-email", {
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
        error: data?.error || "Reminder email could not be sent.",
      };
    }

    return { ok: true, error: null };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Reminder email could not be sent.",
    };
  }
}

type InvoicePaidEmailPayload = {
  contractorName?: string | null;
  contractorEmail?: string | null;
  eventName?: string | null;
  venue?: string | null;
  position?: string | null;
  workDate?: string | null;
  invoiceNumber?: string | null;
  invoiceTotal?: number | string | null;
  dueBalance?: number | string | null;
  paidDate?: string | null;
};

async function sendInvoicePaidEmail(payload: InvoicePaidEmailPayload) {
  if (!payload.contractorEmail) {
    return { ok: false, error: "Contractor email is missing." };
  }

  try {
    const response = await fetch("/api/send-invoice-paid-email", {
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
        error: data?.error || "Invoice paid email could not be sent.",
      };
    }

    return { ok: true, error: null };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "Invoice paid email could not be sent.",
    };
  }
}

export default function ManagerPage() {
  const [activeTab, setActiveTab] = useState<TabName>("Overview");
  const [status, setStatus] = useState("Checking access...");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [expandedScheduleEventIds, setExpandedScheduleEventIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedAssignmentEventIds, setExpandedAssignmentEventIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedPayrollEventIds, setExpandedPayrollEventIds] = useState<
    Record<string, boolean>
  >({});

  const [events, setEvents] = useState<EventItem[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);
  const [documents, setDocuments] = useState<StoredDoc[]>([]);
  const [skillOptions, setSkillOptions] = useState<string[]>(DEFAULT_SKILL_OPTIONS);
  const [newSkillName, setNewSkillName] = useState("");

  const [eventForm, setEventForm] = useState({
    name: "",
    client: "",
    venue: "",
    address: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    status: "Scheduled",
    notes: "",
    geofence_radius_feet: "750",
  });

  const [contractorForm, setContractorForm] = useState({
    name: "",
    role: "Contractor",
    phone: "",
    email: "",
    rate: "",
    rate_type: "day",
    company: "",
    city: "",
    state: "",
  });

  const [assignmentForm, setAssignmentForm] = useState({
    event_id: "",
    contractor_id: "",
    position: "",
    work_date: "",
    work_dates: "",
    call_time: "",
    rate: "",
    rate_type: "day",
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
      eventsResult,
      contractorsResult,
      assignmentsResult,
      availabilityResult,
      skillSetsResult,
    ] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: false }),
      supabase
        .from("contractors")
        .select("*")
        .order("name", { ascending: true }),
      supabase
        .from("assignments")
        .select("*")
        .order("work_date", { ascending: false }),
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
      eventsResult.error ||
      contractorsResult.error ||
      assignmentsResult.error ||
      availabilityResult.error
    ) {
      setMessage(
        eventsResult.error?.message ||
          contractorsResult.error?.message ||
          assignmentsResult.error?.message ||
          availabilityResult.error?.message ||
          "Could not load manager data.",
      );
      setLoading(false);
      return;
    }

    setEvents(eventsResult.data || []);
    setContractors(contractorsResult.data || []);
    setAssignments(assignmentsResult.data || []);
    setAvailability(availabilityResult.data || []);

    if (!skillSetsResult.error && skillSetsResult.data?.length) {
      setSkillOptions(skillSetsResult.data.map((item: any) => item.name));
    } else {
      setSkillOptions(DEFAULT_SKILL_OPTIONS);
    }

    if ((eventsResult.data || [])[0] && !assignmentForm.event_id) {
      setAssignmentForm((prev) => ({
        ...prev,
        event_id: String(eventsResult.data![0].id),
      }));
    }

    await loadDocuments(contractorsResult.data || []);
    setLoading(false);
  }

  async function loadDocuments(contractorRows: Contractor[]) {
    const allDocs: StoredDoc[] = [];

    for (const contractor of contractorRows) {
      const { data } = await supabase.storage
        .from("contractor-documents")
        .list(String(contractor.id), {
          limit: 100,
          sortBy: { column: "updated_at", order: "desc" },
        });

      (data || []).forEach((item: any) => {
        allDocs.push({
          name: item.name,
          path: `${contractor.id}/${item.name}`,
          contractor_id: contractor.id,
          contractor_name: contractor.name,
          updated_at: item.updated_at,
          size: item.metadata?.size ?? item.size,
        });
      });
    }

    setDocuments(allDocs);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function createEvent() {
    if (!eventForm.name.trim()) {
      setMessage("Event name is required.");
      return;
    }

    setMessage("Creating event and checking address GPS location...");

    let geo = {
      latitude: null as number | null,
      longitude: null as number | null,
      formatted_address: null as string | null,
    };

    try {
      if (eventForm.address.trim()) {
        geo = await geocodeAddress(eventForm.address);
      }
    } catch (error: any) {
      setMessage(error?.message || "Could not geocode event address.");
      return;
    }

    const { error } = await supabase.from("events").insert({
      name: eventForm.name.trim(),
      client: eventForm.client.trim() || null,
      venue: eventForm.venue.trim() || null,
      address: geo.formatted_address || eventForm.address.trim() || null,
      start_date: eventForm.start_date || null,
      end_date: eventForm.end_date || null,
      start_time: eventForm.start_time || null,
      end_time: eventForm.end_time || null,
      status: eventForm.status || "Scheduled",
      notes: eventForm.notes.trim() || null,
      latitude: geo.latitude,
      longitude: geo.longitude,
      geofence_radius_feet: Number(eventForm.geofence_radius_feet || 750),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setEventForm({
      name: "",
      client: "",
      venue: "",
      address: "",
      start_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      status: "Scheduled",
      notes: "",
      geofence_radius_feet: "750",
    });

    setMessage("Event created with GPS location.");
    await loadAll();
  }

  async function saveEvent(row: EventItem) {
    if (!row.name?.trim()) {
      setMessage("Event name is required.");
      return;
    }

    setMessage("Saving event and checking address GPS location...");

    let geo = {
      latitude: row.latitude || null,
      longitude: row.longitude || null,
      formatted_address: row.address || null,
    };

    try {
      if (row.address?.trim()) {
        geo = await geocodeAddress(row.address);
      }
    } catch (error: any) {
      setMessage(error?.message || "Could not geocode event address.");
      return;
    }

    const { error } = await supabase
      .from("events")
      .update({
        name: row.name.trim(),
        client: row.client?.trim() || null,
        venue: row.venue?.trim() || null,
        address: geo.formatted_address || row.address?.trim() || null,
        start_date: row.start_date || null,
        end_date: row.end_date || null,
        start_time: row.start_time || null,
        end_time: row.end_time || null,
        status: row.status || "Scheduled",
        notes: row.notes?.trim() || null,
        latitude: geo.latitude,
        longitude: geo.longitude,
        geofence_radius_feet: Number(row.geofence_radius_feet || 750),
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Event updated with GPS location.");
    await loadAll();
  }

  async function deleteEvent(id: number) {
    const ok = window.confirm("Delete this event?");
    if (!ok) return;

    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Event deleted.");
    await loadAll();
  }

  async function addSkillSet() {
    const cleanName = newSkillName.trim();

    if (!cleanName) {
      setMessage("Enter a skill name first.");
      return;
    }

    const existing = skillOptions.some(
      (skill) => skill.toLowerCase() === cleanName.toLowerCase(),
    );

    if (existing) {
      setMessage("That skill already exists.");
      return;
    }

    const { error } = await supabase.from("skill_sets").insert({
      name: cleanName,
      sort_order: skillOptions.length + 1,
      is_active: true,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewSkillName("");
    setMessage("Skill set added.");
    await loadAll();
  }

  async function deleteSkillSet(skillName: string) {
    const ok = window.confirm(
      `Delete this skill set?\n\n${skillName}\n\nThis will remove it from the skill list and clear it from contractor requested/approved skills.`,
    );

    if (!ok) return;

    const { error } = await supabase
      .from("skill_sets")
      .delete()
      .eq("name", skillName);

    if (error) {
      setMessage(error.message);
      return;
    }

    const affectedContractors = contractors.filter((contractor) => {
      return (
        (contractor.requested_skills || []).includes(skillName) ||
        (contractor.approved_skills || []).includes(skillName)
      );
    });

    for (const contractor of affectedContractors) {
      await supabase
        .from("contractors")
        .update({
          requested_skills: (contractor.requested_skills || []).filter(
            (skill) => skill !== skillName,
          ),
          approved_skills: (contractor.approved_skills || []).filter(
            (skill) => skill !== skillName,
          ),
        })
        .eq("id", contractor.id);
    }

    await supabase
      .from("crew_position_requests")
      .update({ required_skill: null })
      .eq("required_skill", skillName);

    setMessage("Skill set deleted.");
    await loadAll();
  }

  async function createContractor() {
    if (!contractorForm.name.trim() || !contractorForm.email.trim()) {
      setMessage("Contractor name and email are required.");
      return;
    }

    const { error } = await supabase.from("contractors").insert({
      name: contractorForm.name.trim(),
      role: contractorForm.role.trim() || "Contractor",
      phone: contractorForm.phone.trim() || null,
      email: contractorForm.email.trim(),
      rate: Number(contractorForm.rate || 0),
      rate_type: contractorForm.rate_type || "day",
      company: contractorForm.company.trim() || null,
      city: contractorForm.city.trim() || null,
      state: contractorForm.state.trim() || null,
      requested_skills: [],
      approved_skills: [],
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setContractorForm({
      name: "",
      role: "Contractor",
      phone: "",
      email: "",
      rate: "",
      rate_type: "day",
      company: "",
      city: "",
      state: "",
    });

    setMessage("Contractor created.");
    await loadAll();
  }

  async function saveContractor(row: Contractor) {
    const { error } = await supabase
      .from("contractors")
      .update({
        name: row.name?.trim() || null,
        role: row.role?.trim() || null,
        phone: row.phone?.trim() || null,
        email: row.email?.trim() || null,
        rate: Number(row.rate || 0),
        rate_type: row.rate_type || "day",
        company: row.company?.trim() || null,
        city: row.city?.trim() || null,
        state: row.state?.trim() || null,
        requested_skills: row.requested_skills || [],
        approved_skills: row.approved_skills || [],
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Contractor updated.");
    await loadAll();
  }

  async function deleteContractor(row: Contractor) {
    const ok = window.confirm(
      `Delete contractor profile?\n\n${row.name}\n${row.email || ""}\n\nThis will remove the contractor profile, assignments, availability submissions, crew request responses, and uploaded contractor documents from the portal. This does not delete the Supabase Auth login account.`,
    );

    if (!ok) return;

    setMessage("Deleting contractor profile...");

    const docs = await supabase.storage
      .from("contractor-documents")
      .list(String(row.id), { limit: 1000 });

    if (docs.data && docs.data.length) {
      const paths = docs.data.map((item: any) => `${row.id}/${item.name}`);
      await supabase.storage.from("contractor-documents").remove(paths);
    }

    const deleteAssignments = await supabase
      .from("assignments")
      .delete()
      .eq("contractor_id", row.id);

    if (deleteAssignments.error) {
      setMessage(deleteAssignments.error.message);
      return;
    }

    const deleteResponses = await supabase
      .from("crew_request_responses")
      .delete()
      .eq("contractor_id", row.id);

    if (deleteResponses.error) {
      setMessage(deleteResponses.error.message);
      return;
    }

    const deleteAvailability = await supabase
      .from("contractor_availability")
      .delete()
      .eq("contractor_id", row.id);

    if (deleteAvailability.error) {
      setMessage(deleteAvailability.error.message);
      return;
    }

    const deleteContractorResult = await supabase
      .from("contractors")
      .delete()
      .eq("id", row.id);

    if (deleteContractorResult.error) {
      setMessage(deleteContractorResult.error.message);
      return;
    }

    setMessage("Contractor profile deleted.");
    await loadAll();
  }

  function parseAssignmentDates() {
    const dateParts = assignmentForm.work_dates
      .split(/[,\n]/)
      .map((date) => date.trim())
      .filter(Boolean);

    const dates = dateParts.length
      ? dateParts
      : assignmentForm.work_date
        ? [assignmentForm.work_date]
        : [];

    return Array.from(new Set(dates));
  }

  async function createAssignment() {
    if (
      !assignmentForm.event_id ||
      !assignmentForm.contractor_id ||
      !assignmentForm.position.trim()
    ) {
      setMessage("Event, contractor, and position are required.");
      return;
    }

    const selectedDates = parseAssignmentDates();

    if (!selectedDates.length) {
      setMessage("At least one work date is required.");
      return;
    }

    const assignmentRowsToInsert = selectedDates.map((workDate) => ({
      event_id: Number(assignmentForm.event_id),
      contractor_id: Number(assignmentForm.contractor_id),
      position: assignmentForm.position.trim(),
      work_date: workDate,
      call_time: assignmentForm.call_time || null,
      break_hours: 0,
      rate: Number(assignmentForm.rate || 0),
      rate_type: assignmentForm.rate_type || "day",
      confirmed: true,
      approved: false,
      paid: false,
      hours_approved: false,
      manager_approved_hours: null,
      manager_notes: null,
    }));

    const { error } = await supabase
      .from("assignments")
      .insert(assignmentRowsToInsert);

    if (error) {
      setMessage(error.message);
      return;
    }

    const selectedContractor = contractors.find(
      (contractor) => contractor.id === Number(assignmentForm.contractor_id),
    );
    const selectedEvent = events.find(
      (event) => event.id === Number(assignmentForm.event_id),
    );

    const emailResults = await Promise.all(
      selectedDates.map((workDate) =>
        sendAssignmentConfirmationEmail({
          contractorName: selectedContractor?.name || null,
          contractorEmail: selectedContractor?.email || null,
          eventName: selectedEvent?.name || null,
          eventStartDate: selectedEvent?.start_date || null,
          eventEndDate: selectedEvent?.end_date || null,
          venue: selectedEvent?.venue || null,
          address: selectedEvent?.address || null,
          position: assignmentForm.position.trim(),
          workDate,
          callTime: assignmentForm.call_time || null,
          rate: Number(assignmentForm.rate || 0),
          rateType: assignmentForm.rate_type || "day",
        }),
      ),
    );

    const failedEmails = emailResults.filter((result) => !result.ok);

    setAssignmentForm({
      event_id: "",
      contractor_id: "",
      position: "",
      work_date: "",
      work_dates: "",
      call_time: "",
      rate: "",
      rate_type: "day",
    });

    setMessage(
      failedEmails.length
        ? `${selectedDates.length} assignment date(s) created, but ${failedEmails.length} confirmation email(s) failed to send: ${failedEmails[0]?.error}`
        : `${selectedDates.length} assignment date(s) created. Email confirmation${selectedDates.length > 1 ? "s" : ""} sent.`,
    );
    await loadAll();
  }

  async function updateAssignment(
    row: Assignment,
    updates: Partial<Assignment>,
  ) {
    const wasPaid = !!row.paid;
    const today = new Date().toISOString().slice(0, 10);
    const updatesToSave: Partial<Assignment> = { ...updates };

    if (updates.paid === true && !updatesToSave.paid_at) {
      updatesToSave.paid_at = today;
    }

    if (updates.paid === false) {
      updatesToSave.paid_at = null;
    }

    const isNowBeingMarkedPaid = updatesToSave.paid === true && !wasPaid;

    const { error } = await supabase
      .from("assignments")
      .update(updatesToSave)
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    let paidEmailMessage = "";

    if (isNowBeingMarkedPaid) {
      const invoiceRow = row as AssignmentRow;
      const paidDateForEmail =
        updatesToSave.paid_at || invoiceRow.paid_at || today;

      const emailResult = await sendInvoicePaidEmail({
        contractorName: invoiceRow.contractor?.name || null,
        contractorEmail: invoiceRow.contractor?.email || null,
        eventName: invoiceRow.event?.name || null,
        venue: invoiceRow.event?.venue || null,
        position: invoiceRow.position || null,
        workDate: invoiceRow.work_date || null,
        invoiceNumber: `LX-${invoiceRow.event_id || "EVENT"}-${invoiceRow.contractor_id || "CONTRACTOR"}-${invoiceRow.id}`,
        invoiceTotal:
          typeof invoiceRow.total === "number"
            ? invoiceRow.total
            : Number(invoiceRow.rate || 0),
        dueBalance: 0,
        paidDate: paidDateForEmail,
      });

      paidEmailMessage = emailResult.ok
        ? " Invoice paid email sent to contractor."
        : ` Invoice was marked paid, but the paid email failed: ${emailResult.error}`;
    }

    setMessage(`Assignment updated.${paidEmailMessage}`);
    await loadAll();
  }

  async function saveTimeCorrection(
    row: AssignmentRow,
    values: {
      clockIn: string;
      lunchOut: string;
      lunchIn: string;
      clockOut: string;
      reason: string;
    },
  ) {
    const reason = values.reason.trim();

    if (!reason) {
      setMessage(
        "A correction reason is required before saving manual time changes.",
      );
      return;
    }

    const correctionStamp = new Date().toISOString();
    const manualLocationNote = `Manual correction by ${email} at ${new Date().toLocaleString()} | GPS not verified`;

    const clockInChanged = (values.clockIn || null) !== (row.clock_in || null);
    const clockOutChanged =
      (values.clockOut || null) !== (row.clock_out || null);

    const { error } = await supabase
      .from("assignments")
      .update({
        clock_in: values.clockIn || null,
        lunch_clock_out: values.lunchOut || null,
        lunch_clock_in: values.lunchIn || null,
        clock_out: values.clockOut || null,
        clock_in_location: clockInChanged
          ? manualLocationNote
          : row.clock_in_location || null,
        clock_out_location: clockOutChanged
          ? manualLocationNote
          : row.clock_out_location || null,
        manual_time_correction: true,
        time_correction_reason: reason,
        time_corrected_by: email,
        time_corrected_at: correctionStamp,
        hours_approved: false,
        hours_approved_at: null,
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Manual time correction saved. Review and approve the updated hours before approving payroll.",
    );
    await loadAll();
  }

  async function deleteAssignment(id: number) {
    const ok = window.confirm(
      "Delete this assignment? This will remove it from Schedule Board, Assignments, Payroll, Invoices, and the contractor portal.",
    );

    if (!ok) return;

    const { error } = await supabase.from("assignments").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Assignment deleted.");
    await loadAll();
  }

  async function cancelAndNotifyAssignment(row: AssignmentRow) {
    const ok = window.confirm(
      `Cancel this position and notify the contractor?\n\n${row.contractor?.name || "Contractor"}\n${row.position || "Assignment"}\n${row.event?.name || "Event"}\n\nThis will email the contractor that the event/position has been canceled, then remove the assignment from the portal.`,
    );

    if (!ok) return;

    setMessage("Sending cancellation email...");

    const emailResult = await sendScheduleCancellationEmail({
      contractorName: row.contractor?.name || null,
      contractorEmail: row.contractor?.email || null,
      eventName: row.event?.name || null,
      eventStartDate: row.event?.start_date || null,
      eventEndDate: row.event?.end_date || null,
      venue: row.event?.venue || null,
      address: row.event?.address || null,
      position: row.position || null,
      workDate: row.work_date || null,
      callTime: row.call_time || null,
      rate: row.rate || 0,
      rateType: row.rate_type || "day",
    });

    if (!emailResult.ok) {
      setMessage(`Cancellation email was not sent: ${emailResult.error}`);
      return;
    }

    const { error } = await supabase.from("assignments").delete().eq("id", row.id);

    if (error) {
      setMessage(
        `Cancellation email sent, but the assignment could not be removed: ${error.message}`,
      );
      return;
    }

    setMessage("Cancellation email sent. Assignment removed from schedule.");
    await loadAll();
  }

  async function sendAssignmentReminder(row: AssignmentRow) {
    const ok = window.confirm(
      `Send reminder email to scheduled contractor?\n\n${row.contractor?.name || "Contractor"}\n${row.position || "Assignment"}\n${row.event?.name || "Event"}\n\nThis will send a branded reminder with the event details, work date, call time, venue, and portal link.`,
    );

    if (!ok) return;

    setMessage("Sending reminder email...");

    const emailResult = await sendAssignmentReminderEmail({
      contractorName: row.contractor?.name || null,
      contractorEmail: row.contractor?.email || null,
      eventName: row.event?.name || null,
      eventStartDate: row.event?.start_date || null,
      eventEndDate: row.event?.end_date || null,
      venue: row.event?.venue || null,
      address: row.event?.address || null,
      position: row.position || null,
      workDate: row.work_date || null,
      callTime: row.call_time || null,
      rate: row.rate || 0,
      rateType: row.rate_type || "day",
    });

    if (!emailResult.ok) {
      setMessage(`Reminder email was not sent: ${emailResult.error}`);
      return;
    }

    setMessage("Reminder email sent to scheduled contractor.");
  }

  async function saveManagerReview(
    row: AssignmentRow,
    managerApprovedHours: string,
    managerNotes: string,
  ) {
    const cleanHours =
      managerApprovedHours.trim() === ""
        ? null
        : Number(managerApprovedHours || 0);

    if (cleanHours !== null && (Number.isNaN(cleanHours) || cleanHours < 0)) {
      setMessage("Approved hours must be a valid number.");
      return;
    }

    const { error } = await supabase
      .from("assignments")
      .update({
        manager_approved_hours: cleanHours,
        manager_notes: managerNotes.trim() || null,
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Manager review saved.");
    await loadAll();
  }

  async function approveHours(row: AssignmentRow) {
    const approvedHours =
      row.manager_approved_hours !== null &&
      row.manager_approved_hours !== undefined
        ? Number(row.manager_approved_hours)
        : Number(row.trackedHours || 0);

    const { error } = await supabase
      .from("assignments")
      .update({
        manager_approved_hours: approvedHours,
        hours_approved: true,
        hours_approved_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Hours approved.");
    await loadAll();
  }

  async function openDocument(path: string) {
    const { data, error } = await supabase.storage
      .from("contractor-documents")
      .createSignedUrl(path, 120);

    if (error || !data?.signedUrl) {
      setMessage("Could not open file.");
      return;
    }

    window.open(data.signedUrl, "_blank");
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

  const assignmentRows: AssignmentRow[] = useMemo(() => {
    return assignments.map((row) => {
      const trackedHours = hoursBetween(
        row.clock_in,
        row.clock_out,
        row.lunch_clock_out,
        row.lunch_clock_in,
      );

      const billedHours =
        row.manager_approved_hours !== null &&
        row.manager_approved_hours !== undefined
          ? Number(row.manager_approved_hours)
          : trackedHours;

      const total =
        row.rate_type === "hour"
          ? billedHours * Number(row.rate || 0)
          : Number(row.rate || 0);

      return {
        ...row,
        trackedHours,
        billedHours,
        total,
        event: eventMap[row.event_id],
        contractor: contractorMap[row.contractor_id],
      };
    });
  }, [assignments, eventMap, contractorMap]);

  const filteredEvents = events.filter((event) =>
    `${event.name} ${event.client || ""} ${event.venue || ""} ${
      event.address || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const filteredContractors = contractors.filter((contractor) =>
    `${contractor.name} ${contractor.email || ""} ${contractor.role || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const filteredAssignments = assignmentRows.filter((row) =>
    `${row.position || ""} ${row.contractor?.name || ""} ${
      row.event?.name || ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const assignmentGroups: EventAssignmentGroup[] = useMemo(() => {
    const groupMap: Record<string, AssignmentRow[]> = {};

    filteredAssignments.forEach((row) => {
      const key = row.event_id ? String(row.event_id) : `no-event-${row.id}`;
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(row);
    });

    return Object.entries(groupMap)
      .map(([key, rows]) => {
        const sortedRows = [...rows].sort((a, b) => {
          const dateA = `${a.work_date || "9999-12-31"} ${a.call_time || "99:99"}`;
          const dateB = `${b.work_date || "9999-12-31"} ${b.call_time || "99:99"}`;
          return dateA.localeCompare(dateB);
        });

        const dates = sortedRows
          .map((row) => row.work_date)
          .filter(Boolean) as string[];

        return {
          key,
          event: sortedRows[0]?.event,
          rows: sortedRows,
          crewCount: sortedRows.length,
          confirmedCount: sortedRows.filter((row) => row.confirmed).length,
          approvedCount: sortedRows.filter((row) => row.approved).length,
          paidCount: sortedRows.filter((row) => row.paid).length,
          totalValue: sortedRows.reduce((sum, row) => sum + row.total, 0),
          earliestDate: dates.length ? dates.sort()[0] : null,
          latestDate: dates.length ? dates.sort()[dates.length - 1] : null,
        };
      })
      .sort((a, b) => {
        const dateA = a.earliestDate || "9999-12-31";
        const dateB = b.earliestDate || "9999-12-31";
        return dateA.localeCompare(dateB);
      });
  }, [filteredAssignments]);

  const invoiceGroups: ContractorEventInvoiceGroup[] = useMemo(() => {
    const groupMap: Record<string, AssignmentRow[]> = {};

    filteredAssignments.forEach((row) => {
      const key = `${row.event_id || "no-event"}-${row.contractor_id || "no-contractor"}`;
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(row);
    });

    return Object.entries(groupMap)
      .map(([key, rows]) => {
        const sortedRows = [...rows].sort((a, b) => {
          const dateA = `${a.work_date || "9999-12-31"} ${a.call_time || "99:99"} ${a.position || ""}`;
          const dateB = `${b.work_date || "9999-12-31"} ${b.call_time || "99:99"} ${b.position || ""}`;
          return dateA.localeCompare(dateB);
        });

        const dates = sortedRows
          .map((row) => row.work_date)
          .filter(Boolean) as string[];

        return {
          key,
          event: sortedRows[0]?.event,
          contractor: sortedRows[0]?.contractor,
          rows: sortedRows,
          invoiceTotal: sortedRows.reduce((sum, row) => sum + row.total, 0),
          approvedCount: sortedRows.filter((row) => row.approved).length,
          paidCount: sortedRows.filter((row) => row.paid).length,
          hoursApprovedCount: sortedRows.filter((row) => row.hours_approved).length,
          totalHours: sortedRows.reduce((sum, row) => sum + row.billedHours, 0),
          earliestDate: dates.length ? dates.sort()[0] : null,
          latestDate: dates.length ? dates.sort()[dates.length - 1] : null,
        };
      })
      .sort((a, b) => {
        const eventA = a.event?.name || "";
        const eventB = b.event?.name || "";
        const eventCompare = eventA.localeCompare(eventB);
        if (eventCompare !== 0) return eventCompare;

        const contractorA = a.contractor?.name || "";
        const contractorB = b.contractor?.name || "";
        return contractorA.localeCompare(contractorB);
      });
  }, [filteredAssignments]);

  const clientLaborInvoiceGroups: ClientLaborInvoiceGroup[] = useMemo(() => {
    const groupMap: Record<string, AssignmentRow[]> = {};

    filteredAssignments
      .filter((row) => row.approved)
      .forEach((row) => {
        const key = row.event_id ? String(row.event_id) : `no-event-${row.id}`;
        if (!groupMap[key]) groupMap[key] = [];
        groupMap[key].push(row);
      });

    return Object.entries(groupMap)
      .map(([key, rows]) => {
        const sortedRows = [...rows].sort((a, b) => {
          const dateA = `${a.work_date || "9999-12-31"} ${a.call_time || "99:99"} ${a.contractor?.name || ""}`;
          const dateB = `${b.work_date || "9999-12-31"} ${b.call_time || "99:99"} ${b.contractor?.name || ""}`;
          return dateA.localeCompare(dateB);
        });

        const dates = sortedRows
          .map((row) => row.work_date)
          .filter(Boolean) as string[];

        const contractorNames = new Set(
          sortedRows.map((row) => row.contractor?.name || "Contractor"),
        );

        const positions = new Set(
          sortedRows.map((row) => row.position || "Assignment"),
        );

        const laborTotal = sortedRows.reduce((sum, row) => sum + row.total, 0);
        const paidTotal = sortedRows.reduce(
          (sum, row) => sum + (row.paid ? row.total : 0),
          0,
        );
        const balanceDue = laborTotal - paidTotal;
        const totalHours = sortedRows.reduce((sum, row) => sum + row.billedHours, 0);
        const paidHours = sortedRows.reduce(
          (sum, row) => sum + (row.paid ? row.billedHours : 0),
          0,
        );
        const unpaidHours = totalHours - paidHours;

        return {
          key,
          event: sortedRows[0]?.event,
          rows: sortedRows,
          laborTotal,
          paidTotal,
          balanceDue,
          totalHours,
          paidHours,
          unpaidHours,
          contractorCount: contractorNames.size,
          positionCount: positions.size,
          earliestDate: dates.length ? dates.sort()[0] : null,
          latestDate: dates.length ? dates.sort()[dates.length - 1] : null,
        };
      })
      .sort((a, b) => {
        const dateA = a.earliestDate || "9999-12-31";
        const dateB = b.earliestDate || "9999-12-31";
        return dateA.localeCompare(dateB);
      });
  }, [filteredAssignments]);

  function toggleScheduleGroup(key: string) {
    setExpandedScheduleEventIds((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }));
  }

  function toggleAssignmentGroup(key: string) {
    setExpandedAssignmentEventIds((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }));
  }

  function togglePayrollGroup(key: string) {
    setExpandedPayrollEventIds((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }));
  }

  const totalPayroll = assignmentRows.reduce((sum, row) => sum + row.total, 0);
  const approvedPayroll = assignmentRows
    .filter((row) => row.approved)
    .reduce((sum, row) => sum + row.total, 0);
  const unpaidCount = assignmentRows.filter(
    (row) => row.approved && !row.paid,
  ).length;

  if (status !== "allowed") {
    return (
      <main className="min-h-screen bg-black p-8 text-white" style={PORTAL_BACKGROUND_STYLE}>
        <h1 className="text-3xl font-bold">Manager Portal</h1>
        <p className="mt-4 text-zinc-400">{status}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white" style={PORTAL_BACKGROUND_STYLE}>
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
              Manager Portal
            </h1>
            <p className="mt-2 text-zinc-400">Signed in as {email}</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search across manager portal..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-11 pr-4 text-sm outline-none focus:border-amber-400/40 md:w-80"
              />
            </div>

            <button
              onClick={signOut}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white"
            >
              <LogOut className="mr-2 inline h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                activeTab === tab
                  ? "bg-gradient-to-r from-amber-300 to-yellow-600 text-black shadow-[0_0_30px_rgba(245,158,11,0.25)]"
                  : "border border-white/10 bg-white/[0.05] text-white"
              }`}
            >
              {tab}
            </button>
          ))}

          <a
            href="/manager/requests"
            className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-200"
          >
            Open Position Requests
          </a>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        {loading ? (
          <GlassCard>
            <div className="text-zinc-300">Loading manager portal...</div>
          </GlassCard>
        ) : (
          <>
            {activeTab === "Overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    icon={<CalendarDays className="h-5 w-5" />}
                    label="Events"
                    value={String(events.length)}
                    sublabel="Total scheduled events"
                  />
                  <MetricCard
                    icon={<Users className="h-5 w-5" />}
                    label="Contractors"
                    value={String(contractors.length)}
                    sublabel="Active roster"
                  />
                  <MetricCard
                    icon={<ClipboardList className="h-5 w-5" />}
                    label="Assignments"
                    value={String(assignments.length)}
                    sublabel="Confirmed work"
                  />
                  <MetricCard
                    icon={<DollarSign className="h-5 w-5" />}
                    label="Payroll"
                    value={money(totalPayroll)}
                    sublabel="Total assignment value"
                  />
                </div>

                <GlassCard>
                  <SectionTitle
                    icon={<MapPin className="h-5 w-5" />}
                    title="GPS Clock-In Status"
                    subtitle="Events must have latitude and longitude for contractor geofence clock-in."
                  />

                  <div className="mt-5 space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="font-semibold">{event.name}</div>
                          <div className="text-sm text-zinc-400">
                            {event.address || "--"}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            Radius: {event.geofence_radius_feet || 750} ft
                          </div>
                        </div>

                        {event.latitude && event.longitude ? (
                          <span className="rounded-2xl border border-emerald-500/20 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300">
                            GPS Ready
                          </span>
                        ) : (
                          <span className="rounded-2xl border border-red-500/20 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300">
                            GPS Missing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Schedule Board" && (
              <GlassCard>
                <SectionTitle
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Schedule Board"
                  subtitle="Assignments grouped by event for a cleaner crew overview"
                />

                <div className="mt-5 space-y-4">
                  {assignmentGroups.length ? (
                    assignmentGroups.map((group) => (
                      <EventAssignmentGroupCard
                        key={group.key}
                        group={group}
                        mode="schedule"
                        isOpen={expandedScheduleEventIds[group.key] ?? true}
                        onToggle={() => toggleScheduleGroup(group.key)}
                        onDeleteAssignment={deleteAssignment}
                        onCancelAndNotifyAssignment={cancelAndNotifyAssignment}
                        onSendAssignmentReminder={sendAssignmentReminder}
                        onSaveReview={saveManagerReview}
                        onApproveHours={approveHours}
                        onUpdateAssignment={updateAssignment}
                        onSaveTimeCorrection={saveTimeCorrection}
                      />
                    ))
                  ) : (
                    <EmptyState text="No assignments yet." />
                  )}
                </div>
              </GlassCard>
            )}

            {activeTab === "Events" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_2.1fr]">
                <GlassCard>
                  <SectionTitle
                    icon={<Plus className="h-5 w-5" />}
                    title="Create Event"
                    subtitle="Address will automatically save GPS coordinates"
                  />

                  <div className="mt-5 space-y-3">
                    <Field
                      label="Event Name"
                      value={eventForm.name}
                      onChange={(v) => setEventForm({ ...eventForm, name: v })}
                    />
                    <Field
                      label="Client"
                      value={eventForm.client}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, client: v })
                      }
                    />
                    <Field
                      label="Venue"
                      value={eventForm.venue}
                      onChange={(v) => setEventForm({ ...eventForm, venue: v })}
                    />
                    <Field
                      label="Address"
                      value={eventForm.address}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, address: v })
                      }
                    />
                    <Field
                      label="Start Date"
                      type="date"
                      value={eventForm.start_date}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, start_date: v })
                      }
                    />
                    <Field
                      label="End Date"
                      type="date"
                      value={eventForm.end_date}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, end_date: v })
                      }
                    />
                    <Field
                      label="Start Time"
                      type="time"
                      value={eventForm.start_time}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, start_time: v })
                      }
                    />
                    <Field
                      label="End Time"
                      type="time"
                      value={eventForm.end_time}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, end_time: v })
                      }
                    />
                    <SelectField
                      label="Status"
                      value={eventForm.status}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, status: v })
                      }
                      options={[
                        { value: "Scheduled", label: "Scheduled" },
                        { value: "Completed", label: "Completed" },
                        { value: "Cancelled", label: "Cancelled" },
                      ]}
                    />
                    <Field
                      label="Geofence Radius Feet"
                      type="number"
                      value={eventForm.geofence_radius_feet}
                      onChange={(v) =>
                        setEventForm({ ...eventForm, geofence_radius_feet: v })
                      }
                    />
                    <TextAreaField
                      label="Notes"
                      value={eventForm.notes}
                      onChange={(v) => setEventForm({ ...eventForm, notes: v })}
                    />

                    <button
                      onClick={createEvent}
                      className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                    >
                      Create Event
                    </button>
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<CalendarDays className="h-5 w-5" />}
                    title="Events"
                    subtitle={`${filteredEvents.length} matching results`}
                  />

                  <div className="mt-5 space-y-4">
                    {filteredEvents.length ? (
                      filteredEvents.map((event) => (
                        <EditableEventCard
                          key={event.id}
                          event={event}
                          onSave={saveEvent}
                          onDelete={deleteEvent}
                        />
                      ))
                    ) : (
                      <EmptyState text="No events found." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Contractors" && (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
                  <GlassCard>
                  <SectionTitle
                    icon={<Plus className="h-5 w-5" />}
                    title="Create Contractor"
                    subtitle="Add contractor profile"
                  />

                  <div className="mt-5 space-y-3">
                    <Field
                      label="Name"
                      value={contractorForm.name}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, name: v })
                      }
                    />
                    <Field
                      label="Role"
                      value={contractorForm.role}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, role: v })
                      }
                    />
                    <Field
                      label="Phone"
                      value={contractorForm.phone}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, phone: v })
                      }
                    />
                    <Field
                      label="Email"
                      value={contractorForm.email}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, email: v })
                      }
                    />
                    <Field
                      label="Rate"
                      type="number"
                      value={contractorForm.rate}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, rate: v })
                      }
                    />
                    <SelectField
                      label="Rate Type"
                      value={contractorForm.rate_type}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, rate_type: v })
                      }
                      options={[
                        { value: "day", label: "day" },
                        { value: "hour", label: "hour" },
                      ]}
                    />
                    <Field
                      label="Company"
                      value={contractorForm.company}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, company: v })
                      }
                    />
                    <Field
                      label="City"
                      value={contractorForm.city}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, city: v })
                      }
                    />
                    <Field
                      label="State"
                      value={contractorForm.state}
                      onChange={(v) =>
                        setContractorForm({ ...contractorForm, state: v })
                      }
                    />

                    <button
                      onClick={createContractor}
                      className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                    >
                      Create Contractor
                    </button>
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<Sparkles className="h-5 w-5" />}
                    title="Skill Sets"
                    subtitle="Add or remove available contractor skills"
                  />

                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <Field
                        label="New Skill Name"
                        value={newSkillName}
                        onChange={setNewSkillName}
                        placeholder="Example: Video Director"
                      />
                      <button
                        onClick={addSkillSet}
                        className="self-end rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-5 py-3 font-semibold text-black"
                      >
                        Add Skill
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {skillOptions.length ? (
                        skillOptions.map((skill) => (
                          <div
                            key={skill}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
                          >
                            <span>{skill}</span>
                            <button
                              type="button"
                              onClick={() => deleteSkillSet(skill)}
                              className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-zinc-500">
                          No skill sets found.
                        </span>
                      )}
                    </div>

                    <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 p-3 text-xs text-amber-100">
                      These skills are used for contractor skill approvals and live position request matching.
                    </div>
                  </div>
                  </GlassCard>
                </div>

                <GlassCard>
                  <SectionTitle
                    icon={<Users className="h-5 w-5" />}
                    title="Contractors"
                    subtitle={`${filteredContractors.length} matching results`}
                  />

                  <div className="mt-5">
                    {filteredContractors.length ? (
                      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                        {filteredContractors.map((contractor) => (
                        <EditableContractorCard
                          key={contractor.id}
                          contractor={contractor}
                          skillOptions={skillOptions}
                          onSave={saveContractor}
                          onDelete={deleteContractor}
                        />
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="No contractors found." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Assignments" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_2.1fr]">
                <GlassCard>
                  <SectionTitle
                    icon={<Plus className="h-5 w-5" />}
                    title="Create Assignment"
                    subtitle="Assign one contractor to one or multiple event dates"
                  />

                  <div className="mt-5 space-y-3">
                    <SelectField
                      label="Event"
                      value={assignmentForm.event_id}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, event_id: v })
                      }
                      options={events.map((e) => ({
                        value: String(e.id),
                        label: e.name,
                      }))}
                    />
                    <SelectField
                      label="Contractor"
                      value={assignmentForm.contractor_id}
                      onChange={(v) =>
                        setAssignmentForm({
                          ...assignmentForm,
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
                      value={assignmentForm.position}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, position: v })
                      }
                    />
                    <Field
                      label="Single Work Date"
                      type="date"
                      value={assignmentForm.work_date}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, work_date: v })
                      }
                    />
                    <TextAreaField
                      label="Multiple Work Dates"
                      value={assignmentForm.work_dates}
                      onChange={(v) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          work_dates: v,
                        })
                      }
                    />
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                      For multiple-day positions, enter one date per line or comma separated using YYYY-MM-DD. Example: 2026-06-17, 2026-06-18, 2026-06-19. If this box is filled, it will use these dates instead of the single work date above.
                    </div>
                    <Field
                      label="Call Time"
                      type="time"
                      value={assignmentForm.call_time}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, call_time: v })
                      }
                    />
                    <Field
                      label="Rate"
                      type="number"
                      value={assignmentForm.rate}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, rate: v })
                      }
                    />
                    <SelectField
                      label="Rate Type"
                      value={assignmentForm.rate_type}
                      onChange={(v) =>
                        setAssignmentForm({ ...assignmentForm, rate_type: v })
                      }
                      options={[
                        { value: "day", label: "day" },
                        { value: "hour", label: "hour" },
                      ]}
                    />

                    <button
                      onClick={createAssignment}
                      className="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
                    >
                      Create Assignment
                    </button>
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<ClipboardList className="h-5 w-5" />}
                    title="Assignments"
                    subtitle="Approve hours, approve invoice, mark paid, delete assignment, and review clock-in/out"
                  />

                  <div className="mt-5 space-y-4">
                    {assignmentGroups.length ? (
                      assignmentGroups.map((group) => (
                        <EventAssignmentGroupCard
                          key={group.key}
                          group={group}
                          mode="full"
                          isOpen={expandedAssignmentEventIds[group.key] ?? true}
                          onToggle={() => toggleAssignmentGroup(group.key)}
                          onDeleteAssignment={deleteAssignment}
                          onCancelAndNotifyAssignment={cancelAndNotifyAssignment}
                          onSendAssignmentReminder={sendAssignmentReminder}
                          onSaveReview={saveManagerReview}
                          onApproveHours={approveHours}
                          onUpdateAssignment={updateAssignment}
                          onSaveTimeCorrection={saveTimeCorrection}
                        />
                      ))
                    ) : (
                      <EmptyState text="No assignments yet." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Payroll" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard
                    icon={<DollarSign className="h-5 w-5" />}
                    label="Total Payroll"
                    value={money(totalPayroll)}
                    sublabel="All assignment value"
                  />
                  <MetricCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    label="Approved Payroll"
                    value={money(approvedPayroll)}
                    sublabel="Approved invoice items"
                  />
                  <MetricCard
                    icon={<ClipboardList className="h-5 w-5" />}
                    label="Unpaid Items"
                    value={String(unpaidCount)}
                    sublabel="Approved but not paid"
                  />
                </div>

                <GlassCard>
                  <SectionTitle
                    icon={<DollarSign className="h-5 w-5" />}
                    title="Payroll Review"
                    subtitle="Payroll grouped by event. Open each show to review individual crew, approve hours, mark paid, or delete assignments."
                  />

                  <div className="mt-5 space-y-4">
                    {assignmentGroups.length ? (
                      assignmentGroups.map((group) => (
                        <EventAssignmentGroupCard
                          key={group.key}
                          group={group}
                          mode="full"
                          isOpen={expandedPayrollEventIds[group.key] ?? true}
                          onToggle={() => togglePayrollGroup(group.key)}
                          onDeleteAssignment={deleteAssignment}
                          onCancelAndNotifyAssignment={cancelAndNotifyAssignment}
                          onSendAssignmentReminder={sendAssignmentReminder}
                          onSaveReview={saveManagerReview}
                          onApproveHours={approveHours}
                          onUpdateAssignment={updateAssignment}
                          onSaveTimeCorrection={saveTimeCorrection}
                        />
                      ))
                    ) : (
                      <EmptyState text="No payroll items yet." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Invoices" && (
              <div className="space-y-6">
                <GlassCard>
                  <SectionTitle
                    icon={<FileText className="h-5 w-5" />}
                    title="Client Labor Invoices"
                    subtitle="Approved assignments grouped into one labor invoice per event for client billing"
                  />

                  <div className="mt-5 space-y-4">
                    {clientLaborInvoiceGroups.length ? (
                      clientLaborInvoiceGroups.map((group) => (
                        <ClientLaborInvoiceCard key={group.key} group={group} />
                      ))
                    ) : (
                      <EmptyState text="No approved assignments ready for client labor invoicing." />
                    )}
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<FileText className="h-5 w-5" />}
                    title="Contractor Invoices"
                    subtitle="Review contractor invoices, add/remove line items, view contractor PDF previews, approve invoices, and mark paid"
                  />

                  <div className="mt-5 space-y-4">
                    {invoiceGroups.length ? (
                      invoiceGroups.map((group) => (
                        <ContractorEventInvoiceCard
                          key={group.key}
                          group={group}
                          onSaveReview={saveManagerReview}
                          onApproveHours={approveHours}
                          onUpdateAssignment={updateAssignment}
                          onDeleteAssignment={deleteAssignment}
                          onCancelAndNotifyAssignment={cancelAndNotifyAssignment}
                          onSendAssignmentReminder={sendAssignmentReminder}
                          onSaveTimeCorrection={saveTimeCorrection}
                          onRefresh={loadAll}
                        />
                      ))
                    ) : (
                      <EmptyState text="No contractor invoice records yet." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === "Documents" && (
              <div className="grid gap-6 xl:grid-cols-2">
                <GlassCard>
                  <SectionTitle
                    icon={<FolderOpen className="h-5 w-5" />}
                    title="Uploaded Contractor Documents"
                    subtitle={`${documents.length} files found`}
                  />

                  <div className="mt-5 space-y-3">
                    <button
                      onClick={loadAll}
                      className="mb-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                    >
                      <RefreshCw className="mr-2 inline h-4 w-4" />
                      Refresh Files
                    </button>

                    {documents.length ? (
                      documents.map((doc) => (
                        <div
                          key={doc.path}
                          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold">{doc.name}</div>
                            <div className="text-sm text-zinc-400">
                              {doc.contractor_name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              folder: {doc.contractor_id}
                              {doc.updated_at
                                ? ` · ${new Date(doc.updated_at).toLocaleString()}`
                                : ""}
                              {doc.size ? ` · ${fileSizeLabel(doc.size)}` : ""}
                            </div>
                          </div>

                          <button
                            onClick={() => openDocument(doc.path)}
                            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white"
                          >
                            Open
                          </button>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="No contractor documents found." />
                    )}
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle
                    icon={<CalendarDays className="h-5 w-5" />}
                    title="Availability Submissions"
                    subtitle={`${availability.length} rows found`}
                  />

                  <div className="mt-5 space-y-3">
                    {availability.length ? (
                      availability.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-white/10 bg-black/25 p-4"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold">
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
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="No availability submissions yet." />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function EventAssignmentGroupCard({
  group,
  mode,
  isOpen,
  onToggle,
  onSaveReview,
  onApproveHours,
  onUpdateAssignment,
  onDeleteAssignment,
  onCancelAndNotifyAssignment,
  onSendAssignmentReminder,
  onSaveTimeCorrection,
}: {
  group: EventAssignmentGroup;
  mode: "schedule" | "full";
  isOpen: boolean;
  onToggle: () => void;
  onSaveReview: (
    row: AssignmentRow,
    managerApprovedHours: string,
    managerNotes: string,
  ) => void;
  onApproveHours: (row: AssignmentRow) => void;
  onUpdateAssignment: (
    row: AssignmentRow,
    updates: Partial<Assignment>,
  ) => void;
  onDeleteAssignment: (id: number) => void;
  onCancelAndNotifyAssignment: (row: AssignmentRow) => void;
  onSendAssignmentReminder: (row: AssignmentRow) => void;
  onSaveTimeCorrection: (
    row: AssignmentRow,
    values: {
      clockIn: string;
      lunchOut: string;
      lunchIn: string;
      clockOut: string;
      reason: string;
    },
  ) => void;
  onRefresh?: () => Promise<void>;
}) {
  const event = group.event;
  const eventName = event?.name || "Unassigned Event";
  const eventDateRange =
    group.earliestDate &&
    group.latestDate &&
    group.earliestDate !== group.latestDate
      ? `${dateLabel(group.earliestDate)} - ${dateLabel(group.latestDate)}`
      : dateLabel(group.earliestDate);

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/25">
      <button
        onClick={onToggle}
        className="flex w-full flex-col gap-4 p-5 text-left md:flex-row md:items-start md:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xl font-semibold text-white">{eventName}</div>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              {group.crewCount} crew
            </span>
          </div>

          <div className="mt-1 text-sm text-zinc-400">
            {event?.client || "No client listed"}
            {event?.venue ? ` · ${event.venue}` : ""}
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            {event?.address || "No address listed"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 md:justify-end">
          <div className="text-left md:text-right">
            <div className="font-semibold text-amber-300">{eventDateRange}</div>
            <div className="text-xs text-zinc-500">
              {group.confirmedCount} confirmed · {group.approvedCount} approved
              · {group.paidCount} paid · {money(group.totalValue)}
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-zinc-400 transition ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-white/10 p-5 pt-4">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <MiniInfo
              icon={<Users className="h-4 w-4" />}
              label="Crew Confirmed"
              value={`${group.confirmedCount} of ${group.crewCount}`}
            />
            <MiniInfo
              icon={<MapPin className="h-4 w-4" />}
              label="Address"
              value={event?.address || "--"}
            />
            <MiniInfo
              icon={<CalendarDays className="h-4 w-4" />}
              label="Event Dates"
              value={eventDateRange}
            />
            <MiniInfo
              icon={<DollarSign className="h-4 w-4" />}
              label="Total Value"
              value={money(group.totalValue)}
            />
          </div>

          {mode === "schedule" ? (
            <div className="space-y-3">
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        {row.position || "Assignment"}
                      </div>
                      <div className="text-sm text-zinc-400">
                        {row.contractor?.name || "Contractor"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {dateLabel(row.work_date)} · Call{" "}
                        {timeLabel(row.call_time)} · Clock{" "}
                        {timeLabel(row.clock_in)} - {timeLabel(row.clock_out)}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:items-end">
                      <div className="text-left md:text-right">
                        <div className="font-semibold text-amber-300">
                          {money(row.total)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Tracked {row.trackedHours.toFixed(2)} hrs · Approved{" "}
                          {row.billedHours.toFixed(2)} hrs
                        </div>
                      </div>

                      <button
                        onClick={() => onSendAssignmentReminder(row)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200"
                      >
                        <Clock3 className="h-4 w-4" />
                        Send Reminder
                      </button>

                      <button
                        onClick={() => onCancelAndNotifyAssignment(row)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300"
                      >
                        <AlertCircle className="h-4 w-4" />
                        Cancel + Notify Contractor
                      </button>

                      <button
                        onClick={() => onDeleteAssignment(row.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Assignment
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {group.rows.map((row) => (
                <ManagerAssignmentCard
                  key={row.id}
                  row={row}
                  onSaveReview={onSaveReview}
                  onApproveHours={onApproveHours}
                  onUpdateAssignment={onUpdateAssignment}
                  onDeleteAssignment={onDeleteAssignment}
                  onCancelAndNotifyAssignment={onCancelAndNotifyAssignment}
                  onSendAssignmentReminder={onSendAssignmentReminder}
                  onSaveTimeCorrection={onSaveTimeCorrection}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ClientLaborInvoiceCard({ group }: { group: ClientLaborInvoiceGroup }) {
  const [showPreview, setShowPreview] = useState(false);

  const clientInvoiceNumber = `CLIENT-${group.event?.id || "EVENT"}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}`;

  const dateRange =
    group.earliestDate && group.latestDate && group.earliestDate !== group.latestDate
      ? `${dateLabel(group.earliestDate)} - ${dateLabel(group.latestDate)}`
      : dateLabel(group.earliestDate);

  const groupedByDate = group.rows.reduce<Record<string, AssignmentRow[]>>(
    (acc, row) => {
      const key = row.work_date || "No Date";
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    },
    {},
  );

  function openClientLaborPdf() {
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const logoUrl = `${window.location.origin}/luxon-logo.png`;

    const groupedBalanceDue = group.balanceDue;
    const groupedPaidTotal = group.paidTotal;
    const groupedPaidHours = group.paidHours;
    const groupedUnpaidHours = group.unpaidHours;

    const lineRows = group.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(dateLabel(row.work_date))}</td>
            <td>${escapeHtml(row.contractor?.name || "Contractor")}</td>
            <td>${escapeHtml(row.position || "Labor")}</td>
            <td>${escapeHtml(timeLabel(row.call_time))}</td>
            <td style="text-align:right;">${escapeHtml(row.billedHours.toFixed(2))}</td>
            <td style="text-align:right;">${escapeHtml(money(Number(row.rate || 0)))} / ${escapeHtml(row.rate_type || "day")}</td>
            <td style="text-align:right;font-weight:700;">${escapeHtml(money(row.total))}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1100,height=850");

    if (!printWindow) {
      alert("Popup blocked. Please allow popups for Luxon Ops and try again.");
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Luxon Client Labor Invoice ${escapeHtml(clientInvoiceNumber)}</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
    }
    body { padding: 28px; }
    .sheet {
      width: 100%;
      background: white;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 24px;
      margin-bottom: 24px;
      align-items: flex-start;
    }
    .brand {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .logo {
      width: 120px;
      height: auto;
      object-fit: contain;
      display: block;
    }
    .company {
      font-size: 30px;
      font-weight: 700;
      line-height: 1.15;
    }
    .subtle {
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title .big {
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
    }
    .label {
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .value-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    thead tr {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th:last-child, td:last-child { text-align: right; }
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 16px;
      align-items: start;
    }
    .summary {
      background: #f8fafc;
      border-radius: 16px;
      padding: 18px;
      border: 1px solid #e2e8f0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      font-size: 24px;
      font-weight: 700;
    }
    .footer {
      margin-top: 28px;
      color: #64748b;
      font-size: 12px;
    }
    .actions {
      margin-top: 22px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    button {
      border: 0;
      border-radius: 12px;
      padding: 12px 16px;
      font-weight: 700;
      cursor: pointer;
    }
    .print { background: #f2c230; color: #000; }
    .close { background: #0f172a; color: #fff; }
    @media print {
      body { padding: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <img src="${escapeHtml(logoUrl)}" alt="Luxon Entertainment Logo" class="logo" />
        <div>
          <div class="company">Luxon Entertainment LLC</div>
          <div class="subtle">Client Labor Invoice</div>
          <div class="subtle" style="margin-top: 10px;">Generated: ${escapeHtml(
            new Date().toLocaleDateString("en-US"),
          )}</div>
        </div>
      </div>

      <div class="invoice-title">
        <div class="big">LABOR INVOICE</div>
        <div class="subtle" style="margin-top: 10px;">${escapeHtml(clientInvoiceNumber)}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Bill To / Client</div>
        <div class="value-title">${escapeHtml(group.event?.client || group.event?.name || "Client")}</div>
        <div>${escapeHtml(group.event?.name || "")}</div>
        <div>${escapeHtml(group.event?.venue || "")}</div>
        <div>${escapeHtml(group.event?.address || "")}</div>
      </div>

      <div class="card">
        <div class="label">Invoice Summary</div>
        <div class="value-title">${escapeHtml(dateRange)}</div>
        <div>${escapeHtml(String(group.rows.length))} approved labor line item(s)</div>
        <div>${escapeHtml(String(group.contractorCount))} contractor(s)</div>
        <div>${escapeHtml(group.totalHours.toFixed(2))} approved/billed labor hour(s)</div>
        <div>${escapeHtml(groupedPaidHours.toFixed(2))} paid labor hour(s)</div>
        <div>${escapeHtml(groupedUnpaidHours.toFixed(2))} unpaid labor hour(s)</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Contractor</th>
          <th>Position</th>
          <th>Call Time</th>
          <th style="text-align:right;">Hours</th>
          <th style="text-align:right;">Rate</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
      </tbody>
    </table>

    <div class="bottom-grid">
      <div class="card">
        <div class="label">Labor Billing Notes</div>
        <div>
          This labor invoice includes approved Luxon Ops assignments only. Multiple contractors, dates, and positions are combined into one client-facing labor invoice for this event.
        </div>
        <div style="margin-top: 12px;">
          Please review totals before sending to client accounting.
        </div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span>Total Hours</span>
          <strong>${escapeHtml(group.totalHours.toFixed(2))}</strong>
        </div>
        <div class="summary-row">
          <span>Labor Line Items</span>
          <strong>${escapeHtml(String(group.rows.length))}</strong>
        </div>
        <div class="summary-row">
          <span>Contractors</span>
          <strong>${escapeHtml(String(group.contractorCount))}</strong>
        </div>
        <div class="summary-row">
          <span>Total Labor</span>
          <strong>${escapeHtml(money(group.laborTotal))}</strong>
        </div>
        <div class="summary-row">
          <span>Paid</span>
          <strong>${escapeHtml(money(groupedPaidTotal))}</strong>
        </div>
        <div class="summary-total">
          <span>Balance Due</span>
          <span>${escapeHtml(money(groupedBalanceDue))}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      Luxon Entertainment LLC · Luxon.entertainment@gmail.com · (562) 391-6933
    </div>
  </div>

  <div class="actions">
    <button class="print" onclick="window.print()">Print / Save PDF</button>
    <button class="close" onclick="window.close()">Close</button>
  </div>
</body>
</html>
    `);

    printWindow.document.close();
    printWindow.focus();
  }

  return (
    <div className="rounded-3xl border border-amber-400/15 bg-amber-400/[0.06] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xl font-bold text-white">
              {group.event?.name || "Event"}
            </div>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              Client Labor Invoice
            </span>
          </div>

          <div className="mt-1 text-sm text-zinc-400">
            Client: {group.event?.client || "--"} · {group.event?.venue || "--"}
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            {dateRange} · {group.rows.length} approved line item{group.rows.length === 1 ? "" : "s"} · {group.contractorCount} contractor{group.contractorCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="text-left xl:text-right">
          <div className="text-3xl font-bold text-amber-300">
            {money(group.balanceDue)}
          </div>
          <div className="text-xs text-zinc-500">
            {group.unpaidHours.toFixed(2)} unpaid labor hrs
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Paid: {money(group.paidTotal)} · Total: {money(group.laborTotal)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniInfo
          icon={<FileText className="h-4 w-4" />}
          label="Client"
          value={group.event?.client || "--"}
        />
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="Dates"
          value={dateRange}
        />
        <MiniInfo
          icon={<Users className="h-4 w-4" />}
          label="Contractors"
          value={String(group.contractorCount)}
        />
        <MiniInfo
          icon={<DollarSign className="h-4 w-4" />}
          label="Balance Due"
          value={money(group.balanceDue)}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1fr_1.2fr_1.1fr_0.8fr_0.8fr] gap-3 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          <div>Date</div>
          <div>Contractor</div>
          <div>Position</div>
          <div className="text-right">Hours</div>
          <div className="text-right">Amount</div>
        </div>

        <div className="divide-y divide-white/10">
          {Object.entries(groupedByDate).map(([date, rows]) =>
            rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1.2fr_1.1fr_0.8fr_0.8fr] md:gap-3"
              >
                <div className="font-semibold text-white">
                  {dateLabel(date)}
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {row.contractor?.name || "Contractor"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {row.contractor?.email || ""}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {row.position || "Labor"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {money(Number(row.rate || 0))} / {row.rate_type || "day"}
                  </div>
                </div>
                <div className="text-left font-semibold text-white md:text-right">
                  {row.billedHours.toFixed(2)}
                </div>
                <div className="text-left font-bold text-amber-300 md:text-right">
                  {money(row.total)}
                </div>
              </div>
            )),
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setShowPreview((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
        >
          <ChevronDown className={`h-4 w-4 transition ${showPreview ? "rotate-180" : ""}`} />
          {showPreview ? "Hide Details" : "Show Details"}
        </button>

        <button
          onClick={openClientLaborPdf}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-2 text-sm font-semibold text-black"
        >
          <FileText className="h-4 w-4" />
          View Client Labor PDF
        </button>
      </div>

      {showPreview ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
          <div>This client invoice pulls only assignments marked approved in Luxon Ops. If a contractor assignment is missing, approve the contractor invoice/assignment first.</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Total Labor</div>
              <div className="mt-1 text-lg font-bold text-white">{money(group.laborTotal)}</div>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/70">Paid</div>
              <div className="mt-1 text-lg font-bold text-emerald-300">{money(group.paidTotal)}</div>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-amber-200/70">Balance Due</div>
              <div className="mt-1 text-lg font-bold text-amber-300">{money(group.balanceDue)}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContractorEventInvoiceCard({
  group,
  onSaveReview,
  onApproveHours,
  onUpdateAssignment,
  onDeleteAssignment,
  onCancelAndNotifyAssignment,
  onSendAssignmentReminder,
  onSaveTimeCorrection,
  onRefresh,
}: {
  group: ContractorEventInvoiceGroup;
  onSaveReview: (
    row: AssignmentRow,
    managerApprovedHours: string,
    managerNotes: string,
  ) => void;
  onApproveHours: (row: AssignmentRow) => void;
  onUpdateAssignment: (
    row: AssignmentRow,
    updates: Partial<Assignment>,
  ) => void;
  onDeleteAssignment: (id: number) => void;
  onCancelAndNotifyAssignment: (row: AssignmentRow) => void;
  onSendAssignmentReminder: (row: AssignmentRow) => void;
  onSaveTimeCorrection: (
    row: AssignmentRow,
    values: {
      clockIn: string;
      lunchOut: string;
      lunchIn: string;
      clockOut: string;
      reason: string;
    },
  ) => void;
  onRefresh?: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [wholeInvoicePaidDate, setWholeInvoicePaidDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [addAssignmentForm, setAddAssignmentForm] = useState({
    position: "",
    work_date: "",
    call_time: "",
    rate: "",
    rate_type: "day",
    notes: "",
  });

  const invoiceNumber = `LX-${group.event?.id || "EVENT"}-${group.contractor?.id || "CONTRACTOR"}`;
  const balanceDue = group.rows.reduce(
    (sum, row) => sum + (row.paid ? 0 : row.total),
    0,
  );
  const paidTotal = group.invoiceTotal - balanceDue;

  async function addAssignmentToInvoice() {
    if (!group.event?.id || !group.contractor?.id) {
      alert("Missing contractor or event for this invoice group.");
      return;
    }

    if (!addAssignmentForm.position.trim()) {
      alert("Enter a position.");
      return;
    }

    if (!addAssignmentForm.work_date) {
      alert("Enter a work date.");
      return;
    }

    const { error } = await supabase.from("assignments").insert({
      event_id: group.event.id,
      contractor_id: group.contractor.id,
      position: addAssignmentForm.position.trim(),
      work_date: addAssignmentForm.work_date || null,
      call_time: addAssignmentForm.call_time || null,
      rate: Number(addAssignmentForm.rate || 0),
      rate_type: addAssignmentForm.rate_type || "day",
      confirmed: true,
      approved: false,
      paid: false,
      hours_approved: false,
      manager_notes: addAssignmentForm.notes.trim() || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setAddAssignmentForm({
      position: "",
      work_date: "",
      call_time: "",
      rate: "",
      rate_type: "day",
      notes: "",
    });
    setShowAddAssignment(false);
    if (onRefresh) {
      if (onRefresh) {
      await onRefresh();
    }
    }
  }

  function openIndividualContractorInvoicePdf(row: AssignmentRow) {
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const logoUrl = `${window.location.origin}/luxon-logo.png`;
    const individualInvoiceNumber = `LX-${row.event_id || "EVENT"}-${row.contractor_id || "CONTRACTOR"}-${row.id}`;

    const printWindow = window.open("", "_blank", "width=1100,height=850");

    if (!printWindow) {
      alert("Popup blocked. Please allow popups for Luxon Ops and try again.");
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Luxon Contractor Invoice ${escapeHtml(individualInvoiceNumber)}</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
    }
    body { padding: 28px; }
    .sheet {
      width: 100%;
      background: white;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 24px;
      margin-bottom: 24px;
      align-items: flex-start;
    }
    .brand {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .logo {
      width: 120px;
      height: auto;
      object-fit: contain;
      display: block;
    }
    .company {
      font-size: 30px;
      font-weight: 700;
      line-height: 1.15;
    }
    .subtle {
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }
    .approved { text-align: right; }
    .approved .big {
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
    }
    .label {
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .value-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    thead tr {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th:last-child, td:last-child { text-align: right; }
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 16px;
      align-items: start;
    }
    .summary {
      background: #f8fafc;
      border-radius: 16px;
      padding: 18px;
      border: 1px solid #e2e8f0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      font-size: 24px;
      font-weight: 700;
    }
    .footer {
      margin-top: 28px;
      color: #64748b;
      font-size: 12px;
    }
    .actions {
      margin-top: 22px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    button {
      border: 0;
      border-radius: 12px;
      padding: 12px 16px;
      font-weight: 700;
      cursor: pointer;
    }
    .print { background: #f2c230; color: #000; }
    .close { background: #0f172a; color: #fff; }
    @media print {
      body { padding: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <img src="${escapeHtml(logoUrl)}" alt="Luxon Entertainment Logo" class="logo" />
        <div>
          <div class="company">Luxon Entertainment LLC</div>
          <div class="subtle">Contractor Pay Stub / Invoice Record</div>
          <div class="subtle" style="margin-top: 10px;">Generated: ${escapeHtml(
            new Date().toLocaleDateString("en-US"),
          )}</div>
        </div>
      </div>

      <div class="approved">
        <div class="big">${escapeHtml(row.paid ? "PAID" : row.approved ? "APPROVED" : "PENDING")}</div>
        <div class="subtle" style="margin-top: 10px;">Record ${escapeHtml(individualInvoiceNumber)}</div>
        <div class="subtle">Paid Date: ${escapeHtml(row.paid_at ? dateLabel(row.paid_at) : "--")}</div>
        <div class="subtle">Balance Due: ${escapeHtml(money(row.paid ? 0 : row.total))}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Contractor</div>
        <div class="value-title">${escapeHtml(row.contractor?.name || group.contractor?.name || "--")}</div>
        <div>${escapeHtml(row.contractor?.email || group.contractor?.email || "")}</div>
        <div>${escapeHtml(row.contractor?.phone || group.contractor?.phone || "")}</div>
        <div>${escapeHtml(
          `${row.contractor?.city || group.contractor?.city || ""}${
            row.contractor?.state || group.contractor?.state
              ? `, ${row.contractor?.state || group.contractor?.state}`
              : ""
          }`,
        )}</div>
      </div>

      <div class="card">
        <div class="label">Event</div>
        <div class="value-title">${escapeHtml(row.event?.name || group.event?.name || "--")}</div>
        <div>${escapeHtml(row.event?.client || group.event?.client || "")}</div>
        <div>${escapeHtml(row.event?.venue || group.event?.venue || "")}</div>
        <div>${escapeHtml(row.event?.address || group.event?.address || "")}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Position</th>
          <th>Call Time</th>
          <th>Clock In</th>
          <th>Lunch Out</th>
          <th>Lunch In</th>
          <th>Clock Out</th>
          <th>Hours</th>
          <th>Rate</th>
          <th>Due Date</th>
          <th>Paid Date</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(dateLabel(row.work_date))}</td>
          <td>${escapeHtml(row.position || "Assignment")}</td>
          <td>${escapeHtml(timeLabel(row.call_time))}</td>
          <td>${escapeHtml(timeLabel(row.clock_in))}</td>
          <td>${escapeHtml(timeLabel(row.lunch_clock_out))}</td>
          <td>${escapeHtml(timeLabel(row.lunch_clock_in))}</td>
          <td>${escapeHtml(timeLabel(row.clock_out))}</td>
          <td>${escapeHtml(row.billedHours.toFixed(2))}</td>
          <td>${escapeHtml(money(Number(row.rate || 0)))} / ${escapeHtml(row.rate_type || "day")}</td>
          <td>${escapeHtml(invoiceDueDateLabel(row.hours_approved_at, row.work_date))}</td>
          <td>${escapeHtml(row.paid_at ? dateLabel(row.paid_at) : "--")}</td>
          <td>${escapeHtml(money(row.total))}</td>
        </tr>
      </tbody>
    </table>

    <div class="bottom-grid">
      <div class="card">
        <div class="label">Notes</div>
        <div>
          This is the contractor invoice/pay stub preview for this assignment.
        </div>
        <div style="margin-top: 12px;">
          Payment Terms: All Luxon Entertainment shows are paid on Net 30 terms unless otherwise agreed in writing. Due date is usually 30 days after hours are approved.
        </div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span>Total Hours</span>
          <strong>${escapeHtml(row.billedHours.toFixed(2))}</strong>
        </div>
        <div class="summary-row">
          <span>Due Date</span>
          <strong>${escapeHtml(invoiceDueDateLabel(row.hours_approved_at, row.work_date))}</strong>
        </div>
        <div class="summary-row">
          <span>Paid Status</span>
          <strong>${escapeHtml(row.paid ? "Paid" : "Unpaid")}</strong>
        </div>
        <div class="summary-row">
          <span>Paid Date</span>
          <strong>${escapeHtml(row.paid_at ? dateLabel(row.paid_at) : "--")}</strong>
        </div>
        <div class="summary-row">
          <span>Invoice Total</span>
          <strong>${escapeHtml(money(row.total))}</strong>
        </div>
        <div class="summary-total">
          <span>Balance Due</span>
          <span>${escapeHtml(money(row.paid ? 0 : row.total))}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      Luxon Entertainment LLC · Luxon.entertainment@gmail.com · (562) 391-6933
    </div>
  </div>

  <div class="actions">
    <button class="print" onclick="window.print()">Print / Save PDF</button>
    <button class="close" onclick="window.close()">Close</button>
  </div>
</body>
</html>
    `);

    printWindow.document.close();
    printWindow.focus();
  }

  function openContractorPdfPreview() {
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const logoUrl = `${window.location.origin}/luxon-logo.png`;

    const groupedBalanceDue = group.rows.reduce(
      (sum, row) => sum + (row.paid ? 0 : row.total),
      0,
    );
    const groupedPaidTotal = group.invoiceTotal - groupedBalanceDue;

    const lineRows = group.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(dateLabel(row.work_date))}</td>
            <td>${escapeHtml(row.position || "Assignment")}</td>
            <td>${escapeHtml(timeLabel(row.call_time))}</td>
            <td>${escapeHtml(timeLabel(row.clock_in))}</td>
            <td>${escapeHtml(timeLabel(row.lunch_clock_out))}</td>
            <td>${escapeHtml(timeLabel(row.lunch_clock_in))}</td>
            <td>${escapeHtml(timeLabel(row.clock_out))}</td>
            <td>${escapeHtml(row.billedHours.toFixed(2))}</td>
            <td>${escapeHtml(money(Number(row.rate || 0)))} / ${escapeHtml(row.rate_type || "day")}</td>
            <td>${escapeHtml(invoiceDueDateLabel(row.hours_approved_at, row.work_date))}</td>
            <td>${escapeHtml(row.paid_at ? dateLabel(row.paid_at) : "--")}</td>
            <td>${escapeHtml(money(row.total))}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1100,height=850");

    if (!printWindow) {
      alert("Popup blocked. Please allow popups for Luxon Ops and try again.");
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Luxon Contractor Invoice ${escapeHtml(invoiceNumber)}</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
    }
    body { padding: 28px; }
    .sheet {
      width: 100%;
      background: white;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 24px;
      margin-bottom: 24px;
      align-items: flex-start;
    }
    .brand {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .logo {
      width: 120px;
      height: auto;
      object-fit: contain;
      display: block;
    }
    .company {
      font-size: 30px;
      font-weight: 700;
      line-height: 1.15;
    }
    .subtle {
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }
    .approved { text-align: right; }
    .approved .big {
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
    }
    .label {
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .value-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    thead tr {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th:last-child, td:last-child { text-align: right; }
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 16px;
      align-items: start;
    }
    .summary {
      background: #f8fafc;
      border-radius: 16px;
      padding: 18px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      font-size: 24px;
      font-weight: 700;
    }
    .footer {
      margin-top: 28px;
      color: #64748b;
      font-size: 12px;
    }
    .actions {
      margin-top: 22px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    button {
      border: 0;
      border-radius: 12px;
      padding: 12px 16px;
      font-weight: 700;
      cursor: pointer;
    }
    .print { background: #f2c230; color: #000; }
    .close { background: #0f172a; color: #fff; }
    @media print {
      body { padding: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <img src="${escapeHtml(logoUrl)}" alt="Luxon Entertainment Logo" class="logo" />
        <div>
          <div class="company">Luxon Entertainment LLC</div>
          <div class="subtle">Contractor Pay Stub / Invoice Record</div>
          <div class="subtle" style="margin-top: 10px;">Generated: ${escapeHtml(
            new Date().toLocaleDateString("en-US")
          )}</div>
        </div>
      </div>

      <div class="approved">
        <div class="big">${escapeHtml(groupedBalanceDue <= 0 ? "PAID" : "APPROVED")}</div>
        <div class="subtle" style="margin-top: 10px;">Record ${escapeHtml(invoiceNumber)}</div>
        <div class="subtle">Balance Due: ${escapeHtml(money(groupedBalanceDue))}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Contractor</div>
        <div class="value-title">${escapeHtml(group.contractor?.name || "--")}</div>
        <div>${escapeHtml(group.contractor?.email || "")}</div>
        <div>${escapeHtml(group.contractor?.phone || "")}</div>
        <div>${escapeHtml(
          `${group.contractor?.city || ""}${
            group.contractor?.state ? `, ${group.contractor.state}` : ""
          }`
        )}</div>
      </div>

      <div class="card">
        <div class="label">Event</div>
        <div class="value-title">${escapeHtml(group.event?.name || "--")}</div>
        <div>${escapeHtml(group.event?.client || "")}</div>
        <div>${escapeHtml(group.event?.venue || "")}</div>
        <div>${escapeHtml(group.event?.address || "")}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Position</th>
          <th>Call Time</th>
          <th>Clock In</th>
          <th>Lunch Out</th>
          <th>Lunch In</th>
          <th>Clock Out</th>
          <th>Hours</th>
          <th>Rate</th>
          <th>Due Date</th>
          <th>Paid Date</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
      </tbody>
    </table>

    <div class="bottom-grid">
      <div class="card">
        <div class="label">Notes</div>
        <div>
          This is the contractor invoice/pay stub preview for this event. Multiple days and positions are shown as invoice line items.
        </div>
        <div style="margin-top: 12px;">
          Payment Terms: All Luxon Entertainment shows are paid on Net 30 terms unless otherwise agreed in writing. Due date is usually 30 days after hours are approved.
        </div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span>Total Hours</span>
          <strong>${escapeHtml(group.totalHours.toFixed(2))}</strong>
        </div>
        <div class="summary-row">
          <span>Line Items</span>
          <strong>${escapeHtml(String(group.rows.length))}</strong>
        </div>
        <div class="summary-row">
          <span>Paid Total</span>
          <strong>${escapeHtml(money(groupedPaidTotal))}</strong>
        </div>
        <div class="summary-row">
          <span>Invoice Total</span>
          <strong>${escapeHtml(money(group.invoiceTotal))}</strong>
        </div>
        <div class="summary-total">
          <span>Balance Due</span>
          <span>${escapeHtml(money(groupedBalanceDue))}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      Luxon Entertainment LLC · Luxon.entertainment@gmail.com · (562) 391-6933
    </div>
  </div>

  <div class="actions">
    <button class="print" onclick="window.print()">View Contractor PDF</button>
    <button class="close" onclick="window.close()">Close</button>
  </div>
</body>
</html>
    `);

    printWindow.document.close();
    printWindow.focus();
  }


  const allHoursApproved =
    group.rows.length > 0 && group.rows.every((row) => row.hours_approved);
  const allInvoiceApproved =
    group.rows.length > 0 && group.rows.every((row) => row.approved);
  const allPaid = group.rows.length > 0 && group.rows.every((row) => row.paid);

  const dateRange =
    group.earliestDate && group.latestDate && group.earliestDate !== group.latestDate
      ? `${dateLabel(group.earliestDate)} - ${dateLabel(group.latestDate)}`
      : dateLabel(group.earliestDate);

  const positionSummary = Array.from(
    new Set(group.rows.map((row) => row.position || "Assignment")),
  ).join(", ");

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xl font-bold text-white">
              {group.contractor?.name || "Contractor"}
            </div>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              One Invoice / Event
            </span>
          </div>

          <div className="mt-1 text-sm text-zinc-400">
            {group.contractor?.email || "No email"} · {group.event?.name || "Event"}
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            {dateRange} · {group.rows.length} line item{group.rows.length === 1 ? "" : "s"} · {positionSummary}
          </div>
        </div>

        <div className="text-left xl:text-right">
          <div className="text-3xl font-bold text-amber-300">
            {money(group.invoiceTotal)}
          </div>
          <div className={balanceDue <= 0 ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>
            Balance Due: {money(balanceDue)}
          </div>
          <div className="text-xs text-zinc-500">
            Paid: {money(paidTotal)} · {group.totalHours.toFixed(2)} approved/billed hrs total
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniInfo
          icon={<FileText className="h-4 w-4" />}
          label="Invoice Group"
          value={`${group.contractor?.name || "Contractor"} / ${group.event?.name || "Event"}`}
        />
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="Dates"
          value={dateRange}
        />
        <MiniInfo
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Approved"
          value={`${group.approvedCount} of ${group.rows.length}`}
        />
        <MiniInfo
          icon={<DollarSign className="h-4 w-4" />}
          label="Paid"
          value={`${group.paidCount} of ${group.rows.length}`}
        />
        <MiniInfo
          icon={<DollarSign className="h-4 w-4" />}
          label="Balance Due"
          value={money(balanceDue)}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1fr_1.15fr_0.65fr_0.75fr_0.8fr_0.75fr_0.65fr_0.65fr] gap-3 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          <div>Date</div>
          <div>Position</div>
          <div>Hours</div>
          <div>Rate</div>
          <div>Due Date</div>
          <div className="text-right">Line Total</div>
          <div className="text-right">PDF</div>
          <div className="text-right">Remove</div>
        </div>

        <div className="divide-y divide-white/10">
          {group.rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1.15fr_0.65fr_0.75fr_0.8fr_0.75fr_0.65fr_0.65fr] md:gap-3"
            >
              <div>
                <div className="font-semibold text-white">
                  {dateLabel(row.work_date)}
                </div>
                <div className="text-xs text-zinc-500">
                  Call {timeLabel(row.call_time)}
                </div>
              </div>

              <div>
                <div className="font-semibold text-white">
                  {row.position || "Assignment"}
                </div>
                <div className="text-xs text-zinc-500">
                  Record #{row.id}
                </div>
              </div>

              <div>
                <div className="font-semibold text-white">
                  {row.billedHours.toFixed(2)}
                </div>
                <div className="text-xs text-zinc-500">
                  {row.hours_approved ? "approved" : "pending"}
                </div>
              </div>

              <div>
                <div className="font-semibold text-white">
                  {money(Number(row.rate || 0))}
                </div>
                <div className="text-xs text-zinc-500">
                  / {row.rate_type || "day"}
                </div>
              </div>

              <div>
                <div className="font-semibold text-white">
                  {invoiceDueDateLabel(row.hours_approved_at, row.work_date)}
                </div>
                <div className="text-xs text-zinc-500">
                  Net 30 after approved
                </div>
              </div>

              <div className="text-left md:text-right">
                <div className="font-bold text-amber-300">
                  {money(row.total)}
                </div>
                <div className={row.paid ? "text-xs font-semibold text-emerald-300" : "text-xs text-zinc-500"}>
                  Balance Due: {money(row.paid ? 0 : row.total)}
                </div>
                <div className="text-xs text-zinc-500">
                  {row.approved ? "Approved" : "Pending"} · {row.paid ? "Paid" : "Unpaid"}
                </div>
                <div className="mt-2 text-left md:text-right">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Paid Date
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white">
                    {row.paid_at ? dateLabel(row.paid_at) : "--"}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const defaultDate =
                        dateInputValue(row.paid_at) ||
                        new Date().toISOString().slice(0, 10);
                      const paidDate = window.prompt(
                        "Enter paid date as YYYY-MM-DD",
                        defaultDate,
                      );

                      if (paidDate === null) return;

                      const cleanDate = paidDate.trim();

                      if (!cleanDate) {
                        onUpdateAssignment(row, { paid_at: null });
                        return;
                      }

                      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
                        alert("Use this format: YYYY-MM-DD");
                        return;
                      }

                      onUpdateAssignment(row, {
                        paid: true,
                        paid_at: cleanDate,
                      });
                    }}
                    className="mt-2 inline-flex h-8 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/20"
                  >
                    Set + Save Date
                  </button>
                </div>
              </div>

              <div className="text-left md:text-right">
                <button
                  onClick={() => openIndividualContractorInvoicePdf(row)}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-400/20"
                >
                  View PDF
                </button>
              </div>

              <div className="text-left md:text-right">
                <button
                  onClick={() => onDeleteAssignment(row.id)}
                  className="inline-flex items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
        >
          <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
          {isOpen ? "Hide Line Item Editing" : "Edit Line Items"}
        </button>

        <button
          onClick={() => setShowAddAssignment((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200"
        >
          <Plus className="h-4 w-4" />
          {showAddAssignment ? "Cancel Add Assignment" : "Add Assignment"}
        </button>

        <button
          onClick={() => setShowInvoicePreview(true)}
          className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200"
        >
          <FileText className="h-4 w-4" />
          Preview Contractor Invoice
        </button>

        <button
          onClick={openContractorPdfPreview}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
        >
          <FileText className="h-4 w-4" />
          View Grouped Contractor PDF
        </button>

        <button
          onClick={() => group.rows.forEach((row) => onApproveHours(row))}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4" />
          {allHoursApproved ? "Hours Approved" : "Approve All Hours"}
        </button>

        <button
          onClick={() =>
            group.rows.forEach((row) =>
              onUpdateAssignment(row, { approved: !allInvoiceApproved }),
            )
          }
          className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200"
        >
          <FileText className="h-4 w-4" />
          {allInvoiceApproved ? "Unapprove Invoice" : "Approve Whole Invoice"}
        </button>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <div className="text-xs font-semibold text-zinc-300">
            Paid Date: <span className="text-white">{dateLabel(wholeInvoicePaidDate)}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              const paidDate = window.prompt(
                "Enter whole invoice paid date as YYYY-MM-DD",
                wholeInvoicePaidDate || new Date().toISOString().slice(0, 10),
              );

              if (paidDate === null) return;

              const cleanDate = paidDate.trim();

              if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
                alert("Use this format: YYYY-MM-DD");
                return;
              }

              setWholeInvoicePaidDate(cleanDate);

              group.rows.forEach((row) =>
                onUpdateAssignment(row, {
                  paid: true,
                  paid_at: cleanDate,
                }),
              );
            }}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-400/20"
          >
            Set + Save Whole Invoice Date
          </button>

          <button
            type="button"
            onClick={() =>
              group.rows.forEach((row) =>
                onUpdateAssignment(row, {
                  paid: true,
                  paid_at: wholeInvoicePaidDate || new Date().toISOString().slice(0, 10),
                }),
              )
            }
            className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20"
          >
            Save Date to PDF
          </button>

          <button
            onClick={() =>
              group.rows.forEach((row) =>
                onUpdateAssignment(row, {
                  paid: !allPaid,
                  paid_at: !allPaid ? wholeInvoicePaidDate || new Date().toISOString().slice(0, 10) : null,
                }),
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
          >
            <DollarSign className="h-4 w-4" />
            {allPaid ? "Mark Whole Invoice Unpaid" : "Mark Whole Invoice Paid"}
          </button>
        </div>
      </div>

      {showAddAssignment ? (
        <div className="mt-5 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
          <div className="mb-4">
            <div className="text-lg font-semibold text-emerald-100">
              Add Assignment to This Invoice
            </div>
            <div className="text-sm text-zinc-400">
              This adds a new line item for {group.contractor?.name || "this contractor"} under {group.event?.name || "this event"}.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Position"
              value={addAssignmentForm.position}
              onChange={(v) =>
                setAddAssignmentForm({ ...addAssignmentForm, position: v })
              }
            />

            <Field
              label="Work Date"
              type="date"
              value={addAssignmentForm.work_date}
              onChange={(v) =>
                setAddAssignmentForm({ ...addAssignmentForm, work_date: v })
              }
            />

            <Field
              label="Call Time"
              type="time"
              value={addAssignmentForm.call_time}
              onChange={(v) =>
                setAddAssignmentForm({ ...addAssignmentForm, call_time: v })
              }
            />

            <Field
              label="Rate"
              type="number"
              value={addAssignmentForm.rate}
              onChange={(v) =>
                setAddAssignmentForm({ ...addAssignmentForm, rate: v })
              }
            />

            <SelectField
              label="Rate Type"
              value={addAssignmentForm.rate_type}
              onChange={(v) =>
                setAddAssignmentForm({ ...addAssignmentForm, rate_type: v })
              }
              options={[
                { value: "day", label: "day / flat rate" },
                { value: "hour", label: "hourly" },
              ]}
            />

            <Field
              label="Manager Notes"
              value={addAssignmentForm.notes}
              onChange={(v) =>
                setAddAssignmentForm({ ...addAssignmentForm, notes: v })
              }
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={addAssignmentToInvoice}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-5 py-3 text-sm font-semibold text-black"
            >
              <Plus className="h-4 w-4" />
              Add to Invoice
            </button>

            <button
              onClick={() => setShowAddAssignment(false)}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showInvoicePreview ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-white/10 bg-black/40 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  Contractor Invoice Preview
                </div>
                <div className="text-sm text-zinc-400">
                  Review exactly what this contractor/event invoice totals before approval or payment.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={openContractorPdfPreview}
                  className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-2 text-sm font-semibold text-black"
                >
                  View Contractor PDF
                </button>

                <button
                  onClick={() => setShowInvoicePreview(false)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
                      Luxon Entertainment LLC
                    </div>
                    <div className="mt-2 text-3xl font-bold text-white">
                      Invoice Preview
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      Invoice Group: {invoiceNumber}
                    </div>
                  </div>

                  <div className="text-left lg:text-right">
                    <div className="text-sm text-zinc-500">Invoice Total</div>
                    <div className="text-4xl font-black text-amber-300">
                      {money(group.invoiceTotal)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {group.totalHours.toFixed(2)} approved/billed hours total
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Contractor
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">
                      {group.contractor?.name || "Contractor"}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {group.contractor?.email || "No email"}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {group.contractor?.phone || ""}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Event
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">
                      {group.event?.name || "Event"}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {group.event?.venue || ""}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {group.event?.address || ""}
                    </div>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <div className="grid grid-cols-[1fr_1fr_1.4fr_0.7fr_0.9fr_0.9fr] gap-3 bg-white/[0.05] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    <div>Date</div>
                    <div>Call Time</div>
                    <div>Position</div>
                    <div className="text-right">Hours</div>
                    <div className="text-right">Rate</div>
                    <div className="text-right">Line Total</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {group.rows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_1.4fr_0.7fr_0.9fr_0.9fr] md:gap-3"
                      >
                        <div className="font-semibold text-white">
                          {dateLabel(row.work_date)}
                        </div>
                        <div className="text-zinc-300">
                          {timeLabel(row.call_time)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {row.position || "Assignment"}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Record #{row.id}
                          </div>
                        </div>
                        <div className="text-left font-semibold text-white md:text-right">
                          {row.billedHours.toFixed(2)}
                        </div>
                        <div className="text-left text-zinc-300 md:text-right">
                          {money(Number(row.rate || 0))} / {row.rate_type || "day"}
                        </div>
                        <div className="text-left font-bold text-amber-300 md:text-right">
                          {money(row.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.08] p-4 text-sm text-amber-100">
                  Manager check: confirm line item dates, positions, rates, approved hours, invoice approval, and paid status before processing payment.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <div className="mt-5 space-y-4">
          {group.rows.map((row) => (
            <ManagerAssignmentCard
              key={row.id}
              row={row}
              onSaveReview={onSaveReview}
              onApproveHours={onApproveHours}
              onUpdateAssignment={onUpdateAssignment}
              onDeleteAssignment={onDeleteAssignment}
              onCancelAndNotifyAssignment={onCancelAndNotifyAssignment}
              onSendAssignmentReminder={onSendAssignmentReminder}
              onSaveTimeCorrection={onSaveTimeCorrection}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ManagerAssignmentCard({
  row,
  onSaveReview,
  onApproveHours,
  onUpdateAssignment,
  onDeleteAssignment,
  onCancelAndNotifyAssignment,
  onSendAssignmentReminder,
  onSaveTimeCorrection,
}: {
  row: AssignmentRow;
  onSaveReview: (
    row: AssignmentRow,
    managerApprovedHours: string,
    managerNotes: string,
  ) => void;
  onApproveHours: (row: AssignmentRow) => void;
  onUpdateAssignment: (
    row: AssignmentRow,
    updates: Partial<Assignment>,
  ) => void;
  onDeleteAssignment: (id: number) => void;
  onCancelAndNotifyAssignment: (row: AssignmentRow) => void;
  onSendAssignmentReminder: (row: AssignmentRow) => void;
  onSaveTimeCorrection: (
    row: AssignmentRow,
    values: {
      clockIn: string;
      lunchOut: string;
      lunchIn: string;
      clockOut: string;
      reason: string;
    },
  ) => void;
}) {
  const [approvedHours, setApprovedHours] = useState(
    row.manager_approved_hours !== null &&
      row.manager_approved_hours !== undefined
      ? String(row.manager_approved_hours)
      : "",
  );
  const [notes, setNotes] = useState(row.manager_notes || "");
  const defaultDisplayTitle = `Invoice Record #${row.id} · ${row.position || "Assignment"}`;
  const [displayTitle, setDisplayTitle] = useState(
    row.assignment_display_title || defaultDisplayTitle,
  );
  const [positionText, setPositionText] = useState(row.position || "");
  const [editableRate, setEditableRate] = useState(String(row.rate || ""));
  const [editableRateType, setEditableRateType] = useState(row.rate_type || "day");
  const [clockIn, setClockIn] = useState(row.clock_in || "");
  const [lunchOut, setLunchOut] = useState(row.lunch_clock_out || "");
  const [lunchIn, setLunchIn] = useState(row.lunch_clock_in || "");
  const [clockOut, setClockOut] = useState(row.clock_out || "");
  const [correctionReason, setCorrectionReason] = useState(
    row.time_correction_reason || "",
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold">
            {displayTitle || defaultDisplayTitle}
          </div>
          <div className="text-sm text-zinc-400">
            {row.contractor?.name || "Contractor"} ·{" "}
            {row.event?.name || "Event"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {dateLabel(row.work_date)} · Call {timeLabel(row.call_time)} · Clock{" "}
            {timeLabel(row.clock_in)} - {timeLabel(row.clock_out)}
          </div>
          {row.manual_time_correction ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <AlertCircle className="h-3.5 w-3.5" />
              Manual time correction saved
            </div>
          ) : null}
        </div>

        <div className="text-left md:text-right">
          <div className="text-xl font-bold text-amber-300">
            {money(row.total)}
          </div>
          <div className="text-xs text-zinc-500">
            {money(Number(row.rate || 0))} / {row.rate_type || "day"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <Field
          label="Custom Header / Invoice Title"
          value={displayTitle}
          onChange={setDisplayTitle}
        />
        <button
          onClick={() =>
            onUpdateAssignment(row, {
              assignment_display_title: displayTitle.trim() || null,
            })
          }
          className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
        >
          <Save className="h-4 w-4" />
          Save Header
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <Field
          label="Assignment Position"
          value={positionText}
          onChange={setPositionText}
        />
        <button
          onClick={() =>
            onUpdateAssignment(row, {
              position: positionText.trim() || null,
            })
          }
          className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
        >
          <Save className="h-4 w-4" />
          Save Position
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-amber-100">
              Payroll Rate Override
            </div>
            <div className="text-xs text-zinc-400">
              Use this when a contractor was scheduled at one rate but should be paid a different amount for this assignment.
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            Current: {money(Number(row.rate || 0))} / {row.rate_type || "day"}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[180px_180px_auto]">
          <Field
            label="Pay Rate"
            type="number"
            value={editableRate}
            onChange={setEditableRate}
          />

          <SelectField
            label="Rate Type"
            value={editableRateType}
            onChange={setEditableRateType}
            options={[
              { value: "day", label: "day / flat rate" },
              { value: "hour", label: "hourly" },
            ]}
          />

          <button
            onClick={() => {
              const cleanRate = Number(editableRate || 0);

              if (Number.isNaN(cleanRate) || cleanRate < 0) {
                alert("Enter a valid pay rate.");
                return;
              }

              onUpdateAssignment(row, {
                rate: cleanRate,
                rate_type: editableRateType || "day",
              });
            }}
            className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200"
          >
            <Save className="h-4 w-4" />
            Save Pay Rate
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-zinc-300">
          Example: if someone was scheduled at $300/day but only worked a half day, change the rate to $150 and keep the rate type as day/flat rate.
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="Tracked Hours"
          value={row.trackedHours.toFixed(2)}
        />
        <MiniInfo
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Approved Hours"
          value={row.billedHours.toFixed(2)}
        />
        <MiniInfo
          icon={<DollarSign className="h-4 w-4" />}
          label="Invoice Total"
          value={money(row.total)}
        />
        <MiniInfo
          icon={<ClipboardList className="h-4 w-4" />}
          label="Status"
          value={`${row.hours_approved ? "Hours Approved" : "Hours Pending"} · ${
            row.approved ? "Invoice Approved" : "Invoice Pending"
          } · ${row.paid ? "Paid" : "Unpaid"}`}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Clock3 className="h-4 w-4 text-amber-300" />
          Time Correction / Audit
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Field
            label="Clock In"
            type="time"
            value={clockIn}
            onChange={setClockIn}
          />
          <Field
            label="Lunch Out"
            type="time"
            value={lunchOut}
            onChange={setLunchOut}
          />
          <Field
            label="Lunch In"
            type="time"
            value={lunchIn}
            onChange={setLunchIn}
          />
          <Field
            label="Clock Out"
            type="time"
            value={clockOut}
            onChange={setClockOut}
          />
        </div>
        <TextAreaField
          label="Correction Reason / Audit Notes"
          value={correctionReason}
          onChange={setCorrectionReason}
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <MiniInfo
            icon={<MapPin className="h-4 w-4" />}
            label="Clock In GPS / Audit"
            value={row.clock_in_location || "No GPS / not clocked in"}
          />
          <MiniInfo
            icon={<MapPin className="h-4 w-4" />}
            label="Clock Out GPS / Audit"
            value={row.clock_out_location || "No GPS / not clocked out"}
          />
        </div>
        {row.time_corrected_by || row.time_corrected_at ? (
          <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
            Last correction by {row.time_corrected_by || "manager"}
            {row.time_corrected_at
              ? ` on ${new Date(row.time_corrected_at).toLocaleString()}`
              : ""}
            {row.time_correction_reason
              ? ` · ${row.time_correction_reason}`
              : ""}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <Field
          label="Manager Approved Hours"
          type="number"
          value={approvedHours}
          onChange={setApprovedHours}
        />
        <TextAreaField
          label="Manager Notes"
          value={notes}
          onChange={setNotes}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() =>
            onSaveTimeCorrection(row, {
              clockIn,
              lunchOut,
              lunchIn,
              clockOut,
              reason: correctionReason,
            })
          }
          className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200"
        >
          <Clock3 className="h-4 w-4" />
          Save Time Correction
        </button>

        <button
          onClick={() => onSaveReview(row, approvedHours, notes)}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
        >
          <Save className="h-4 w-4" />
          Save Hours / Notes
        </button>

        <ToggleButton
          active={!!row.hours_approved}
          label={row.hours_approved ? "Hours Approved" : "Approve Hours"}
          onClick={() => onApproveHours(row)}
        />

        <ToggleButton
          active={!!row.approved}
          label={row.approved ? "Invoice Approved" : "Approve Invoice"}
          onClick={() => onUpdateAssignment(row, { approved: !row.approved })}
        />

        <ToggleButton
          active={!!row.paid}
          label={row.paid ? "Paid" : "Mark Paid"}
          onClick={() =>
            onUpdateAssignment(row, {
              paid: !row.paid,
              paid_at: !row.paid ? new Date().toISOString().slice(0, 10) : null,
            })
          }
        />

        <button
          onClick={() => onCancelAndNotifyAssignment(row)}
          className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300"
        >
          <AlertCircle className="h-4 w-4" />
          Cancel + Notify Contractor
        </button>

        <button
          onClick={() => onDeleteAssignment(row.id)}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300"
        >
          <Trash2 className="h-4 w-4" />
          Delete Assignment
        </button>
      </div>
    </div>
  );
}

function EditableEventCard({
  event,
  onSave,
  onDelete,
}: {
  event: EventItem;
  onSave: (event: EventItem) => void;
  onDelete: (id: number) => void;
}) {
  const [row, setRow] = useState<EventItem>(event);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold">{event.name}</div>
          <div className="text-sm text-zinc-400">
            {event.client || "--"} · {event.venue || "--"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {event.address || "--"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {event.latitude && event.longitude ? (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
              GPS Ready
            </span>
          ) : (
            <span className="rounded-full border border-red-500/20 bg-red-500/15 px-3 py-1 text-xs text-red-300">
              GPS Missing
            </span>
          )}
          <button
            onClick={() => onDelete(event.id)}
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="Start"
          value={`${dateLabel(event.start_date)}${event.start_time ? ` · ${timeLabel(event.start_time)}` : ""}`}
        />
        <MiniInfo
          icon={<CalendarDays className="h-4 w-4" />}
          label="End"
          value={`${dateLabel(event.end_date)}${event.end_time ? ` · ${timeLabel(event.end_time)}` : ""}`}
        />
        <MiniInfo
          icon={<MapPin className="h-4 w-4" />}
          label="GPS Radius"
          value={`${event.geofence_radius_feet || 750} ft`}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Name"
          value={row.name || ""}
          onChange={(v) => setRow({ ...row, name: v })}
        />
        <Field
          label="Client"
          value={row.client || ""}
          onChange={(v) => setRow({ ...row, client: v })}
        />
        <Field
          label="Venue"
          value={row.venue || ""}
          onChange={(v) => setRow({ ...row, venue: v })}
        />
        <Field
          label="Address"
          value={row.address || ""}
          onChange={(v) => setRow({ ...row, address: v })}
        />
        <Field
          label="Start Date"
          type="date"
          value={row.start_date || ""}
          onChange={(v) => setRow({ ...row, start_date: v })}
        />
        <Field
          label="End Date"
          type="date"
          value={row.end_date || ""}
          onChange={(v) => setRow({ ...row, end_date: v })}
        />
        <Field
          label="Start Time"
          type="time"
          value={row.start_time || ""}
          onChange={(v) => setRow({ ...row, start_time: v })}
        />
        <Field
          label="End Time"
          type="time"
          value={row.end_time || ""}
          onChange={(v) => setRow({ ...row, end_time: v })}
        />
        <Field
          label="Geofence Radius Feet"
          type="number"
          value={String(row.geofence_radius_feet || 750)}
          onChange={(v) =>
            setRow({ ...row, geofence_radius_feet: Number(v || 750) })
          }
        />
        <SelectField
          label="Status"
          value={row.status || "Scheduled"}
          onChange={(v) => setRow({ ...row, status: v })}
          options={[
            { value: "Scheduled", label: "Scheduled" },
            { value: "Completed", label: "Completed" },
            { value: "Cancelled", label: "Cancelled" },
          ]}
        />
      </div>

      <button
        onClick={() => onSave(row)}
        className="mt-4 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-semibold text-black"
      >
        Save Event + Update GPS
      </button>
    </div>
  );
}

function EditableContractorCard({
  contractor,
  skillOptions,
  onSave,
  onDelete,
}: {
  contractor: Contractor;
  skillOptions: string[];
  onSave: (contractor: Contractor) => void;
  onDelete: (contractor: Contractor) => void;
}) {
  const [row, setRow] = useState<Contractor>(contractor);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold">
            {contractor.name}
          </div>
          <div className="truncate text-sm text-zinc-400">
            {contractor.email || "--"} · {contractor.role || "--"}
          </div>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300">
          Contractor Profile
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Field
          label="Name"
          value={row.name || ""}
          onChange={(v) => setRow({ ...row, name: v })}
        />
        <Field
          label="Role"
          value={row.role || ""}
          onChange={(v) => setRow({ ...row, role: v })}
        />
        <Field
          label="Phone"
          value={row.phone || ""}
          onChange={(v) => setRow({ ...row, phone: v })}
        />
        <Field
          label="Email"
          value={row.email || ""}
          onChange={(v) => setRow({ ...row, email: v })}
        />
        <Field
          label="Rate"
          type="number"
          value={String(row.rate || "")}
          onChange={(v) => setRow({ ...row, rate: Number(v || 0) })}
        />
        <SelectField
          label="Rate Type"
          value={row.rate_type || "day"}
          onChange={(v) => setRow({ ...row, rate_type: v })}
          options={[
            { value: "day", label: "day" },
            { value: "hour", label: "hour" },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
          <div className="mb-3 text-sm font-semibold text-amber-100">
            Requested Skills
          </div>

          <div className="flex flex-wrap gap-2">
            {(row.requested_skills || []).length ? (
              (row.requested_skills || []).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center whitespace-nowrap rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-sm text-zinc-500">
                No requested skills yet.
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
          <div className="mb-3 text-sm font-semibold text-emerald-100">
            Manager Approved Skills
          </div>

          <div className="flex flex-wrap gap-2">
            {skillOptions.map((skill) => {
              const active = (row.approved_skills || []).includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() =>
                    setRow((prev) => ({
                      ...prev,
                      approved_skills: active
                        ? (prev.approved_skills || []).filter(
                            (item) => item !== skill,
                          )
                        : [...(prev.approved_skills || []), skill],
                    }))
                  }
                  className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-emerald-400/20 hover:text-emerald-100"
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => onSave(row)}
          className="flex-1 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-5 py-3 font-semibold text-black"
        >
          Save Contractor
        </button>

        <button
          onClick={() => onDelete(contractor)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
        >
          <Trash2 className="h-4 w-4" />
          Delete Contractor Profile
        </button>
      </div>
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
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
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
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
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400/40"
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
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
      {text}
    </div>
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
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
        active
          ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-300"
          : "border-white/10 bg-white/[0.05] text-white"
      }`}
    >
      {label}
    </button>
  );
}
