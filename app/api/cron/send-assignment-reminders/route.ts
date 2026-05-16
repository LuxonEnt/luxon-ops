import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type AssignmentRow = {
  id: number;
  event_id: number;
  contractor_id: number;
  position?: string | null;
  work_date?: string | null;
  call_time?: string | null;
  rate?: number | null;
  rate_type?: string | null;
  confirmed?: boolean | null;
  reminder_24hr_sent_at?: string | null;
};

type EventRow = {
  id: number;
  name: string;
  venue?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type ContractorRow = {
  id: number;
  name: string;
  email?: string | null;
};

type ReminderPayload = {
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

const TIME_ZONE = "America/Los_Angeles";

const LOGO_URL = "https://luxon-ops.vercel.app/luxon-logo.png";
const PORTAL_URL = "https://luxon-ops.vercel.app/login";

const FROM_EMAIL =
  "Luxon Entertainment <notifications@mail.luxonentertainment.com>";

const REPLY_TO_EMAIL = "Luxon Entertainment <Luxon.entertainment@gmail.com>";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateLabel(value?: string | null) {
  if (!value) return "--";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
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

function money(value?: number | string | null) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isNaN(numericValue) ? 0 : numericValue);
}

function buildDateRange(start?: string | null, end?: string | null) {
  if (start && end && start !== end) {
    return `${dateLabel(start)} – ${dateLabel(end)}`;
  }

  if (start) return dateLabel(start);
  if (end) return dateLabel(end);

  return "--";
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });

  const parts = formatter.formatToParts(date);
  const timeZonePart = parts.find((part) => part.type === "timeZoneName");

  const value = timeZonePart?.value || "GMT";
  const match = value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);

  if (!match) return 0;

  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);

  return sign * (hours * 60 + minutes);
}

function localDateTimeToUtc(
  dateValue?: string | null,
  timeValue?: string | null,
) {
  if (!dateValue || !timeValue) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = String(timeValue).slice(0, 5).split(":").map(Number);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(TIME_ZONE, utcGuess);

  return new Date(utcGuess.getTime() - offsetMinutes * 60 * 1000);
}

