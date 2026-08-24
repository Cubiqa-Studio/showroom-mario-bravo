"use client";

import { motion } from "framer-motion";

/**
 * Fallback del slot @modal mientras llega el RSC de la landing interceptada. Es un
 * SHELL completo (blanco opaco, mismo fondo que el detalle) con spinner centrado:
 * tras el zoom-in del home, "entrás a la landing" y esperás ahí la carga — en vez
 * de quedar mirando el home congelado. Entra con leve demora para que el avance del
 * zoom se lea primero; en cargas rápidas (RSC veloz) se desmonta antes de verse, y
 * como el detalle también es blanco, el handoff shell → contenido no parpadea.
 */
export default function ModalLoading() {
  return (
    <motion.div
      className="fixed inset-0 z-[90] grid place-items-center bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
    >
      <span
        className="h-10 w-10 animate-spin rounded-full border-2 border-[#B87D09]/25 border-t-[#B87D09]"
        role="status"
        aria-label="Cargando departamento"
      />
    </motion.div>
  );
}
