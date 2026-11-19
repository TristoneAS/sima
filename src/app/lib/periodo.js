const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function soloDia(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseFecha(value) {
  const [year, month, day] = String(value || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function inicioSemana(date) {
  const dia = soloDia(date);
  const offset = dia.getDay() === 0 ? -6 : 1 - dia.getDay();
  dia.setDate(dia.getDate() + offset);
  return dia;
}

export function rangoPeriodo(ancla, periodo) {
  const dia = soloDia(ancla);
  if (periodo === "mes") {
    return {
      inicio: new Date(dia.getFullYear(), dia.getMonth(), 1),
      fin: new Date(dia.getFullYear(), dia.getMonth() + 1, 0),
    };
  }
  if (periodo === "anio") {
    return {
      inicio: new Date(dia.getFullYear(), 0, 1),
      fin: new Date(dia.getFullYear(), 11, 31),
    };
  }
  const inicio = inicioSemana(dia);
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  return { inicio, fin };
}

export function moverPeriodo(ancla, periodo, sentido) {
  const dia = soloDia(ancla);
  if (periodo === "mes") {
    return new Date(dia.getFullYear(), dia.getMonth() + sentido, 1);
  }
  if (periodo === "anio") {
    return new Date(dia.getFullYear() + sentido, 0, 1);
  }
  const inicio = inicioSemana(dia);
  inicio.setDate(inicio.getDate() + sentido * 7);
  return inicio;
}

export function etiquetaPeriodo(ancla, periodo) {
  const { inicio, fin } = rangoPeriodo(ancla, periodo);
  if (periodo === "anio") return String(inicio.getFullYear());
  if (periodo === "mes") {
    const nombre = MESES[inicio.getMonth()];
    return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${inicio.getFullYear()}`;
  }
  const mismoMes = inicio.getMonth() === fin.getMonth();
  const izquierda = mismoMes
    ? `${inicio.getDate()}`
    : `${inicio.getDate()} ${MESES_CORTOS[inicio.getMonth()]}`;
  return `${izquierda}–${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]} ${fin.getFullYear()}`;
}
