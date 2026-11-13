// Se usa cuando conviertas la app web en app nativa (ver README, sección "App nativa").
// Antes instala:  pnpm add @capacitor/core @capacitor/geolocation && pnpm add -D @capacitor/cli
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.elmandadero.app", // cámbialo por el id de tu organización
  appName: "El Mandadero",
  webDir: "dist",
};

export default config;
