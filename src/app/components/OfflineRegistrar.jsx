"use client";

import { useEffect } from "react";
import { leerOutbox, sincronizarOutbox } from "@/app/lib/offline";

export default function OfflineRegistrar() {
  useEffect(() => {
    let cancelado = false;

    async function prepararCopiaLocal() {
      if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
      const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      if (cancelado) return;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          const listo = () => resolve();
          navigator.serviceWorker.addEventListener("controllerchange", listo, { once: true });
          window.setTimeout(listo, 3000);
        });
      }
      const host = window.location.hostname;
      const enEquipo = host !== "localhost" && host !== "127.0.0.1";
      if (
        cancelado ||
        !enEquipo ||
        !navigator.serviceWorker.controller ||
        !navigator.onLine ||
        leerOutbox().length > 0 ||
        sessionStorage.getItem("sima_sw_cache") === "1"
      ) {
        return;
      }
      sessionStorage.setItem("sima_sw_cache", "1");
      window.location.reload();
    }

    prepararCopiaLocal().catch(() => {});

    async function subir() {
      if (navigator.onLine === false) return;
      await sincronizarOutbox();
    }

    subir();
    const timer = window.setInterval(subir, 20000);
    window.addEventListener("online", subir);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
      window.removeEventListener("online", subir);
    };
  }, []);

  return null;
}
