"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Add, Delete, Edit, Undo } from "@mui/icons-material";
import DashboardShell from "./DashboardShell";

const MapaRutas = dynamic(() => import("./MapaRutas"), { ssr: false });
import { BRAND } from "@/libs/theme_palette";
import {
  PAGE_MAX_WIDTH,
  pageSubtitleSx,
  pageTitleSx,
  tableEmptyCellSx,
  tableHeadCellSx,
  tableHeadRowSx,
} from "@/libs/table_ui";

const emptyForm = { nombre: "" };

export default function LugaresCatalog() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [trazando, setTrazando] = useState(null);
  const [viendo, setViendo] = useState(null);
  const [borrador, setBorrador] = useState([]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/lugares");
      const data = await response.json();
      if (!response.ok || !data.success) {
        setRows([]);
        setError(data.error || "No se pudo cargar el catálogo");
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

  function startEdit(row) {
    setEditId(row.id_lugar);
    setForm({ nombre: row.nombre });
    setSuccess("");
    setError("");
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyForm);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(editId ? `/api/lugares/${editId}` : "/api/lugares", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo guardar");
        return;
      }
      setSuccess(data.message || "Guardado");
      cancelEdit();
      loadRows();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  function abrirTrazo(row) {
    setTrazando(row);
    setBorrador([]);
    setError("");
    setSuccess("");
  }

  function cerrarTrazo() {
    setTrazando(null);
    setBorrador([]);
  }

  async function guardarRuta() {
    if (!trazando || borrador.length < 2) {
      setError("Marque al menos dos puntos en el mapa.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/lugares/${trazando.id_lugar}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: trazando.nombre, ruta: borrador }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo guardar la ruta");
        return;
      }
      setSuccess(`Ruta guardada para ${trazando.nombre}.`);
      cerrarTrazo();
      loadRows();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  async function limpiarRuta(row) {
    if (!window.confirm(`¿Quitar el recorrido guardado de ${row.nombre}? El lugar se conserva.`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/lugares/${row.id_lugar}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: row.nombre, ruta: [] }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo limpiar la ruta");
        return;
      }
      setSuccess(`Recorrido eliminado de ${row.nombre}.`);
      loadRows();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`¿Eliminar ${row.nombre}?`)) return;
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/lugares/${row.id_lugar}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo eliminar");
        return;
      }
      if (editId === row.id_lugar) cancelEdit();
      setSuccess(data.message || "Eliminado");
      loadRows();
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }

  return (
    <DashboardShell selectedItemId="lugares">
      <Box sx={{ maxWidth: PAGE_MAX_WIDTH, mx: "auto", width: "100%" }}>
        <Typography variant="h5" sx={pageTitleSx}>
          Lugares
        </Typography>
        <Typography variant="body2" sx={pageSubtitleSx}>
          Puntos que se eligen como procedencia o destino. Cada lugar puede guardar el recorrido que usa en el mapa.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Paper
          component="form"
          onSubmit={submit}
          sx={{ p: 2, mb: 2, border: `1px solid ${BRAND.border}` }}
        >
          <Typography sx={{ fontWeight: 700, mb: 1.5, color: BRAND.primary }}>
            {editId ? "Editar lugar" : "Nuevo lugar"}
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
            <TextField
              label="Nombre del lugar"
              size="small"
              value={form.nombre}
              onChange={(event) => setForm({ nombre: event.target.value })}
              required
              sx={{ minWidth: 280, flex: 1 }}
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<Add />}
              disabled={saving}
              sx={{ textTransform: "none", height: 40 }}
            >
              {saving ? "Guardando..." : editId ? "Guardar" : "Agregar"}
            </Button>
            {editId && (
              <Button type="button" variant="outlined" onClick={cancelEdit} sx={{ textTransform: "none", height: 40 }}>
                Cancelar
              </Button>
            )}
          </Box>
        </Paper>

        <TableContainer component={Paper} sx={{ border: `1px solid ${BRAND.border}` }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={tableHeadRowSx}>
                <TableCell sx={tableHeadCellSx}>Lugar</TableCell>
                <TableCell sx={tableHeadCellSx}>Ruta</TableCell>
                <TableCell sx={tableHeadCellSx} align="right">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={tableEmptyCellSx}>
                    No hay lugares registrados
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id_lugar} hover>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>
                    {Array.isArray(row.ruta) && row.ruta.length >= 2
                      ? `${row.ruta.length} puntos`
                      : "Sin ruta"}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => abrirTrazo(row)}
                      sx={{ textTransform: "none", mr: 1 }}
                    >
                      Trazar ruta
                    </Button>
                    {Array.isArray(row.ruta) && row.ruta.length >= 2 && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setViendo(row)}
                        sx={{ textTransform: "none", mr: 1 }}
                      >
                        Ver ruta
                      </Button>
                    )}
                    {Array.isArray(row.ruta) && row.ruta.length >= 2 && (
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => limpiarRuta(row)}
                        disabled={saving}
                        sx={{ textTransform: "none", mr: 1 }}
                      >
                        Limpiar ruta
                      </Button>
                    )}
                    <Button
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => startEdit(row)}
                      sx={{ textTransform: "none", mr: 1 }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => remove(row)}
                      sx={{ textTransform: "none" }}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={Boolean(trazando)} onClose={cerrarTrazo} fullWidth maxWidth="md">
          <DialogTitle>Trazar ruta{trazando ? `: ${trazando.nombre}` : ""}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1, color: BRAND.muted }}>
              Haga clic en el mapa para marcar el recorrido. Se guarda en este lugar.
            </Typography>
            <Box sx={{ height: { xs: 420, sm: 520 }, border: `1px solid ${BRAND.border}`, borderRadius: 1, overflow: "hidden" }}>
              {trazando && (
                <MapaRutas
                  rutas={rows
                    .filter((row) => Array.isArray(row.ruta) && row.ruta.length >= 2 && row.id_lugar !== trazando.id_lugar)
                    .map((row) => ({
                      id_ruta: row.id_lugar,
                      visible: true,
                      color: "#94a3b8",
                      lineas: [{ puntos: row.ruta }],
                    }))}
                  seleccionId={null}
                  borrador={borrador}
                  dibujando
                  onMapClick={(punto) => setBorrador((prev) => [...prev, punto])}
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setBorrador((prev) => prev.slice(0, -1))}
              disabled={borrador.length === 0}
              startIcon={<Undo />}
              sx={{ textTransform: "none" }}
            >
              Deshacer
            </Button>
            <Button onClick={cerrarTrazo} sx={{ textTransform: "none" }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={guardarRuta}
              disabled={saving || borrador.length < 2}
              sx={{ textTransform: "none" }}
            >
              {saving ? "Guardando..." : `Guardar ruta (${borrador.length})`}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(viendo)} onClose={() => setViendo(null)} fullWidth maxWidth="md">
          <DialogTitle>Ruta{viendo ? `: ${viendo.nombre}` : ""}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1, color: BRAND.muted }}>
              Recorrido guardado de este lugar.
            </Typography>
            <Box sx={{ height: { xs: 420, sm: 520 }, border: `1px solid ${BRAND.border}`, borderRadius: 1, overflow: "hidden" }}>
              {viendo && (
                <MapaRutas
                  rutas={[
                    {
                      id_ruta: viendo.id_lugar,
                      visible: true,
                      color: "#7c3aed",
                      lineas: [{ puntos: viendo.ruta }],
                    },
                  ]}
                  seleccionId={viendo.id_lugar}
                  borrador={[]}
                  encuadrar
                  soloLectura
                  altura="100%"
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setViendo(null)} sx={{ textTransform: "none" }}>
              Cerrar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardShell>
  );
}
