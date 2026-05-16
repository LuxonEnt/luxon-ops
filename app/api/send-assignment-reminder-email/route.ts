import { NextResponse } from "next/server";
import { Resend } from "resend";

type AssignmentReminderPayload = {
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

const resend = new Resend(process.env.RESEND_API_KEY);

const LOGO_URL = "https://luxon-ops.vercel.app/luxon-logo.png";
const PORTAL_URL = "https://luxon-ops.vercel.app/login";

const FROM_EMAIL =
  "Luxon Entertainment <notifications@mail.luxonentertainment.com>";

const REPLY_TO_EMAIL = "Luxon Entertainment <Luxon.entertainment@gmail.com>";

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

function buildEmailHtml(payload: AssignmentReminderPayload) {
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

function buildTextEmail(payload: AssignmentReminderPayload) {
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

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const payload = (await request.json()) as AssignmentReminderPayload;

    if (!payload.contractorEmail) {
      return NextResponse.json(
        { error: "Missing contractor email." },
        { status: 400 },
      );
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
      return NextResponse.json(
        {
          error:
            emailResult.error.message || "Reminder email failed to send.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      id: emailResult.data?.id || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected reminder email error." },
      { status: 500 },
    );
  }
}
