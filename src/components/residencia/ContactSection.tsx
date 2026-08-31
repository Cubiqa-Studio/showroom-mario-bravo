"use client";

import { useState, type FormEvent } from "react";
import type { SiteConfig, Unit } from "@/lib/types";
import { useOrigen, useWhatsappUrl } from "@/components/OrigenProvider";
import { captureContactFormSubmitted, captureCta } from "@/lib/analytics";
import { useI18n } from "@/i18n/LanguageProvider";

/* eslint-disable @next/next/no-img-element */

type FormState = "idle" | "submitting" | "ok" | "error";

/**
 * "Hablemos" (sección 06), layout del mock del cliente: a la izquierda el
 * argumento de inversión + logo blanco y negro, al centro el form compacto
 * (Nombre / Teléfono / Email), a la derecha "Comercializa en exclusiva" (RE/MAX)
 * y el CTA de WhatsApp. POST a /api/contact con { name, phone, email, message,
 * unitId, residence } (mismo contrato de siempre; el mensaje se autocompleta).
 */
export function ContactSection({
  unit,
  unitId,
  site,
}: {
  unit: Unit;
  unitId: string;
  site: SiteConfig;
}) {
  const brand = site.brandName ?? site.projectName;
  const { t } = useI18n();
  // Quién trajo la visita: decide a qué bandeja va el lead y a qué WhatsApp.
  const { origen } = useOrigen();
  const waUrl = useWhatsappUrl();
  const [state, setState] = useState<FormState>("idle");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setState("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          message: t.contact.formMessage(unit.residence),
          unitId,
          residence: unit.residence,
          origen,
        }),
      });
      if (!res.ok) throw new Error();
      captureContactFormSubmitted("residence_contact_section", origen);
      setState("ok");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="wrap" id="contacto">
      <div className="spec-head">
        <h2 className="section-title">{t.contact.sectionTitle}</h2>
        <p className="muted center">{t.contact.intro}</p>
      </div>

      <div className="contact-grid">
        {/* Columna izquierda: argumento de inversión + la marca. */}
        <aside className="contact-aside">
          <p className="ca-copy">{t.contact.asideCopy}</p>
          {/* Variante BLANCA. La tinta (`logo_b_n.png`) es #0F0F11 y esta sección va
              sobre el negro de marca: el logotipo desaparecía contra el fondo. */}
          <img className="ca-logo" src="/logo_blanco.png" alt={brand} />
        </aside>

        {state === "ok" ? (
          <div className="contact-form" style={{ textAlign: "center" }}>
            <p className="form-ok serif">{t.contact.thanks}</p>
            <p className="muted">{t.contact.thanksNote}</p>
          </div>
        ) : (
          <form className="contact-form" onSubmit={onSubmit}>
            <div className="cf-field">
              <label htmlFor="cf-name">{t.contact.name}</label>
              <input
                id="cf-name"
                type="text"
                placeholder={t.contact.namePlaceholder}
                required
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
              />
            </div>
            <div className="cf-field">
              <label htmlFor="cf-phone">{t.contact.phone}</label>
              <div className="cf-phone">
                <span className="country-sel">
                  🇦🇷 +54
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
                <input
                  id="cf-phone"
                  type="tel"
                  placeholder={t.contact.phonePlaceholder}
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                />
              </div>
            </div>
            <div className="cf-field">
              <label htmlFor="cf-email">{t.contact.email}</label>
              <input
                id="cf-email"
                type="email"
                placeholder={t.contact.emailPlaceholder}
                required
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
              />
            </div>
            <div className="cf-foot">
              <button
                type="submit"
                className="btn btn-gold"
                disabled={state === "submitting"}
              >
                <span className="btn-label">
                  {state === "submitting" ? t.contact.sending : t.contact.send}
                </span>
              </button>
              <p className="form-disclaimer">
                {state === "error" ? t.contact.sendError : t.contact.disclaimer}
              </p>
            </div>
          </form>
        )}

        {/* Columna derecha: consulta directa. (Miro 2026-07-15: se sacó el bloque
            "Comercializa en exclusiva" + logo RE/MAX de la página de Consultar.) */}
        <aside className="contact-aside">
          <div className="ca-wsp">
            <p>{t.contact.wspCopy}</p>
            <a
              className="btn btn-outline"
              href={waUrl(t.wa.unit(unit.residence))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                captureCta("whatsapp", "residence_contact_section")
              }
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a9.94 9.94 0 0 0-8.59 15.01L2 22l5.13-1.35A9.96 9.96 0 1 0 12 2zm0 18.13c-1.6 0-3.16-.43-4.53-1.24l-.32-.19-3.04.8.81-2.97-.21-.34a8.12 8.12 0 1 1 7.29 3.94zm4.46-6.08c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.44-1.35-1.68-.14-.24-.02-.37.11-.5.11-.11.24-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.03s.87 2.36 1 2.52c.12.16 1.72 2.62 4.16 3.68.58.25 1.04.4 1.39.51.58.19 1.12.16 1.54.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.46-.28z" />
              </svg>
              <span className="btn-label">{t.contact.wspCta}</span>
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
