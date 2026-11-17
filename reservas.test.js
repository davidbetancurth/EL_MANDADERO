const test = require("node:test");
const assert = require("node:assert");
const { calcularAnticipo, calcularDevolucion } = require("./reservas");

// CP-08 a CP-11 · tabla de decisión (franja x socio) y límite 17/18
const anticipos = [
  ["CP-08", 17, false, 60000],
  ["CP-09", 18, false, 75000],
  ["CP-10", 17, true, 54000],
  ["CP-11", 18, true, 67500],
];
for (const [caso, hora, esSocio, esperado] of anticipos) {
  test(`${caso}: anticipo a las ${hora} (socio: ${esSocio}) = ${esperado}`, () => {
    assert.strictEqual(calcularAnticipo(hora, esSocio), esperado);
  });
}

// CP-02 y CP-04 · límites válidos; CP-03 y CP-05 · límites inválidos
for (const [caso, hora] of [["CP-02", 6], ["CP-04", 21]]) {
  test(`${caso}: las ${hora} se aceptan`, () => {
    assert.ok(calcularAnticipo(hora, false) > 0);
  });
}
for (const [caso, hora] of [["CP-03", 5], ["CP-05", 22]]) {
  test(`${caso}: las ${hora} se rechazan`, () => {
    assert.throws(() => calcularAnticipo(hora, false), /fuera de servicio/);
  });
}

// CP-16, CP-17, límite de 2 h y CP-18 · RN-7
const devoluciones = [
  ["CP-16", 24 * 60, 75000],
  ["CP-17", 24 * 60 - 1, 37500],
  ["C2-limite", 2 * 60, 37500],
];
for (const [caso, minutos, esperado] of devoluciones) {
  test(`${caso}: cancelar ${minutos} min antes devuelve ${esperado}`, () => {
    assert.strictEqual(calcularDevolucion(minutos, 75000), esperado);
  });
}
test("CP-18: cancelar con menos de 2 h se rechaza", () => {
  assert.throws(() => calcularDevolucion(2 * 60 - 1, 75000), /Ya no se puede cancelar/);
});
