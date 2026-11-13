import { useEffect, useMemo, useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Header, Icon, Shell } from "../components/ui";
import { Mapa } from "../components/Mapa";
import { costoDomicilio, crearPedido, direccionesDe } from "../lib/api";
import { mensajeError } from "../lib/errores";
import { CENTRO_MANIZALES, direccionDe, geocodificar, obtenerPosicion, type Punto } from "../lib/geo";
import type { Go, NavParams } from "../lib/nav";
import { describirItem, formatoPesos, type ItemPedido, type TipoPedido } from "../lib/types";

type ModoUbicacion = "guardada" | "gps" | "escrita";

export function Pedir({ go, params }: { go: Go; params: NavParams }) {
  const { perfil, barrios } = useSesion();
  const borrador = params.borrador;

  const [tipo] = useState<TipoPedido>(borrador?.tipo ?? params.tipo ?? "mandado");
  const [items, setItems] = useState<ItemPedido[]>(borrador?.items ?? []);
  const [nuevo, setNuevo] = useState("");
  const [sitio] = useState(borrador?.sitio_sugerido ?? null);
  const [presupuesto, setPresupuesto] = useState(borrador?.presupuesto_max ? String(borrador.presupuesto_max) : "");
  const [notas, setNotas] = useState("");

  const [modo, setModo] = useState<ModoUbicacion>("guardada");
  const [direccion, setDireccion] = useState("");
  const [punto, setPunto] = useState<Punto | null>(null);
  const [barrioId, setBarrioId] = useState(perfil?.barrio_id ? String(perfil.barrio_id) : "");
  const [tieneGuardada, setTieneGuardada] = useState(false);
  const [domicilio, setDomicilio] = useState(3500);

  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  // Cargar dirección guardada y costo del domicilio
  useEffect(() => {
    let vivo = true;
    void costoDomicilio().then((c) => vivo && setDomicilio(c));
    if (perfil) {
      void direccionesDe(perfil.id).then((ds) => {
        if (!vivo) return;
        const d = ds.find((x) => x.es_principal) ?? ds[0];
        if (!d) return setModo("escrita");
        setTieneGuardada(true);
        setDireccion(d.direccion);
        if (d.lat !== null && d.lng !== null) setPunto({ lat: d.lat, lng: d.lng });
        if (d.barrio_id) setBarrioId(String(d.barrio_id));
      });
    }
    return () => {
      vivo = false;
    };
  }, [perfil]);

  const usarGps = async () => {
    setError("");
    setBuscando(true);
    try {
      const p = await obtenerPosicion();
      setModo("gps");
      setPunto(p);
      setDireccion((await direccionDe(p)) ?? "Mi ubicación actual");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setError(
        m === "GPS_DENEGADO"
          ? "No tengo permiso para ver tu ubicación. Actívalo en los ajustes o escribe la dirección."
          : "No pude encontrar tu ubicación. Escribe la dirección.",
      );
      setModo("escrita");
    } finally {
      setBuscando(false);
    }
  };

  const buscarDireccion = async () => {
    setError("");
    if (direccion.trim().length < 5) return setError("Escribe la dirección completa.");
    setBuscando(true);
    const p = await geocodificar(direccion);
    setBuscando(false);
    if (p) setPunto(p);
    else setError("No encontré esa dirección. Mueve el pin en el mapa hasta tu puerta.");
  };

  const moverPin = async (p: Punto) => {
    setPunto(p);
    if (modo === "gps") {
      const d = await direccionDe(p);
      if (d) setDireccion(d);
    }
  };

  const agregar = () => {
    const t = nuevo.trim();
    if (!t) return;
    setItems((x) => [...x, { producto: t.slice(0, 120), cantidad: 1, unidad: null }]);
    setNuevo("");
  };

  const barrioElegido = useMemo(() => barrios.find((b) => String(b.id) === barrioId), [barrios, barrioId]);

  const confirmar = async () => {
    setError("");
    if (items.length === 0) return setError("Agrega al menos un producto a tu lista.");
    if (direccion.trim().length < 3) return setError("Dime dónde entregamos.");
    if (!barrioId) return setError("Elige el barrio donde estás.");
    setEnviando(true);
    try {
      const p = await crearPedido({
        items,
        tipo,
        sitio_sugerido: sitio,
        presupuesto_max: presupuesto ? Math.max(0, parseInt(presupuesto, 10) || 0) : null,
        transcripcion: borrador?.transcripcion,
        direccion: direccion.trim(),
        lat: punto?.lat ?? null,
        lng: punto?.lng ?? null,
        barrioId: Number(barrioId),
        notas: notas.trim(),
      });
      go("tracking", { pedidoId: p.id });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const etiqueta = tipo === "factura" ? "Factura a pagar" : "Tu lista";

  return (
    <Shell mic go={go}>
      <Header title={tipo === "factura" ? "Pagar una factura" : "Tu mandado"} onBack={() => go("home")} />
      <section className="content cart-page">
        <h2>{etiqueta}</h2>
        {sitio && (
          <p className="lead">
            Sitio sugerido: <strong>{sitio}</strong>
          </p>
        )}
        <div className="mm-lista">
          {items.length === 0 && <p className="lead">Aún no hay nada. Escribe abajo o dicta tu lista.</p>}
          {items.map((i, k) => (
            <div className="mm-fila" key={k}>
              <span>{describirItem(i)}</span>
              <button aria-label={`Quitar ${i.producto}`} onClick={() => setItems((x) => x.filter((_, j) => j !== k))}>
                <Icon name="minus" size={18} />
              </button>
            </div>
          ))}
        </div>
        <div className="mm-escribir">
          <input
            placeholder={tipo === "factura" ? "Ej. Factura de agua" : "Ej. 2 libras de arroz"}
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
          />
          <button onClick={agregar} disabled={!nuevo.trim()}>
            Agregar
          </button>
        </div>
        <div className="list-actions">
          <button onClick={() => go("voice")}>
            <Icon name="mic" /> Dictar mi lista
          </button>
        </div>

        <h2>¿Dónde entregamos?</h2>
        <div className="mm-opciones">
          {tieneGuardada && (
            <button
              className={modo === "guardada" ? "sel" : ""}
              onClick={() => {
                setModo("guardada");
                void direccionesDe(perfil!.id).then((ds) => {
                  const d = ds.find((x) => x.es_principal) ?? ds[0];
                  if (d) {
                    setDireccion(d.direccion);
                    setPunto(d.lat !== null && d.lng !== null ? { lat: d.lat, lng: d.lng } : null);
                    if (d.barrio_id) setBarrioId(String(d.barrio_id));
                  }
                });
              }}
            >
              <Icon name="home" />
              <span>Mi casa</span>
              {modo === "guardada" && <Icon name="check" />}
            </button>
          )}
          <button className={modo === "gps" ? "sel" : ""} onClick={usarGps} disabled={buscando}>
            <Icon name="location" />
            <span>Usar mi ubicación actual</span>
            {modo === "gps" && <Icon name="check" />}
          </button>
          <button className={modo === "escrita" ? "sel" : ""} onClick={() => setModo("escrita")}>
            <Icon name="search" />
            <span>Escribir otra dirección</span>
            {modo === "escrita" && <Icon name="check" />}
          </button>
        </div>

        <label>
          Dirección
          <input
            placeholder="Calle, carrera y número"
            value={direccion}
            readOnly={modo === "guardada"}
            onChange={(e) => setDireccion(e.target.value)}
            onBlur={() => modo === "escrita" && direccion.trim().length >= 5 && !punto && void buscarDireccion()}
          />
        </label>
        {modo === "escrita" && (
          <Button variant="secondary" icon="search" onClick={buscarDireccion} disabled={buscando}>
            {buscando ? "Buscando..." : "Ver en el mapa"}
          </Button>
        )}
        <Mapa
          centro={punto ?? CENTRO_MANIZALES}
          destino={punto}
          editable
          onMover={moverPin}
          alto={240}
        />
        <p className="lead" style={{ fontSize: 13 }}>
          Toca el mapa para marcar tu puerta. Puedes arrastrar la casita para ajustarla.
        </p>
        <label>
          Barrio
          <select value={barrioId} onChange={(e) => setBarrioId(e.target.value)}>
            <option value="" disabled>
              Selecciona el barrio
            </option>
            {barrios.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
                {b.sectores?.nombre ? ` · ${b.sectores.nombre}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          Gasto máximo en compras <small>(opcional)</small>
          <input inputMode="numeric" placeholder="Ej. 20000" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label>
          Notas para el repartidor
          <textarea placeholder="Ej. Tocar el timbre azul" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>

        <div className="detail-card">
          <button type="button" style={{ cursor: "default" }}>
            <span className="detail-icon">
              <Icon name="bill" />
            </span>
            <div>
              <small>MÉTODO DE PAGO</small>
              <strong>Efectivo</strong>
              <span>Le pagas al repartidor al recibir</span>
            </div>
          </button>
        </div>
        <div className="summary">
          <p>
            <span>Domicilio ecológico</span>
            <b>{formatoPesos(domicilio)}</b>
          </p>
          <p>
            <span>{tipo === "factura" ? "Valor de la factura" : "Compras"}</span>
            <b>Según lo que cueste</b>
          </p>
          <hr />
          <p className="total">
            <span>Barrio</span>
            <b>{barrioElegido?.nombre ?? "—"}</b>
          </p>
        </div>
        <div className="eco-note">
          <Icon name="bike" />
          <p>
            <strong>Entrega sin emisiones</strong>
            <br />
            Un repartidor de tu barrio hará la compra y te la llevará en bicicleta o patineta eléctrica.
          </p>
        </div>

        {error && <Aviso>{error}</Aviso>}
        <Button onClick={confirmar} disabled={enviando}>
          {enviando ? "Enviando pedido..." : "Confirmar pedido"}
        </Button>
      </section>
    </Shell>
  );
}
