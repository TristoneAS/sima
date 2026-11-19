"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppBar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  EditNote,
  ExpandLess,
  ExpandMore,
  Home,
  LocalShipping,
  Logout,
  Menu,
  MenuOpen,
  Person,
  Place,
  ManageAccounts,
  Settings,
} from "@mui/icons-material";
import { clearSession, readSession } from "@/app/lib/session";
import { BRAND } from "@/libs/theme_palette";

const drawerWidth = 260;
const MENU_KEY = "sima_menu_abierto";
const PAGINAS_CONFIG = new Set(["transporte", "choferes", "lugares", "usuarios", "rutas"]);

const menuItems = [
  {
    id: "graficas",
    title: "Dashboard",
    description: "Panel de aforo",
    icon: Home,
    route: "/dashboard",
  },
  {
    id: "llenado",
    title: "Llenado de datos",
    description: "Registro de llegadas",
    icon: EditNote,
    route: "/dashboard/llenado",
  },
  {
    id: "configuracion",
    title: "Configuración",
    description: "Catálogos del sistema",
    icon: Settings,
    hasSubmenu: true,
    submenu: [
      {
        id: "transporte",
        title: "Transporte",
        icon: LocalShipping,
        route: "/dashboard/configuracion/transporte",
      },
      {
        id: "choferes",
        title: "Choferes",
        icon: Person,
        route: "/dashboard/configuracion/choferes",
      },
      {
        id: "lugares",
        title: "Lugares",
        icon: Place,
        route: "/dashboard/configuracion/lugares",
      },
      {
        id: "usuarios",
        title: "Usuarios",
        icon: ManageAccounts,
        route: "/dashboard/configuracion/usuarios",
      },
    ],
  },
];

function windowTitle(selectedItemId) {
  if (selectedItemId === "graficas") return "Gráficas";
  if (selectedItemId === "llenado") return "Llenado de datos";
  if (selectedItemId === "transporte") return "Transporte";
  if (selectedItemId === "choferes") return "Choferes";
  if (selectedItemId === "lugares") return "Lugares";
  if (selectedItemId === "usuarios") return "Usuarios";
  return "Dashboard";
}

