const MENSAJES: Record<string, string> = {
  BARRIO_LLENO: "Este barrio ya tiene sus 6 repartidores. Prueba con un barrio vecino o ponte en lista de espera.",
  MENOR_DE_EDAD: "Debes ser mayor de 18 años para registrarte.",
  SIN_CONSENTIMIENTO: "Necesitamos que aceptes el tratamiento de datos para continuar.",
  YA_REGISTRADO: "Este documento ya tiene una cuenta. Inicia sesión.",
  SIN_VEHICULO: "Elige tu vehículo.",
  SIN_BARRIO: "Elige el barrio donde estás.",
  BARRIO_INVALIDO: "Ese barrio no está disponible.",
  SIN_DIRECCION: "Escribe o marca la dirección de entrega.",
  LISTA_INVALIDA: "Tu lista está vacía o es demasiado larga.",
  DEMASIADOS_PEDIDOS: "Ya tienes 3 pedidos en curso. Espera a que llegue alguno.",
  SOLO_USUARIOS: "Solo los usuarios pueden hacer pedidos.",
  NO_APROBADO: "Tu cuenta de repartidor aún está en revisión.",
  YA_TIENES_PEDIDO: "Termina tu pedido actual antes de tomar otro.",
  PEDIDO_NO_DISPONIBLE: "Otro repartidor ya tomó este pedido.",
  FUERA_DE_ZONA: "Este pedido es de otro sector.",
  TRANSICION_INVALIDA: "Ese paso no corresponde al estado actual del pedido.",
  SIN_TOTAL: "Escribe cuánto costó la compra.",
  SUPERA_PRESUPUESTO: "El total supera el tope que puso el cliente. Llámalo para confirmar.",
  NO_SE_PUEDE_CANCELAR: "Este pedido ya no se puede cancelar.",
  CONFIRMACION_ACTIVA:
    "Tu proyecto de Supabase exige confirmar el correo. Desactiva 'Confirm email' en Authentication → Providers → Email.",
};

export function mensajeError(e: unknown): string {
  let m = "";
  if (e instanceof Error) m = e.message;
  else if (typeof e === "object" && e && "message" in e) m = String((e as { message: unknown }).message);
  else m = String(e);

  for (const k of Object.keys(MENSAJES)) if (m.includes(k)) return MENSAJES[k];
  if (/duplicate key|23505/i.test(m)) return "Ese documento ya está registrado.";
  if (/already registered|already been registered/i.test(m)) return "Ese documento ya tiene cuenta. Inicia sesión.";
  if (/invalid login credentials/i.test(m)) return "Documento o PIN incorrectos.";
  if (/failed to fetch|network/i.test(m)) return "No hay conexión. Revisa tu internet e intenta de nuevo.";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera un momento.";
  return "Algo salió mal. Intenta de nuevo.";
}
