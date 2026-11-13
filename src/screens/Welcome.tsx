import { Button, Icon, Logo, Shell } from "../components/ui";
import type { Go } from "../lib/nav";

export function Welcome({ go }: { go: Go }) {
  return (
    <Shell>
      <section className="welcome">
        <div className="welcome-art">
          <div className="sun" />
          <div className="house">
            <Icon name="store" size={66} />
          </div>
          <div className="rider">
            <Icon name="bike" size={50} />
          </div>
          <div className="road" />
        </div>
        <div className="welcome-copy">
          <Logo />
          <h1>
            Lo que necesitas,
            <br />
            <em>sin salir de tu barrio.</em>
          </h1>
          <p>Mandados, pagos y compañía de personas de confianza de tu mismo barrio.</p>
        </div>
        <div className="stack">
          <Button onClick={() => go("register", { rol: "usuario" })}>Crear cuenta como usuario</Button>
          <Button variant="secondary" icon="bike" onClick={() => go("register", { rol: "repartidor" })}>
            Quiero ser repartidor
          </Button>
          <Button variant="ghost" onClick={() => go("login")}>
            Ya tengo cuenta · Iniciar sesión
          </Button>
        </div>
        <div className="trust">
          <Icon name="shield" size={18} /> Tus datos están protegidos
        </div>
      </section>
    </Shell>
  );
}
