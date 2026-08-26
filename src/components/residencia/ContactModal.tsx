"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingPortal } from "@floating-ui/react";
import { whatsappUrl } from "@/lib/contact";
import { captureContactFormSubmitted, captureCta } from "@/lib/analytics";
import { useI18n } from "@/i18n/LanguageProvider";
import { CloseIcon } from "../gallery/icons";

/* eslint-disable @next/next/no-img-element */

/**
 * Modal de "Contacto" (desde el SideMenu). Pedido del cliente: NO redirigir
 * directo a WhatsApp — primero pedir los datos en un formulario y, al enviar,
 * abrir WhatsApp (Juan) con el mensaje pre-cargado con esos datos. Tailwind
 * (no .res-landing) para verse igual en el exterior y en la landing.
 */
export function ContactModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", phone: "", comment: "" });
  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const [state, setState] = useState<"idle" | "submitting" | "ok" | "error">(
    "idle",
  );

  // Cerrar con Escape + bloquear el scroll del fondo.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Al cerrarse, resetear estado + formulario (tras la animación de salida) para
  // que el modal reabra limpio.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => {
      setState("idle");
      setForm({ name: "", phone: "", comment: "" });
    }, 220);
    return () => clearTimeout(id);
  }, [open]);

  // Acción PRINCIPAL: enviar el lead por email vía Resend (/api/contact). El
  // WhatsApp pasa a ser una alternativa (el link azul de abajo), ya no el submit.
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setState("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          comment: form.comment,
          source: "Sidebar · Contacto",
        }),
      });
      if (!res.ok) throw new Error();
      captureContactFormSubmitted("sidebar_contact_modal");
      setState("ok");
    } catch {
      setState("error");
    }
  };

  // WhatsApp (alternativa): link con el mensaje pre-cargado con los datos del form.
  const waHref = whatsappUrl(
    t.contactModal.waMessage(form.name, form.phone, form.comment),
  );

  const field =
    "w-full rounded-lg border border-line bg-mist px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20 placeholder:text-faint";

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[160] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            // pointerEvents off al cerrar (bug 216 breathe): el overlay full-screen que se
            // desvanece no debe capturar el puntero. "auto" en animate lo restaura.
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label={t.contactModal.close}
              onClick={onClose}
              className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-paper shadow-2xl ring-1 ring-line"
            >
              <button
                type="button"
                aria-label={t.contactModal.close}
                onClick={onClose}
                className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-white/10 hover:text-ink"
              >
                <CloseIcon width={20} height={20} />
              </button>

              {/* max-h + scroll interno: en teléfonos bajos (o con el teclado abierto)
                  el form completo no entra en el viewport; sin esto el card centrado
                  quedaba recortado por arriba y por abajo (overflow-hidden del card).
                  El botón de cerrar queda fijo (está fuera de este contenedor). */}
              <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto px-5 pb-6 pt-7 sm:px-7 sm:pb-7 sm:pt-8">
                <img
                  src="/logo.png"
                  alt="TIER Bravo"
                  className="mb-4 h-10 w-auto sm:mb-5 sm:h-12"
                />

                {state === "ok" ? (
                  <div className="pb-2 text-center">
                    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-gold/15 text-gold">
                      <svg
                        viewBox="0 0 24 24"
                        width={26}
                        height={26}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        aria-hidden
                      >
                        <path
                          d="M20 6 9 17l-5-5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <h2 className="font-serif text-2xl leading-tight tracking-wide text-ink">
                      {t.contactModal.sentTitle}
                    </h2>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
                      {t.contactModal.sent}
                    </p>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        captureCta("whatsapp", "sidebar_contact_modal");
                        onClose();
                      }}
                      className="ph-no-capture mt-5 inline-block text-sm font-medium text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-700"
                    >
                      {t.contactModal.whatsappCta}
                    </a>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
                      {t.contactModal.eyebrow}
                    </p>
                    <h2 className="mt-1.5 font-serif text-2xl leading-tight tracking-wide text-ink">
                      {t.contactModal.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {t.contactModal.subtitle}
                    </p>

                    <form
                      className="mt-4 space-y-3 sm:mt-6 sm:space-y-3.5"
                      onSubmit={onSubmit}
                    >
                      <div>
                        <label
                          htmlFor="cm-name"
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
                        >
                          {t.contactModal.name}
                        </label>
                        <input
                          id="cm-name"
                          type="text"
                          required
                          className={field}
                          placeholder={t.contactModal.namePlaceholder}
                          value={form.name}
                          onChange={(e) => set("name")(e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="cm-phone"
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
                        >
                          {t.contactModal.phone}
                        </label>
                        <input
                          id="cm-phone"
                          type="tel"
                          required
                          className={field}
                          placeholder={t.contactModal.phonePlaceholder}
                          value={form.phone}
                          onChange={(e) => set("phone")(e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="cm-comment"
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
                        >
                          {t.contactModal.comment}
                        </label>
                        <textarea
                          id="cm-comment"
                          rows={3}
                          className={`${field} resize-none`}
                          placeholder={t.contactModal.commentPlaceholder}
                          value={form.comment}
                          onChange={(e) => set("comment")(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2.5 pt-1">
                        <button
                          type="submit"
                          disabled={state === "submitting"}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold tracking-wide text-cream shadow-sm transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {state === "submitting"
                            ? t.contactModal.sending
                            : t.contactModal.submit}
                        </button>

                        {state === "error" && (
                          <p className="text-center text-xs text-red-600">
                            {t.contactModal.error}
                          </p>
                        )}

                        {/* Alternativa: seguir por WhatsApp (link azul, estilo hipervínculo). */}
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            captureCta("whatsapp", "sidebar_contact_modal");
                            onClose();
                          }}
                          className="ph-no-capture block text-center text-sm font-medium text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-700"
                        >
                          {t.contactModal.whatsappCta}
                        </a>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}
