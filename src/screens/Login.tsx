import { useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Header, Icon, Shell } from "../components/ui";
import { iniciarSesion } from "../lib/auth";
import { mensajeError } from "../lib/errores";
import type { Go } from "../lib/nav";

export function Login({ go }: { go: Go }) {
  const { recargar } = useSesion();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setError("");

    if (!correo.trim()) {
      return setError("Escribe tu correo electrónico.");
    }

    if (!password) {
      return setError("Escribe tu contraseña.");
    }

    setCargando(true);

    try {
      await iniciarSesion(correo, password);

      const perfil = await recargar();

      if (!perfil) {
        return setError(
          "Tu cuenta todavía no tiene un registro completo."
        );
      }

      if (perfil.rol === "admin") {
        go("admin");
      } else if (perfil.rol === "repartidor") {
        go("courier-pending");
      } else {
        go("voice");
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Shell>
      <Header title="Iniciar sesión" onBack={() => go("welcome")} />

      <section className="content">
        <div className="intro-icon">
          <Icon name="profile" size={34} />
        </div>

        <h2>Qué gusto verte</h2>
        <p className="lead">
          Ingresa con tu correo y contraseña.
        </p>

        <label>
          Correo electrónico
          <input
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            placeholder="Escribe tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <Aviso>{error}</Aviso>}

        <Button onClick={entrar} disabled={cargando}>
          {cargando ? "Entrando..." : "Entrar"}
        </Button>

        <p className="security-note">
          <Icon name="shield" size={18} />
          Nunca compartas tu contraseña.
        </p>
      </section>
    </Shell>
  );
}

