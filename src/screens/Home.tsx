import { useEffect, useState } from "react";
import { useSesion } from "../context";
import { Icon, Shell, type IconName } from "../components/ui";
import { misPedidos } from "../lib/api";
import type { Go, NavParams, Screen } from "../lib/nav";
import { ESTADOS_ACTIVOS, type Pedido } from "../lib/types";

const servicios: { icon: IconName; title: string; text: string; color: string; target: Screen; params?: NavParams }[] = [
  { icon: "bag", title: "Pedir un mandado", text: "Lo que necesites del barrio", color: "mint", target: "pedir" },
  { icon: "mic", title: "Hablar con el asistente", text: "Dime qué necesitas", color: "peach", target: "voice" },
  { icon: "bill", title: "Pagar facturas", text: "Agua, luz, gas e internet", color: "blue", target: "pedir", params: { tipo: "factura" } },
  { icon: "companion", title: "Acompañamiento", text: "No tienes que ir solo", color: "lilac", target: "companion" },
];

const ETIQUETA_ESTADO: Record<string, string> = {
  buscando: "BUSCANDO REPARTIDOR",
  asignado: "ASIGNADO",
  comprando: "COMPRANDO",
  en_camino: "EN CAMINO",
};

export function Home({ go }: { go: Go }) {
  const { perfil, barrios } = useSesion();
  const [activo, setActivo] = useState<Pedido | null>(null);

  useEffect(() => {
    let vivo = true;
    void misPedidos()
      .then((ps) => vivo && setActivo(ps.find((p) => ESTADOS_ACTIVOS.includes(p.estado)) ?? null))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const nombre = perfil?.nombre_completo.split(" ")[0] ?? "";
  const iniciales = (perfil?.nombre_completo ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  const barrio = barrios.find((b) => b.id === perfil?.barrio_id)?.nombre;
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días," : hora < 19 ? "Buenas tardes," : "Buenas noches,";

  return (
    <Shell nav current="home" go={go} mic>
      <div className="home-head">
        <div>
          <span>{saludo}</span>
          <h1>{nombre}</h1>
          <p>
            <Icon name="location" size={16} /> {barrio ?? "Manizales"}
          </p>
        </div>
        <button className="avatar" onClick={() => go("profile")} aria-label="Mi perfil">
          {iniciales}
        </button>
      </div>
      <section className="home-content">
        <div className="help-banner">
          <div>
            <span>¿No sabes por dónde empezar?</span>
            <strong>Cuéntame qué necesitas</strong>
          </div>
          <button onClick={() => go("voice")} aria-label="Hablar con el asistente">
            <Icon name="mic" />
          </button>
        </div>
        <h2>¿Qué hacemos hoy?</h2>
        <div className="service-grid">
          {servicios.map((s) => (
            <button key={s.title} className={`service-card ${s.color}`} onClick={() => go(s.target, s.params)}>
              <span className="service-icon">
                <Icon name={s.icon} size={30} />
              </span>
              <strong>{s.title}</strong>
              <small>{s.text}</small>
              <span className="round-arrow">
                <Icon name="chevron" size={17} />
              </span>
            </button>
          ))}
        </div>
        {activo && (
          <>
            <div className="section-title">
              <h2>Tu pedido activo</h2>
              <button onClick={() => go("orders")}>Ver todos</button>
            </div>
            <button className="active-order" onClick={() => go("tracking", { pedidoId: activo.id })}>
              <div className="order-visual">
                <Icon name="bike" size={31} />
              </div>
              <div>
                <span className="status-pill">{ETIQUETA_ESTADO[activo.estado]}</span>
                <strong>Pedido #{activo.numero}</strong>
                <small>{activo.items.length} {activo.items.length === 1 ? "producto" : "productos"}</small>
              </div>
              <Icon name="chevron" />
            </button>
          </>
        )}
      </section>
    </Shell>
  );
}
