
import { useCallback, useEffect, useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Cargando, Header, Shell } from "../components/ui";
import { mensajeError } from "../lib/errores";
import {
  listarSolicitudesAdmin,
  resolverSolicitudAdmin,
} from "../lib/admin";
import type { Go } from "../lib/nav";
import { VEHICULOS, type Vehiculo } from "../lib/types";

interface SolicitudAdmin {
  id: string;
  barrio_id: number;
  vehiculo: Vehiculo;
  estado: "esperando" | "aprobado" | "rechazado";
  creado_en: string;
  resuelto_en: string | null;
}

export function Admin({ go }: { go: Go }) {
  const { perfil, barrios } = useSesion();

  const [solicitudes, setSolicitudes] = useState<SolicitudAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    setError("");

    try {
      const data = await listarSolicitudesAdmin();
      setSolicitudes(data as SolicitudAdmin[]);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resolver = async (id: string, aprobar: boolean) => {
    setProcesando(id);
    setError("");
    setAviso("");

    try {
      await resolverSolicitudAdmin(id, aprobar);

      setAviso(
        aprobar
          ? "Solicitud aprobada correctamente."
          : "Solicitud rechazada."
      );

      await cargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setProcesando(null);
    }
  };

  if (perfil?.rol !== "admin") {
    return (
      <Shell>
        <Header
          title="Administración"
          onBack={() => go("home")}
        />
        <section className="content">
          <Aviso>
            No tienes autorización para acceder a esta sección.
          </Aviso>
        </section>
      </Shell>
    );
  }

  const pendientes = solicitudes.filter(
    (s) => s.estado === "esperando"
  );

  return (
    <Shell>
      <Header
        title="Administración"
        onBack={() => go("home")}
        action={
          <button
            className="icon-btn"
            onClick={() => void cargar()}
            aria-label="Actualizar"
          >
            ↻
          </button>
        }
      />

      <section className="content">
        <h2>Solicitudes de repartidores</h2>

        <p className="lead">
          Revisa las solicitudes pendientes. Para aprobar se
          necesitan los tres documentos y un cupo disponible
          en el barrio.
        </p>

        {error && <Aviso>{error}</Aviso>}
        {aviso && <Aviso tipo="ok">{aviso}</Aviso>}

        {cargando && (
          <Cargando texto="Cargando solicitudes..." />
        )}

        {!cargando &&
          pendientes.length === 0 &&
          !error && (
            <p className="lead">
              No hay solicitudes pendientes.
            </p>
          )}

        {pendientes.map((s) => {
          const barrio = barrios.find(
            (b) => b.id === s.barrio_id
          );

          return (
            <article className="past-order" key={s.id}>
              <div>
                <strong>
                  Solicitud #{s.id.slice(0, 8)}
                </strong>

                <span>
                  Barrio: {barrio?.nombre ?? `ID ${s.barrio_id}`}
                </span>

                <span>
                  Vehículo: {VEHICULOS[s.vehiculo]?.label ?? s.vehiculo}
                </span>

                <span>
                  Recibida:{" "}
                  {new Date(s.creado_en).toLocaleString("es-CO")}
                </span>
              </div>

              <div className="admin-actions">
                <Button
                  onClick={() => void resolver(s.id, true)}
                  disabled={procesando !== null}
                >
                  {procesando === s.id
                    ? "Procesando..."
                    : "Aprobar"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => void resolver(s.id, false)}
                  disabled={procesando !== null}
                >
                  Rechazar
                </Button>
              </div>
            </article>
          );
        })}
      </section>
    </Shell>
  );
}
