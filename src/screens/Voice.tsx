import { useCallback, useEffect, useRef, useState } from "react";
import { useSesion } from "../context";
import { Aviso, Button, Icon, Logo, Shell, type IconName } from "../components/ui";
import { interpretarPedido, type Turno } from "../lib/api";
import { mensajeError } from "../lib/errores";
import type { Go } from "../lib/nav";
import { describirItem, type RespuestaIA } from "../lib/types";

// Tipos mínimos del reconocimiento de voz del navegador (no vienen en TypeScript).
interface Alternativa {
  transcript: string;
}
interface Resultado {
  isFinal: boolean;
  0: Alternativa;
}
interface EventoVoz {
  resultIndex: number;
  results: ArrayLike<Resultado>;
}
interface Reconocedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type ConstructorVoz = new () => Reconocedor;

function crearReconocedor(): Reconocedor | null {
  const w = window as unknown as { SpeechRecognition?: ConstructorVoz; webkitSpeechRecognition?: ConstructorVoz };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

type Fase = "reposo" | "escuchando" | "pensando" | "respuesta";

export function Voice({ go }: { go: Go }) {
  const { perfil } = useSesion();
  const [fase, setFase] = useState<Fase>("reposo");
  const [parcial, setParcial] = useState("");
  const [respuesta, setRespuesta] = useState<RespuestaIA | null>(null);
  const [historial, setHistorial] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [silenciado, setSilenciado] = useState(false);
  const rec = useRef<Reconocedor | null>(null);
  const soportaVoz = typeof window !== "undefined" && crearReconocedor() !== null;
  const nombre = perfil?.nombre_completo.split(" ")[0] ?? "";

  const hablar = useCallback(
    (t: string) => {
      if (silenciado || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "es-CO";
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    },
    [silenciado],
  );

  // Saludo con voz (si la persona lo tiene activado en su perfil)
  useEffect(() => {
    if (perfil?.saludo_voz) hablar(`Hola ${nombre}. ¿Qué necesitas hoy?`);
    return () => {
      if (rec.current) {
        rec.current.onend = null;
        rec.current.onerror = null;
        rec.current.onresult = null;
        rec.current.abort();
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviar = async (dicho: string) => {
    const limpio = dicho.trim();
    if (!limpio) {
      setFase("reposo");
      return setError("No alcancé a escucharte. Toca el micrófono e inténtalo otra vez.");
    }
    setFase("pensando");
    setError("");
    try {
      const r = await interpretarPedido(limpio, historial);
      const dichoAsistente = r.estado === "listo" ? (r.resumen_voz ?? "¿Hacemos el pedido?") : (r.pregunta ?? "¿Me lo repites?");
      setHistorial((h) => [...h, { rol: "usuario", texto: limpio }, { rol: "asistente", texto: dichoAsistente }]);
      setRespuesta({ ...r, transcripcion: [...historial.filter((t) => t.rol === "usuario").map((t) => t.texto), limpio].join(". ") });
      setFase("respuesta");
      hablar(dichoAsistente);
    } catch (e) {
      setFase("reposo");
      setError(mensajeError(e));
    }
  };

  const alternarMicrofono = () => {
    setError("");
    if (fase === "escuchando") {
      rec.current?.stop();
      return;
    }
    const r = crearReconocedor();
    if (!r) return setError("Este celular no permite dictar por voz. Escribe lo que necesitas.");
    rec.current = r;
    r.lang = "es-CO";
    r.interimResults = true;
    r.continuous = false;
    let ultimo = "";
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      ultimo = t;
      setParcial(t);
    };
    r.onerror = (e) => {
      setFase("reposo");
      setError(
        e.error === "not-allowed"
          ? "Necesito permiso para usar el micrófono. Actívalo en los ajustes del celular."
          : "No pude escucharte. Intenta de nuevo o escribe lo que necesitas.",
      );
    };
    r.onend = () => {
      setFase((f) => (f === "escuchando" ? "pensando" : f));
      void enviar(ultimo);
    };
    setParcial("");
    setFase("escuchando");
    window.speechSynthesis?.cancel();
    r.start();
  };

  const reiniciar = () => {
    setRespuesta(null);
    setHistorial([]);
    setParcial("");
    setFase("reposo");
  };

  const atajos: [IconName, string, () => void][] = [
    ["bag", "Pedir un mandado", () => go("pedir")],
    ["bill", "Pagar una factura", () => go("pedir", { tipo: "factura" })],
    ["companion", "Pedir acompañamiento", () => go("companion")],
  ];

  const mostrandoRespuesta = fase === "respuesta" && respuesta;
  const listo = mostrandoRespuesta && respuesta.estado === "listo";

  return (
    <Shell>
      <section className="voice-screen">
        <div className="voice-top">
          <Logo compact />
          <button onClick={() => go("home")}>Saltar</button>
        </div>
        <div className="ai-label">
          <Icon name="sparkle" size={18} /> ASISTENTE DE VOZ
        </div>
        <h1>
          {listo ? (
            "¿Hacemos el pedido?"
          ) : mostrandoRespuesta ? (
            respuesta.pregunta
          ) : (
            <>
              Hola, {nombre}.
              <br />
              <em>¿Qué necesitas hoy?</em>
            </>
          )}
        </h1>

        {listo ? (
          <>
            <div className="understood">
              <div className="understood-icon">
                <Icon name="check" />
              </div>
              <span>Entendí</span>
              {respuesta.items.map((i, k) => (
                <strong key={k}>{describirItem(i)}</strong>
              ))}
              {respuesta.sitio_sugerido && <p>de {respuesta.sitio_sugerido}</p>}
              {respuesta.presupuesto_max ? <p>Máximo ${respuesta.presupuesto_max.toLocaleString("es-CO")}</p> : null}
            </div>
            <div className="stack">
              <Button onClick={() => go("pedir", { borrador: respuesta })}>Sí, continuar</Button>
              <Button variant="secondary" onClick={reiniciar}>
                Corregir
              </Button>
              <Button variant="ghost" onClick={() => go("home")}>
                No, ir al inicio
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="voice-status">
              {fase === "escuchando" ? "Te estoy escuchando..." : fase === "pensando" ? "Pensando..." : mostrandoRespuesta ? "Toca el micrófono y respóndeme" : "Toca el micrófono y háblame"}
            </p>
            <button className="voice-orb" onClick={alternarMicrofono} disabled={fase === "pensando"} aria-label="Hablar">
              <i />
              <i />
              <i />
              <Icon name="mic" size={45} />
            </button>
            {parcial && fase !== "respuesta" && <div className="transcript">“{parcial}”</div>}
            <p className="hint">Solo escucho cuando tocas el micrófono</p>
            {error && <Aviso>{error}</Aviso>}
            {(!soportaVoz || fase === "reposo" || fase === "respuesta") && (
              <div className="mm-escribir">
                <input
                  placeholder="O escribe aquí lo que necesitas"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && texto.trim()) {
                      const t = texto;
                      setTexto("");
                      void enviar(t);
                    }
                  }}
                />
                <button
                  disabled={!texto.trim()}
                  onClick={() => {
                    const t = texto;
                    setTexto("");
                    void enviar(t);
                  }}
                >
                  Enviar
                </button>
              </div>
            )}
            <div className="voice-shortcuts">
              <span>También puedes tocar una opción</span>
              {atajos.map(([icono, etiqueta, accion]) => (
                <button key={etiqueta} onClick={accion}>
                  <Icon name={icono} />
                  {etiqueta}
                  <Icon name="chevron" size={20} />
                </button>
              ))}
            </div>
          </>
        )}
        <button
          className="sound"
          onClick={() => {
            setSilenciado(!silenciado);
            window.speechSynthesis?.cancel();
          }}
        >
          <Icon name="volume" size={18} /> {silenciado ? "Activar voz" : "Silenciar voz"}
        </button>
      </section>
    </Shell>
  );
}
