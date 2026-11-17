// GolZone · reglas de reservas (RN-1 a RN-4 y RN-7)
const HORA_APERTURA = 6;
const HORA_CIERRE = 21;
const INICIO_NOCHE = 18;
const TARIFA_DIURNA = 120000;
const TARIFA_NOCTURNA = 150000;

function calcularAnticipo(horaInicio, esSocio) {
  if (horaInicio < HORA_APERTURA || horaInicio > HORA_CIERRE) {
    throw new Error("Hora fuera de servicio");
  }
  let tarifa = horaInicio >= INICIO_NOCHE ? TARIFA_NOCTURNA : TARIFA_DIURNA;
  if (esSocio) {
    tarifa = tarifa * 0.9;
  }
  return tarifa * 0.5;
}

function calcularDevolucion(minutosAntes, anticipo) {
  if (minutosAntes < 120) {
    throw new Error("Ya no se puede cancelar");
  }
  if (minutosAntes >= 24 * 60) {
    return anticipo;
  }
  return anticipo * 0.5;
}

module.exports = { calcularAnticipo, calcularDevolucion };
