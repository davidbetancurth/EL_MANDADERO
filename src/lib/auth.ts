import { supabase } from "./supabase";
import type { Rol, Vehiculo } from "./types";

// Supabase Auth trabaja con correo+contraseña. Usamos el documento como "correo interno"
// y el PIN (con un prefijo, porque Supabase exige mínimo 6 caracteres) como contraseña.
// OJO: un PIN de 4 dígitos es débil; depende de los límites de intentos de Supabase.
// Para producción se recomienda migrar a OTP por celular (ver README).
const DOMINIO = import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? "elmandadero.app";

export const soloDigitos = (s: string) => s.replace(/\D/g, "");
const emailDe = (documento: string) => `${soloDigitos(documento)}@${DOMINIO}`;
const claveDe = (pin: string) => `mandadero-${pin}`;

export async function iniciarSesion(documento: string, pin: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailDe(documento),
    password: claveDe(pin),
  });
  if (error) throw error;
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

export interface DatosRegistro {
  rol: Exclude<Rol, "admin">;
  nombre: string;
  edad: number;
  tipoDocumento: "CC" | "CE";
  documento: string;
  celular: string;
  correo: string;
  pin: string;
  direccion: string;
  barrioId: number | null;
  barrioTexto: string;
  indicaciones: string;
  lat: number | null;
  lng: number | null;
  vehiculo: Vehiculo | null;
  aceptaDatos: boolean;
  aceptaBiometricos: boolean;
  aceptaUbicacion: boolean;
}

export interface FotosRegistro {
  selfie: File | null;
  frente: File | null;
  reverso: File | null;
}

export async function registrar(d: DatosRegistro, fotos: FotosRegistro) {
  // 1) Para repartidores, confirmamos el cupo ANTES de crear la cuenta
  if (d.rol === "repartidor" && d.barrioId !== null) {
    const { data } = await supabase.rpc("cupos_libres", { p_barrio: d.barrioId });
    if (typeof data === "number" && data <= 0) throw new Error("BARRIO_LLENO");
  }

  // 2) Crear (o recuperar) la cuenta de acceso
  const credenciales = { email: emailDe(d.documento), password: claveDe(d.pin) };
  const alta = await supabase.auth.signUp(credenciales);
  let sesion = alta.data.session;
  if (alta.error) {
    if (/already registered/i.test(alta.error.message)) {
      // Cuenta de acceso huérfana de un intento anterior: reintentamos con ella
      const r = await supabase.auth.signInWithPassword(credenciales);
      if (r.error) throw new Error("already registered");
      sesion = r.data.session;
    } else throw alta.error;
  }
  if (!sesion) throw new Error("CONFIRMACION_ACTIVA");
  const uid = sesion.user.id;

  // 3) Subir fotos al bucket privado (carpeta = id del usuario)
  const subir = async (f: File | null, nombre: string) => {
    if (!f) return null;
    const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ruta = `${uid}/${nombre}.${ext || "jpg"}`;
    const { error } = await supabase.storage
      .from("verificaciones")
      .upload(ruta, f, { upsert: true, contentType: f.type || "image/jpeg" });
    if (error) throw error;
    return ruta;
  };

  const rutaSelfie = await subir(fotos.selfie, "selfie");
  const rutaFrente = await subir(fotos.frente, "doc-frente");
  const rutaReverso = await subir(fotos.reverso, "doc-reverso");

  // 4) Crear perfil, dirección, consentimiento y cupo
  const { error } = await supabase.rpc("completar_registro", {
    p_rol: d.rol,
    p_nombre: d.nombre,
    p_edad: d.edad,
    p_tipo_doc: d.tipoDocumento,
    p_documento: soloDigitos(d.documento),
    p_celular: soloDigitos(d.celular),
    p_correo: d.correo || null,
    p_direccion: d.direccion,
    p_barrio_id: d.barrioId,
    p_barrio_texto: d.barrioTexto || null,
    p_indicaciones: d.indicaciones || null,
    p_lat: d.lat,
    p_lng: d.lng,
    p_vehiculo: d.vehiculo,
    p_acepta_datos: d.aceptaDatos,
    p_acepta_biometricos: d.aceptaBiometricos,
    p_acepta_ubicacion: d.aceptaUbicacion,
    p_ruta_selfie: rutaSelfie,
    p_ruta_doc_frente: rutaFrente,
    p_ruta_doc_reverso: rutaReverso,
  });
  if (error) throw error;
}
