import { useMemo, useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Header, Icon, PinInput, Shell } from "../components/ui";
import { registrar, soloDigitos } from "../lib/auth";
import { mensajeError } from "../lib/errores";
import { cuposLibres } from "../lib/api";
import { geocodificar } from "../lib/geo";
import type { Go } from "../lib/nav";
import { VEHICULOS, type Rol, type Vehiculo } from "../lib/types";

type Paso = "datos" | "ubicacion" | "contacto" | "vehiculo" | "rostro" | "documento" | "permisos";

const ETIQUETAS: Record<Paso, string> = {
  datos: "Tus datos",
  ubicacion: "Ubicación",
  contacto: "Contacto",
  vehiculo: "Tu vehículo",
  rostro: "Tu rostro",
  documento: "Documento",
  permisos: "Permisos",
};

function SelectorFoto({
  titulo,
  archivo,
  onChange,
  camara,
}: {
  titulo: string;
  archivo: File | null;
  onChange: (f: File | null) => void;
  camara: "user" | "environment";
}) {
  return (
    <label className="upload-card" style={{ cursor: "pointer" }}>
      <Icon name={archivo ? "check" : "plus"} />
      <strong>{titulo}</strong>
      <span>{archivo ? archivo.name : "Toca para abrir la cámara"}</span>
      <input
        type="file"
        accept="image/*"
        capture={camara}
        style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export function Register({ go, rol }: { go: Go; rol: Exclude<Rol, "admin"> }) {
  const { barrios, recargar } = useSesion();
  const esRepartidor = rol === "repartidor";
  const pasos: Paso[] = esRepartidor
    ? ["datos", "ubicacion", "contacto", "vehiculo", "rostro", "documento", "permisos"]
    : ["datos", "ubicacion", "contacto", "rostro", "documento", "permisos"];

  const [indice, setIndice] = useState(0);
  const paso = pasos[indice];

  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [tipoDoc, setTipoDoc] = useState<"CC" | "CE" | "">("");
  const [documento, setDocumento] = useState("");
  const [direccion, setDireccion] = useState("");
  const [filtro, setFiltro] = useState("");
  const [barrioId, setBarrioId] = useState("");
  const [noEncuentro, setNoEncuentro] = useState(false);
  const [barrioTexto, setBarrioTexto] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  const [celular, setCelular] = useState("");
  const [correo, setCorreo] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [vehiculo, setVehiculo] = useState<Vehiculo | "">("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [frente, setFrente] = useState<File | null>(null);
  const [reverso, setReverso] = useState<File | null>(null);
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [aceptaBio, setAceptaBio] = useState(false);
  const [aceptaUbic, setAceptaUbic] = useState(false);

  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const barriosFiltrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return f ? barrios.filter((b) => b.nombre.toLowerCase().includes(f)) : barrios;
  }, [barrios, filtro]);

  const validar = (p: Paso): string => {
    switch (p) {
      case "datos":
        if (nombre.trim().length < 5) return "Escribe tu nombre completo.";
        if (!(Number(edad) >= 18 && Number(edad) <= 120)) return "Debes ser mayor de 18 años.";
        if (!tipoDoc) return "Elige el tipo de documento.";
        if (soloDigitos(documento).length < 5 || soloDigitos(documento).length > 12) return "Revisa tu número de documento.";
        return "";
      case "ubicacion":
        if (direccion.trim().length < 5) return "Escribe tu dirección.";
        if (esRepartidor && !barrioId) return "Elige tu barrio.";
        if (!barrioId && !(noEncuentro && barrioTexto.trim().length >= 3)) return "Elige tu barrio o escribe cuál es.";
        return "";
      case "contacto":
        if (!/^3\d{9}$/.test(soloDigitos(celular))) return "Escribe tu celular de 10 dígitos (empieza por 3).";
        if (correo && !/^\S+@\S+\.\S+$/.test(correo)) return "Revisa tu correo.";
        if (pin.length !== 4) return "Tu PIN debe tener 4 dígitos.";
        if (pin !== pin2) return "Los dos PIN no coinciden.";
        if (/^(\d)\1{3}$/.test(pin) || pin === "1234") return "Elige un PIN menos fácil de adivinar.";
        return "";
      case "vehiculo":
        return vehiculo ? "" : "Elige tu vehículo.";
      case "rostro":
        return selfie ? "" : "Necesitamos una foto de tu rostro.";
      case "documento":
        return frente && reverso ? "" : "Sube las dos fotos de tu documento.";
      case "permisos":
        if (!aceptaDatos || !aceptaBio) return "Para continuar debes aceptar el tratamiento de datos.";
        if (esRepartidor && !aceptaUbic) return "Como repartidor debes aceptar compartir tu ubicación durante los pedidos.";
        return "";
    }
  };

  const siguiente = async () => {
    setError("");
    const msg = validar(paso);
    if (msg) return setError(msg);

    if (paso === "ubicacion" && esRepartidor && barrioId) {
      setCargando(true);
      try {
        if ((await cuposLibres(Number(barrioId))) <= 0) return setError(mensajeError(new Error("BARRIO_LLENO")));
      } catch (e) {
        return setError(mensajeError(e));
      } finally {
        setCargando(false);
      }
    }

    if (indice < pasos.length - 1) return setIndice(indice + 1);

    // Último paso: crear la cuenta
    setCargando(true);
    try {
      const punto = await geocodificar(direccion); // opcional: si falla, se registra sin coordenadas
      await registrar(
        {
          rol,
          nombre: nombre.trim(),
          edad: Number(edad),
          tipoDocumento: tipoDoc as "CC" | "CE",
          documento,
          celular,
          correo: correo.trim(),
          pin,
          direccion: direccion.trim(),
          barrioId: barrioId ? Number(barrioId) : null,
          barrioTexto: noEncuentro ? barrioTexto.trim() : "",
          indicaciones: indicaciones.trim(),
          lat: punto?.lat ?? null,
          lng: punto?.lng ?? null,
          vehiculo: vehiculo || null,
          aceptaDatos,
          aceptaBiometricos: aceptaBio,
          aceptaUbicacion: aceptaUbic,
        },
        { selfie, frente, reverso },
      );
      const perfil = await recargar();
      go(perfil?.rol === "repartidor" ? "courier-home" : "voice");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  const atras = () => (indice > 0 ? setIndice(indice - 1) : go("welcome"));

  return (
    <Shell>
      <Header title={esRepartidor ? "Ser repartidor" : "Crear tu cuenta"} onBack={atras} />
      <section className="content">
        <div className="progress-copy">
          <span>
            Paso {indice + 1} de {pasos.length}
          </span>
          <strong>{ETIQUETAS[paso]}</strong>
        </div>
        <div className="progress">
          <span style={{ width: `${((indice + 1) / pasos.length) * 100}%` }} />
        </div>

        {paso === "datos" && (
          <>
            <h2>Empecemos por ti</h2>
            <p className="lead">Escribe tus datos tal como aparecen en tu documento.</p>
            <label>
              Nombre completo
              <input placeholder="Tu nombre y apellidos" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label>
              Edad
              <input type="number" inputMode="numeric" placeholder="Tu edad" value={edad} onChange={(e) => setEdad(e.target.value)} />
            </label>
            <label>
              Tipo de documento
              <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value as "CC" | "CE" | "")}>
                <option value="" disabled>
                  Selecciona una opción
                </option>
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
              </select>
            </label>
            <label>
              Número de documento
              <input inputMode="numeric" placeholder="Sin puntos ni espacios" value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </label>
          </>
        )}

        {paso === "ubicacion" && (
          <>
            <h2>¿Dónde vives?</h2>
            <p className="lead">
              {esRepartidor
                ? "Según tu barrio te asignamos uno de los 6 puestos de repartidor."
                : "Así te conectamos con los repartidores de tu barrio."}
            </p>
            <label>
              Dirección
              <input placeholder="Calle, carrera y número" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </label>
            {!noEncuentro && (
              <>
                <label>
                  Barrio
                  <input placeholder="Escribe para buscar tu barrio" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
                </label>
                {barrios.length === 0 ? (
                  <Aviso>Todavía no hay barrios cargados en el sistema.</Aviso>
                ) : (
                  <label>
                    Elige de la lista ({barriosFiltrados.length})
                    <select value={barrioId} onChange={(e) => setBarrioId(e.target.value)}>
                      <option value="" disabled>
                        Selecciona tu barrio
                      </option>
                      {barriosFiltrados.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nombre}
                          {b.sectores?.nombre ? ` · ${b.sectores.nombre}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {!esRepartidor && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={noEncuentro}
                  onChange={(e) => {
                    setNoEncuentro(e.target.checked);
                    if (e.target.checked) setBarrioId("");
                  }}
                />{" "}
                No encuentro mi barrio
              </label>
            )}
            {noEncuentro && (
              <label>
                ¿Cómo se llama tu barrio?
                <input placeholder="Nombre de tu barrio" value={barrioTexto} onChange={(e) => setBarrioTexto(e.target.value)} />
                <small>Lo revisaremos y lo agregaremos. Mientras tanto, al pedir elegirás el barrio más cercano.</small>
              </label>
            )}
            <label>
              Indicaciones adicionales
              <textarea placeholder="Ej. Casa verde, timbre azul" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} />
            </label>
          </>
        )}

        {paso === "contacto" && (
          <>
            <h2>¿Cómo te contactamos?</h2>
            <p className="lead">Tu celular también te servirá para recibir avisos.</p>
            <label>
              Número de celular
              <input inputMode="numeric" placeholder="300 000 0000" value={celular} onChange={(e) => setCelular(e.target.value)} />
            </label>
            <label>
              Correo <small>(opcional)</small>
              <input type="email" placeholder="nombre@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} />
            </label>
            <label>
              Crea un PIN de 4 dígitos
              <PinInput value={pin} onChange={setPin} etiqueta="PIN, dígito" />
            </label>
            <label>
              Repite tu PIN
              <PinInput value={pin2} onChange={setPin2} etiqueta="Confirmar PIN, dígito" />
            </label>
          </>
        )}

        {paso === "vehiculo" && (
          <>
            <h2>¿Cómo harás los domicilios?</h2>
            <p className="lead">Solo se permiten vehículos sin emisiones.</p>
            <div className="mm-opciones">
              {(Object.keys(VEHICULOS) as Vehiculo[]).map((v) => (
                <button key={v} type="button" className={vehiculo === v ? "sel" : ""} onClick={() => setVehiculo(v)}>
                  <Icon name="bike" />
                  <span>{VEHICULOS[v].label}</span>
                  {vehiculo === v && <Icon name="check" />}
                </button>
              ))}
            </div>
            <Aviso tipo="ok">
              Tu cuenta será revisada (identidad y antecedentes) antes de que puedas recibir pedidos.
            </Aviso>
          </>
        )}

        {paso === "rostro" && (
          <>
            <h2>Verifiquemos tu rostro</h2>
            <p className="lead">Esto protege tu cuenta. Busca un lugar con buena luz.</p>
            <SelectorFoto titulo="Selfie de frente" archivo={selfie} onChange={setSelfie} camara="user" />
          </>
        )}

        {paso === "documento" && (
          <>
            <h2>Foto de tu documento</h2>
            <p className="lead">Asegúrate de que todos los datos se puedan leer.</p>
            <SelectorFoto titulo="Foto de la parte frontal" archivo={frente} onChange={setFrente} camara="environment" />
            <SelectorFoto titulo="Foto de la parte posterior" archivo={reverso} onChange={setReverso} camara="environment" />
          </>
        )}

        {paso === "permisos" && (
          <>
            <h2>Todo listo para terminar</h2>
            <p className="lead">Usaremos tus datos solo para prestar el servicio y proteger tu cuenta.</p>
            <div className="consent">
              <Icon name="shield" />
              <div>
                <strong>Tu privacidad es importante</strong>
                <p>Puedes consultar, actualizar o eliminar tus datos cuando quieras.</p>
              </div>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={aceptaDatos} onChange={(e) => setAceptaDatos(e.target.checked)} /> Acepto el
              tratamiento de mis datos personales.
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={aceptaBio} onChange={(e) => setAceptaBio(e.target.checked)} /> Acepto el
              tratamiento de mis datos biométricos (foto de rostro y documento) para verificar mi identidad.
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={aceptaUbic} onChange={(e) => setAceptaUbic(e.target.checked)} />{" "}
              {esRepartidor
                ? "Acepto compartir mi ubicación mientras tenga un pedido activo."
                : "Acepto usar mi ubicación para encontrar dónde entregar mis pedidos."}
            </label>
            <p className="lead" style={{ fontSize: 13 }}>
              El asistente de voz solo escucha cuando tocas el micrófono. Lo que dices se convierte en texto y un servicio
              de inteligencia artificial lo usa para armar tu pedido.
            </p>
          </>
        )}

        {error && <Aviso>{error}</Aviso>}
        <Button onClick={siguiente} disabled={cargando}>
          {cargando ? "Un momento..." : indice < pasos.length - 1 ? "Continuar" : "Finalizar registro"}
        </Button>
        {paso === "datos" && (
          <button className="help-register" type="button" onClick={() => alert("Escríbenos al soporte de El Mandadero y te ayudamos a registrarte.")}>
            <Icon name="headset" /> Quiero que me ayuden a registrarme
          </button>
        )}
      </section>
    </Shell>
  );
}