export default function DashboardShell({ selectedItemId, children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [configuracion, setConfiguracion] = useState(true);
  const [abiertos, setAbiertos] = useState({
    configuracion:
      selectedItemId === "transporte" ||
      selectedItemId === "choferes" ||
      selectedItemId === "lugares" ||
      selectedItemId === "usuarios",
  });
  const [menuOpen, setMenuOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(MENU_KEY);
    if (saved === "0" || saved === "1") {
      setMenuOpen(saved === "1");
      return;
    }
    setMenuOpen(window.innerWidth >= 1280);
  }, []);

  function toggleMenu() {
    setMenuOpen((open) => {
      localStorage.setItem(MENU_KEY, open ? "0" : "1");
      return !open;
    });
  }

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace("/");
      return;
    }
    const permite = session.configuracion !== false;
    setUsername(session.username);
    setConfiguracion(permite);
    if (!permite && PAGINAS_CONFIG.has(selectedItemId)) {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
  }, [router, selectedItemId]);

  async function logout() {
    try {
      await fetch("/api/sesion", { method: "DELETE" });
    } catch {
      // La sesión local se cierra aunque el servidor no responda.
    }
    clearSession();
    router.replace("/");
  }

  if (!ready) {
    return <Box sx={{ minHeight: "100vh", bgcolor: BRAND.bg }} />;
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          width: menuOpen ? `calc(100% - ${drawerWidth}px)` : "100%",
          ml: menuOpen ? `${drawerWidth}px` : 0,
          transition: "width 0.2s ease, margin 0.2s ease",
          background: `linear-gradient(90deg, ${BRAND.primaryDark}, ${BRAND.primary})`,
          boxShadow: `0 2px 12px ${BRAND.glow}`,
          "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: 4,
            background: `linear-gradient(90deg, ${BRAND.primaryDeep}, ${BRAND.primary}, ${BRAND.amber})`,
          },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 48, sm: 56 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={toggleMenu}
            aria-label={menuOpen ? "Ocultar menú" : "Mostrar menú"}
            sx={{ mr: 1, color: "#fff" }}
          >
            {menuOpen ? <MenuOpen /> : <Menu />}
          </IconButton>
          <Typography sx={{ flexGrow: 1, fontWeight: 800, color: "#fff" }}>
            SIMA - {windowTitle(selectedItemId)}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: "0.9rem" }}>
            {username}
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: menuOpen ? drawerWidth : 0,
          flexShrink: 0,
          transition: "width 0.2s ease",
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: BRAND.navy,
            color: BRAND.paper,
            borderRight: `1px solid ${BRAND.border}`,
            transform: menuOpen ? "none" : `translateX(-${drawerWidth}px)`,
            transition: "transform 0.2s ease",
          },
        }}
      >
        <Toolbar
          onClick={() => router.push("/dashboard")}
          sx={{
            justifyContent: "center",
            cursor: "pointer",
            minHeight: 72,
            py: 1,
            borderBottom: `3px solid ${BRAND.primary}`,
            "&:hover": { bgcolor: BRAND.hover },
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 180,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/tristone_logo_head.png"
              alt="Tristone"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                mixBlendMode: "screen",
              }}
            />
          </Box>
        </Toolbar>

        <List sx={{ flex: 1, pt: 2, px: 1 }}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              px: 1.5,
              py: 0.75,
              color: BRAND.muted,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              fontSize: "0.68rem",
            }}
          >
            SIMA
          </Typography>
          {(configuracion ? menuItems : menuItems.filter((item) => item.id !== "configuracion")).map((item) => {
            const Icon = item.icon;
            const isSelected = item.hasSubmenu
              ? item.submenu.some((sub) => sub.id === selectedItemId)
              : selectedItemId === item.id;

            return (
              <Box key={item.id}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => {
                      if (item.hasSubmenu) {
                        setAbiertos((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                        return;
                      }
                      if (item.route !== undefined && selectedItemId !== item.id) {
                        router.push(item.route);
                      }
                    }}
                    sx={{
                      borderRadius: 1.5,
                      background: isSelected
                        ? `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)`
                        : "transparent",
                      boxShadow: isSelected ? `0 8px 20px ${BRAND.glow}` : "none",
                      "&:hover": {
                        background: isSelected
                          ? `linear-gradient(135deg, ${BRAND.primaryDeep} 0%, ${BRAND.primaryDark} 100%)`
                          : BRAND.hover,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: isSelected ? "#fff" : BRAND.primaryLight }}>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      secondary={item.description}
                      slotProps={{
                        primary: {
                          sx: { fontWeight: 600, color: isSelected ? "#fff" : BRAND.paper },
                        },
                        secondary: {
                          sx: {
                            fontSize: "0.72rem",
                            color: isSelected ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)",
                          },
                        },
                      }}
                    />
                    {item.hasSubmenu &&
                      (abiertos[item.id] ? (
                        <ExpandLess sx={{ color: isSelected ? "#fff" : BRAND.primaryLight }} />
                      ) : (
                        <ExpandMore sx={{ color: isSelected ? "#fff" : BRAND.primaryLight }} />
                      ))}
                  </ListItemButton>
                </ListItem>

                {item.hasSubmenu && (
                  <Collapse in={Boolean(abiertos[item.id])} unmountOnExit>
                    <List disablePadding>
                      {item.submenu.map((sub) => {
                        const SubIcon = sub.icon;
                        const subSelected = selectedItemId === sub.id;
                        return (
                          <ListItem key={sub.id} disablePadding sx={{ pl: 2, mb: 0.5 }}>
                            <ListItemButton
                              onClick={() => {
                                if (!subSelected) router.push(sub.route);
                              }}
                              sx={{
                                borderRadius: 1.5,
                                background: subSelected
                                  ? `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)`
                                  : "transparent",
                                "&:hover": {
                                  background: subSelected
                                    ? `linear-gradient(135deg, ${BRAND.primaryDeep} 0%, ${BRAND.primaryDark} 100%)`
                                    : BRAND.hover,
                                },
                              }}
                            >
                              <ListItemIcon
                                sx={{ minWidth: 32, color: subSelected ? "#fff" : BRAND.primaryLight }}
                              >
                                <SubIcon sx={{ fontSize: 20 }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={sub.title}
                                slotProps={{
                                  primary: {
                                    sx: {
                                      fontSize: "0.88rem",
                                      fontWeight: subSelected ? 700 : 500,
                                      color: subSelected ? "#fff" : BRAND.paper,
                                    },
                                  },
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                )}
              </Box>
            );
          })}
        </List>

        <Divider sx={{ borderColor: BRAND.border }} />
        <List sx={{ p: 1.5 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={logout}
              sx={{
                borderRadius: 1.5,
                border: `1px solid ${BRAND.border}`,
                "&:hover": { bgcolor: BRAND.hover },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: BRAND.primaryLight }}>
                <Logout />
              </ListItemIcon>
              <ListItemText
                primary="Cerrar sesión"
                slotProps={{ primary: { sx: { fontWeight: 600, color: BRAND.paper } } }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 1.5 },
          width: menuOpen ? `calc(100% - ${drawerWidth}px)` : "100%",
          transition: "width 0.2s ease",
          minWidth: 0,
          minHeight: "100vh",
          bgcolor: BRAND.bg,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 48, sm: 56 } }} />
        {children}
      </Box>
    </Box>
  );
}
