import { Resend } from "resend";

const FROM_EMAIL =
  "Luxon Entertainment <notifications@mail.luxonentertainment.com>";
const REPLY_TO_EMAIL = "Luxon Entertainment <Luxon.entertainment@gmail.com>";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function dateLabel(value?: string | null) {
  if (!value) return "--";

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function POST(request: Request) {
  try {
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      return Response.json(
        { ok: false, error: "RESEND_API_KEY is missing." },
        { status: 500 },
      );
    }

    const body = await request.json();

    const contractorEmail = String(body.contractorEmail || "").trim();
    const contractorName = String(body.contractorName || "Contractor").trim();
    const eventName = String(body.eventName || "Event").trim();
    const venue = String(body.venue || "").trim();
    const position = String(body.position || "Assignment").trim();
    const workDate = body.workDate ? String(body.workDate) : null;
    const invoiceNumber = String(body.invoiceNumber || "Invoice").trim();
    const invoiceTotal = Number(body.invoiceTotal || 0);
    const dueBalance = Number(body.dueBalance || 0);
    const paidDate = body.paidDate ? String(body.paidDate) : new Date().toISOString();

    if (!contractorEmail) {
      return Response.json(
        { ok: false, error: "Contractor email is required." },
        { status: 400 },
      );
    }

    const resend = new Resend(resendKey);

    const subject = `Luxon Invoice Paid - ${eventName}`;

    const html = `
      <div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="max-width:680px;margin:0 auto;padding:28px;">
          <div style="background:#050505;border-radius:24px 24px 0 0;padding:28px;text-align:center;">
            <img src="https://luxon-ops.vercel.app/luxon-logo.png" alt="Luxon Entertainment" style="max-width:180px;height:auto;margin-bottom:16px;" />
            <div style="color:#f8d36a;font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;">Invoice Paid</div>
            <h1 style="color:#ffffff;margin:10px 0 0;font-size:28px;">Your invoice has been paid</h1>
          </div>

          <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 24px 24px;padding:28px;">
            <p style="font-size:16px;line-height:1.6;margin:0 0 18px;">Hi ${contractorName},</p>

            <p style="font-size:16px;line-height:1.6;margin:0 0 18px;">
              Luxon Entertainment has marked your invoice as paid.
            </p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:18px;padding:18px;margin:20px 0;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;font-weight:700;margin-bottom:12px;">Payment Details</div>

              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr>
                  <td style="padding:8px 0;color:#6b7280;">Invoice</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;">Event</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;">${eventName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;">Venue</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;">${venue || "--"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;">Position</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;">${position}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;">Work Date</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;">${dateLabel(workDate)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;">Paid Date</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;">${dateLabel(paidDate)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;">Invoice Total</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;">${money(invoiceTotal)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;color:#6b7280;border-top:1px solid #e5e7eb;">Balance Due</td>
                  <td style="padding:12px 0 0;text-align:right;font-size:22px;font-weight:900;color:#059669;border-top:1px solid #e5e7eb;">${money(dueBalance)}</td>
                </tr>
              </table>
            </div>

            <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
              You can log into the Luxon Ops Contractor Portal to review your invoice records.
            </p>

            <div style="text-align:center;margin:26px 0;">
              <a href="https://luxon-ops.vercel.app/login" style="display:inline-block;background:#f2c230;color:#000000;text-decoration:none;font-weight:800;border-radius:14px;padding:14px 22px;">
                Open Contractor Portal
              </a>
            </div>

            <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0;">
              Luxon Entertainment LLC<br />
              Luxon.entertainment@gmail.com<br />
              (562) 391-6933
            </p>
          </div>
        </div>
      </div>
    `;

    const textBody = [
      `Hi ${contractorName},`,
      "",
      "Luxon Entertainment has marked your invoice as paid.",
      "",
      `Invoice: ${invoiceNumber}`,
      `Event: ${eventName}`,
      `Venue: ${venue || "--"}`,
      `Position: ${position}`,
      `Work Date: ${dateLabel(workDate)}`,
      `Paid Date: ${dateLabel(paidDate)}`,
      `Invoice Total: ${money(invoiceTotal)}`,
      `Balance Due: ${money(dueBalance)}`,
      "",
      "You can log into the Luxon Ops Contractor Portal to review your invoice records:",
      "https://luxon-ops.vercel.app/login",
      "",
      "Luxon Entertainment LLC",
      "Luxon.entertainment@gmail.com",
      "(562) 391-6933",
    ].join("\\n");

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: contractorEmail,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
      text: textBody,
    });

    return Response.json({ ok: true, result });
  } catch (error: any) {
    return Response.json(
      {
        ok: false,
        error: error?.message || "Invoice paid email could not be sent.",
      },
      { status: 500 },
    );
  }
}
