import { useEffect, useRef, useState } from "react";
import { Aviso, Button, Cargando, Icon, Shell } from "../components/ui";
import { Mapa } from "../components/Mapa";
import { cancelarPedido, obtenerPedido, suscribirPedido, ubicacionRepartidor } from "../lib/api";
import { mensajeError } from "../lib/errores";
import { CENTRO_MANIZALES, calcularRuta, distanciaM, minutosEstimados, type Punto, type Ruta } from "../lib/geo";
import type { Go } from "../lib/nav";
import { VEHICULOS, describirItem, formatoPesos, type Pedido } from "../lib/types";

const ETAPAS = ["Asignado", "Comprando", "En camino", "Entregado"];
const INDICE: Record<string, number> = { buscando: -1, asignado: 0, comprando: 1, en_camino: 2, entregado: 3, cancelado: -1 };

export function Tracking({ go, pedidoId }: { go: Go; pedidoId?: string }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [rep, setRep] = useState<Punto | null>(null);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [error, setError] = useState("");
  const ultimaRuta = useRef(0);

  useEffect(() => {
    if (!pedidoId) return;
    let vivo = true;
    void obtenerPedido(pedidoId).then((p) => vivo && setPedido(p)).catch((e) => vivo && setError(mensajeError(e)));
    void ubicacionRepartidor(pedidoId).then((u) => vivo && u && setRep({ lat: u.lat, lng: u.lng }));
    const cancelar = suscribirPedido(
      pedidoId,
      (p) => vivo && setPedido(p),
      (u) => vivo && setRep({ lat: u.lat, lng: u.lng }),
    );
    return () => {
      vivo = false;
      cancelar();
    };
  }, [pedidoId]);

  const destino: Punto | null = pedido && pedido.lat !== null && pedido.lng !== null ? { lat: pedido.lat, lng: pedido.lng } : null;

  // Recalcular la ruta cuando se mueve el repartidor (máx. una vez cada 15 s)
  useEffect(() => {
    if (!rep || !destino) return;
    if (Date.now() - ultimaRuta.current < 15000) return;
    ultimaRuta.current = Date.now();
    void calcularRuta(rep, destino).then(setRuta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, destino?.lat, destino?.lng]);

  useEffect(() => {
    if (!pedidoId) go("orders");
  }, [pedidoId, go]);

  if (!pedidoId) return null;
  if (!pedido) return <Shell>{error ? <Aviso>{error}</Aviso> : <Cargando texto="Buscando tu pedido..." />}</Shell>;

  const idx = INDICE[pedido.estado];
  const entregado = pedido.estado === "entregado";
  const cancelado = pedido.estado === "cancelado";
  const metros = ruta?.metros ?? (rep && destino ? distanciaM(rep, destino) * 1.3 : null);
  const minutos = metros !== null ? minutosEstimados(metros, pedido.vehiculo) : null;
  const puedeCancelar = pedido.estado === "buscando" || pedido.estado === "asignado";

  const cancelar = async () => {
    if (!window.confirm("¿Quieres cancelar este pedido?")) return;
    try {
      await cancelarPedido(pedido.id);
      setPedido(await obtenerPedido(pedido.id));
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const titulo = cancelado
    ? "Pedido cancelado"
    : entregado
      ? "¡Tu pedido llegó!"
      : pedido.estado === "buscando"
        ? "Buscando repartidor"
        : pedido.estado === "asignado"
          ? "Repartidor asignado"
          : pedido.estado === "comprando"
            ? "Están comprando lo tuyo"
            : minutos !== null
              ? `Llega en ${minutos} min`
              : "Va en camino";

  const subtitulo = cancelado
    ? "Puedes hacer un nuevo pedido cuando quieras"
    : entregado
      ? "Llegó sin emisiones"
      : pedido.estado === "buscando"
        ? "Avisamos a los repartidores de tu barrio"
        : metros !== null && pedido.estado === "en_camino"
          ? `${(metros / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} km restantes`
          : "Te avisaremos cuando salga hacia tu casa";

  return (
    <Shell>
      <div className="map" style={{ minHeight: 0, height: "44vh" }}>
        <Mapa centro={destino ?? CENTRO_MANIZALES} destino={destino} repartidor={entregado || cancelado ? null : rep} ruta={entregado || cancelado ? null : ruta?.puntos} alto={420} />
        <button className="map-back" onClick={() => go("home")} aria-label="Volver">
          <Icon name="arrow" />
        </button>
        <div className="eco-route">
          <Icon name="bike" size={17} /> Ruta ecológica
        </div>
      </div>
      <section className="tracking-card">
        <div className="drag" />
        <div className="tracking-title">
          <div>
            <span className={entregado ? "delivered" : ""}>
              {cancelado ? "CANCELADO" : entregado ? "ENTREGADO" : pedido.estado.replace("_", " ").toUpperCase()}
            </span>
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
          </div>
          <div className="time-circle">
            {entregado ? (
              <Icon name="check" />
            ) : minutos !== null && pedido.estado === "en_camino" ? (
              <>
                <b>{minutos}</b>
                <small>min</small>
              </>
            ) : (
              <Icon name="clock" />
            )}
          </div>
        </div>

        {!cancelado && (
          <div className="step-line">
            {ETAPAS.map((s, i) => (
              <div className={i <= idx ? "done" : ""} key={s}>
                <i>{i < idx ? <Icon name="check" size={12} /> : i + 1}</i>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}

        {pedido.repartidor_nombre && !entregado && !cancelado && (
          <div className="courier">
            <div className="courier-photo">{pedido.repartidor_nombre.split(" ").slice(0, 2).map((p) => p[0]).join("")}</div>
            <div>
              <strong>{pedido.repartidor_nombre}</strong>
              <span>
                <Icon name="star" size={15} /> {pedido.vehiculo ? VEHICULOS[pedido.vehiculo].label : "Repartidor de tu barrio"}
              </span>
            </div>
            {pedido.repartidor_celular && (
              <a className="mm-llamar" href={`tel:${pedido.repartidor_celular}`}>
                Llamar
              </a>
            )}
          </div>
        )}

        <div className="summary" style={{ marginBottom: 14 }}>
          {pedido.items.map((i, k) => (
            <p key={k}>
              <span>{describirItem(i)}</span>
            </p>
          ))}
          <hr />
          <p>
            <span>Domicilio</span>
            <b>{formatoPesos(pedido.costo_domicilio)}</b>
          </p>
          {pedido.total_productos !== null && (
            <p>
              <span>Compras</span>
              <b>{formatoPesos(pedido.total_productos)}</b>
            </p>
          )}
          {pedido.total_productos !== null && (
            <p className="total">
              <span>Total a pagar en efectivo</span>
              <b>{formatoPesos(pedido.total_productos + pedido.costo_domicilio)}</b>
            </p>
          )}
        </div>

        {error && <Aviso>{error}</Aviso>}
        {puedeCancelar && (
          <Button variant="secondary" onClick={cancelar}>
            Cancelar pedido
          </Button>
        )}
        {(entregado || cancelado) && <Button onClick={() => go("orders")}>Ver mis pedidos</Button>}
      </section>
    </Shell>
  );
}
