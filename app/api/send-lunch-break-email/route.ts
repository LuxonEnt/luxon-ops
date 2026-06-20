import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "--";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "--";
  const clean = String(value).slice(0, 5);
  const [hours, minutes] = clean.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value || "--";

  return new Date(2026, 0, 1, hours, minutes).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY." },
        { status: 500 },
      );
    }

    const body = await request.json();

    const contractorName = body.contractorName || "Contractor";
    const contractorEmail = body.contractorEmail;
    const eventName = body.eventName || "your assignment";
    const venue = body.venue || "";
    const position = body.position || "Assignment";
    const workDate = body.workDate || null;
    const callTime = body.callTime || null;
    const clockIn = body.clockIn || null;

    if (!contractorEmail) {
      return NextResponse.json(
        { ok: false, error: "Contractor email is missing." },
        { status: 400 },
      );
    }

    const resend = new Resend(apiKey);

    const subject = `Required Lunch Break Reminder - ${eventName}`;

    const text = `Hi ${contractorName},

This is a reminder that you are required to take and record your lunch break.

Assignment: ${position}
Event: ${eventName}
Venue: ${venue || "--"}
Work Date: ${formatDate(workDate)}
Call Time: ${formatTime(callTime)}
Clock In: ${formatTime(clockIn)}

Please take your lunch break and make sure your lunch clock-out and lunch clock-in are entered in the Luxon contractor portal before clocking out for the day.

Thank you,
Luxon Entertainment`;

    const html = `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:24px;">
        <div style="max-width:640px;margin:0 auto;border:1px solid rgba(255,255,255,0.14);border-radius:20px;padding:24px;background:#111111;">
          <h1 style="margin:0 0 8px;font-size:22px;">Required Lunch Break Reminder</h1>
          <p style="color:#d4d4d8;">Hi ${contractorName},</p>
          <p style="color:#d4d4d8;">
            This is a reminder that you are required to take and record your lunch break.
          </p>
          <div style="margin:18px 0;padding:16px;border-radius:14px;background:#1c1c1c;">
            <p><strong>Assignment:</strong> ${position}</p>
            <p><strong>Event:</strong> ${eventName}</p>
            <p><strong>Venue:</strong> ${venue || "--"}</p>
            <p><strong>Work Date:</strong> ${formatDate(workDate)}</p>
            <p><strong>Call Time:</strong> ${formatTime(callTime)}</p>
            <p><strong>Clock In:</strong> ${formatTime(clockIn)}</p>
          </div>
          <p style="color:#d4d4d8;">
            Please take your lunch break and make sure your lunch clock-out and lunch clock-in
            are entered in the Luxon contractor portal before clocking out for the day.
          </p>
          <p style="color:#facc15;font-weight:bold;">Luxon Entertainment</p>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: "Luxon Entertainment <notifications@mail.luxonentertainment.com>",
      to: contractorEmail,
      replyTo: "Luxon Entertainment <Luxon.entertainment@gmail.com>",
      subject,
      text,
      html,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Lunch break email failed." },
      { status: 500 },
    );
  }
}
