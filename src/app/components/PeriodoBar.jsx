"use client";

import { Box, IconButton, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { etiquetaPeriodo, moverPeriodo } from "@/app/lib/periodo";
import { BRAND } from "@/libs/theme_palette";

export default function PeriodoBar({ periodo, ancla, onPeriodo, onMover }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 2 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={periodo}
        onChange={(_event, value) => {
          if (value) onPeriodo(value);
        }}
        sx={{
          "& .MuiToggleButton-root": { textTransform: "none", px: 1.5 },
          "& .Mui-selected": { bgcolor: `${BRAND.soft} !important`, color: BRAND.primaryDeep, fontWeight: 700 },
        }}
      >
        <ToggleButton value="semana">Semana</ToggleButton>
        <ToggleButton value="mes">Mes</ToggleButton>
        <ToggleButton value="anio">Año</ToggleButton>
      </ToggleButtonGroup>
      <IconButton aria-label="Periodo anterior" onClick={() => onMover(-1)} disabled={!ancla}>
        <ChevronLeft />
      </IconButton>
      <Typography sx={{ fontWeight: 800, minWidth: 160, textAlign: "center" }}>
        {ancla ? etiquetaPeriodo(ancla, periodo) : "…"}
      </Typography>
      <IconButton aria-label="Periodo siguiente" onClick={() => onMover(1)} disabled={!ancla}>
        <ChevronRight />
      </IconButton>
    </Box>
  );
}

export function moverAncla(ancla, periodo, sentido) {
  return moverPeriodo(ancla || new Date(), periodo, sentido);
}
