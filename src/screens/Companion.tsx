import { useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Header, Icon, Shell, type IconName } from "../components/ui";
import { solicitarAcompanamiento } from "../lib/api";
import { mensajeError } from "../lib/errores";
import type { Go } from "../lib/nav";

const TIPOS: [string, IconName][] = [
  ["Cita médica", "clock"],
  ["Hacer compras", "bag"],
  ["Ir al centro", "location"],
  ["Otra diligencia", "plus"],
];

export function Companion({ go }: { go: Go }) {
  const { perfil } = useSesion();
  const [tipo, setTipo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const solicitar = async () => {
    if (!perfil) return;
    if (!tipo) return setError("Elige para qué necesitas compañía.");
    setCargando(true);
    setError("");
    try {
      await solicitarAcompanamiento(perfil.id, tipo, detalle.trim(), perfil.barrio_id);
      setEnviado(true);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Shell nav current="companion" go={go} mic>
      <Header title="Acompañamiento" />
      <section className="content">
        <div className="companion-hero">
          <div>
            <span>Estamos contigo</span>
            <h2>¿A dónde necesitas ir?</h2>
            <p>Una persona de confianza te acompaña y te ayuda durante tu diligencia.</p>
          </div>
          <Icon name="companion" size={56} />
        </div>
        {enviado ? (
          <>
            <Aviso tipo="ok">Recibimos tu solicitud de “{tipo}”. Te contactaremos pronto para coordinar.</Aviso>
            <Button onClick={() => go("home")}>Volver al inicio</Button>
          </>
        ) : (
          <>
            <div className="companion-types">
              {TIPOS.map(([l, i]) => (
                <button key={l} className={tipo === l ? "sel" : ""} onClick={() => setTipo(l)}>
                  <Icon name={i} />
                  <span>{l}</span>
                  <Icon name={tipo === l ? "check" : "chevron"} />
                </button>
              ))}
            </div>
            <label>
              Cuéntanos más <small>(opcional)</small>
              <textarea placeholder="Ej. Cita en la Clínica a las 3 p. m." value={detalle} onChange={(e) => setDetalle(e.target.value)} />
            </label>
            <div className="safe-card">
              <Icon name="shield" />
              <div>
                <strong>Acompañantes verificados</strong>
                <p>Validamos su identidad y antecedentes para tu tranquilidad.</p>
              </div>
            </div>
            {error && <Aviso>{error}</Aviso>}
            <Button onClick={solicitar} disabled={cargando}>
              {cargando ? "Enviando..." : "Solicitar acompañamiento"}
            </Button>
          </>
        )}
      </section>
    </Shell>
  );
}
