"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  MenuItem,
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

const TIPOS = ["Camión", "Auto", "Camioneta"];
const emptyForm = { numero: "", tipo: "Camión", capacidad: "" };

export default function TransporteCatalog() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/transportes");
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
    setEditId(row.id_transporte);
    setForm({
      numero: row.numero,
      tipo: row.tipo,
      capacidad: String(row.capacidad),
    });
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
      const response = await fetch(
        editId ? `/api/transportes/${editId}` : "/api/transportes",
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            numero: form.numero,
            tipo: form.tipo,
            capacidad: Number(form.capacidad),
          }),
        },
      );
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
    if (!window.confirm(`¿Eliminar el transporte ${row.numero}?`)) return;
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/transportes/${row.id_transporte}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo eliminar");
        return;
      }
      if (editId === row.id_transporte) cancelEdit();
      setSuccess(data.message || "Eliminado");
      loadRows();
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }

  return (
    <DashboardShell selectedItemId="transporte">
      <Box sx={{ maxWidth: PAGE_MAX_WIDTH, mx: "auto", width: "100%" }}>
        <Typography variant="h5" sx={pageTitleSx}>
          Transporte
        </Typography>
        <Typography variant="body2" sx={pageSubtitleSx}>
          Unidades de personal. El no. de camión o ID identifica cada una para
          medir su aforo.
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
            {editId ? "Editar transporte" : "Nuevo transporte"}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(240px, 1.4fr) minmax(180px, 1fr) 150px" },
              gap: 1.5,
              alignItems: "start",
            }}
          >
            <TextField
              label="No. de camión o ID"
              size="small"
              value={form.numero}
              onChange={(event) => setForm((prev) => ({ ...prev, numero: event.target.value }))}
              required
            />
            <TextField
              select
              label="Tipo de transporte"
              size="small"
              value={form.tipo ?? "Camión"}
              onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
              required
            >
              {TIPOS.map((tipo) => (
                <MenuItem key={tipo} value={tipo}>
                  {tipo}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Capacidad"
              size="small"
              type="number"
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              value={form.capacidad}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, capacidad: event.target.value }))
              }
              required
            />
            <Box sx={{ display: "flex", gap: 1, gridColumn: { xs: "1", md: "1 / -1" } }}>
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
                <Button
                  type="button"
                  variant="outlined"
                  onClick={cancelEdit}
                  sx={{ textTransform: "none", height: 40 }}
                >
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
                <TableCell sx={tableHeadCellSx}>No. / ID</TableCell>
                <TableCell sx={tableHeadCellSx}>Tipo</TableCell>
                <TableCell sx={tableHeadCellSx}>Capacidad</TableCell>
                <TableCell sx={tableHeadCellSx} align="right">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={tableEmptyCellSx}>
                    No hay transportes registrados
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id_transporte} hover>
                  <TableCell>{row.numero}</TableCell>
                  <TableCell>{row.tipo}</TableCell>
                  <TableCell>{row.capacidad}</TableCell>
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
