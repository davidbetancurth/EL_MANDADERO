import { useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Header, Icon, PinInput, Shell } from "../components/ui";
import { iniciarSesion, soloDigitos } from "../lib/auth";
import { mensajeError } from "../lib/errores";
import type { Go } from "../lib/nav";

export function Login({ go }: { go: Go }) {
  const { recargar } = useSesion();
  const [documento, setDocumento] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [olvido, setOlvido] = useState(false);
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setError("");
    if (soloDigitos(documento).length < 5) return setError("Escribe tu número de documento.");
    if (pin.length !== 4) return setError("Tu PIN tiene 4 dígitos.");
    setCargando(true);
    try {
      await iniciarSesion(documento, pin);
      const perfil = await recargar();
      if (!perfil) return setError("Tu cuenta no está completa. Vuelve a registrarte con el mismo documento.");
      go(perfil.rol === "repartidor" ? "courier-home" : "voice");
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
        <p className="lead">Ingresa con tu documento y tu PIN.</p>
        <label>
          Documento de identidad
          <input
            inputMode="numeric"
            placeholder="Ej. 52 345 678"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          PIN de 4 dígitos
          <PinInput value={pin} onChange={setPin} />
        </label>
        <button className="text-link" onClick={() => setOlvido(true)}>
          Olvidé mi clave
        </button>
        {olvido && <Aviso tipo="ok">Para recuperar tu PIN comunícate con el soporte de El Mandadero.</Aviso>}
        {error && <Aviso>{error}</Aviso>}
        <Button onClick={entrar} disabled={cargando}>
          {cargando ? "Entrando..." : "Entrar"}
        </Button>
        <p className="security-note">
          <Icon name="shield" size={18} /> Nunca compartas tu PIN con nadie.
        </p>
      </section>
    </Shell>
  );
}
