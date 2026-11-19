"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { readSession, saveSession, sessionRevision, subscribeSession } from "../lib/session";
import styles from "./Login.module.css";

function SchoolBus({ color, plate, seats }) {
  return (
    <svg className={styles.truck} viewBox="0 0 360 132" aria-hidden="true">
      <ellipse cx="180" cy="124" rx="150" ry="6" fill="rgba(23, 32, 51, 0.16)" />
      <path
        d="M248 62h46l26 16h28v24H248Z"
        fill={color}
        stroke="#1e3a5f"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="16" y="36" width="240" height="66" rx="8" fill={color} stroke="#1e3a5f" strokeWidth="2" />
      <rect x="16" y="36" width="240" height="12" rx="6" fill="#243140" />
      <rect x="16" y="86" width="232" height="6" fill="#1e3a5f" />
      {seats.map((filled, index) => {
        const x = 28 + index * 36;
        return (
          <g key={plate + index}>
            <rect x={x} y="52" width="28" height="28" rx="2" fill="#d7e8f6" stroke="#1e3a5f" strokeWidth="1.2" />
            {filled && (
              <g fill="#3d4c5c">
                <circle cx={x + 14} cy="62" r="4" />
                <path d={`M${x + 6} 78c1.4-6 4.4-8 8-8s6.6 2 8 8`} />
              </g>
            )}
          </g>
        );
      })}
      <path d="M300 66l20 12h-26V66Z" fill="#c5d9ea" stroke="#1e3a5f" strokeWidth="1.3" />
      <rect x="258" y="70" width="34" height="16" rx="2" fill="#c5d9ea" stroke="#1e3a5f" strokeWidth="1.2" />
      <rect x="248" y="96" width="100" height="8" rx="2" fill="#1e3a5f" />
      <circle cx="338" cy="84" r="4" fill="#f4f7fb" stroke="#1e3a5f" strokeWidth="1" />
      <circle cx="326" cy="84" r="3" fill="#ffb300" stroke="#1e3a5f" strokeWidth="1" />
      {[72, 292].map((cx) => (
        <g key={cx}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${cx} 112`}
            to={`360 ${cx} 112`}
            dur="0.7s"
            repeatCount="indefinite"
          />
          <circle cx={cx} cy="112" r="16" fill="#243140" />
          <circle cx={cx} cy="112" r="7" fill="#f4c430" />
          <circle cx={cx} cy="112" r="2.5" fill="#1e3a5f" />
        </g>
      ))}
    </svg>
  );
}

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const revision = useSyncExternalStore(subscribeSession, sessionRevision, () => 0);

  useEffect(() => {
    setLoading(false);
    if (readSession()) {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
  }, [router, revision]);

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Ingrese usuario y contraseña");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: username.trim(), clave: password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "Usuario o contraseña incorrectos");
        setLoading(false);
        return;
      }
      saveSession(data.data?.usuario || username.trim(), {
        configuracion: data.data?.configuracion === true,
      });
      router.push("/dashboard");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return <main className={styles.screen} />;
  }

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.stripe} />
        <div className={styles.body}>
          <div className={styles.logo}>
            <img src="/tristone.png" alt="Tristone" />
          </div>
          <h1>SIMA</h1>
          <p className={styles.hint}>
            Sistema de monitoreo de aforo de camiones. Ingrese su usuario y
            contraseña para continuar.
          </p>

          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.legend}>Usuario</span>
              <span className={styles.icon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5.5 19.2c.8-3.2 3.2-4.8 6.5-4.8s5.7 1.6 6.5 4.8" />
                </svg>
              </span>
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={loading}
              />
            </label>
            <label className={`${styles.field} ${styles.withReveal}`}>
              <span className={styles.legend}>Contraseña</span>
              <span className={styles.icon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="6" y="10" width="12" height="9" rx="1.5" />
                  <path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" />
                </svg>
              </span>
              <input
                name="password"
                type={verClave ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className={styles.reveal}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setVerClave((visible) => !visible)}
                disabled={loading}
              >
                {verClave ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 6.2A10 10 0 0 1 12 6c5.2 0 8.6 4.2 9.5 6-.4.8-1.2 2-2.4 3.2" />
                    <path d="M6.1 6.8C4.2 8.2 2.9 10.2 2.5 12c.9 1.8 4.3 6 9.5 6 1.2 0 2.3-.2 3.3-.6" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12C3.4 10.2 6.8 6 12 6s8.6 4.2 9.5 6c-.9 1.8-4.3 6-9.5 6s-8.6-4.2-9.5-6Z" />
                    <circle cx="12" cy="12" r="2.6" />
                  </svg>
                )}
              </button>
            </label>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Entrando..." : "Ingresar"}
          </button>
        </div>
      </form>
      <div className={styles.convoy} aria-hidden="true">
        <div className={styles.road}>
          <span className={styles.lane} />
        </div>
        <div className={`${styles.runner} ${styles.runnerA}`}>
          <SchoolBus color="#F5C400" plate="R1" seats={[true, true, true, true, true, false]} />
        </div>
        <div className={`${styles.runner} ${styles.runnerB}`}>
          <SchoolBus color="#1E88E5" plate="R4" seats={[true, false, false, true, false, false]} />
        </div>
        <div className={`${styles.runner} ${styles.runnerC}`}>
          <SchoolBus color="#F7F9FB" plate="R7" seats={[true, true, false, true, true, false]} />
        </div>
      </div>
    </main>
  );
}
