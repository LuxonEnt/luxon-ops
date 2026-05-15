import { NextResponse } from "next/server";
import { Resend } from "resend";

type OpportunityEmailRecipient = {
  contractorName?: string | null;
  contractorEmail?: string | null;
};

type OpportunityEmailPayload = {
  recipients?: OpportunityEmailRecipient[];
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

function buildEmailHtml(
  payload: OpportunityEmailPayload,
  recipient: OpportunityEmailRecipient,
) {
  const contractorName = escapeHtml(recipient.contractorName || "Contractor");
  const eventName = escapeHtml(payload.eventName || "--");
  const eventDates = escapeHtml(
    buildDateRange(payload.eventStartDate, payload.eventEndDate),
  );
  const venue = escapeHtml(payload.venue || "--");
  const address = escapeHtml(payload.address || "");
  const requestTitle = escapeHtml(
    payload.requestTitle || "New Position Opportunity",
  );
  const position = escapeHtml(payload.position || "--");
  const requiredSkill = escapeHtml(payload.requiredSkill || "--");
  const workDate = escapeHtml(dateLabel(payload.workDate));
  const callTime = escapeHtml(timeLabel(payload.callTime));
  const rate = escapeHtml(
    `${money(payload.rate)} / ${payload.rateType || "day"}`,
  );
  const notes = escapeHtml(payload.notes || "");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>New Luxon Opportunity Available</title>
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
                New Opportunity Available
              </h1>

              <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6;">
                Dear ${contractorName},
              </p>

              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.6;">
                A new Luxon Entertainment position is available that matches your approved skill profile.
              </p>

              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.6;">
                Please log into the Luxon Ops Contractor Portal to review the opportunity and mark yourself Available or Unavailable.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 0 24px 0;">
                <tr>
                  <td style="padding:14px 0; border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Request</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${requestTitle}</div>
                  </td>
                </tr>

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
                    <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em;">Required Skill</div>
                    <div style="font-size:17px; color:#111827; margin-top:5px;">${requiredSkill}</div>
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

              ${
                notes
                  ? `<div style="margin:0 0 24px 0; padding:16px; border-radius:14px; background:#f9fafb; border:1px solid #e5e7eb;">
                      <div style="font-size:12px; font-weight:bold; color:#6b7280; text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px;">Notes</div>
                      <div style="font-size:15px; line-height:1.6; color:#374151;">${notes}</div>
                    </div>`
                  : ""
              }

              <h2 style="margin:0 0 12px 0; font-size:19px; color:#111827;">
                Response Required
              </h2>

              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.6;">
                Marking yourself Available means you are applying for this position. A manager will still review all responses and confirm who is selected.
              </p>

              <p style="margin:0 0 28px 0;">
                <a href="${PORTAL_URL}" style="display:inline-block; background:#d4a62a; color:#111827; text-decoration:none; font-weight:bold; padding:14px 22px; border-radius:12px;">
                  Review Opportunity in Luxon Ops
                </a>
              </p>

              <p style="margin:0 0 20px 0; font-size:15px; line-height:1.6; color:#374151;">
                If you have any questions, please contact us at
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
          You are receiving this email because this opportunity matches your approved Luxon Ops skills.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function buildTextEmail(
  payload: OpportunityEmailPayload,
  recipient: OpportunityEmailRecipient,
) {
  return `
New Opportunity Available

Dear ${recipient.contractorName || "Contractor"},

A new Luxon Entertainment position is available that matches your approved skill profile.

Please log into the Luxon Ops Contractor Portal to review the opportunity and mark yourself Available or Unavailable.

Request:
${payload.requestTitle || "New Position Opportunity"}

Event:
${payload.eventName || "--"}

Dates:
${buildDateRange(payload.eventStartDate, payload.eventEndDate)}

Venue:
${payload.venue || "--"}
${payload.address || ""}

Position:
${payload.position || "--"}

Required Skill:
${payload.requiredSkill || "--"}

Work Date:
${dateLabel(payload.workDate)}

Call Time:
${timeLabel(payload.callTime)}

Rate:
${money(payload.rate)} / ${payload.rateType || "day"}

${payload.notes ? `Notes:\n${payload.notes}\n` : ""}

Response Required

Marking yourself Available means you are applying for this position. A manager will still review all responses and confirm who is selected.

Review the opportunity here:
${PORTAL_URL}

If you have any questions, please contact us at Luxon.entertainment@gmail.com.

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

    const payload = (await request.json()) as OpportunityEmailPayload;
    const recipients = (payload.recipients || []).filter(
      (recipient) => !!recipient.contractorEmail,
    );

    if (!recipients.length) {
      return NextResponse.json({
        success: true,
        sentCount: 0,
        message: "No matching contractor emails to notify.",
      });
    }

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        resend.emails.send({
          from: FROM_EMAIL,
          to: [recipient.contractorEmail as string],
          replyTo: REPLY_TO_EMAIL,
          subject: "New Luxon Opportunity Available",
          html: buildEmailHtml(payload, recipient),
          text: buildTextEmail(payload, recipient),
        }),
      ),
    );

    const failed = results.filter((result) => {
      if (result.status === "rejected") return true;
      return !!result.value.error;
    });

    if (failed.length) {
      return NextResponse.json(
        {
          error: `${failed.length} of ${recipients.length} opportunity email(s) failed to send.`,
          sentCount: recipients.length - failed.length,
          failedCount: failed.length,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      sentCount: recipients.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected opportunity email error." },
      { status: 500 },
    );
  }
}