function buildEmailHtml(payload: ReminderPayload) {
  const contractorName = escapeHtml(payload.contractorName || "Contractor");
  const eventName = escapeHtml(payload.eventName || "--");
  const eventDates = escapeHtml(
    buildDateRange(payload.eventStartDate, payload.eventEndDate),
  );
  const venue = escapeHtml(payload.venue || "--");
  const address = escapeHtml(payload.address || "");
  const position = escapeHtml(payload.position || "--");
  const workDate = escapeHtml(dateLabel(payload.workDate));
  const callTime = escapeHtml(timeLabel(payload.callTime));
  const rate = escapeHtml(
    `${money(payload.rate)} / ${payload.rateType || "day"}`,
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reminder: Upcoming Luxon Position</title>
</head>

<body style="margin:0; padding:0; background:#f4f4f5; font-family:Arial, Helvetica, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:32px 32px 20px 32px;">
              <img
                src="${LOGO_URL}"
                alt="Luxon Entertainment"
                style="max-width:220px; height:auto; display:block; margin-bottom:26px;"
              />

              <h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.25; color:#111827;">
                Reminder: Upcoming Position
              </h1>

              <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6;">
                Dear ${contractorName},
              </p>

              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.6;">
                This is a reminder that you are currently scheduled for the following Luxon Entertainment position.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 0 24px 0;">
                <tr>
                  <td style="padding:14px 0; border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Event</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${eventName}</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 0; border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Dates</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${eventDates}</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 0; border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Venue</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${venue}</div>
                    ${
                      address
                        ? `<div style="font-size:15px; color:#4b5563; margin-top:4px;">${address}</div>`
                        : ""
                    }
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 0; border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Position</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${position}</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 0; border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Work Date</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${workDate}</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 0; border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Call Time</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${callTime}</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 0; border-top:1px solid #e5e7eb; border-bottom:1px solid #e5e7eb;">
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Rate</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${rate}</div>
                  </td>
                </tr>
              </table>

              <h2 style="margin:0 0 12px 0; font-size:19px; color:#111827;">
                Please Review Your Schedule
              </h2>

              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.6;">
                Please log into the Luxon Ops Contractor Portal to review your assignment details and make sure your schedule is correct.
              </p>

              <p style="margin:0 0 28px 0;">
                <a href="${PORTAL_URL}" style="display:inline-block; background:#d4a62a; color:#111827; text-decoration:none; font-weight:bold; padding:14px 22px; border-radius:12px;">
                  Open Luxon Ops Portal
                </a>
              </p>

              <p style="margin:0 0 20px 0; font-size:15px; line-height:1.6; color:#374151;">
                If anything looks incorrect, or if you have any questions, please contact us at
                <a href="mailto:Luxon.entertainment@gmail.com" style="color:#111827;">Luxon.entertainment@gmail.com</a>.
              </p>

              <p style="margin:0; font-size:15px; line-height:1.6; color:#111827;">
                Luxon Entertainment LLC<br />
                (562) 391-6933<br />
                15234 Cadwell St.<br />
                La Puente, CA 91744
              </p>
            </td>
          </tr>
        </table>

        <div style="max-width:680px; padding:16px 8px; font-size:12px; line-height:1.5; color:#6b7280;">
          You are receiving this email because you are scheduled through Luxon Ops.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function buildTextEmail(payload: ReminderPayload) {
  return `
Reminder: Upcoming Position

Dear ${payload.contractorName || "Contractor"},

This is a reminder that you are currently scheduled for the following Luxon Entertainment position.

Event:
${payload.eventName || "--"}

Dates:
${buildDateRange(payload.eventStartDate, payload.eventEndDate)}

Venue:
${payload.venue || "--"}
${payload.address || ""}

Position:
${payload.position || "--"}

Work Date:
${dateLabel(payload.workDate)}

Call Time:
${timeLabel(payload.callTime)}

Rate:
${money(payload.rate)} / ${payload.rateType || "day"}

Please log into the Luxon Ops Contractor Portal to review your assignment details and make sure your schedule is correct:
${PORTAL_URL}

If anything looks incorrect, or if you have any questions, please contact us at Luxon.entertainment@gmail.com.

Luxon Entertainment LLC
(562) 391-6933
15234 Cadwell St.
La Puente, CA 91744
`;
}

async function sendReminderEmail(payload: ReminderPayload) {
  if (!payload.contractorEmail) {
    return {
      ok: false,
      error: "Contractor email is missing.",
    };
  }

  const emailResult = await resend.emails.send({
    from: FROM_EMAIL,
    to: [payload.contractorEmail],
    replyTo: REPLY_TO_EMAIL,
    subject: "Reminder: Upcoming Luxon Position",
    html: buildEmailHtml(payload),
    text: buildTextEmail(payload),
  });

  if (emailResult.error) {
    return {
      ok: false,
      error: emailResult.error.message || "Reminder email failed to send.",
    };
  }

  return {
    ok: true,
    error: null,
  };
}

export async function GET(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY environment variable." },
        { status: 500 },
      );
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing Supabase server credentials. Add SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 },
      );
    }

    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const authHeader = request.headers.get("authorization") || "";
      const expected = `Bearer ${cronSecret}`;

      if (authHeader !== expected) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const now = new Date();

    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select(
        "id,event_id,contractor_id,position,work_date,call_time,rate,rate_type,confirmed,reminder_24hr_sent_at",
      )
      .eq("confirmed", true)
      .is("reminder_24hr_sent_at", null)
      .not("work_date", "is", null)
      .not("call_time", "is", null)
      .order("work_date", { ascending: true })
      .limit(200);

    if (assignmentError) {
      return NextResponse.json(
        { error: assignmentError.message },
        { status: 500 },
      );
    }

    const assignmentRows = (assignments || []) as AssignmentRow[];

    const dueAssignments = assignmentRows.filter((assignment) => {
      const scheduledUtc = localDateTimeToUtc(
        assignment.work_date,
        assignment.call_time,
      );

      if (!scheduledUtc) return false;

      const diffHours =
        (scheduledUtc.getTime() - now.getTime()) / (1000 * 60 * 60);

      return diffHours >= 23 && diffHours <= 25;
    });

    if (!dueAssignments.length) {
      return NextResponse.json({
        success: true,
        checked: assignmentRows.length,
        due: 0,
        sent: 0,
        failed: 0,
        message: "No 24-hour reminders due right now.",
      });
    }

    const eventIds = Array.from(
      new Set(dueAssignments.map((assignment) => assignment.event_id)),
    );

    const contractorIds = Array.from(
      new Set(dueAssignments.map((assignment) => assignment.contractor_id)),
    );

    const [{ data: eventsData, error: eventsError }, { data: contractorsData, error: contractorsError }] =
      await Promise.all([
        supabaseAdmin
          .from("events")
          .select("id,name,venue,address,start_date,end_date")
          .in("id", eventIds),
        supabaseAdmin
          .from("contractors")
          .select("id,name,email")
          .in("id", contractorIds),
      ]);

    if (eventsError || contractorsError) {
      return NextResponse.json(
        {
          error:
            eventsError?.message ||
            contractorsError?.message ||
            "Could not load event or contractor details.",
        },
        { status: 500 },
      );
    }

    const eventMap: Record<number, EventRow> = {};
    ((eventsData || []) as EventRow[]).forEach((event) => {
      eventMap[event.id] = event;
    });

    const contractorMap: Record<number, ContractorRow> = {};
    ((contractorsData || []) as ContractorRow[]).forEach((contractor) => {
      contractorMap[contractor.id] = contractor;
    });

    let sent = 0;
    let failed = 0;
    const failures: Array<{ assignmentId: number; error: string }> = [];

    for (const assignment of dueAssignments) {
      const event = eventMap[assignment.event_id];
      const contractor = contractorMap[assignment.contractor_id];

      const reminderResult = await sendReminderEmail({
        contractorName: contractor?.name || null,
        contractorEmail: contractor?.email || null,
        eventName: event?.name || null,
        eventStartDate: event?.start_date || null,
        eventEndDate: event?.end_date || null,
        venue: event?.venue || null,
        address: event?.address || null,
        position: assignment.position || null,
        workDate: assignment.work_date || null,
        callTime: assignment.call_time || null,
        rate: assignment.rate || 0,
        rateType: assignment.rate_type || "day",
      });

      if (!reminderResult.ok) {
        failed += 1;
        failures.push({
          assignmentId: assignment.id,
          error: reminderResult.error || "Unknown reminder email error.",
        });
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from("assignments")
        .update({
          reminder_24hr_sent_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);

      if (updateError) {
        failed += 1;
        failures.push({
          assignmentId: assignment.id,
          error: `Email sent, but reminder timestamp failed: ${updateError.message}`,
        });
        continue;
      }

      sent += 1;
    }

    return NextResponse.json({
      success: true,
      checked: assignmentRows.length,
      due: dueAssignments.length,
      sent,
      failed,
      failures,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected cron reminder error." },
      { status: 500 },
    );
  }
}
