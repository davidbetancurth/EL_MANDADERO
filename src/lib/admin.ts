
import { supabase } from "./supabase";

/**
 * Obtiene todas las solicitudes de repartidores.
 * Solo los administradores autorizados podrán consultar
 * las solicitudes de otros usuarios gracias a RLS.
 */
export async function listarSolicitudesAdmin() {
  const { data, error } = await supabase
    .from("solicitudes_repartidor")
    .select(`
      id,
      barrio_id,
      vehiculo,
      estado,
      creado_en,
      resuelto_en
    `)
    .order("creado_en", { ascending: false });

  if (error) {
    console.error("Error al listar solicitudes:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Aprueba o rechaza una solicitud.
 * La autorización se verifica en Supabase mediante es_admin().
 */
export async function resolverSolicitudAdmin(
  solicitudId: string,
  aprobar: boolean
) {
  if (!solicitudId) {
    throw new Error("ID de solicitud no válido.");
  }

  const funcion = aprobar
    ? "aprobar_solicitud_repartidor"
    : "rechazar_solicitud_repartidor";

  const { data, error } = await supabase.rpc(funcion, {
    p_solicitud_id: solicitudId,
  });

  if (error) {
    console.error("Error al resolver solicitud:", error);
    throw error;
  }

  return data;
}

