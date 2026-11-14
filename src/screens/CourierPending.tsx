
import { useState } from "react";
import {
  Aviso,
  Button,
  Header,
  Icon,
  Shell,
} from "../components/ui";
import { useSesion } from "../context";
import { obtenerRepartidor } from "../lib/api";
import { mensajeError } from "../lib/errores";
import type { Go } from "../lib/nav";

export function CourierPending({ go }: { go: Go }) {
  const { perfil, recargar } = useSesion();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const verificar = async () => {
    if (!perfil) return;

    setCargando(true);
    setError("");
    setMensaje("");

    try {
      await recargar();

      const repartidor = await obtenerRepartidor(perfil.id);

      if (repartidor?.aprobado) {
        go("courier-home");
        return;
      }

      setMensaje(
        "Tu solicitud todavía está pendiente de aprobación."
      );
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Shell>
      <Header title="Solicitud de repartidor" />

      <section className="content">
        <div className="consent">
          <Icon name="clock" size={34} />
          <div>
            <strong>Estamos revisando tu solicitud</strong>
            <p>
              Gracias por querer formar parte de El Mandadero.
              Nuestro equipo debe verificar tus documentos
              antes de habilitar tu cuenta.
            </p>
          </div>
        </div>

        <h2>¿Qué sigue?</h2>

        <p className="lead">
          Cuando el administrador apruebe tu solicitud,
          podrás conectarte y recibir pedidos.
        </p>

        <Aviso tipo="ok">
          Mientras tu solicitud esté pendiente no podrás
          recibir ni reclamar pedidos.
        </Aviso>

        {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}
        {error && <Aviso>{error}</Aviso>}

        <Button onClick={verificar} disabled={cargando}>
          {cargando
            ? "Comprobando..."
            : "Comprobar estado de mi solicitud"}
        </Button>
      </section>
    </Shell>
  );
}
