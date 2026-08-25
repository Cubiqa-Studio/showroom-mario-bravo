import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Envío de leads del showroom por email vía Resend (API HTTP, sin dependencia npm).
//
// Lo consumen TODOS los formularios del sitio:
//   - ContactSection ("Hablemos", ficha de residencia): { name, phone, email, message, unitId, residence }
//   - ContactModal   (sidebar, además abre WhatsApp):    { name, phone, comment, source }
//
// Campos flexibles: sólo `name` es obligatorio + al menos un medio de contacto
// (email o teléfono). El resto (email/phone/message/comment/unitId/residence) se
// muestra si viene. Así el mismo endpoint sirve a los dos forms sin ramificar.
//
// Config por entorno (ver .env.example):
//   RESEND_API_KEY  – obligatoria (https://resend.com/api-keys).
//   EMAIL_TO        – bandeja donde llegan los leads.
//   EMAIL_FROM      – remitente. Default `onboarding@resend.dev` (funciona SIN
//                     dominio verificado, sólo entrega a la cuenta dueña de la key).
//                     Al verificar el dominio en Resend → EMAIL_FROM=Showroom
//                     TIER Bravo <consultas@tu-dominio>.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_FROM = process.env.EMAIL_FROM || "Showroom TIER Bravo <onboarding@resend.dev>";

interface ContactBody {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  comment?: string;
  unitId?: string;
  residence?: string;
  source?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const emailTo = process.env.EMAIL_TO;

  if (!apiKey || !emailTo) {
    // Falta configurar el envío. Log para el operador; el front sólo ve el 500.
    console.error("[contacto] Falta RESEND_API_KEY o EMAIL_TO en el entorno.");
    return NextResponse.json({ error: "Envío de email no configurado." }, { status: 500 });
  }

  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const phone = body.phone?.trim();
  const text = (body.message ?? body.comment)?.trim();

  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ error: "Dejá un email o un teléfono de contacto." }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "El formato del email es inválido." }, { status: 400 });
  }

  const unitLabel = body.residence?.trim() || body.unitId?.trim();
  const subject = unitLabel ? `Nueva consulta — ${name} · ${unitLabel}` : `Nueva consulta — ${name}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [emailTo],
        subject,
        html: renderEmail({ name, email, phone, text, unitLabel, source: body.source }),
        // Responder al email va directo al interesado (si dejó email).
        ...(email ? { reply_to: email } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[contacto] Resend error:", res.status, detail);
      return NextResponse.json({ error: "No se pudo enviar el email." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contacto] Error de red al enviar:", err);
    return NextResponse.json({ error: "Error de conexión al enviar el email." }, { status: 502 });
  }
}

// ── Plantilla del email (dorado del logo, #A07F46) ────────────────────────────

function renderEmail(d: {
  name: string;
  email?: string;
  phone?: string;
  text?: string;
  unitLabel?: string;
  source?: string;
}): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f1efe9;color:#8a7a5c;font-size:13px;width:150px;vertical-align:top;">${label}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f1efe9;color:#1c1a15;font-size:14px;font-weight:500;">${value}</td>
    </tr>`;

  const rows = [
    row("Nombre", escapeHtml(d.name)),
    d.email
      ? row("Email", `<a href="mailto:${escapeHtml(d.email)}" style="color:#A07F46;">${escapeHtml(d.email)}</a>`)
      : "",
    d.phone
      ? row("Teléfono", `<a href="tel:${escapeHtml(d.phone)}" style="color:#A07F46;">${escapeHtml(d.phone)}</a>`)
      : "",
    d.unitLabel ? row("Unidad", escapeHtml(d.unitLabel)) : "",
    d.text ? row("Mensaje", escapeHtml(d.text).replace(/\n/g, "<br>")) : "",
    d.source ? row("Origen", escapeHtml(d.source)) : "",
  ].join("");

  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#1c1a15;padding:32px;text-align:center;">
        <h1 style="color:#f6f1e7;margin:0;font-size:22px;font-weight:600;letter-spacing:1px;">
          Showroom TIER Bravo — Nueva consulta
        </h1>
        <p style="color:#A07F46;margin:8px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
          Mario Bravo 955 · Buenos Aires
        </p>
      </div>
      <div style="padding:28px 24px;">
        <p style="color:#6b6455;font-size:14px;margin:0 0 20px;">Se recibió una nueva consulta desde la web:</p>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      <div style="background:#f6f1e7;padding:18px 24px;text-align:center;">
        <p style="color:#8a7a5c;font-size:12px;margin:0;">Email enviado automáticamente desde el Showroom TIER Bravo.</p>
      </div>
    </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
