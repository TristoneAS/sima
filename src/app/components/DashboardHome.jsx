"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardShell from "./DashboardShell";

const MapaRutas = dynamic(() => import("./MapaRutas"), { ssr: false });
import PeriodoBar, { moverAncla } from "./PeriodoBar";
import { inicioSemana, parseFecha, rangoPeriodo, soloDia } from "@/app/lib/periodo";
import { PAGE_MAX_WIDTH, pageSubtitleSx, pageTitleSx } from "@/libs/table_ui";

const TURNOS = ["TA", "TB", "TC", "TE"];
const VIAJES_SEGUIDOS = 5;
const TOPE_AUTO = 5;
const TOPE_CAMIONETA = 16;

const COLOR_LLEGADAS = "#2563eb";
const COLOR_SALIDAS = "#dc2626";
const COLOR_TENDENCIA_LLEGADAS = "#1e3a8a";
const COLOR_TENDENCIA_SALIDAS = "#9f1239";

const DIAS = [
  { index: 1, label: "Lun" },
  { index: 2, label: "Mar" },
  { index: 3, label: "Mié" },
  { index: 4, label: "Jue" },
  { index: 5, label: "Vie" },
  { index: 6, label: "Sáb" },
  { index: 0, label: "Dom" },
];

function calcularTendencia(valores) {
  const muestras = [];
  for (let index = 0; index < valores.length; index += 1) {
    const y = valores[index];
    if (typeof y === "number" && Number.isFinite(y)) muestras.push({ x: index, y });
  }
  if (muestras.length < 2) return valores.map(() => null);

  const n = muestras.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const muestra of muestras) {
    sumX += muestra.x;
    sumY += muestra.y;
    sumXY += muestra.x * muestra.y;
    sumXX += muestra.x * muestra.x;
  }
  const denominador = n * sumXX - sumX * sumX;
  if (denominador === 0) return valores.map(() => null);
  const pendiente = (n * sumXY - sumX * sumY) / denominador;
  const origen = (sumY - pendiente * sumX) / n;
  return valores.map((_, index) => {
    const y = origen + pendiente * index;
    return Number.isFinite(y) ? Math.max(0, Math.round(y)) : null;
  });
}

