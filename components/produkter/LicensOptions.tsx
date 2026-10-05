/**
 * <option>-elementer til en licens-dropdown, grupperet under deres produkt.
 * Bruges inde i en <Select>.
 */
type L = { id: string; name: string };
export type LicensGruppe = { id: string; navn: string; licenser: L[] };

export function LicensOptions({ grupper, medtag }: { grupper: LicensGruppe[]; medtag?: L | null }) {
  const findes = medtag ? grupper.some((g) => g.licenser.some((l) => l.id === medtag.id)) : true;
  return (
    <>
      {!findes && medtag && <option value={medtag.id}>{medtag.name} (arkiveret)</option>}
      {grupper.map((g) => (
        <optgroup key={g.id} label={g.navn}>
          {g.licenser.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
