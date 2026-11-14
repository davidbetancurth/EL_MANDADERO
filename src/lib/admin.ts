
import { supabase } from "./supabase";

export async function listarSolicitudesAdmin() {
  const { data, error } = await supabase
    .from("solicitudes_repartidor")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function resolverSolicitudAdmin(
  solicitudId: string,
  aprobar: boolean
) {
  const { data, error } = await supabase.rpc(
    aprobar
      ? "aprobar_solicitud_repartidor"
      : "rechazar_solicitud_repartidor",
    { solicitud_id: solicitudId }
  );

  if (error) throw error;

  return data;
}
