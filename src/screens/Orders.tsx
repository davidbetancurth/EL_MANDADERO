import { useEffect, useState } from "react";
import { Aviso, Cargando, Header, Icon, Shell } from "../components/ui";
import { misPedidos } from "../lib/api";
import { mensajeError } from "../lib/errores";
import type { Go } from "../lib/nav";
import { ESTADOS_ACTIVOS, describirItem, formatoPesos, type Pedido } from "../lib/types";

const ESTADO_TEXTO: Record<string, string> = {
  buscando: "BUSCANDO REPARTIDOR",
  asignado: "ASIGNADO",
  comprando: "COMPRANDO",
  en_camino: "EN CAMINO",
  entregado: "ENTREGADO",
  cancelado: "CANCELADO",
};

export function Orders({ go }: { go: Go }) {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [tab, setTab] = useState<"activos" | "pasados">("activos");
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    misPedidos()
      .then((p) => vivo && setPedidos(p))
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, []);

  const activos = pedidos?.filter((p) => ESTADOS_ACTIVOS.includes(p.estado)) ?? [];
  const pasados = pedidos?.filter((p) => !ESTADOS_ACTIVOS.includes(p.estado)) ?? [];

  return (
    <Shell nav current="orders" go={go} mic>
      <Header title="Mis pedidos" />
      <section className="content">
        <div className="tabs">
          <button className={tab === "activos" ? "selected" : ""} onClick={() => setTab("activos")}>
            Activos
          </button>
          <button className={tab === "pasados" ? "selected" : ""} onClick={() => setTab("pasados")}>
            Pasados
          </button>
        </div>
        {error && <Aviso>{error}</Aviso>}
        {!pedidos && !error && <Cargando />}

        {tab === "activos" && pedidos && activos.length === 0 && (
          <p className="lead">No tienes pedidos activos. ¡Pide lo que necesites!</p>
        )}
        {tab === "activos" &&
          activos.map((p) => (
            <button className="order-full" key={p.id} onClick={() => go("tracking", { pedidoId: p.id })}>
              <div className="order-top">
                <span className="status-pill">{ESTADO_TEXTO[p.estado]}</span>
                <small>Pedido #{p.numero}</small>
              </div>
              <div className="order-main">
                <div className="order-visual">
                  <Icon name="bag" />
                </div>
                <div>
                  <strong>{p.tipo === "factura" ? "Pago de factura" : "Mandado"}</strong>
                  <span>
                    {p.items.length} {p.items.length === 1 ? "producto" : "productos"}
                  </span>
                  <b>{p.repartidor_nombre ? `Lo lleva ${p.repartidor_nombre.split(" ")[0]}` : "Buscando repartidor"}</b>
                </div>
                <Icon name="chevron" />
              </div>
            </button>
          ))}

        {tab === "pasados" && pedidos && pasados.length === 0 && <p className="lead">Aún no tienes pedidos anteriores.</p>}
        {tab === "pasados" &&
          pasados.map((p) => (
            <div className="past-order" key={p.id}>
              <div>
                <strong>
                  #{p.numero} · {ESTADO_TEXTO[p.estado].toLowerCase()}
                </strong>
                <span>
                  {new Date(p.creado_en).toLocaleDateString("es-CO", { day: "numeric", month: "long" })} ·{" "}
                  {p.items.map(describirItem).join(", ").slice(0, 60)}
                </span>
              </div>
              {p.total_productos !== null && <b>{formatoPesos(p.total_productos + p.costo_domicilio)}</b>}
              <button onClick={() => go("pedir", { borrador: { items: p.items, tipo: p.tipo, sitio_sugerido: p.sitio_sugerido } })}>
                Repetir pedido
              </button>
            </div>
          ))}
      </section>
    </Shell>
  );
}
