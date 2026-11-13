import { supabase } from "./supabase";
import type {
  Barrio,
  BorradorPedido,
  Direccion,
  EstadoPedido,
  Pedido,
  Perfil,
  RepartidorInfo,
  RespuestaIA,
  Ubicacion,
} from "./types";
import { ESTADOS_ACTIVOS } from "./types";

// ---------- Barrios ----------
export async function listarBarrios(): Promise<Barrio[]> {
  const { data, error } = await supabase
    .from("barrios")
    .select("id, nombre, sector_id, sectores(nombre)")
    .order("nombre");
  if (error) throw error;
  return (data ?? []) as unknown as Barrio[];
}

export async function cuposLibres(barrioId: number): Promise<number> {
  const { data, error } = await supabase.rpc("cupos_libres", { p_barrio: barrioId });
  if (error) throw error;
  return Number(data ?? 0);
}

// ---------- Perfil ----------
export async function obtenerPerfil(uid: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return (data as Perfil | null) ?? null;
}

export async function obtenerRepartidor(uid: string): Promise<RepartidorInfo | null> {
  const { data, error } = await supabase.from("repartidores").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return (data as RepartidorInfo | null) ?? null;
}

export async function actualizarPerfil(
  uid: string,
  cambios: Partial<
    Pick<
      Perfil,
      "letra_grande" | "saludo_voz" | "contacto_emergencia_nombre" | "contacto_emergencia_celular" | "celular" | "correo"
    >
  >,
) {
  const { error } = await supabase.from("profiles").update(cambios).eq("id", uid);
  if (error) throw error;
}

export async function direccionesDe(uid: string): Promise<Direccion[]> {
  const { data, error } = await supabase
    .from("direcciones")
    .select("*")
    .eq("user_id", uid)
    .order("es_principal", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Direccion[];
}

export async function costoDomicilio(): Promise<number> {
  const { data } = await supabase.from("config").select("valor").eq("clave", "costo_domicilio").maybeSingle();
  const n = Number(data?.valor);
  return Number.isFinite(n) && n > 0 ? n : 3500;
}

// ---------- Pedidos (usuario) ----------
export interface DatosPedido extends BorradorPedido {
  direccion: string;
  lat: number | null;
  lng: number | null;
  barrioId: number;
  notas: string;
}

export async function crearPedido(d: DatosPedido): Promise<Pedido> {
  const { data, error } = await supabase.rpc("crear_pedido", {
    p_items: d.items,
    p_tipo: d.tipo,
    p_direccion: d.direccion,
    p_lat: d.lat,
    p_lng: d.lng,
    p_barrio_id: d.barrioId,
    p_notas: d.notas || null,
    p_presupuesto: d.presupuesto_max ?? null,
    p_transcripcion: d.transcripcion ?? null,
    p_sitio: d.sitio_sugerido ?? null,
  });
  if (error) throw error;
  return data as Pedido;
}

export async function cancelarPedido(id: string) {
  const { error } = await supabase.rpc("cancelar_pedido", { p_id: id });
  if (error) throw error;
}

export async function obtenerPedido(id: string): Promise<Pedido | null> {
  const { data, error } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Pedido | null) ?? null;
}

export async function misPedidos(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Pedido[];
}

export async function ubicacionRepartidor(pedidoId: string): Promise<Ubicacion | null> {
  const { data } = await supabase.from("ubicaciones_repartidor").select("*").eq("pedido_id", pedidoId).maybeSingle();
  return (data as Ubicacion | null) ?? null;
}

/** Seguimiento en vivo de un pedido (estado + posición del repartidor). Devuelve la función para cancelar. */
export function suscribirPedido(
  id: string,
  alCambiarPedido: (p: Pedido) => void,
  alMoverse: (u: Ubicacion) => void,
): () => void {
  const canal = supabase
    .channel(`pedido-${id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `id=eq.${id}` }, (payload) => {
      if (payload.new && "id" in payload.new) alCambiarPedido(payload.new as Pedido);
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ubicaciones_repartidor", filter: `pedido_id=eq.${id}` },
      (payload) => {
        if (payload.new && "lat" in payload.new) alMoverse(payload.new as Ubicacion);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(canal);
  };
}

// ---------- Pedidos (repartidor) ----------
export async function pedidosDelRepartidor(uid: string): Promise<{ activo: Pedido | null; disponibles: Pedido[] }> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .in("estado", ESTADOS_ACTIVOS)
    .order("creado_en", { ascending: true });
  if (error) throw error;
  const todos = (data ?? []) as Pedido[];
  return {
    activo: todos.find((p) => p.repartidor_id === uid) ?? null,
    disponibles: todos.filter((p) => p.estado === "buscando"),
  };
}

export async function reclamarPedido(id: string) {
  const { error } = await supabase.rpc("reclamar_pedido", { p_id: id });
  if (error) throw error;
}

export async function avanzarPedido(id: string, estado: EstadoPedido, totalProductos?: number) {
  const { error } = await supabase.rpc("avanzar_pedido", {
    p_id: id,
    p_estado: estado,
    p_total_productos: totalProductos ?? null,
  });
  if (error) throw error;
}

export async function enviarUbicacion(pedidoId: string, lat: number, lng: number) {
  const { error } = await supabase.rpc("actualizar_ubicacion", { p_pedido: pedidoId, p_lat: lat, p_lng: lng });
  if (error) throw error;
}

export async function cambiarDisponibilidad(uid: string, disponible: boolean) {
  const { error } = await supabase.from("repartidores").update({ disponible }).eq("id", uid);
  if (error) throw error;
}

/** Avisa cuando cambia cualquier pedido visible para el repartidor (RLS ya filtra por barrio/sector). */
export function suscribirPedidosRepartidor(alCambiar: () => void): () => void {
  const canal = supabase
    .channel("pedidos-repartidor")
    .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, alCambiar)
    .subscribe();
  return () => {
    void supabase.removeChannel(canal);
  };
}

// ---------- Acompañamiento ----------
export async function solicitarAcompanamiento(uid: string, tipo: string, detalle: string, barrioId: number | null) {
  const { error } = await supabase
    .from("solicitudes_acompanamiento")
    .insert({ user_id: uid, tipo, detalle: detalle || null, barrio_id: barrioId });
  if (error) throw error;
}

// ---------- Asistente de voz (Edge Function) ----------
export interface Turno {
  rol: "usuario" | "asistente";
  texto: string;
}

export async function interpretarPedido(texto: string, historial: Turno[]): Promise<RespuestaIA> {
  const { data, error } = await supabase.functions.invoke("interpretar-pedido", { body: { texto, historial } });
  if (error) throw error;
  return data as RespuestaIA;
}
