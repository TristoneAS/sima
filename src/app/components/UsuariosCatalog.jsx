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

const emptyForm = { usuario: "", nombre: "", clave: "" };

export default function UsuariosCatalog() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/usuarios", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo cargar");
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(row) {
    setEditingId(row.id_usuario);
    setForm({ usuario: row.usuario, nombre: row.nombre, clave: "" });
    setNotice("");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      usuario: form.usuario.trim(),
      nombre: form.nombre.trim(),
      clave: form.clave,
    };
    try {
      const response = await fetch(editingId ? `/api/usuarios/${editingId}` : "/api/usuarios", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo guardar");
      setNotice(editingId ? "Usuario actualizado" : "Usuario agregado");
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`¿Quitar el acceso de ${row.usuario}?`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/usuarios/${row.id_usuario}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo eliminar");
      if (editingId === row.id_usuario) cancelEdit();
      setNotice("Usuario eliminado");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <DashboardShell selectedItemId="usuarios">
      <Box sx={{ maxWidth: PAGE_MAX_WIDTH, mx: "auto" }}>
        <Typography sx={pageTitleSx}>Usuarios</Typography>
        <Typography sx={pageSubtitleSx}>
          Cuentas para el login. Estas personas no abren Configuración. Mientras no haya ninguna, el acceso sigue abierto.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {notice}
          </Alert>
        )}

        <Paper component="form" onSubmit={submit} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr auto" }, gap: 1.5, alignItems: "start" }}>
            <TextField
              label="Usuario"
              value={form.usuario}
              onChange={(event) => setField("usuario", event.target.value)}
              autoComplete="off"
              required
            />
            <TextField
              label="Nombre"
              value={form.nombre}
              onChange={(event) => setField("nombre", event.target.value)}
              required
            />
            <TextField
              label="Contraseña"
              type="password"
              value={form.clave}
              onChange={(event) => setField("clave", event.target.value)}
              autoComplete="new-password"
              required={!editingId}
              helperText={editingId ? "En blanco conserva la actual" : "Mínimo 4 caracteres"}
            />
            <Box sx={{ display: "flex", gap: 1, pt: { md: 0.5 } }}>
              <Button type="submit" variant="contained" disabled={saving} startIcon={<Add />} sx={{ bgcolor: BRAND.primary }}>
                {editingId ? "Guardar" : "Agregar"}
              </Button>
              {editingId && (
                <Button type="button" onClick={cancelEdit} disabled={saving}>
                  Cancelar
                </Button>
              )}
            </Box>
          </Box>
        </Paper>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={tableHeadRowSx}>
                <TableCell sx={tableHeadCellSx}>Usuario</TableCell>
                <TableCell sx={tableHeadCellSx}>Nombre</TableCell>
                <TableCell sx={tableHeadCellSx} align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} sx={tableEmptyCellSx}>
                    Todavía no hay usuarios. Cualquier usuario y contraseña pueden entrar.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id_usuario} hover>
                  <TableCell>{row.usuario}</TableCell>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<Edit />} onClick={() => startEdit(row)}>
                      Editar
                    </Button>
                    <Button size="small" color="error" startIcon={<Delete />} onClick={() => remove(row)}>
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
