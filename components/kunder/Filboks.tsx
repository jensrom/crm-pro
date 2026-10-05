import { Paperclip, Upload, Download, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import {
  FILKATEGORIER,
  FILKATEGORI_LABEL,
  FILKATEGORI_LABEL_ENTAL,
} from "@/lib/attachment-categories";
import { uploadFil, sletFil, flytFilKategori } from "@/app/actions/filer";

export type FilRaekke = {
  id: string;
  filename: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: string | null;
};

function filstoerrelse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Filboks -- upload + liste grupperet pr. kategori (kontrakt, plan,
 * moedereferat, email, andet). Ingen klient-JS: almindelige <form
 * action={...}> ligesom resten af CRM-Pro.
 */
export function Filboks({ companyId, filer, forStor = false }: { companyId: string; filer: FilRaekke[]; forStor?: boolean }) {
  const grupper = FILKATEGORIER
    .map((kat) => ({ kat, rows: filer.filter((f) => f.category === kat) }))
    .filter((g) => g.rows.length > 0);

  return (
    <Card>
      <div id="filer" className="scroll-mt-24" />
      <CardHeader title="Filer" description="Kontrakter, planer, mødereferater og andet på denne kunde. Højst 4 MB pr. fil." />
      <CardBody className="flex flex-col gap-5">
        {forStor && (
          <p className="text-sm text-danger rounded-lg bg-danger/[0.08] px-3 py-2">Filen er for stor. Grænsen er 4 MB pr. fil.</p>
        )}
        <form
          action={uploadFil.bind(null, companyId)}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4"
        >
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="filupload">Vælg fil</Label>
            <input
              id="filupload"
              name="file"
              type="file"
              required
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
            />
          </div>
          <div>
            <Label htmlFor="filkategori">Gemmes som</Label>
            <Select id="filkategori" name="category" defaultValue="andet" className="w-40">
              {FILKATEGORIER.map((k) => (
                <option key={k} value={k}>{FILKATEGORI_LABEL_ENTAL[k]}</option>
              ))}
            </Select>
          </div>
          <Button size="sm" type="submit"><Upload className="h-3.5 w-3.5" /> Upload</Button>
        </form>

        {filer.length === 0 ? (
          <EmptyState title="Ingen filer endnu" icon={Paperclip} description="Kontrakter, planer og mødereferater havner her." />
        ) : (
          <div className="flex flex-col gap-5">
            {grupper.map(({ kat, rows }) => (
              <div key={kat}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {FILKATEGORI_LABEL[kat]} ({rows.length})
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {rows.map((f) => (
                    <li key={f.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/api/filer/${f.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:text-primary truncate block"
                        >
                          {f.filename}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {filstoerrelse(f.sizeBytes)}
                          {f.uploadedBy ? ` · uploadet af ${f.uploadedBy}` : ""}
                        </p>
                      </div>
                      <form action={flytFilKategori.bind(null, f.id)} className="flex items-center gap-1.5 shrink-0">
                        <Select name="category" defaultValue={f.category} aria-label="Flyt til anden kategori" className="h-8 text-xs w-36">
                          {FILKATEGORIER.map((k) => (
                            <option key={k} value={k}>{FILKATEGORI_LABEL_ENTAL[k]}</option>
                          ))}
                        </Select>
                        <Button size="sm" variant="ghost" type="submit" className="text-xs px-2">Flyt</Button>
                      </form>
                      <a
                        href={`/api/filer/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded shrink-0"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <form action={sletFil.bind(null, f.id)} className="shrink-0">
                        <button type="submit" aria-label={`Slet ${f.filename}`} className="text-muted-foreground hover:text-danger p-1.5 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
