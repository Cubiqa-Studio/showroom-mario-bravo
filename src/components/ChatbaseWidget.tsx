"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Widget de chat de Chatbase. Se monta de /showroom en adelante, NUNCA en la
 * portada ("/"): ahí el visitante todavía no eligió entre Sinclair, Bravo y Avenue,
 * y el agente está entrenado sólo en Bravo.
 *
 * Hacen falta DOS mecanismos, no uno. No alcanza con dejar de renderizar el
 * <Script>: la portada va al showroom con <Link> (SPA), y al volver con la flecha
 * "‹" este componente se desmonta pero la burbuja NO — embed.min.js la cuelga de
 * <body>, fuera del árbol de React, y ahí se queda. Por eso en la portada se
 * devuelve un <style> que tapa los tres elementos que crea Chatbase. Va como
 * <style> y no como un efecto para que aplique en el mismo commit que el resto de
 * la navegación: un useEffect corre DESPUÉS del paint y deja ver un frame de
 * burbuja al volver.
 */
export function ChatbaseWidget({ agentId }: { agentId: string }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return (
      <style>{
        "#chatbase-bubble-button,#chatbase-message-bubbles,#chatbase-bubble-window{display:none!important}"
      }</style>
    );
  }

  return (
    <Script
      id="chatbase-widget"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="${agentId}";script.domain="www.chatbase.co";document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();`,
      }}
    />
  );
}
