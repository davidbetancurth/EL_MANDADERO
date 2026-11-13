import { useEffect, useRef, useState } from "react";
import { Aviso, Button, Cargando, Header, Icon, Shell } from "../components/ui";
import { Mapa } from "../components/Mapa";
import { avanzarPedido, enviarUbicacion, obtenerPedido, suscribirPedido } from "../lib/api";
import { mensajeError } from "../lib/errores";
import { CENTRO_MANIZALES, calcularRuta, vigilarPosicion, type Punto, type Ruta } from "../lib/geo";
import type { Go } from "../lib/nav";
import { describirItem, formatoPesos, type Pedido } from "../lib/types";

export function CourierPedido({ go, pedidoId }: { go: Go; pedidoId?: string }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [yo, setYo] = useState<Punto | null>(null);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [total, setTotal] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const ultimoEnvio = useRef(0);
  const ultimaRuta = useRef(0);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!pedidoId) go("courier-home");
  }, [pedidoId, go]);

  useEffect(() => {
    if (!pedidoId) return;
    let vivo = true;
    void obtenerPedido(pedidoId).then((p) => vivo && setPedido(p)).catch((e) => vivo && setError(mensajeError(e)));
    const quitar = suscribirPedido(pedidoId, (p) => vivo && setPedido(p), () => undefined);
    return () => {
      vivo = false;
      quitar();
    };
  }, [pedidoId]);

  const activo = pedido && ["asignado", "comprando", "en_camino"].includes(pedido.estado);
  const destino: Punto | null = pedido && pedido.lat !== null && pedido.lng !== null ? { lat: pedido.lat, lng: pedido.lng } : null;

  // Compartir mi ubicación mientras el pedido está activo (cada ~8 s)
  useEffect(() => {
    if (!pedidoId || !activo) return;
    return vigilarPosicion((p) => {
      setYo(p);
      if (Date.now() - ultimoEnvio.current > 8000) {
        ultimoEnvio.current = Date.now();
        void enviarUbicacion(pedidoId, p.lat, p.lng).catch(() => undefined);
      }
    });
  }, [pedidoId, activo]);

  // Ruta hacia el cliente
  useEffect(() => {
    if (!yo || !destino || Date.now() - ultimaRuta.current < 20000) return;
    ultimaRuta.current = Date.now();
    void calcularRuta(yo, destino).then(setRuta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yo, destino?.lat, destino?.lng]);

  if (!pedidoId) return null;
  if (!pedido) return <Shell>{error ? <Aviso>{error}</Aviso> : <Cargando />}</Shell>;

  const avanzar = async (estado: "comprando" | "en_camino" | "entregado") => {
    setError("");
    setCargando(true);
    try {
      await avanzarPedido(pedido.id, estado, estado === "en_camino" ? parseInt(total, 10) : undefined);
      if (estado === "entregado") go("courier-home");
      else setPedido(await obtenerPedido(pedido.id));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  const cobrar = (pedido.total_productos ?? 0) + pedido.costo_domicilio;

  return (
    <Shell>
      <Header title={`Pedido #${pedido.numero}`} onBack={() => go("courier-home")} />
      <section className="content">
        {destino ? (
          <Mapa centro={destino} destino={destino} repartidor={yo} ruta={ruta?.puntos} alto={220} />
        ) : (
          <Mapa centro={CENTRO_MANIZALES} alto={140} />
        )}

        <div className="detail-card">
          <button type="button" style={{ cursor: "default" }}>
            <span className="detail-icon">
              <Icon name="location" />
            </span>
            <div>
              <small>ENTREGAR EN</small>
              <strong>{pedido.direccion_texto}</strong>
              <span>{pedido.notas ?? "Sin notas"}</span>
            </div>
          </button>
          <button type="button" style={{ cursor: "default" }}>
            <span className="detail-icon">
              <Icon name="profile" />
            </span>
            <div>
              <small>CLIENTE</small>
              <strong>{pedido.cliente_nombre}</strong>
              {pedido.cliente_celular && <a href={`tel:${pedido.cliente_celular}`}>Llamar · {pedido.cliente_celular}</a>}
            </div>
          </button>
        </div>

        <h2>{pedido.tipo === "factura" ? "Factura a pagar" : "Qué comprar"}</h2>
        {pedido.sitio_sugerido && <p className="lead">Sitio sugerido: {pedido.sitio_sugerido}</p>}
        <div className="mm-lista">
          {pedido.items.map((i, k) => (
            <label className="mm-fila" key={k} style={{ marginBottom: 8 }}>
              <span style={{ textDecoration: marcados.has(k) ? "line-through" : "none" }}>{describirItem(i)}</span>
              <input
                type="checkbox"
                style={{ width: 24, height: 24 }}
                checked={marcados.has(k)}
                onChange={() =>
                  setMarcados((m) => {
                    const n = new Set(m);
                    if (n.has(k)) n.delete(k);
                    else n.add(k);
                    return n;
                  })
                }
              />
            </label>
          ))}
        </div>
        {pedido.presupuesto_max !== null && (
          <Aviso tipo="ok">Tope de gasto del cliente: {formatoPesos(pedido.presupuesto_max)}</Aviso>
        )}

        {pedido.estado === "comprando" && (
          <label>
            ¿Cuánto costó la compra? (en pesos)
            <input inputMode="numeric" placeholder="Ej. 18500" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} />
          </label>
        )}
        {pedido.estado === "en_camino" && pedido.total_productos !== null && (
          <div className="summary">
            <p>
              <span>Compras</span>
              <b>{formatoPesos(pedido.total_productos)}</b>
            </p>
            <p>
              <span>Domicilio</span>
              <b>{formatoPesos(pedido.costo_domicilio)}</b>
            </p>
            <hr />
            <p className="total">
              <span>Cobrar en efectivo</span>
              <b>{formatoPesos(cobrar)}</b>
            </p>
          </div>
        )}

        {error && <Aviso>{error}</Aviso>}
        {pedido.estado === "asignado" && <Button onClick={() => avanzar("comprando")} disabled={cargando}>Empecé a comprar</Button>}
        {pedido.estado === "comprando" && (
          <Button onClick={() => avanzar("en_camino")} disabled={cargando || !total}>
            Ya compré · voy en camino
          </Button>
        )}
        {pedido.estado === "en_camino" && <Button onClick={() => avanzar("entregado")} disabled={cargando}>Entregué el pedido</Button>}
        {(pedido.estado === "entregado" || pedido.estado === "cancelado") && (
          <Aviso tipo="ok">{pedido.estado === "entregado" ? "Pedido entregado. ¡Gracias!" : "El cliente canceló este pedido."}</Aviso>
        )}
      </section>
    </Shell>
  );
}
