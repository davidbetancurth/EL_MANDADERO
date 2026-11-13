import { useRef, type ReactNode } from "react";
import { useSesion } from "../context";
import type { Go, Screen } from "../lib/nav";

export type IconName =
  | "arrow"
  | "bag"
  | "bike"
  | "bill"
  | "cart"
  | "check"
  | "chevron"
  | "clock"
  | "companion"
  | "headset"
  | "home"
  | "location"
  | "market"
  | "mic"
  | "minus"
  | "orders"
  | "plus"
  | "profile"
  | "search"
  | "shield"
  | "sparkle"
  | "star"
  | "store"
  | "volume";

const paths: Record<IconName, ReactNode> = {
  arrow: <path d="m15 18-6-6 6-6" />,
  bag: (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="m6 17 4-7 4 7h-4l3-6h3M9 7h3" />
    </>
  ),
  bill: (
    <>
      <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21V3Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2 11h10l2-7H6" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="17" cy="19" r="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  companion: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M4 20v-2a5 5 0 0 1 10 0v2M16 9v8M13 12h6" />
    </>
  ),
  headset: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 13h3v6H5a1 1 0 0 1-1-1v-5ZM20 13h-3v6h2a1 1 0 0 0 1-1v-5Z" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  market: (
    <>
      <path d="M4 9h16l-1 11H5L4 9Z" />
      <path d="M8 9c0-3 1-5 4-5s4 2 4 5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  orders: (
    <>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  sparkle: (
    <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
  ),
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  store: (
    <>
      <path d="M4 10v10h16V10M3 10l2-6h14l2 6" />
      <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6" />
    </>
  ),
  volume: (
    <>
      <path d="M5 10v4h3l4 4V6L8 10H5Z" />
      <path d="M16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
    </>
  ),
};

export function Icon({
  name,
  size = 24,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <div className="logo-mark">
        <Icon name="bike" size={compact ? 21 : 30} />
      </div>
      {!compact && (
        <div>
          <strong>El Mandadero</strong>
          <span>Tu barrio, más cerca</span>
        </div>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  icon,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
  disabled?: boolean;
}) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick} disabled={disabled} style={disabled ? { opacity: 0.55 } : undefined}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function Header({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="Volver">
          <Icon name="arrow" />
        </button>
      ) : (
        <Logo compact />
      )}
      <h1>{title}</h1>
      {action || <span className="header-spacer" />}
    </header>
  );
}

export function Aviso({ children, tipo = "error" }: { children: ReactNode; tipo?: "error" | "ok" }) {
  return (
    <div className={`mm-aviso ${tipo}`} role={tipo === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Cargando({ texto = "Cargando..." }: { texto?: string }) {
  return <p className="mm-cargando">{texto}</p>;
}

/** Campo de PIN de 4 dígitos (4 casillas con avance automático). */
export function PinInput({ value, onChange, etiqueta = "Dígito" }: { value: string; onChange: (v: string) => void; etiqueta?: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <div className="pin-row">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-label={`${etiqueta} ${i + 1}`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={value[i] ?? ""}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            if (!d) return;
            onChange((value.slice(0, i) + d).slice(0, 4));
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              onChange(value.slice(0, Math.max(0, value[i] ? i : i - 1)));
              if (!value[i]) refs.current[i - 1]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}

const NAV_USUARIO: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: "home", label: "Inicio", icon: "home" },
  { screen: "orders", label: "Pedidos", icon: "orders" },
  { screen: "companion", label: "Acompañar", icon: "companion" },
  { screen: "profile", label: "Perfil", icon: "profile" },
];
const NAV_REPARTIDOR: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: "courier-home", label: "Entregas", icon: "bike" },
  { screen: "profile", label: "Perfil", icon: "profile" },
];

function BottomNav({ current, go }: { current: Screen; go: Go }) {
  const { perfil } = useSesion();
  const items = perfil?.rol === "repartidor" ? NAV_REPARTIDOR : NAV_USUARIO;
  return (
    <nav className="bottom-nav" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((item) => (
        <button key={item.screen} className={current === item.screen ? "active" : ""} onClick={() => go(item.screen)}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Shell({
  children,
  nav,
  current,
  go,
  mic = false,
}: {
  children: ReactNode;
  nav?: boolean;
  current?: Screen;
  go?: Go;
  mic?: boolean;
}) {
  return (
    <main className="phone">
      <div className="screen">{children}</div>
      {mic && go && (
        <button className="mic-fab" onClick={() => go("voice")} aria-label="Abrir asistente de voz">
          <Icon name="mic" size={28} />
        </button>
      )}
      {nav && current && go && <BottomNav current={current} go={go} />}
    </main>
  );
}