function semanasDelMes(inicio, fin) {
  const semanas = [];
  let cursor = inicioSemana(inicio);
  while (cursor <= fin) {
    const finSemana = new Date(cursor);
    finSemana.setDate(cursor.getDate() + 6);
    const desde = cursor < inicio ? new Date(inicio) : new Date(cursor);
    const hasta = finSemana > fin ? new Date(fin) : finSemana;
    semanas.push({
      name: desde.getDate() === hasta.getDate() ? String(desde.getDate()) : `${desde.getDate()}–${hasta.getDate()}`,
      inicio: soloDia(desde),
      fin: soloDia(hasta),
    });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return semanas;
}

const MESES_EJE = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function mesesDelAnio(inicio) {
  const year = inicio.getFullYear();
  return MESES_EJE.map((name, month) => ({
    name,
    inicio: new Date(year, month, 1),
    fin: new Date(year, month + 1, 0),
  }));
}

function diasDelRango(inicio, fin) {
  const dias = [];
  const cursor = soloDia(inicio);
  const limite = soloDia(fin);
  while (cursor <= limite && dias.length < 62) {
    dias.push({
      name: `${cursor.getDate()} ${MESES_EJE[cursor.getMonth()].toLowerCase()}`,
      inicio: new Date(cursor),
      fin: new Date(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

function columnasDelPeriodo(periodo, inicio, fin) {
  if (periodo === "rango") return diasDelRango(inicio, fin);
  if (periodo === "mes") return semanasDelMes(inicio, fin);
  if (periodo === "anio") return mesesDelAnio(inicio);
  return DIAS.map((dia) => ({ name: dia.label, dia: dia.index }));
}

function claveRuta(id, nombre) {
  const limpio = String(nombre || "").trim();
  if (!limpio || limpio.toUpperCase() === "NA") return null;
  return id ? `id:${id}` : `nombre:${limpio.toLowerCase()}`;
}

function asegurarRuta(mapa, key, nombre, columnas) {
  if (!mapa.has(key)) {
    mapa.set(key, {
      id: key,
      nombre,
      viajes: [],
      porDia: columnas.map((columna) => ({
          name: columna.name,
          dia: columna.dia,
          inicio: columna.inicio,
          fin: columna.fin,
          Llegadas: null,
          Salidas: null,
        })),
      });
    }
  return mapa.get(key);
}

function consejoDeRuta(viajes) {
  const ordenados = [...viajes].sort((a, b) => a.orden.localeCompare(b.orden));
  let auto = false;
  let camioneta = false;
  for (let inicio = 0; inicio <= ordenados.length - VIAJES_SEGUIDOS; inicio += 1) {
    const seguidos = ordenados.slice(inicio, inicio + VIAJES_SEGUIDOS);
    if (seguidos.every((viaje) => viaje.personas < TOPE_AUTO)) auto = true;
    else if (seguidos.every((viaje) => viaje.personas < TOPE_CAMIONETA)) camioneta = true;
  }
  if (auto) {
    return {
      tipo: "auto",
      texto: "Cambiar por auto: hubo 5 viajes seguidos con menos de 5 personas.",
    };
  }
  if (camioneta) {
    return {
      tipo: "camioneta",
      texto: "Cambiar por camioneta: hubo 5 viajes seguidos con menos de 16 personas.",
    };
  }
  return null;
}

function seriesPorRuta(viajes, inicio, fin, periodo) {
  const columnas = columnasDelPeriodo(periodo, inicio, fin);
  const mapa = new Map();
  for (const row of viajes) {
    const fecha = parseFecha(row.fecha);
    if (!fecha || fecha < inicio || fecha > fin) continue;
    const orden = `${String(row.fecha).slice(0, 10)} ${row.hora_entrada || "00:00"} ${row.id_llegada || ""}`;
    const keyProcedencia = claveRuta(row.id_procedencia, row.procedencia);
    const keyDestino = claveRuta(row.id_destino, row.destino);
    const personasEntrada = Number(row.personas_entrada) || 0;
    const personasSalida = Number(row.personas_salida) || 0;
    if (keyProcedencia && keyProcedencia === keyDestino) {
      const ruta = asegurarRuta(mapa, keyProcedencia, String(row.procedencia || "").trim(), columnas);
      ruta.viajes.push({ orden, personas: Math.max(personasEntrada, personasSalida) });
    } else {
      if (keyProcedencia) {
        const ruta = asegurarRuta(mapa, keyProcedencia, String(row.procedencia || "").trim(), columnas);
        ruta.viajes.push({ orden, personas: personasEntrada });
      }
      if (keyDestino) {
        const ruta = asegurarRuta(mapa, keyDestino, String(row.destino || "").trim(), columnas);
        ruta.viajes.push({ orden, personas: personasSalida });
      }
    }
    const aportes = [
      {
        key: claveRuta(row.id_procedencia, row.procedencia),
        nombre: String(row.procedencia || "").trim(),
        campo: "Llegadas",
        personas: Number(row.personas_entrada) || 0,
      },
      {
        key: claveRuta(row.id_destino, row.destino),
        nombre: String(row.destino || "").trim(),
        campo: "Salidas",
        personas: Number(row.personas_salida) || 0,
      },
    ];
    for (const aporte of aportes) {
      if (!aporte.key) continue;
      const ruta = asegurarRuta(mapa, aporte.key, aporte.nombre, columnas);
      const punto = ruta.porDia.find((item) =>
        item.inicio && item.fin ? fecha >= item.inicio && fecha <= item.fin : item.dia === fecha.getDay(),
      );
      if (!punto) continue;
      if (punto[aporte.campo] == null) punto[aporte.campo] = 0;
      punto[aporte.campo] += aporte.personas;
    }
  }

  return [...mapa.values()]
    .map((ruta) => {
      const tendenciaLlegadas = calcularTendencia(ruta.porDia.map((punto) => punto.Llegadas));
      const tendenciaSalidas = calcularTendencia(ruta.porDia.map((punto) => punto.Salidas));
      const porDia = ruta.porDia.map((punto, index) => ({
        ...punto,
        "Tendencia llegadas": punto.Llegadas == null ? null : tendenciaLlegadas[index],
        "Tendencia salidas": punto.Salidas == null ? null : tendenciaSalidas[index],
      }));
      const { viajes, ...resto } = ruta;
      return {
        ...resto,
        consejo: consejoDeRuta(viajes),
        porDia,
        totalLlegadas: porDia.reduce((suma, punto) => suma + (punto.Llegadas || 0), 0),
        totalSalidas: porDia.reduce((suma, punto) => suma + (punto.Salidas || 0), 0),
      };
    })
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { numeric: true }));
}

function puntosGuardados(ruta, lugares) {
  const id = String(ruta.id).startsWith("id:") ? String(ruta.id).slice(3) : "";
  const lugar = id
    ? lugares.find((row) => String(row.id_lugar) === id)
    : lugares.find(
        (row) => String(row.nombre).trim().toLowerCase() === String(ruta.nombre).trim().toLowerCase(),
      );
  return Array.isArray(lugar?.ruta) && lugar.ruta.length >= 2 ? lugar.ruta : [];
}

function GraficaRuta({ ruta, puntos }) {
  const titulo = ruta.nombre;
  const recorrido = puntos.length >= 2;
  const etiquetasLargas = ruta.porDia.length > 10 && /\d/.test(String(ruta.porDia[0]?.name || ""));
  return (
    <Card variant="outlined" sx={{ borderColor: "#bfdbfe", borderRadius: 2, bgcolor: "#fff" }}>
      <CardContent sx={{ pb: "12px !important" }}>
        <Typography sx={{ fontWeight: 800, color: "#1e3a5f" }}>{titulo}</Typography>
        <Typography sx={{ color: "#64748b", fontSize: "0.8rem", mb: 1 }}>
          {ruta.totalLlegadas === 1 ? "1 persona al llegar" : `${ruta.totalLlegadas} personas al llegar`}
          {" · "}
          {ruta.totalSalidas === 1 ? "1 al salir" : `${ruta.totalSalidas} al salir`}
        </Typography>
        {ruta.consejo && (
          <Alert severity="error" sx={{ mb: 1, py: 0.25 }}>
            {ruta.consejo.texto}
          </Alert>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(280px, 0.85fr)" },
            gap: 1.5,
            alignItems: "stretch",
          }}
        >
        <Box sx={{ width: "100%", height: etiquetasLargas ? 330 : 300, minWidth: 0 }}>
          <ResponsiveContainer>
            <LineChart data={ruta.porDia} margin={{ top: 8, right: 16, left: 0, bottom: etiquetasLargas ? 16 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                interval={0}
                angle={etiquetasLargas ? -45 : 0}
                textAnchor={etiquetasLargas ? "end" : "middle"}
                height={etiquetasLargas ? 64 : 30}
                tick={{ fontSize: 11, fill: "#475569" }}
              />
              <YAxis tick={{ fontSize: 11, fill: "#475569" }} width={40} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#cbd5e1" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Llegadas"
                stroke={COLOR_LLEGADAS}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="Salidas"
                stroke={COLOR_SALIDAS}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                type="linear"
                dataKey="Tendencia llegadas"
                stroke={COLOR_TENDENCIA_LLEGADAS}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={false}
                connectNulls
                legendType="plainline"
              />
              <Line
                type="linear"
                dataKey="Tendencia salidas"
                stroke={COLOR_TENDENCIA_SALIDAS}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={false}
                connectNulls
                legendType="plainline"
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Box
          sx={{
            height: 300,
            minWidth: 0,
            borderRadius: 1,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            bgcolor: "#f8fafc",
          }}
        >
          {recorrido ? (
            <MapaRutas
              rutas={[
                {
                  id_ruta: ruta.id,
                  visible: true,
                  color: "#7c3aed",
                  lineas: [{ puntos }],
                },
              ]}
              seleccionId={ruta.id}
              borrador={[]}
              dibujando={false}
              encuadrar
              soloLectura
              altura={300}
            />
          ) : (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                textAlign: "center",
                color: "#64748b",
                fontSize: "0.9rem",
              }}
            >
              Esta ruta todavía no tiene recorrido. Se traza en Configuración, Lugares.
            </Box>
          )}
        </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardHome() {
  const [viajes, setViajes] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState("semana");
  const [ancla, setAncla] = useState(null);
  const [buscaRuta, setBuscaRuta] = useState("");
  const [buscaTurno, setBuscaTurno] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    setAncla(new Date());
    let cancelado = false;
    Promise.all([
      fetch("/api/llegadas").then((res) => res.json()),
      fetch("/api/lugares").then((res) => res.json()),
    ])
      .then(([viajesData, lugaresData]) => {
        if (cancelado) return;
        if (!viajesData?.success) {
          setError(viajesData?.error || "No se pudieron cargar los viajes");
          setViajes([]);
        } else {
          setViajes(viajesData.data || []);
        }
        setLugares(lugaresData?.success ? lugaresData.data || [] : []);
      })
      .catch(() => {
        if (!cancelado) setError("No se pudo conectar con el servidor");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const opcionesTurno = useMemo(() => {
    const extras = viajes
      .map((row) => String(row.turno || "").trim())
      .filter((turno) => turno && !TURNOS.includes(turno));
    return [...TURNOS, ...new Set(extras)];
  }, [viajes]);

  const viajesFiltrados = useMemo(() => {
    const turno = buscaTurno.trim().toLowerCase();
    if (!turno) return viajes;
    return viajes.filter((row) => String(row.turno || "").toLowerCase().includes(turno));
  }, [viajes, buscaTurno]);

  const rango = useMemo(() => {
    const inicio = parseFecha(desde);
    const fin = parseFecha(hasta);
    if (!inicio || !fin) return { activo: false, invalido: false, largo: false };
    if (inicio > fin) return { activo: false, invalido: true, largo: false };
    const dias = Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1;
    if (dias > 62) return { activo: false, invalido: false, largo: true };
    return { activo: true, inicio, fin, invalido: false, largo: false };
  }, [desde, hasta]);

  const rutas = useMemo(() => {
    if (!ancla && !rango.activo) return [];
    const { inicio, fin } = rango.activo ? rango : rangoPeriodo(ancla, periodo);
    return seriesPorRuta(viajesFiltrados, inicio, fin, rango.activo ? "rango" : periodo);
  }, [viajesFiltrados, ancla, periodo, rango]);

  const rutasVisibles = useMemo(() => {
    const consulta = buscaRuta.trim().toLowerCase();
    if (!consulta) return rutas;
    return rutas.filter((ruta) => ruta.nombre.toLowerCase().includes(consulta));
  }, [rutas, buscaRuta]);

  return (
    <DashboardShell selectedItemId="graficas">
      <Box sx={{ maxWidth: PAGE_MAX_WIDTH, mx: "auto", width: "100%" }}>
        <Typography variant="h5" sx={pageTitleSx}>
          Panel de aforo
        </Typography>
        <Typography variant="body2" sx={{ ...pageSubtitleSx, mb: 1.5 }}>
          A la izquierda, las personas de cada ruta. A la derecha, el recorrido guardado en el mapa.
        </Typography>

        <PeriodoBar
          periodo={periodo}
          ancla={ancla}
          onPeriodo={(value) => {
            setPeriodo(value);
            setDesde("");
            setHasta("");
          }}
          onMover={(sentido) => {
            setDesde("");
            setHasta("");
            setAncla((prev) => moverAncla(prev, periodo, sentido));
          }}
        />

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", mb: 2 }}>
          <TextField
            label="Desde"
            type="date"
            size="small"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 170 }}
          />
          <TextField
            label="Hasta"
            type="date"
            size="small"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 170 }}
          />
          {(desde || hasta) && (
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={() => {
                setDesde("");
                setHasta("");
              }}
              sx={{ textTransform: "none" }}
            >
              Quitar fechas
            </Button>
          )}
        </Box>

        {rango.invalido && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            La fecha final es anterior a la inicial.
          </Alert>
        )}
        {rango.largo && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Elija un rango de hasta 62 días para ver cada día abajo.
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
          <Autocomplete
            freeSolo
            options={rutas.map((ruta) => ruta.nombre)}
            value={buscaRuta}
            inputValue={buscaRuta}
            onChange={(_event, value) => setBuscaRuta(value || "")}
            onInputChange={(_event, value, reason) => {
              if (reason === "reset") return;
              setBuscaRuta(value || "");
            }}
            sx={{ minWidth: 240, flex: 1 }}
            renderInput={(params) => (
              <TextField {...params} label="Buscar ruta" size="small" placeholder="Todas las rutas" />
            )}
          />
          <Autocomplete
            freeSolo
            options={opcionesTurno}
            value={buscaTurno}
            inputValue={buscaTurno}
            onChange={(_event, value) => setBuscaTurno(value || "")}
            onInputChange={(_event, value, reason) => {
              if (reason === "reset") return;
              setBuscaTurno(value || "");
            }}
            sx={{ minWidth: 200, width: { sm: 220 } }}
            renderInput={(params) => (
              <TextField {...params} label="Buscar turno" size="small" placeholder="Todos los turnos" />
            )}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && rutas.length === 0 && (
          <Alert severity="info">
            {buscaTurno.trim()
              ? "No hay viajes de ese turno en este periodo."
              : "No hay viajes en este periodo."}
          </Alert>
        )}

        {!loading && rutas.length > 0 && rutasVisibles.length === 0 && (
          <Alert severity="info">Ninguna ruta coincide con la búsqueda.</Alert>
        )}

        {rutasVisibles.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {rutasVisibles.map((ruta) => (
              <GraficaRuta key={ruta.id} ruta={ruta} puntos={puntosGuardados(ruta, lugares)} />
            ))}
          </Box>
        )}
      </Box>
    </DashboardShell>
  );
}
