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
  const [h, m] =
