/**
 * Verrou structurel : AUCUNE route API ne doit pouvoir creer un SUPERADMIN.
 *
 * L'exigence est « aucun moyen de creer un superadmin depuis l'interface :
 * uniquement par un script CLI ». Un test de comportement ne peut pas le
 * prouver — il faudrait essayer toutes les routes. On inspecte donc le CODE
 * SOURCE, ce qui couvre aussi les routes qui n'existent pas encore.
 *
 * Ce test echouera le jour ou quelqu'un ecrira `role: "SUPERADMIN"` dans une
 * route. C'est exactement son role : rendre la regression impossible a
 * commettre sans s'en apercevoir.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const RACINE_API = join(process.cwd(), "src", "app", "api");

/** Tous les fichiers .ts sous src/app/api, en profondeur. */
function fichiersApi(dossier: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      sortie.push(...fichiersApi(chemin));
    } else if (entree.endsWith(".ts")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

describe("aucune creation de SUPERADMIN par l'interface", () => {
  const fichiers = fichiersApi(RACINE_API);

  it("trouve bien des routes a inspecter (le test lui-meme est valide)", () => {
    // Sans cette garde, un chemin casse ferait passer le test a vide.
    expect(fichiers.length).toBeGreaterThan(30);
  });

  it("aucune route API n'attribue le role SUPERADMIN", () => {
    const coupables: string[] = [];

    for (const f of fichiers) {
      const src = readFileSync(f, "utf8");
      // On cherche l'ATTRIBUTION du role, pas sa simple mention : une route
      // a parfaitement le droit de COMPARER un role a "SUPERADMIN" pour
      // refuser l'acces — c'est meme ce qu'on veut.
      const attribue =
        /role\s*:\s*["'`]SUPERADMIN["'`]/.test(src) ||
        /role\s*=\s*["'`]SUPERADMIN["'`]/.test(src) ||
        /\.role\s*=\s*["'`]SUPERADMIN["'`]/.test(src);
      if (attribue) coupables.push(f.replace(process.cwd(), ""));
    }

    expect(coupables).toEqual([]);
  });

  it("aucune route API n'ecrit superadminSince", () => {
    // Deuxieme filet : meme sans ecrire le role, poser cette date laisserait
    // croire a un acces fondateur legitime dans la liste du script CLI.
    const coupables = fichiers.filter((f) =>
      /superadminSince\s*:/.test(readFileSync(f, "utf8")),
    );
    expect(coupables.map((f) => f.replace(process.cwd(), ""))).toEqual([]);
  });

  it("le script CLI, lui, sait bien promouvoir", () => {
    // Pendant de la regle : si le script perdait cette capacite, il n'y
    // aurait plus AUCUN moyen de creer un superadmin.
    const cli = readFileSync(join(process.cwd(), "scripts", "superadmin.ts"), "utf8");
    expect(cli).toMatch(/role\s*:\s*["'`]SUPERADMIN["'`]/);
  });
});
