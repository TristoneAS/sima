"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { Add, Delete, Undo } from "@mui/icons-material";
import DashboardShell from "./DashboardShell";
import { BRAND } from "@/libs/theme_palette";
import { pageSubtitleSx, pageTitleSx } from "@/libs/table_ui";

const MapaRutas = dynamic(() => import("./MapaRutas"), { ssr: false });

const COLORES = ["#7c3aed", "#2563eb", "#dc2626", "#059669", "#d97706", "#0891b2", "#db2777", "#4f46e5"];

function siguienteColor(rutas) {
  return COLORES[rutas.length % COLORES.length];
}

export default function RutasCatalog() {
  const [rows, setRows] = useState([]);
  const [nombre, setNombre] = useState("");
  const [seleccionId, setSeleccionId] = useState(null);
  const [borrador, setBorrador] = useState([]);
  const [dibujando, setDibujando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rutas");
      const data = await response.json();
      if (!response.ok || !data.success) {
        setRows([]);
        setError(data.error || "No se pudo cargar las rutas");
        return;
      }
      setRows(data.data || []);
    } catch {
      setRows([]);
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const seleccion = rows.find((row) => String(row.id_ruta) === String(seleccionId)) || null;

  async function guardar(ruta, mensaje) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const nueva = !ruta.id_ruta;
      const response = await fetch(nueva ? "/api/rutas" : `/api/rutas/${ruta.id_ruta}`, {
        method: nueva ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruta),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo guardar la ruta");
        return null;
      }
      setSuccess(mensaje || data.message || "Guardado");
      await loadRows();
      return data.data;
    } catch {
      setError("No se pudo conectar con el servidor");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function crearRuta(event) {
    event.preventDefault();
    const creada = await guardar(
      {
        nombre,
        color: siguienteColor(rows),
        visible: true,
        lineas: [],
      },
      "Ruta creada. Trácela en el mapa.",
    );
    if (!creada) return;
    setNombre("");
    setSeleccionId(creada.id_ruta);
    setDibujando(true);
    setBorrador([]);
  }

  function clicMapa(punto) {
    if (!dibujando || !seleccion) return;
    setBorrador((prev) => [...prev, punto]);
  }

  async function terminarLinea() {
    if (!seleccion || borrador.length < 2) {
      setError("Marque al menos dos puntos en el mapa.");
      return;
    }
    const idLinea =
      (seleccion.lineas || []).reduce((max, linea) => Math.max(max, Number(linea.id_linea) || 0), 0) + 1;
    const guardada = await guardar(
      {
        ...seleccion,
        lineas: [
          ...(seleccion.lineas || []),
          {
            id_linea: idLinea,
            nombre: (seleccion.lineas || []).length === 0 ? "Inicio" : `Línea ${idLinea}`,
            puntos: borrador,
          },
        ],
      },
      "Línea guardada en la ruta.",
    );
    if (!guardada) return;
    setBorrador([]);
    setDibujando(false);
    setSeleccionId(guardada.id_ruta);
  }

  async function quitarLinea(idLinea) {
    if (!seleccion) return;
    const guardada = await guardar(
      {
        ...seleccion,
        lineas: (seleccion.lineas || []).filter((linea) => linea.id_linea !== idLinea),
      },
      "Línea eliminada.",
    );
    if (guardada) setSeleccionId(guardada.id_ruta);
  }

  async function cambiarVisible(ruta, visible) {
    const guardada = await guardar({ ...ruta, visible }, visible ? "Ruta visible en el mapa." : "Ruta oculta en el mapa.");
    if (guardada) setSeleccionId(guardada.id_ruta);
  }

  async function eliminarRuta(ruta) {
    if (!window.confirm(`¿Eliminar la ruta ${ruta.nombre}?`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/rutas/${ruta.id_ruta}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo eliminar la ruta");
        return;
      }
      if (String(seleccionId) === String(ruta.id_ruta)) {
        setSeleccionId(null);
        setDibujando(false);
        setBorrador([]);
      }
      setSuccess("Ruta eliminada.");
      await loadRows();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell selectedItemId="rutas">
      <Box sx={{ width: "100%" }}>
        <Typography variant="h5" sx={{ ...pageTitleSx, mb: 0.25 }}>
          Rutas
        </Typography>
        <Typography variant="body2" sx={{ ...pageSubtitleSx, mb: 1.25 }}>
          Dibuje cada recorrido sobre el mapa de Delicias. Cree la ruta, haga clic en el mapa para marcar el camino y guarde la línea.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 1.25 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 1.25 }}>
            {success}
          </Alert>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 1.25,
            height: { md: "calc(100dvh - 210px)" },
            minHeight: 560,
          }}
        >
          <Paper
            sx={{
              width: { xs: "100%", md: 320 },
              flexShrink: 0,
              p: 1.25,
              border: `1px solid ${BRAND.border}`,
              overflow: "auto",
            }}
          >
            <Box component="form" onSubmit={crearRuta} sx={{ display: "flex", gap: 1, mb: 1.25 }}>
              <TextField
                label="Nueva ruta"
                size="small"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
                fullWidth
                placeholder="Rosales, Cumbres, Av. 16 sur"
              />
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                sx={{ textTransform: "none", minWidth: 44, px: 1.2 }}
                aria-label="Crear ruta"
              >
                <Add />
              </Button>
            </Box>

            {loading && (
              <Typography variant="body2" sx={{ color: BRAND.muted }}>
                Cargando rutas…
              </Typography>
            )}
            {!loading && rows.length === 0 && (
              <Typography variant="body2" sx={{ color: BRAND.muted }}>
                Todavía no hay rutas. Escriba el nombre y créela para trazarla.
              </Typography>
            )}

            {rows.map((ruta) => {
              const activa = String(ruta.id_ruta) === String(seleccionId);
              return (
                <Box
                  key={ruta.id_ruta}
                  sx={{
                    mb: 0.75,
                    borderRadius: 1,
                    border: `1px solid ${activa ? ruta.color : BRAND.border}`,
                    bgcolor: activa ? "#f8fafc" : "transparent",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pr: 0.5 }}>
                    <Checkbox
                      size="small"
                      checked={ruta.visible !== false}
                      onChange={(event) => cambiarVisible(ruta, event.target.checked)}
                      slotProps={{ input: { "aria-label": `Mostrar ${ruta.nombre}` } }}
                    />
                    <Box
                      sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: ruta.color, flexShrink: 0 }}
                    />
                    <Typography
                      onClick={() => {
                        setSeleccionId(ruta.id_ruta);
                        setDibujando(false);
                        setBorrador([]);
                      }}
                      sx={{ flex: 1, fontWeight: activa ? 800 : 600, cursor: "pointer", py: 0.8 }}
                    >
                      {ruta.nombre}
                    </Typography>
                    <IconButton size="small" color="error" aria-label={`Eliminar ${ruta.nombre}`} onClick={() => eliminarRuta(ruta)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                  {activa && (
                    <Box sx={{ px: 1.25, pb: 1 }}>
                      {(ruta.lineas || []).map((linea) => (
                        <Box key={linea.id_linea} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography variant="body2" sx={{ flex: 1, color: "#334155" }}>
                            {linea.nombre} · {linea.puntos.length} puntos
                          </Typography>
                          <IconButton size="small" aria-label={`Quitar ${linea.nombre}`} onClick={() => quitarLinea(linea.id_linea)}>
                            <Delete fontSize="inherit" />
                          </IconButton>
                        </Box>
                      ))}
                      {(ruta.lineas || []).length === 0 && (
                        <Typography variant="body2" sx={{ color: BRAND.muted, mb: 0.5 }}>
                          Esta ruta todavía no tiene recorrido.
                        </Typography>
                      )}
                      {dibujando ? (
                        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 0.75 }}>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={saving || borrador.length < 2}
                            onClick={terminarLinea}
                            sx={{ textTransform: "none" }}
                          >
                            Guardar línea ({borrador.length})
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Undo />}
                            disabled={borrador.length === 0}
                            onClick={() => setBorrador((prev) => prev.slice(0, -1))}
                            sx={{ textTransform: "none" }}
                          >
                            Deshacer
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setDibujando(false);
                              setBorrador([]);
                            }}
                            sx={{ textTransform: "none" }}
                          >
                            Cancelar
                          </Button>
                        </Box>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setDibujando(true);
                            setBorrador([]);
                            setError("");
                          }}
                          sx={{ textTransform: "none", mt: 0.5 }}
                        >
                          Trazar línea
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Paper>

          <Paper sx={{ flex: 1, minHeight: 480, overflow: "hidden", border: `1px solid ${BRAND.border}` }}>
            <MapaRutas
              rutas={rows}
              seleccionId={seleccionId}
              borrador={borrador}
              dibujando={dibujando}
              onMapClick={clicMapa}
            />
          </Paper>
        </Box>
      </Box>
    </DashboardShell>
  );
}
