import { Shell } from "../components/ui";

export function ConfigFaltante() {
  return (
    <Shell>
      <section className="content">
        <h2>Falta conectar Supabase</h2>
        <p className="lead">
          Crea un archivo <strong>.env</strong> en la raíz del proyecto con estas dos líneas y reinicia el servidor:
        </p>
        <pre style={{ background: "#fff", padding: 14, borderRadius: 14, fontSize: 12, overflowX: "auto" }}>
{`VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY`}
        </pre>
        <p className="lead">Las encuentras en Supabase → Project Settings → API.</p>
      </section>
    </Shell>
  );
}
