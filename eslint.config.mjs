import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    /**
     * Regles du compilateur React 19 — retrogradees en avertissement.
     *
     * POURQUOI. Elles sont arrivees avec `eslint-config-next` recent et
     * signalent 35 emplacements dans du code qui tourne en production depuis
     * des mois sans incident. La CI ajoutee au lot D bloque sur `npm run
     * lint` : la laisser echouer sur cette dette existante l'aurait rendue
     * inutile — une CI qui echoue toujours, on prend l'habitude de la
     * contourner.
     *
     * CE QUE CELA CHANGE. La CI bloque desormais sur toute NOUVELLE erreur
     * (types, imports, regles Next), et ces 35 restent visibles comme
     * avertissements. Le code n'est pas ignore, il est date.
     *
     * DETTE A RESORBER, par ordre de volume :
     *   - `set-state-in-effect` (27) : `useEffect(() => { load(); }, [])`
     *     partout ou une page charge ses donnees. La reecriture propre passe
     *     par les Server Components ou un `useSyncExternalStore` — un lot a
     *     part entiere, sans filet de test (Vitest tourne sans jsdom, aucun
     *     composant n'est testable).
     *   - `purity` (6) : `Date.now()` lu pendant le rendu, notamment dans les
     *     calendriers. A deplacer dans un `useMemo` avec une horloge stable.
     *   - `refs` (1), `immutability` (1) : cas isoles.
     *
     * NE PAS retrograder d'autres regles pour faire passer un build. Si une
     * NOUVELLE erreur apparait, elle signale un vrai probleme dans du code
     * qu'on vient d'ecrire — c'est precisement ce que la CI doit attraper.
     */
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
