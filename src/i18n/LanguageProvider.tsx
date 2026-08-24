"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { MESSAGES, type Dict, type Lang } from "./translations";

// ─────────────────────────────────────────────────────────────────────────────
// Idioma del sitio: estado de CLIENTE (sin routing /en — las rutas interceptadas
// y el ZoomLayer hacen inviable el locale en la URL sin una cirugía mayor).
// Default español; la elección persiste en localStorage y sobrevive a la
// navegación overlay/standalone porque el provider vive en el layout raíz.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mario-bravo-lang";

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "es",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // SSR siempre renderiza ES; si el visitante había elegido EN, el efecto lo
  // aplica al montar (re-render inmediato, antes del primer paint útil).
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "en") setLangState("en");
    } catch {
      /* localStorage bloqueado (modo privado estricto) → queda ES */
    }
  }, []);

  // <html lang> sigue al idioma activo (lectores de pantalla / traductores).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* sin persistencia */
    }
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

/** Hook de i18n: `t` es el diccionario completo del idioma activo. */
export function useI18n(): { lang: Lang; setLang: (l: Lang) => void; t: Dict } {
  const { lang, setLang } = useContext(LangContext);
  return { lang, setLang, t: MESSAGES[lang] };
}
