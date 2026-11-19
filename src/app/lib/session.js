const SESSION_KEY = "sima_session";
let revision = 0;
const oyentes = new Set();

function avisar() {
  revision += 1;
  oyentes.forEach((fn) => fn());
}

export function subscribeSession(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

export function sessionRevision() {
  return revision;
}

function writeRaw(raw) {
  sessionStorage.setItem(SESSION_KEY, raw);
  localStorage.setItem(SESSION_KEY, raw);
}

export function saveSession(username, { configuracion = false } = {}) {
  writeRaw(
    JSON.stringify({
      username,
      configuracion: Boolean(configuracion),
      loggedAt: new Date().toISOString(),
    }),
  );
}

export function readSession() {
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (!session?.username) return null;
    if (!sessionStorage.getItem(SESSION_KEY)) sessionStorage.setItem(SESSION_KEY, raw);
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  avisar();
}
