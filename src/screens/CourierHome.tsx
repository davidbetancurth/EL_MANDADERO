import { useCallback, useEffect, useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Cargando, Header, Icon, Shell } from "../components/ui";
import { cambiarDisponibilidad, pedidosDelRepartidor, reclamarPedido, suscribirPedidosRepartidor } from "../lib/api";
import { mensajeError } from "../lib/errores";
import type { Go } from "../lib/nav";
import { VEHICULOS, describirItem, type Pedido } from "../lib/types";

const ESTADO: Record<string, string> = {
  asignado: "ASIGNADO",
  comprando: "COMPRANDO",
  en_camino: "EN CAMINO",
};

export function CourierHome({ go }: { go: Go }) {
  const { perfil, repartidor, barrios, recargar } = useSesion();
  const [activo, setActivo] = useState<Pedido | null>(null);
  const [disponibles, setDisponibles] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    if (!perfil) return;
    try {
      const r = await pedidosDelRepartidor(perfil.id);
      setActivo(r.activo);
      setDisponibles(r.disponibles);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, [perfil]);

  useEffect(() => {
    void cargar();
    return suscribirPedidosRepartidor(() => void cargar());
  }, [cargar]);

  if (!perfil || !repartidor) {
    return (
      <Shell nav current="courier-home" go={go}>
        <Header title="Entregas" />
        <section className="content">
          <Aviso>No encontramos tu cuenta de repartidor. Contacta a soporte.</Aviso>
        </section>
      </Shell>
    );
  }

  const barrio = barrios.find((b) => b.id === repartidor.barrio_id);

  const alternar = async () => {
    setError("");
    try {
      await cambiarDisponibilidad(perfil.id, !repartidor.disponible);
      await recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const tomar = async (id: string) => {
    setError("");
    try {
      await reclamarPedido(id);
      await cargar();
      go("courier-pedido", { pedidoId: id });
    } catch (e) {
      setError(mensajeError(e));
      void cargar();
    }
  };

  return (
    <Shell nav current="courier-home" go={go}>
      <Header title="Entregas" />
      <section className="content">
        <div className="profile-card">
          <div className="avatar big">
            <Icon name="bike" />
          </div>
          <div>
            <strong>{perfil.nombre_completo.split(" ")[0]}</strong>
            <span>
              {VEHICULOS[repartidor.vehiculo].label} · Puesto {repartidor.cupo}/6
            </span>
            <span>Barrio {barrio?.nombre ?? "—"}</span>
          </div>
        </div>

        {!repartidor.aprobado ? (
          <Aviso tipo="ok">
            Tu cuenta está en revisión. Cuando verifiquemos tu identidad podrás conectarte y recibir pedidos.
          </Aviso>
        ) : (
          <div className="settings">
            <div>
              <span className="setting-icon">
                <Icon name="check" />
              </span>
              <div>
                <strong>{repartidor.disponible ? "Estoy disponible" : "No estoy disponible"}</strong>
                <small>{repartidor.disponible ? "Te asignaremos pedidos de tu zona" : "No recibirás pedidos"}</small>
              </div>
              <button
                className={`toggle ${repartidor.disponible ? "on" : ""}`}
                aria-pressed={repartidor.disponible}
                onClick={alternar}
                disabled={!!activo}
              >
                <i />
              </button>
            </div>
          </div>
        )}

        {error && <Aviso>{error}</Aviso>}
        {cargando && <Cargando />}

        {activo && (
          <>
            <h2>Tu pedido actual</h2>
            <button className="active-order" onClick={() => go("courier-pedido", { pedidoId: activo.id })}>
              <div className="order-visual">
                <Icon name="bag" size={31} />
              </div>
              <div>
                <span className="status-pill">{ESTADO[activo.estado]}</span>
                <strong>Pedido #{activo.numero}</strong>
                <small>{activo.direccion_texto}</small>
              </div>
              <Icon name="chevron" />
            </button>
          </>
        )}

        {!activo && repartidor.aprobado && (
          <>
            <h2>Pedidos esperando repartidor</h2>
            {disponibles.length === 0 && !cargando && <p className="lead">Por ahora no hay pedidos en tu zona.</p>}
            {disponibles.map((p) => (
              <div className="past-order" key={p.id}>
                <div>
                  <strong>
                    #{p.numero} · {p.items.length} {p.items.length === 1 ? "producto" : "productos"}
                  </strong>
                  <span>{p.items.slice(0, 3).map(describirItem).join(", ")}</span>
                  <span>{p.direccion_texto}</span>
                </div>
                <Button onClick={() => tomar(p.id)}>Tomar pedido</Button>
              </div>
            ))}
          </>
        )}
      </section>
    </Shell>
  );
}
