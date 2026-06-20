import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timeToMinutes(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function todayIsoDate() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function hoursSinceClockIn(workDate?: string | null, clockIn?: string | null) {
  if (!workDate || !clockIn) return 0;

  const clockInMinutes = timeToMinutes(clockIn);
  if (clockInMinutes === null) return 0;

  const start = new Date(`${workDate}T00:00:00`);
  start.setMinutes(clockInMinutes);

  return Math.max(0, (Date.now() - start.getTime()) / 36e5);
}

async function sendTwilioSms(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error(
      "Missing Twilio env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER",
    );
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: body,
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.message || "Twilio SMS failed.");
  }

  return result;
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase server env vars." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const today = todayIsoDate();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      id,
      contractor_id,
      event_id,
      position,
      work_date,
      clock_in,
      clock_out,
      lunch_clock_out,
      lunch_sms_sent_at,
      contractors(name,phone),
      events(name,venue)
    `,
    )
    .eq("work_date", today)
    .not("clock_in", "is", null)
    .is("clock_out", null)
    .is("lunch_clock_out", null)
    .is("lunch_sms_sent_at", null);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const due = (data || []).filter((row: any) => {
    return hoursSinceClockIn(row.work_date, row.clock_in) >= 5;
  });

  let sent = 0;
  const failed: Array<{ assignment_id: number; error: string }> = [];

  for (const row of due) {
    const contractor = Array.isArray(row.contractors)
      ? row.contractors[0]
      : row.contractors;
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    const phone = contractor?.phone;

    if (!phone) {
      failed.push({ assignment_id: row.id, error: "Missing contractor phone." });
      continue;
    }

    const body = `Luxon Ops reminder: You have been clocked in for 5+ hours for ${event?.name || "your assignment"}. Please take/record your lunch break if required.`;

    try {
      await sendTwilioSms(phone, body);

      await supabase
        .from("assignments")
        .update({ lunch_sms_sent_at: new Date().toISOString() })
        .eq("id", row.id);

      sent += 1;
    } catch (error: any) {
      failed.push({ assignment_id: row.id, error: error?.message || "SMS failed." });
    }
  }

  return NextResponse.json({
    success: true,
    checked: data?.length || 0,
    due: due.length,
    sent,
    failed,
  });
}

export async function POST() {
  return GET();
}
