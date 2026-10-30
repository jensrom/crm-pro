"use client";

import { createContext, useContext } from "react";

/**
 * Hvem må slette. Gennemgående regel: kun Administrator og Superadministrator
 * kan slette noget; logbogsposter kan kun slettes af Superadministrator.
 * Sættes én gang i appens layout ud fra den indloggede bruger. BekraeftSlet
 * læser den og viser ingen slet-knap til brugere, der ikke må slette.
 * Serveren håndhæver det samme i hver slet-handling.
 */
export type SletNiveau = "admin" | "superadmin";

const SletRet = createContext<{ admin: boolean; superadmin: boolean }>({ admin: false, superadmin: false });

export function SletRetProvider({ admin, superadmin, children }: { admin: boolean; superadmin: boolean; children: React.ReactNode }) {
  return <SletRet.Provider value={{ admin, superadmin }}>{children}</SletRet.Provider>;
}

export function useMaaSlette(niveau: SletNiveau = "admin") {
  const r = useContext(SletRet);
  return niveau === "superadmin" ? r.superadmin : r.admin;
}
