import type { Vehiculo } from "./types";
import { VEHICULOS } from "./types";

export interface Punto {
  lat: number;
  lng: number;
}

/** Centro de Manizales (Plaza de Bolívar, aprox.) — se usa cuando aún no hay ubicación. */
export const CENTRO_MANIZALES: Punto = { lat: 5.0703, lng: -75.5138 };

// ---------- GPS ----------
export function obtenerPosicion(): Promise<Punto> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("GPS_NO_DISPONIBLE"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? "GPS_DENEGADO" : "GPS_NO_DISPONIBLE")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  });
}

/**
 * Sigue la posición mientras la app está abierta.
 * En la app nativa del repartidor reemplaza esto por el plugin de ubicación en segundo plano (ver README).
 */
export function vigilarPosicion(alCambiar: (p: Punto) => void): () => void {
  if (!("geolocation" in navigator)) return () => undefined;
  const id = navigator.geolocation.watchPosition(
    (p) => alCambiar({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// ---------- Geocodificación (Nominatim / OpenStreetMap) ----------
// Gratis pero con límite de ~1 consulta por segundo y sin garantías: sirve para empezar.
// Para producción cambia estas dos funciones por Google Geocoding o Mapbox.
const NOMINATIM = "https://nominatim.openstreetmap.org";

export async function geocodificar(direccion: string): Promise<Punto | null> {
  try {
    const q = encodeURIComponent(`${direccion}, Manizales, Caldas, Colombia`);
    const r = await fetch(
      `${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=co&viewbox=-75.62,5.14,-75.42,4.98&bounded=1&q=${q}`,
    );
    if (!r.ok) return null;
    const datos = (await r.json()) as { lat: string; lon: string }[];
    return datos[0] ? { lat: Number(datos[0].lat), lng: Number(datos[0].lon) } : null;
  } catch {
    return null;
  }
}

export async function direccionDe(p: Punto): Promise<string | null> {
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&lat=${p.lat}&lon=${p.lng}`);
    if (!r.ok) return null;
    const d = (await r.json()) as { address?: { road?: string; house_number?: string; suburb?: string } };
    const a = d.address;
    if (!a?.road) return null;
    return [a.road, a.house_number].filter(Boolean).join(" ");
  } catch {
    return null;
  }
}

// ---------- Rutas (OSRM público de demostración) ----------
export interface Ruta {
  puntos: [number, number][];
  metros: number;
  segundos: number;
}

export async function calcularRuta(desde: Punto, hasta: Punto): Promise<Ruta | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${desde.lng},${desde.lat};${hasta.lng},${hasta.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const ruta = d.routes?.[0];
    if (!ruta) return null;
    return {
      puntos: ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      metros: ruta.distance,
      segundos: ruta.duration,
    };
  } catch {
    return null;
  }
}

export function distanciaM(a: Punto, b: Punto): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Minutos estimados según el vehículo (no el tiempo del auto que devuelve OSRM). */
export function minutosEstimados(metros: number, vehiculo: Vehiculo | null): number {
  const kmh = vehiculo ? VEHICULOS[vehiculo].kmh : 12;
  return Math.max(1, Math.round(metros / 1000 / kmh * 60));
}
