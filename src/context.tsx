import { createContext, useContext } from "react";
import type { Barrio, Perfil, RepartidorInfo } from "./lib/types";

export interface Sesion {
  perfil: Perfil | null;
  repartidor: RepartidorInfo | null;
  barrios: Barrio[];
  /** Vuelve a leer el perfil desde Supabase y lo devuelve. */
  recargar: () => Promise<Perfil | null>;
}

export const SesionCtx = createContext<Sesion>({
  perfil: null,
  repartidor: null,
  barrios: [],
  recargar: async () => null,
});

export const useSesion = () => useContext(SesionCtx);
