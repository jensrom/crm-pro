import { FARVER, IKONER } from "@/lib/produktstil";

/**
 * Ikon- og farvevalg som almindelige radioknapper. Ingen JavaScript involveret —
 * markeringen er ren CSS, så det virker i formularen præcis som resten af felterne.
 */
export function StilVaelger({
  valgtIkon,
  valgtFarve,
}: {
  valgtIkon?: string | null;
  valgtFarve?: string | null;
}) {
  const ikon = valgtIkon ?? "package";
  const farve = valgtFarve ?? "graa";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="block text-xs font-medium text-muted-foreground mb-2">Mærke</span>
        <div className="flex flex-wrap gap-1.5">
          {IKONER.map(({ key, label, Icon }) => (
            <label key={key} title={label} className="cursor-pointer">
              <input type="radio" name="icon" value={key} defaultChecked={key === ikon} className="sr-only peer" />
              <span className="grid place-items-center h-9 w-9 rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                <Icon className="h-4 w-4" />
                <span className="sr-only">{label}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-xs font-medium text-muted-foreground mb-2">Farve</span>
        <div className="flex flex-wrap gap-2">
          {FARVER.map((f) => (
            <label key={f.key} title={f.label} className="cursor-pointer">
              <input type="radio" name="color" value={f.key} defaultChecked={f.key === farve} className="sr-only peer" />
              <span className="flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-lg border border-border bg-card text-xs text-muted-foreground transition-colors hover:bg-secondary peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                <span className="h-6 w-6 rounded-md" style={{ background: f.bg }} />
                {f.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
