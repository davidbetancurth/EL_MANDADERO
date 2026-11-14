
import type { BorradorPedido, Rol, TipoPedido } from "./types";

export type Screen =
  | "welcome"
  | "login"
  | "register"
  | "voice"
  | "home"
  | "pedir"
  | "tracking"
  | "orders"
  | "companion"
  | "profile"
  | "courier-home"
  | "courier-pedido"
  | "courier-pending"
  | "config"
  | "admin";

export interface NavParams {
  rol?: Rol;
  borrador?: BorradorPedido;
  pedidoId?: string;
  tipo?: TipoPedido;
}

export type Go = (screen: Screen, params?: NavParams) => void;
