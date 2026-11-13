import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Punto } from "../lib/geo";

interface Props {
  centro: Punto;
  /** Punto de entrega. Si `editable`, la persona puede arrastrarlo o tocar el mapa para moverlo. */
  destino?: Punto | null;
  repartidor?: Punto | null;
  ruta?: [number, number][] | null;
  editable?: boolean;
  onMover?: (p: Punto) => void;
  alto?: number;
}

const icono = (clase: string, texto: string) =>
  L.divIcon({
    className: "",
    html: `<div class="mm-pin ${clase}">${texto}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });

export function Mapa({ centro, destino, repartidor, ruta, editable = false, onMover, alto = 260 }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const mDestino = useRef<L.Marker | null>(null);
  const mRep = useRef<L.Marker | null>(null);
  const linea = useRef<L.Polyline | null>(null);
  const alMover = useRef(onMover);
  alMover.current = onMover;

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const m = L.map(contenedor.current, { zoomControl: true, attributionControl: true }).setView(
      [centro.lat, centro.lng],
      16,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(m);
    if (editable) {
      m.on("click", (e: L.LeafletMouseEvent) => alMover.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }
    mapa.current = m;
    setTimeout(() => m.invalidateSize(), 150);
    return () => {
      m.remove();
      mapa.current = null;
      mDestino.current = null;
      mRep.current = null;
      linea.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marcador de destino
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!destino) {
      mDestino.current?.remove();
      mDestino.current = null;
      return;
    }
    if (!mDestino.current) {
      const mk = L.marker([destino.lat, destino.lng], { icon: icono("casa", "🏠"), draggable: editable }).addTo(m);
      if (editable) {
        mk.on("dragend", () => {
          const p = mk.getLatLng();
          alMover.current?.({ lat: p.lat, lng: p.lng });
        });
      }
      mDestino.current = mk;
    } else {
      mDestino.current.setLatLng([destino.lat, destino.lng]);
    }
    if (editable) m.panTo([destino.lat, destino.lng]);
  }, [destino, editable]);

  // Marcador del repartidor
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!repartidor) {
      mRep.current?.remove();
      mRep.current = null;
      return;
    }
    if (!mRep.current) mRep.current = L.marker([repartidor.lat, repartidor.lng], { icon: icono("rep", "🚲") }).addTo(m);
    else mRep.current.setLatLng([repartidor.lat, repartidor.lng]);
  }, [repartidor]);

  // Ruta y encuadre
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    linea.current?.remove();
    linea.current = null;
    if (ruta && ruta.length > 1) {
      linea.current = L.polyline(ruta, { color: "#2e7d32", weight: 5, opacity: 0.85 }).addTo(m);
    }
    if (!editable && destino && repartidor) {
      m.fitBounds(
        L.latLngBounds([
          [destino.lat, destino.lng],
          [repartidor.lat, repartidor.lng],
        ]),
        { padding: [50, 50], maxZoom: 17 },
      );
    }
  }, [ruta, destino, repartidor, editable]);

  return <div ref={contenedor} className="mm-mapa" style={{ height: alto }} />;
}
