
import { supabase } from "./supabase";
import type { Rol, Vehiculo } from "./types";

export const soloDigitos = (s: string) => s.replace(/\D/g, "");

export async function iniciarSesion(correo: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password,
  });

  if (error) throw error;
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export interface DatosRegistro {
  rol: Exclude<Rol, "admin">;
  nombre: string;
  edad: number;
  tipoDocumento: "CC" | "CE";
  documento: string;
  celular: string;
  correo: string;
  password: string;
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
  const correo = d.correo.trim().toLowerCase();

  // Crear la cuenta con el correo real y la contraseña elegida.
  const alta = await supabase.auth.signUp({
    email: correo,
    password: d.password,
  });

  let sesion = alta.data.session;

  // Si ya existe una cuenta de un intento anterior, intentamos recuperar
  // la sesión con las mismas credenciales.
  if (alta.error) {
    if (/already registered|already been registered/i.test(alta.error.message)) {
      const acceso = await supabase.auth.signInWithPassword({
        email: correo,
        password: d.password,
      });

      if (acceso.error) throw new Error("Este correo ya tiene una cuenta. Inicia sesión.");
      sesion = acceso.data.session;
    } else {
      throw alta.error;
    }
  }

  if (!sesion) {
    throw new Error("No se pudo iniciar la sesión. Revisa la configuración de confirmación de correo en Supabase.");
  }

  const uid = sesion.user.id;

  // Subir las fotos al bucket privado.
  const subir = async (f: File | null, nombre: string) => {
    if (!f) return null;

    const ext = (f.name.split(".").pop() ?? "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const ruta = `${uid}/${nombre}.${ext || "jpg"}`;

    const { error } = await supabase.storage
      .from("verificaciones")
      .upload(ruta, f, {
        upsert: true,
        contentType: f.type || "image/jpeg",
      });

    if (error) throw error;
    return ruta;
  };

  const rutaSelfie = await subir(fotos.selfie, "selfie");
  const rutaFrente = await subir(fotos.frente, "doc-frente");
  const rutaReverso = await subir(fotos.reverso, "doc-reverso");

  // Guardar el perfil y los demás datos mediante la función de Supabase.
  const { error } = await supabase.rpc("completar_registro", {
    p_rol: d.rol,
    p_nombre: d.nombre,
    p_edad: d.edad,
    p_tipo_doc: d.tipoDocumento,
    p_documento: soloDigitos(d.documento),
    p_celular: soloDigitos(d.celular),
    p_correo: correo,
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
