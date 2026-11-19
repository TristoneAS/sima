"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const DELICIAS = [28.193, -105.47];

export default function MapaRutas({
  rutas,
  seleccionId,
  borrador,
  dibujando,
  onMapClick,
  encuadrar = false,
  soloLectura = false,
  altura,
}) {
  const host = useRef(null);
  const mapRef = useRef(null);
  const capasRef = useRef(null);
  const [mapaListo, setMapaListo] = useState(false);
  const [ajuste, setAjuste] = useState(0);
  const clickRef = useRef(onMapClick);
  const soloLecturaRef = useRef(soloLectura);
  clickRef.current = onMapClick;
  soloLecturaRef.current = soloLectura;

  useEffect(() => {
    let cancelado = false;
    let mapa = null;

    async function iniciar() {
      const leaflet = await import("leaflet");
      const L = leaflet.default || leaflet;
      if (cancelado || !host.current || mapRef.current) return;
      mapa = L.map(host.current, {
        zoomControl: true,
        scrollWheelZoom: !soloLecturaRef.current,
      }).setView(DELICIAS, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(mapa);
      mapa.on("click", (event) => {
        clickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      capasRef.current = L.layerGroup().addTo(mapa);
      mapRef.current = mapa;
      setMapaListo(true);
      window.setTimeout(() => {
        if (cancelado) return;
        mapa.invalidateSize();
        setAjuste((valor) => valor + 1);
      }, 250);
      window.setTimeout(() => {
        if (cancelado) return;
        mapa.invalidateSize();
        setAjuste((valor) => valor + 1);
      }, 700);
    }

    iniciar();
    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
      capasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = capasRef.current;
    if (!group || !mapRef.current) return;
    let cancelado = false;

    async function pintar() {
      const leaflet = await import("leaflet");
      const L = leaflet.default || leaflet;
      if (cancelado) return;
      group.clearLayers();

      for (const ruta of rutas) {
        if (ruta.visible === false) continue;
        const activa = String(ruta.id_ruta) === String(seleccionId);
        for (const linea of ruta.lineas || []) {
          if (!linea.puntos?.length) continue;
          L.polyline(
            linea.puntos.map((punto) => [punto.lat, punto.lng]),
            {
              color: ruta.color || "#7c3aed",
              weight: activa ? 6 : 4,
              opacity: activa ? 0.95 : 0.7,
            },
          ).addTo(group);
        }
      }

      if (borrador?.length) {
        L.polyline(
          borrador.map((punto) => [punto.lat, punto.lng]),
          { color: "#111827", weight: 4, dashArray: "6 6" },
        ).addTo(group);
        for (const punto of borrador) {
          L.circleMarker([punto.lat, punto.lng], {
            radius: 5,
            color: "#111827",
            weight: 2,
            fillColor: "#ffffff",
            fillOpacity: 1,
          }).addTo(group);
        }
      }

      if (encuadrar && mapRef.current) {
        const coords = [];
        for (const ruta of rutas || []) {
          if (ruta.visible === false) continue;
          for (const linea of ruta.lineas || []) {
            for (const punto of linea.puntos || []) coords.push([punto.lat, punto.lng]);
          }
        }
        for (const punto of borrador || []) coords.push([punto.lat, punto.lng]);
        if (coords.length === 1) mapRef.current.setView(coords[0], 15);
        else if (coords.length > 1) {
          mapRef.current.fitBounds(L.latLngBounds(coords), { padding: [28, 28], maxZoom: 16 });
        }
      }
    }

    pintar();
    return () => {
      cancelado = true;
    };
  }, [rutas, seleccionId, borrador, mapaListo, encuadrar, ajuste]);

  return (
    <div
      ref={host}
      style={{
        height: altura ? altura : "100%",
        width: "100%",
        minHeight: altura || 480,
        cursor: dibujando ? "crosshair" : "grab",
      }}
    />
  );
}
