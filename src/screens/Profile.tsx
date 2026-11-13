import { useEffect, useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Header, Icon, Shell } from "../components/ui";
import { actualizarPerfil } from "../lib/api";
import { cerrarSesion } from "../lib/auth";
import { mensajeError } from "../lib/errores";
import type { Go } from "../lib/nav";
import { VEHICULOS } from "../lib/types";

export function Profile({ go }: { go: Go }) {
  const { perfil, repartidor, barrios, recargar } = useSesion();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [ceNombre, setCeNombre] = useState(perfil?.contacto_emergencia_nombre ?? "");
  const [ceCel, setCeCel] = useState(perfil?.contacto_emergencia_celular ?? "");

  useEffect(() => {
    setCeNombre(perfil?.contacto_emergencia_nombre ?? "");
    setCeCel(perfil?.contacto_emergencia_celular ?? "");
  }, [perfil]);

  if (!perfil) return null;
  const esRep = perfil.rol === "repartidor";
  const barrio = barrios.find((b) => b.id === (esRep ? repartidor?.barrio_id : perfil.barrio_id));
  const iniciales = perfil.nombre_completo
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  const guardar = async (cambios: Parameters<typeof actualizarPerfil>[1], mensaje?: string) => {
    setError("");
    setOk("");
    try {
      await actualizarPerfil(perfil.id, cambios);
      await recargar();
      if (mensaje) setOk(mensaje);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Shell nav current="profile" go={go}>
      <Header title="Mi perfil" />
      <section className={`content profile-page ${perfil.letra_grande ? "large-type" : ""}`}>
        <div className="profile-card">
          <div className="avatar big">{iniciales}</div>
          <div>
            <strong>{perfil.nombre_completo}</strong>
            <span>
              {perfil.tipo_documento === "CC" ? "C.C." : "C.E."} ••••• {perfil.documento.slice(-4)}
            </span>
            <span>{barrio ? `Barrio ${barrio.nombre}` : "Barrio por confirmar"}</span>
          </div>
        </div>

        {esRep && repartidor && (
          <>
            <h3>Mi puesto de repartidor</h3>
            <div className="settings">
              <div>
                <span className="setting-icon">
                  <Icon name="bike" />
                </span>
                <div>
                  <strong>{VEHICULOS[repartidor.vehiculo].label}</strong>
                  <small>
                    Puesto {repartidor.cupo} de 6 en {barrio?.nombre ?? "tu barrio"}
                  </small>
                </div>
              </div>
              <div>
                <span className="setting-icon">
                  <Icon name="shield" />
                </span>
                <div>
                  <strong>{repartidor.aprobado ? "Cuenta aprobada" : "En revisión"}</strong>
                  <small>{repartidor.aprobado ? "Puedes recibir pedidos" : "Aún no puedes recibir pedidos"}</small>
                </div>
              </div>
            </div>
          </>
        )}

        <h3>Accesibilidad</h3>
        <div className="settings">
          <div>
            <span className="setting-icon">Aa</span>
            <div>
              <strong>Letra más grande</strong>
              <small>Hace más fácil leer la app</small>
            </div>
            <button
              className={`toggle ${perfil.letra_grande ? "on" : ""}`}
              aria-pressed={perfil.letra_grande}
              onClick={() => guardar({ letra_grande: !perfil.letra_grande })}
            >
              <i />
            </button>
          </div>
          <div>
            <span className="setting-icon">
              <Icon name="volume" />
            </span>
            <div>
              <strong>Saludo con voz</strong>
              <small>Al abrir el asistente</small>
            </div>
            <button
              className={`toggle ${perfil.saludo_voz ? "on" : ""}`}
              aria-pressed={perfil.saludo_voz}
              onClick={() => guardar({ saludo_voz: !perfil.saludo_voz })}
            >
              <i />
            </button>
          </div>
        </div>

        <h3>Contacto de emergencia</h3>
        <label>
          Nombre
          <input value={ceNombre} onChange={(e) => setCeNombre(e.target.value)} placeholder="Ej. María, mi hija" />
        </label>
        <label>
          Celular
          <input inputMode="numeric" value={ceCel} onChange={(e) => setCeCel(e.target.value)} placeholder="300 000 0000" />
        </label>
        <Button
          variant="secondary"
          onClick={() =>
            guardar(
              { contacto_emergencia_nombre: ceNombre.trim() || null, contacto_emergencia_celular: ceCel.replace(/\D/g, "") || null },
              "Contacto guardado.",
            )
          }
        >
          Guardar contacto
        </Button>

        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {error && <Aviso>{error}</Aviso>}
        <Button
          variant="ghost"
          onClick={async () => {
            await cerrarSesion();
            go("welcome");
          }}
        >
          Cerrar sesión
        </Button>
        <p className="version">El Mandadero · Versión 1.0</p>
      </section>
    </Shell>
  );
}
