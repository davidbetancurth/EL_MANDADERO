export type Rol = "usuario" | "repartidor" | "admin";
export type Vehiculo = "patineta_electrica" | "bicicleta_electrica" | "bicicleta";
export type EstadoPedido =
  | "buscando"
  | "asignado"
  | "comprando"
  | "en_camino"
  | "entregado"
  | "cancelado";
export type TipoPedido = "mandado" | "factura";

/** Velocidad media supuesta para calcular el tiempo estimado (km/h). Ajusta con datos reales. */
export const VEHICULOS: Record<Vehiculo, { label: string; kmh: number }> = {
  patineta_electrica: { label: "Patineta eléctrica", kmh: 16 },
  bicicleta_electrica: { label: "Bicicleta eléctrica", kmh: 16 },
  bicicleta: { label: "Bicicleta", kmh: 10 },
};

export const ESTADOS_ACTIVOS: EstadoPedido[] = ["buscando", "asignado", "comprando", "en_camino"];

export interface Barrio {
  id: number;
  nombre: string;
  sector_id: number | null;
  sectores: { nombre: string } | null;
}

export interface Perfil {
  id: string;
  rol: Rol;
  nombre_completo: string;
  edad: number;
  tipo_documento: "CC" | "CE";
  documento: string;
  celular: string;
  correo: string | null;
  barrio_id: number | null;
  letra_grande: boolean;
  saludo_voz: boolean;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_celular: string | null;
}

export interface RepartidorInfo {
  id: string;
  barrio_id: number;
  cupo: number;
  vehiculo: Vehiculo;
  disponible: boolean;
  aprobado: boolean;
  calificacion: number;
}

export interface Direccion {
  id: string;
  etiqueta: string;
  direccion: string;
  indicaciones: string | null;
  barrio_id: number | null;
  lat: number | null;
  lng: number | null;
  es_principal: boolean;
}

export interface ItemPedido {
  producto: string;
  cantidad: number;
  unidad?: string | null;
  nota?: string | null;
}

export interface Pedido {
  id: string;
  numero: number;
  tipo: TipoPedido;
  user_id: string;
  repartidor_id: string | null;
  barrio_id: number;
  estado: EstadoPedido;
  items: ItemPedido[];
  sitio_sugerido: string | null;
  presupuesto_max: number | null;
  direccion_texto: string;
  lat: number | null;
  lng: number | null;
  notas: string | null;
  total_productos: number | null;
  costo_domicilio: number;
  cliente_nombre: string | null;
  cliente_celular: string | null;
  repartidor_nombre: string | null;
  repartidor_celular: string | null;
  vehiculo: Vehiculo | null;
  creado_en: string;
}

export interface Ubicacion {
  pedido_id: string;
  lat: number;
  lng: number;
  actualizado_en: string;
}

export interface BorradorPedido {
  items: ItemPedido[];
  tipo: TipoPedido;
  sitio_sugerido?: string | null;
  presupuesto_max?: number | null;
  transcripcion?: string;
}

export interface RespuestaIA extends BorradorPedido {
  estado: "listo" | "faltan_datos" | "no_entendi";
  pregunta?: string;
  resumen_voz?: string;
}

export const formatoPesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

export const describirItem = (i: ItemPedido) =>
  `${i.cantidad} ${i.unidad ? `${i.unidad} de ` : ""}${i.producto}`;
