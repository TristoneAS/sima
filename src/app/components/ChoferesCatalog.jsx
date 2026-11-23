"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import { Add, Delete, Edit } from "@mui/icons-material";
import DashboardShell from "./DashboardShell";
import { BRAND } from "@/libs/theme_palette";
import {
  PAGE_MAX_WIDTH,
  pageSubtitleSx,
  pageTitleSx,
  tableEmptyCellSx,
  tableHeadCellSx,
  tableHeadRowSx,
} from "@/libs/table_ui";

const emptyForm = { nombre: "", telefono: "" };

export default function ChoferesCatalog() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sugerencias, setSugerencias] = useState([]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/choferes");
      const data = await response.json();
      if (!response.ok || !data.success) {
        setRows([]);
        setSugerencias([]);
        setError(data.error || "No se pudo cargar el catálogo");
        return;
      }
      setRows(data.data || []);
      setSugerencias(Array.isArray(data.sugerencias) ? data.sugerencias : []);
    } catch {
      setRows([]);
      setSugerencias([]);
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function startEdit(row) {
    setEditId(row.id_chofer);
    setForm({ nombre: row.nombre, telefono: row.telefono });
    setSuccess("");
    setError("");
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyForm);
  }

  function usarSugerencia(nombre) {
    setEditId(null);
    setForm({ nombre, telefono: "" });
    setSuccess("");
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(editId ? `/api/choferes/${editId}` : "/api/choferes", {
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

  async function remove(row) {
    if (!window.confirm(`¿Eliminar a ${row.nombre}?`)) return;
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/choferes/${row.id_chofer}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo eliminar");
        return;
      }
      if (editId === row.id_chofer) cancelEdit();
      setSuccess(data.message || "Eliminado");
      loadRows();
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }

  return (
    <DashboardShell selectedItemId="choferes">
      <Box sx={{ maxWidth: PAGE_MAX_WIDTH, mx: "auto", width: "100%" }}>
        <Typography variant="h5" sx={pageTitleSx}>
          Choferes
        </Typography>
        <Typography variant="body2" sx={pageSubtitleSx}>
          Conductores que se seleccionan al registrar un viaje.
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
        {sugerencias.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Estos choferes se escribieron en Llenado de datos y no están dados de alta. Falta el teléfono para registrarlos.
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
              {sugerencias.map((nombre) => (
                <Button
                  key={nombre}
                  size="small"
                  variant="outlined"
                  onClick={() => usarSugerencia(nombre)}
                  sx={{ textTransform: "none" }}
                >
                  Dar de alta {nombre}
                </Button>
              ))}
            </Box>
          </Alert>
        )}

        <Paper
          component="form"
          onSubmit={submit}
          sx={{ p: 2, mb: 2, border: `1px solid ${BRAND.border}` }}
        >
          <Typography sx={{ fontWeight: 700, mb: 1.5, color: BRAND.primary }}>
            {editId ? "Editar chofer" : "Nuevo chofer"}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr auto" },
              gap: 1.5,
              alignItems: "start",
            }}
          >
            <TextField
              label="Nombre"
              size="small"
              value={form.nombre}
              onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
              required
            />
            <TextField
              label="Teléfono"
              size="small"
              value={form.telefono}
              onChange={(event) => setForm((prev) => ({ ...prev, telefono: event.target.value }))}
              required
              slotProps={{ htmlInput: { inputMode: "tel" } }}
            />
            <Box sx={{ display: "flex", gap: 1 }}>
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
          </Box>
        </Paper>

        <TableContainer component={Paper} sx={{ border: `1px solid ${BRAND.border}` }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={tableHeadRowSx}>
                <TableCell sx={tableHeadCellSx}>Nombre</TableCell>
                <TableCell sx={tableHeadCellSx}>Teléfono</TableCell>
                <TableCell sx={tableHeadCellSx} align="right">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={tableEmptyCellSx}>
                    No hay choferes registrados
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id_chofer} hover>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>{row.telefono}</TableCell>
                  <TableCell align="right">
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
      </Box>
    </DashboardShell>
  );
}
