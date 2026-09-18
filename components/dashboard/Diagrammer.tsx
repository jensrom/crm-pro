"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Farverne er valideret for farveblindhed mod både lys og mørk flade.
 * Lys: #2563EB / #10B981 · Mørk: #3B82F6 / #059669
 */
function farver(moerk: boolean) {
  return {
    serie1: moerk ? "#3B82F6" : "#2563EB",
    serie2: moerk ? "#059669" : "#10B981",
    gitter: moerk ? "#334155" : "#E2E8F0",
    tekst: moerk ? "#94A3B8" : "#64748B",
    flade: moerk ? "#1E293B" : "#FFFFFF",
    kant: moerk ? "#334155" : "#E2E8F0",
    ink: moerk ? "#F1F5F9" : "#1E293B",
  };
}

function useMoerk() {
  const [moerk, setMoerk] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const laes = () => setMoerk(el.classList.contains("dark"));
    laes();
    const obs = new MutationObserver(laes);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return moerk;
}

function Boks({ c, children }: { c: ReturnType<typeof farver>; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: c.flade,
        border: `1px solid ${c.kant}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        color: c.ink,
        boxShadow: "0 6px 20px -12px rgba(0,0,0,.45)",
      }}
    >
      {children}
    </div>
  );
}

export function PakkeDiagram({
  data,
}: {
  data: { navn: string; kunder: number; licenser: number; prissat: boolean; farve: string }[];
}) {
  const moerk = useMoerk();
  const c = farver(moerk);

  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Ingen pakker oprettet.</p>;
  }

  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 10, bottom: 4, left: -18 }}>
          <CartesianGrid vertical={false} stroke={c.gitter} />
          <XAxis dataKey="navn" tick={{ fill: c.tekst, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: c.tekst, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: moerk ? "rgba(255,255,255,.04)" : "rgba(15,23,42,.04)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Boks c={c}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
                    <span style={{ color: c.tekst }}>Licenser</span>
                    <span style={{ fontWeight: 600 }}>{payload[0].payload.licenser}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
                    <span style={{ color: c.tekst }}>Kunder</span>
                    <span style={{ fontWeight: 600 }}>{payload[0].payload.kunder}</span>
                  </div>
                </Boks>
              ) : null
            }
          />
          <Bar dataKey="licenser" radius={[4, 4, 0, 0]} maxBarSize={72}>
            <LabelList dataKey="licenser" position="top" style={{ fill: c.tekst, fontSize: 11, fontWeight: 600 }} />
            {data.map((d, i) => (
              <Cell key={i} fill={d.farve} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {data.some((d) => !d.prissat) && (
        <p className="text-xs text-muted-foreground mt-1">
          Uden pris: {data.filter((d) => !d.prissat).map((d) => d.navn).join(", ")} — de licenser tæller ikke
          med i licensværdien.
        </p>
      )}
    </div>
  );
}

export function UdnyttelseDiagram({ data }: { data: { baand: string; antal: number; fuld: boolean }[] }) {
  const moerk = useMoerk();
  const c = farver(moerk);

  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 10, bottom: 4, left: -18 }}>
          <CartesianGrid vertical={false} stroke={c.gitter} />
          <XAxis dataKey="baand" tick={{ fill: c.tekst, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: c.tekst, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: moerk ? "rgba(255,255,255,.04)" : "rgba(15,23,42,.04)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Boks c={c}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
                  <div style={{ color: c.tekst }}>{payload[0].value} kunder</div>
                </Boks>
              ) : null
            }
          />
          <Bar dataKey="antal" radius={[4, 4, 0, 0]} maxBarSize={64}>
            <LabelList dataKey="antal" position="top" style={{ fill: c.tekst, fontSize: 11, fontWeight: 600 }} />
            {data.map((d, i) => (
              <Cell key={i} fill={d.fuld ? "#EF4444" : c.serie1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-1">
        Rød søjle = kunder uden en eneste ledig licens.
      </p>
    </div>
  );
}
