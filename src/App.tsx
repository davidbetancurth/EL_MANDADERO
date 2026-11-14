
import { useCallback, useEffect, useMemo, useState } from "react";
import { SesionCtx } from "./context";
import { Cargando, Shell } from "./components/ui";
import {
  listarBarrios,
  obtenerPerfil,
  obtenerRepartidor,
} from "./lib/api";
import type { Go, NavParams, Screen } from "./lib/nav";
import { supabase, supabaseConfigurado } from "./lib/supabase";
import type {
  Barrio,
  Perfil,
  RepartidorInfo,
} from "./lib/types";

import { Admin } from "./screens/Admin";
import { Companion } from "./screens/Companion";
import { ConfigFaltante } from "./screens/ConfigFaltante";
import { CourierHome } from "./screens/CourierHome";
import { CourierPedido } from "./screens/CourierPedido";
import { CourierPending } from "./screens/CourierPending";
import { Home } from "./screens/Home";
import { Login } from "./screens/Login";
import { Orders } from "./screens/Orders";
import { Pedir } from "./screens/Pedir";
import { Profile } from "./screens/Profile";
import { Register } from "./screens/Register";
import { Tracking } from "./screens/Tracking";
import { Voice } from "./screens/Voice";
import { Welcome } from "./screens/Welcome";

const PUBLICAS: Screen[] = [
  "welcome",
  "login",
  "register",
  "config",
];

const SOLO_USUARIO: Screen[] = [
  "voice",
  "home",
  "pedir",
  "orders",
  "companion",
];

const SOLO_REPARTIDOR: Screen[] = [
  "courier-home",
  "courier-pedido",
  "courier-pending",
];

export default function App() {
  const [screen, setScreen] = useState<Screen>(
    supabaseConfigurado ? "welcome" : "config"
  );

  const [params, setParams] = useState<NavParams>({});
  const [cargando, setCargando] = useState(supabaseConfigurado);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [repartidor, setRepartidor] =
    useState<RepartidorInfo | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);

  const go: Go = useCallback((s, p = {}) => {
    setScreen(s);
    setParams(p);
    window.scrollTo(0, 0);
  }, []);

  const recargar = useCallback(async (): Promise<Perfil | null> => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;

    if (!uid) {
      setPerfil(null);
      setRepartidor(null);
      return null;
    }

    const p = await obtenerPerfil(uid);

    setPerfil(p);

    setRepartidor(
      p?.rol === "repartidor"
        ? await obtenerRepartidor(uid)
        : null
    );

    return p;
  }, []);

  useEffect(() => {
    if (!supabaseConfigurado) return;

    let vivo = true;

    (async () => {
      try {
        const [b, p] = await Promise.all([
          listarBarrios().catch(() => [] as Barrio[]),
          recargar(),
        ]);

        if (!vivo) return;

        setBarrios(b);

        if (p) {
          if (p.rol === "admin") {
            setScreen("admin");
          } else if (p.rol === "repartidor") {
            setScreen("courier-pending");
          } else {
            setScreen("home");
          }
        }
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (evento) => {
        if (evento === "SIGNED_OUT") {
          setPerfil(null);
          setRepartidor(null);
          setScreen("welcome");
        }
      }
    );

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [recargar]);

  const sesion = useMemo(
    () => ({ perfil, repartidor, barrios, recargar }),
    [perfil, repartidor, barrios, recargar]
  );

  // Protección de navegación según el rol y la aprobación.
  let actual: Screen = screen;

  if (!cargando && supabaseConfigurado) {
    if (!perfil && !PUBLICAS.includes(actual)) {
      actual = "welcome";
    } else if (
      perfil?.rol === "admin" &&
      !PUBLICAS.includes(actual) &&
      actual !== "admin"
    ) {
      actual = "admin";
    } else if (perfil?.rol === "repartidor") {
      if (repartidor?.aprobado) {
        if (
          SOLO_USUARIO.includes(actual) ||
          actual === "courier-pending"
        ) {
          actual = "courier-home";
        }
      } else if (!PUBLICAS.includes(actual)) {
        actual = "courier-pending";
      }
    } else if (
      perfil?.rol === "usuario" &&
      SOLO_REPARTIDOR.includes(actual)
    ) {
      actual = "home";
    } else if (
      perfil?.rol === "usuario" &&
      actual === "admin"
    ) {
      actual = "home";
    }
  }

  let vista;

  if (cargando) {
    vista = (
      <Shell>
        <Cargando texto="Abriendo El Mandadero..." />
      </Shell>
    );
  } else {
    switch (actual) {
      case "config":
        vista = <ConfigFaltante />;
        break;

      case "welcome":
        vista = <Welcome go={go} />;
        break;

      case "login":
        vista = <Login go={go} />;
        break;

      case "register":
        vista = (
          <Register
            go={go}
            rol={
              params.rol === "repartidor"
                ? "repartidor"
                : "usuario"
            }
          />
        );
        break;

      case "voice":
        vista = <Voice go={go} />;
        break;

      case "home":
        vista = <Home go={go} />;
        break;

      case "pedir":
        vista = <Pedir go={go} params={params} />;
        break;

      case "tracking":
        vista = (
          <Tracking
            go={go}
            pedidoId={params.pedidoId}
          />
        );
        break;

      case "orders":
        vista = <Orders go={go} />;
        break;

      case "companion":
        vista = <Companion go={go} />;
        break;

      case "profile":
        vista = <Profile go={go} />;
        break;

      case "courier-home":
        vista = <CourierHome go={go} />;
        break;

      case "courier-pedido":
        vista = (
          <CourierPedido
            go={go}
            pedidoId={params.pedidoId}
          />
        );
        break;

      case "courier-pending":
        vista = <CourierPending go={go} />;
        break;

      case "admin":
        vista = <Admin go={go} />;
        break;
    }
  }

  return (
    <SesionCtx.Provider value={sesion}>
      <div
        className={`app-shell ${
          perfil?.letra_grande ? "mm-grande" : ""
        }`}
      >
        {vista}
      </div>
    </SesionCtx.Provider>
  );
}
