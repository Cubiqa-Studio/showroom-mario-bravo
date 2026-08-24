"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Revela su contenido al entrar en viewport (equivalente al IntersectionObserver
 * de la referencia: `.reveal` → `.reveal.in`). Si no hay IO disponible o se
 * prefiere reduced-motion, revela de entrada (nunca deja contenido oculto).
 */
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  as?: "section" | "div";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    // threshold 0 (no 0.12): una sección MÁS alta que viewport/0.12 (≈5800px en celu,
    // ej. la lista larga de residencias) nunca alcanza el 12% visible → se quedaba en
    // opacity:0 ("no renderiza"). Con threshold 0 + rootMargin dispara apenas asoma.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cls = `reveal${shown ? " in" : ""}${className ? " " + className : ""}`;
  return (
    <Tag ref={ref as never} className={cls}>
      {children}
    </Tag>
  );
}
