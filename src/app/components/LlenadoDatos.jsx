"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import {
  combinarLlegadas,
  encolarEliminacion,
  encolarLlegada,
  filaLocal,
  guardarCache,
  leerCache,
  leerOutbox,
  nuevoClienteId,
  sincronizarOutbox,
} from "@/app/lib/offline";
import { BRAND } from "@/libs/theme_palette";
import {
  pageSubtitleSx,
  pageTitleSx,
  tableEmptyCellSx,
  tableHeadCellSx,
  tableHeadRowSx,
} from "@/libs/table_ui";

const TURNOS = ["TA", "TB", "TC", "TE"];

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const MANUAL = "manual";

const blankForm = {
  id_transporte: "",
  transporte: "",
  fecha: "",
  turno: "",
  hora_entrada: "",
  id_procedencia: "",
  personas_entrada: "",
  hora_salida: "",
  id_destino: "",
  personas_salida: "",
  id_chofer: "",
  chofer: "",
};

function emptyForm() {
  return { ...blankForm, fecha: todayInput() };
}

const BORRADOR_KEY = "sima_borrador_llenado";

function leerBorrador() {
  try {
    const raw = localStorage.getItem(BORRADOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
    return parsed;
  } catch {
    return null;
  }
}

function horaCorta(value) {
  return String(value || "").slice(0, 5);
}

async function guardarCopiaDeLlenado() {
  if (!("caches" in window) || !window.isSecureContext || navigator.onLine === false) return;
  try {
    const cache = await caches.open("sima-shell-v2");
    const response = await fetch("/dashboard/llenado");
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put("/dashboard/llenado", response);
    const urls = new Set();
    for (const match of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
      if (!match[1].startsWith("/api/") && !/hmr|webpack|turbopack/.test(match[1])) urls.add(match[1]);
    }
    await Promise.all(
      [...urls].map(async (url) => {
        try {
          const asset = await fetch(url);
          if (asset.ok) await cache.put(url, asset);
        } catch {
          /* un archivo no disponible no impide guardar el resto */
        }
      }),
    );
  } catch {
    /* sin copia local la pantalla sigue funcionando en línea */
  }
}

export default function LlenadoDatos() {
  const [transportes, setTransportes] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editId, setEditId] = useState(null);
  const [editClienteId, setEditClienteId] = useState(null);
  const [editLocal, setEditLocal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [borradorListo, setBorradorListo] = useState(false);
  const [fechaVista, setFechaVista] = useState("");
  const [verTodas, setVerTodas] = useState(false);
  const [confirmados, setConfirmados] = useState([]);
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  const vista = useRef({ form, editId, editClienteId, editLocal });
  const catalogosRef = useRef({ transportes: [], choferes: [], lugares: [] });
  catalogosRef.current = { transportes, choferes, lugares };
  vista.current = { form, editId, editClienteId, editLocal };

  const transporteActual = useMemo(
    () => transportes.find((row) => String(row.id_transporte) === String(form.id_transporte)),
    [transportes, form.id_transporte],
  );

  const choferActual = useMemo(
    () => choferes.find((row) => String(row.id_chofer) === String(form.id_chofer)),
    [choferes, form.id_chofer],
  );

  const aplicar = useCallback((transportesRows, choferesRows, lugaresRows, llegadasRows) => {
    setTransportes(transportesRows);
    setChoferes(choferesRows);
    setLugares(lugaresRows);
    setRows(
      combinarLlegadas(llegadasRows, {
        transportes: transportesRows,
        choferes: choferesRows,
        lugares: lugaresRows,
      }),
    );
    setPendientes(leerOutbox().length);
  }, []);

  const pintarLocal = useCallback(() => {
    aplicar(
      leerCache("transportes"),
      leerCache("choferes"),
      leerCache("lugares"),
      leerCache("llegadas"),
    );
  }, [aplicar]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const cacheTransportes = leerCache("transportes");
    const cacheChoferes = leerCache("choferes");
    const cacheLugares = leerCache("lugares");
    const cacheLlegadas = leerCache("llegadas");
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
      aplicar(cacheTransportes, cacheChoferes, cacheLugares, cacheLlegadas);
      if (cacheTransportes.length === 0) {
        setError("Sin conexión y sin catálogos guardados. Abra el llenado una vez con red.");
      }
      setLoading(false);
      return;
    }

    try {
      await sincronizarOutbox();
      const [transportesRes, choferesRes, lugaresRes, llegadasRes] = await Promise.all([
        fetch("/api/transportes"),
        fetch("/api/choferes"),
        fetch("/api/lugares"),
        fetch("/api/llegadas"),
      ]);
      const transportesData = await transportesRes.json();
      const choferesData = await choferesRes.json();
      const lugaresData = await lugaresRes.json();
      const llegadasData = await llegadasRes.json();
      if (!transportesRes.ok || !transportesData.success) {
        throw new Error(transportesData.error || "No se pudo cargar el catálogo de transportes");
      }
      if (!choferesRes.ok || !choferesData.success) {
        throw new Error(choferesData.error || "No se pudo cargar el catálogo de choferes");
      }
      if (!lugaresRes.ok || !lugaresData.success) {
        throw new Error(lugaresData.error || "No se pudo cargar el catálogo de lugares");
      }
      if (!llegadasRes.ok || !llegadasData.success) {
        throw new Error(llegadasData.error || "No se pudo cargar el llenado");
      }
      const transportesRows = transportesData.data || [];
      const choferesRows = choferesData.data || [];
      const lugaresRows = lugaresData.data || [];
      const llegadasRows = llegadasData.data || [];
      guardarCache("transportes", transportesRows);
      guardarCache("choferes", choferesRows);
      guardarCache("lugares", lugaresRows);
      guardarCache("llegadas", llegadasRows);
      setOffline(false);
      aplicar(transportesRows, choferesRows, lugaresRows, llegadasRows);
    } catch (loadError) {
      setOffline(true);
      aplicar(cacheTransportes, cacheChoferes, cacheLugares, cacheLlegadas);
      if (cacheTransportes.length === 0) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo conectar con el servidor");
      }
    } finally {
      setLoading(false);
    }
  }, [aplicar]);

  useEffect(() => {
    const draft = leerBorrador();
    if (draft) {
      setForm({ ...blankForm, ...draft.form });
      setEditId(draft.editId ?? null);
      setEditClienteId(draft.editClienteId ?? null);
      setEditLocal(Boolean(draft.editLocal));
    }
    setFechaVista(draft?.form?.fecha || todayInput());
    setBorradorListo(true);
    guardarCopiaDeLlenado();
    loadAll();
    setForm((prev) => ({
      ...blankForm,
      ...prev,
      fecha: prev.fecha || todayInput(),
      id_transporte: prev.id_transporte ?? "",
      turno: prev.turno ?? "",
      id_chofer: prev.id_chofer ?? "",
      id_procedencia: prev.id_procedencia ?? "",
      id_destino: prev.id_destino ?? "",
    }));
  }, [loadAll]);

  useEffect(() => {
    if (!borradorListo) return;
    localStorage.setItem(BORRADOR_KEY, JSON.stringify(vista.current));
  }, [borradorListo, form, editId, editClienteId, editLocal]);

  useEffect(() => {
    function guardarVista() {
      if (!borradorListo) return;
      localStorage.setItem(BORRADOR_KEY, JSON.stringify(vista.current));
    }
    function alOcultar() {
      if (document.visibilityState === "hidden") guardarVista();
    }
    window.addEventListener("pagehide", guardarVista);
    document.addEventListener("visibilitychange", alOcultar);
    return () => {
      window.removeEventListener("pagehide", guardarVista);
      document.removeEventListener("visibilitychange", alOcultar);
    };
  }, [borradorListo]);

  useEffect(() => {
    function bloquearRecarga(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    function bloquearTecla(event) {
      const tecla = String(event.key || "").toLowerCase();
      const recarga = event.key === "F5" || ((event.ctrlKey || event.metaKey) && tecla === "r");
      if (!recarga) return;
      event.preventDefault();
      event.stopPropagation();
    }

    function inicioToque(event) {
      inicioY = event.touches?.[0]?.clientY ?? 0;
    }

    function frenarJalón(event) {
      const y = event.touches?.[0]?.clientY ?? 0;
      const panel = document.querySelector("main > :last-child");
      const arriba = !panel || panel.scrollTop <= 0;
      if (arriba && y > inicioY) event.preventDefault();
    }

    let inicioY = 0;
    const esTactil = window.matchMedia("(pointer: coarse)").matches;
    document.documentElement.classList.add("sima-sin-recarga");
    if (!esTactil) window.addEventListener("beforeunload", bloquearRecarga);
    window.addEventListener("keydown", bloquearTecla, true);
    document.addEventListener("touchstart", inicioToque, { passive: true });
    document.addEventListener("touchmove", frenarJalón, { passive: false });
    return () => {
      document.documentElement.classList.remove("sima-sin-recarga");
      if (!esTactil) window.removeEventListener("beforeunload", bloquearRecarga);
      window.removeEventListener("keydown", bloquearTecla, true);
      document.removeEventListener("touchstart", inicioToque);
      document.removeEventListener("touchmove", frenarJalón);
    };
  }, []);

  useEffect(() => {
    function alReconectar() {
      setOffline(false);
      loadAll();
    }
    function alDesconectar() {
      setOffline(true);
    }
    function alSincronizar(event) {
      const registros = Array.isArray(event.detail?.registros) ? event.detail.registros : [];
      const agregados = registros
        .filter((op) => op.tipo === "crear")
        .map((op) => ({ ...filaLocal(op, catalogosRef.current), cliente_id: op.cliente_id }));
      if (agregados.length > 0) {
        setConfirmados(agregados);
        setAvisoAbierto(true);
      }
      alReconectar();
    }
    window.addEventListener("online", alReconectar);
    window.addEventListener("offline", alDesconectar);
    window.addEventListener("sima-synced", alSincronizar);
    return () => {
      window.removeEventListener("online", alReconectar);
      window.removeEventListener("offline", alDesconectar);
      window.removeEventListener("sima-synced", alSincronizar);
    };
  }, [loadAll]);

  function mostrarDia(fecha) {
    const dia = String(fecha || "").slice(0, 10);
    if (!dia) return;
    setFechaVista(dia);
    setVerTodas(false);
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "fecha") mostrarDia(value);
  }

  function setTransporte(value) {
    setForm((prev) => ({
      ...prev,
      id_transporte: value,
      transporte: value === MANUAL ? prev.transporte : "",
    }));
  }

  function setChofer(value) {
    setForm((prev) => ({
      ...prev,
      id_chofer: value,
      chofer: value === MANUAL ? prev.chofer : "",
    }));
  }

  function startEdit(row) {
    setEditId(row.id_llegada);
    setEditClienteId(row.cliente_id || null);
    setEditLocal(Boolean(row.pendiente) && String(row.id_llegada).startsWith("local-"));
    const nombreCamion = row.transporte || row.numero || "";
    setForm({
      id_transporte: row.id_transporte ? String(row.id_transporte) : nombreCamion ? MANUAL : "",
      transporte: row.id_transporte ? "" : nombreCamion,
      fecha: row.fecha,
      turno: row.turno || "",
      hora_entrada: horaCorta(row.hora_entrada),
      id_procedencia: row.id_procedencia ? String(row.id_procedencia) : "",
      personas_entrada: String(row.personas_entrada),
      hora_salida: horaCorta(row.hora_salida),
      id_destino: row.id_destino ? String(row.id_destino) : "",
      personas_salida: String(row.personas_salida),
      id_chofer: row.id_chofer ? String(row.id_chofer) : row.chofer ? MANUAL : "",
      chofer: row.id_chofer ? "" : row.chofer || "",
    });
    setSuccess("");
    setError("");
  }

  function cancelEdit() {
    setEditId(null);
    setEditClienteId(null);
    setEditLocal(false);
    setForm(emptyForm());
  }

  function guardarEnEquipo(payload) {
    if (editLocal || !editId) {
      encolarLlegada({ tipo: "crear", cliente_id: payload.cliente_id, payload });
    } else {
      encolarLlegada({
        tipo: "actualizar",
        cliente_id: payload.cliente_id,
        id_llegada: editId,
        payload,
      });
    }
    pintarLocal();
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const cliente_id = editClienteId || nuevoClienteId();
    const camionManual = form.id_transporte === MANUAL;
    const choferManual = form.id_chofer === MANUAL;
    const nombreCamion = String(form.transporte || "").trim();
    const nombreChofer = String(form.chofer || "").trim();
    if (!camionManual && !form.id_transporte) {
      setError("Seleccione el camión o escríbalo manualmente");
      setSaving(false);
      return;
    }
    if (camionManual && !nombreCamion) {
      setError("Escriba el nombre o número del camión");
      setSaving(false);
      return;
    }
    if (!choferManual && !form.id_chofer) {
      setError("Seleccione el chofer o escríbalo manualmente");
      setSaving(false);
      return;
    }
    if (choferManual && !nombreChofer) {
      setError("Escriba el nombre del chofer");
      setSaving(false);
      return;
    }
    const payload = {
      ...form,
      cliente_id,
      id_procedencia: form.id_procedencia ? Number(form.id_procedencia) : null,
      id_destino: Number(form.id_destino),
      id_transporte: camionManual ? null : Number(form.id_transporte),
      transporte: camionManual ? nombreCamion : "",
      numero: camionManual ? nombreCamion : transporteActual?.numero || "",
      id_chofer: choferManual ? null : Number(form.id_chofer),
      chofer: choferManual ? nombreChofer : choferActual?.nombre || "",
      personas_entrada: Number(form.personas_entrada),
      personas_salida: Number(form.personas_salida),
    };

    if (editLocal || navigator.onLine === false) {
      guardarEnEquipo(payload);
      mostrarDia(payload.fecha);
      setSuccess("Guardado en este equipo. Se subirá a la base al volver la conexión.");
      cancelEdit();
      setSaving(false);
      if (navigator.onLine) sincronizarOutbox().then(() => loadAll());
      return;
    }

    try {
      const response = await fetch(editId ? `/api/llegadas/${editId}` : "/api/llegadas", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo guardar");
        return;
      }
      setSuccess(data.message || "Guardado");
      mostrarDia(data.data?.fecha || payload.fecha);
      cancelEdit();
      loadAll();
    } catch {
      guardarEnEquipo(payload);
      mostrarDia(payload.fecha);
      setOffline(true);
      setSuccess("Sin conexión con el servidor. El viaje quedó en este equipo y se subirá al reconectar.");
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    const etiqueta = row.numero ? `el viaje de ${row.numero}` : "este registro";
    if (!window.confirm(`¿Eliminar ${etiqueta}?`)) return;
    setError("");
    setSuccess("");
    const local = Boolean(row.pendiente) && String(row.id_llegada).startsWith("local-");
    if (local || navigator.onLine === false) {
      encolarEliminacion(row);
      if (editId === row.id_llegada) cancelEdit();
      pintarLocal();
      setSuccess(local ? "Eliminado de este equipo." : "Se eliminará en la base al volver la conexión.");
      if (!local && navigator.onLine) sincronizarOutbox().then(() => loadAll());
      return;
    }
    try {
      const response = await fetch(`/api/llegadas/${row.id_llegada}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo eliminar");
        return;
      }
      if (editId === row.id_llegada) cancelEdit();
      setSuccess(data.message || "Eliminado");
      loadAll();
    } catch {
      encolarEliminacion(row);
      if (editId === row.id_llegada) cancelEdit();
      pintarLocal();
      setOffline(true);
      setSuccess("Sin conexión. La baja quedó pendiente y se enviará al reconectar.");
    }
  }

  async function subirAhora() {
    setError("");
    const resultado = await sincronizarOutbox();
    if (resultado.offline) {
      setOffline(true);
      setError("Sigue sin conexión. Los viajes esperan en este equipo.");
      return;
    }
    if (resultado.error) setError(resultado.error);
    else if ((resultado.registros || []).some((op) => op.tipo === "crear")) {
      setSuccess("");
    } else if (resultado.subidos > 0) {
      setSuccess(resultado.subidos === 1 ? "Se subió 1 viaje." : `Se subieron ${resultado.subidos} viajes.`);
    }
    loadAll();
  }

  const filasVisibles = !verTodas && fechaVista
    ? rows.filter((row) => String(row.fecha || "").slice(0, 10) === fechaVista)
    : rows;
  const diaConfirmado = confirmados.every((row) => String(row.fecha || "").slice(0, 10) === String(confirmados[0]?.fecha || "").slice(0, 10))
    ? String(confirmados[0]?.fecha || "").slice(0, 10)
    : "";

  const sobreCapacidad =
    transporteActual &&
    form.personas_entrada !== "" &&
    Number(form.personas_entrada) > Number(transporteActual.capacidad);

  return (
    <DashboardShell selectedItemId="llenado">
      <Box sx={{ width: "100%", maxWidth: "100%" }}>
        <Typography variant="h5" sx={{ ...pageTitleSx, mb: 0.25 }}>
          Llenado de datos
        </Typography>
        <Typography variant="body2" sx={{ ...pageSubtitleSx, mb: 1.25 }}>
          Registre cada viaje: qué transporte llegó, de dónde venía, a qué hora
          salió, cuántas personas iban y quién manejaba. En el iPad no jale la
          pantalla hacia abajo: Safari la recarga y puede duplicar el viaje.
        </Typography>

        {transportes.length === 0 && !loading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No hay camiones dados de alta. Puede escribir el nombre a mano; después aparecerá en Configuración para registrarlo.
          </Alert>
        )}
        {choferes.length === 0 && !loading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No hay choferes dados de alta. Puede escribir el nombre a mano; después aparecerá en Configuración para registrarlo.
          </Alert>
        )}
        {lugares.length === 0 && !loading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Primero dé de alta los lugares en Configuración, Lugares. Se usan en procedencia y destino.
          </Alert>
        )}
        {offline && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Sin conexión. Los viajes se guardan en este equipo y se suben a la base cuando vuelva la red.
          </Alert>
        )}
        {pendientes > 0 && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={subirAhora} sx={{ textTransform: "none" }}>
                Subir ahora
              </Button>
            }
          >
            {pendientes === 1
              ? "Hay 1 viaje pendiente de subir."
              : `Hay ${pendientes} viajes pendientes de subir.`}
          </Alert>
        )}
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
          sx={{ p: 1.25, mb: 1, border: `1px solid ${BRAND.border}` }}
        >
          <Typography sx={{ fontWeight: 700, mb: 1, color: BRAND.primary }}>
            {editId ? "Editar viaje" : "Nuevo viaje"}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" },
              gap: 1,
              "& .MuiFormHelperText-root": { mt: 0.25 },
            }}
          >
            <TextField
              select
              label="Transporte"
              sx={{ gridColumn: { xs: "1 / -1", sm: "span 2" } }}
              size="small"
              value={form.id_transporte ?? ""}
              onChange={(event) => setTransporte(event.target.value)}
              required
              helperText={
                transporteActual
                  ? `Capacidad: ${transporteActual.capacidad}`
                  : form.id_transporte === MANUAL
                    ? "No está dado de alta. Quedará como sugerencia en Configuración."
                    : undefined
              }
              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
            >
              <MenuItem value="" disabled>
                Seleccione
              </MenuItem>
              {transportes.map((row) => (
                <MenuItem key={row.id_transporte} value={String(row.id_transporte)}>
                  {row.numero} · {row.tipo}
                </MenuItem>
              ))}
              <MenuItem value={MANUAL}>Escribir manualmente</MenuItem>
            </TextField>
            {form.id_transporte === MANUAL && (
              <TextField
                label="Nombre o número del camión"
                sx={{ gridColumn: { xs: "1 / -1", sm: "span 2" } }}
                size="small"
                value={form.transporte}
                onChange={(event) => setField("transporte", event.target.value)}
                required
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
            <TextField
              label="Fecha"
              type="date"
              size="small"
              value={form.fecha}
              onChange={(event) => setField("fecha", event.target.value)}
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label="Turno"
              size="small"
              value={form.turno ?? ""}
              onChange={(event) => setField("turno", event.target.value)}
              required
              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
            >
              <MenuItem value="" disabled>
                Seleccione
              </MenuItem>
              {TURNOS.map((turno) => (
                <MenuItem key={turno} value={turno}>
                  {turno}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Chofer"
              sx={{ gridColumn: { xs: "1 / -1", sm: "span 2" } }}
              size="small"
              value={form.id_chofer ?? ""}
              onChange={(event) => setChofer(event.target.value)}
              required
              helperText={
                choferActual
                  ? `Teléfono: ${choferActual.telefono}`
                  : form.id_chofer === MANUAL
                    ? "No está dado de alta. Quedará como sugerencia en Configuración."
                    : undefined
              }
              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
            >
              <MenuItem value="" disabled>
                Seleccione
              </MenuItem>
              {choferes.map((row) => (
                <MenuItem key={row.id_chofer} value={String(row.id_chofer)}>
                  {row.nombre}
                </MenuItem>
              ))}
              <MenuItem value={MANUAL}>Escribir manualmente</MenuItem>
            </TextField>
            {form.id_chofer === MANUAL && (
              <TextField
                label="Nombre del chofer"
                sx={{ gridColumn: { xs: "1 / -1", sm: "span 2" } }}
                size="small"
                value={form.chofer}
                onChange={(event) => setField("chofer", event.target.value)}
                required
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
            <TextField
              label="Hora de entrada"
              type="time"
              size="small"
              value={form.hora_entrada}
              onChange={(event) => setField("hora_entrada", event.target.value)}
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Hora de salida"
              type="time"
              size="small"
              value={form.hora_salida}
              onChange={(event) => setField("hora_salida", event.target.value)}
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label="Procedencia de entrada"
              size="small"
              value={form.id_procedencia ?? ""}
              onChange={(event) => setField("id_procedencia", event.target.value)}
              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
            >
              <MenuItem value="">NA</MenuItem>
              {lugares.map((row) => (
                <MenuItem key={`origen-${row.id_lugar}`} value={String(row.id_lugar)}>
                  {row.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Destino"
              size="small"
              value={form.id_destino ?? ""}
              onChange={(event) => setField("id_destino", event.target.value)}
              required
              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
            >
              <MenuItem value="" disabled>
                Seleccione
              </MenuItem>
              {lugares.map((row) => (
                <MenuItem key={`destino-${row.id_lugar}`} value={String(row.id_lugar)}>
                  {row.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Personas de entrada"
              type="number"
              size="small"
              value={form.personas_entrada}
              onChange={(event) => setField("personas_entrada", event.target.value)}
              required
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0, step: 1 } }}
              error={Boolean(sobreCapacidad)}
              helperText={sobreCapacidad ? "Supera la capacidad del transporte" : undefined}
            />
            <TextField
              label="Personas de salida"
              type="number"
              size="small"
              value={form.personas_salida}
              onChange={(event) => setField("personas_salida", event.target.value)}
              required
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0, step: 1 } }}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Add />}
              disabled={saving || lugares.length === 0}
              sx={{ textTransform: "none" }}
            >
              {saving ? "Guardando..." : offline ? "Guardar en este equipo" : editId ? "Guardar" : "Registrar"}
            </Button>
            {editId && (
              <Button type="button" variant="outlined" onClick={cancelEdit} sx={{ textTransform: "none" }}>
                Cancelar
              </Button>
            )}
          </Box>
        </Paper>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
          <TextField
            label="Ver día"
            type="date"
            size="small"
            value={fechaVista}
            onChange={(event) => {
              setFechaVista(event.target.value);
              setVerTodas(false);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 180 }}
          />
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => {
              setVerTodas(false);
              setFechaVista(todayInput());
            }}
            sx={{ textTransform: "none" }}
          >
            Hoy
          </Button>
          <Button
            type="button"
            variant={verTodas ? "contained" : "outlined"}
            size="small"
            onClick={() => setVerTodas(true)}
            sx={{ textTransform: "none" }}
          >
            Todas
          </Button>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {verTodas
              ? `${filasVisibles.length} viaje${filasVisibles.length === 1 ? "" : "s"} en total`
              : fechaVista
                ? `${filasVisibles.length} viaje${filasVisibles.length === 1 ? "" : "s"} en esta fecha`
                : "Elija un día"}
          </Typography>
        </Box>

        <TableContainer component={Paper} sx={{ border: `1px solid ${BRAND.border}`, width: "100%", overflowX: "auto" }}>
          <Table
            size="small"
            sx={{
              width: "100%",
              tableLayout: "fixed",
              "& .MuiTableCell-root": {
                px: 0.6,
                py: 0.55,
                fontSize: "0.75rem",
                lineHeight: 1.2,
                whiteSpace: "normal",
                wordBreak: "break-word",
              },
            }}
          >
            <TableHead>
              <TableRow sx={tableHeadRowSx}>
                <TableCell sx={{ ...tableHeadCellSx, width: "8%" }}>Fecha</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "5%" }}>Turno</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "7%" }}>Unidad</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "6%" }}>Entrada</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "12%" }}>Procedencia</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "7%" }}>Pers. ent.</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "6%" }}>Salida</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "12%" }}>Destino</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "7%" }}>Pers. sal.</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "12%" }}>Chofer</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "8%" }}>Sync</TableCell>
                <TableCell sx={{ ...tableHeadCellSx, width: "10%" }} align="right">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && filasVisibles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={tableEmptyCellSx}>
                    {!verTodas && fechaVista ? "No hay viajes en este día. Elija otra fecha o pulse Todas." : "No hay viajes registrados"}
                  </TableCell>
                </TableRow>
              )}
              {filasVisibles.map((row) => (
                <TableRow key={row.id_llegada} hover>
                  <TableCell>{row.fecha}</TableCell>
                  <TableCell>{row.turno || "—"}</TableCell>
                  <TableCell>{row.numero || "—"}</TableCell>
                  <TableCell>{horaCorta(row.hora_entrada)}</TableCell>
                  <TableCell>{row.procedencia}</TableCell>
                  <TableCell>
                    {row.personas_entrada}
                    {row.capacidad ? ` / ${row.capacidad}` : ""}
                  </TableCell>
                  <TableCell>{horaCorta(row.hora_salida)}</TableCell>
                  <TableCell>{row.destino}</TableCell>
                  <TableCell>{row.personas_salida}</TableCell>
                  <TableCell>{row.chofer}</TableCell>
                  <TableCell>
                    {row.pendiente ? (
                      <Chip size="small" label="Pendiente" color="warning" />
                    ) : (
                      <Chip size="small" label="Enviado" color="success" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <IconButton size="small" aria-label="Editar" onClick={() => startEdit(row)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" aria-label="Eliminar" onClick={() => remove(row)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={avisoAbierto} onClose={() => setAvisoAbierto(false)} fullWidth maxWidth="xs">
          <DialogTitle>
            {confirmados.length === 1 ? "Se agregó este registro" : `Se agregaron ${confirmados.length} registros`}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Volvió la conexión y estos viajes quedaron guardados en la base.
            </Typography>
            {confirmados.map((row) => (
              <Typography key={row.cliente_id || row.id_llegada} variant="body2" sx={{ py: 0.4 }}>
                Unidad {row.numero || "—"}, turno {row.turno || "—"}, {String(row.fecha || "").slice(0, 10)}{" "}
                {horaCorta(row.hora_entrada)}, {row.personas_entrada ?? "—"} personas, chofer {row.chofer || "—"}.
              </Typography>
            ))}
          </DialogContent>
          <DialogActions>
            {diaConfirmado && diaConfirmado !== fechaVista ? (
              <Button
                onClick={() => {
                  setVerTodas(false);
                  setFechaVista(diaConfirmado);
                  setAvisoAbierto(false);
                }}
                sx={{ textTransform: "none" }}
              >
                Ver ese día
              </Button>
            ) : null}
            <Button variant="contained" onClick={() => setAvisoAbierto(false)} sx={{ textTransform: "none" }}>
              Entendido
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardShell>
  );
}
