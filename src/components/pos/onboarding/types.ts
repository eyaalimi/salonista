/**
 * Le salon en cours de configuration, pendant l'assistant de demarrage.
 *
 * Ce type etait duplique dans les CINQ fichiers de l'assistant, chacun n'en
 * declarant que les champs dont il se servait. TypeScript voyait donc cinq
 * types distincts portant le meme nom, et refusait de passer le `onSaved` du
 * wizard a ses etapes — d'ou trois erreurs que `ignoreBuildErrors` masquait.
 *
 * Une seule definition, ici. Les etapes qui n'ont besoin que d'une partie
 * reçoivent un `Partial<Provider>`.
 */
export type Provider = {
  id: string;
  salonName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  category?: string;
  matriculeFiscal: string | null;
  receiptFooter: string | null;
  onboardingDismissedAt: Date | null;
  _count: {
    offers: number;
    products: number;
    employees: number;
    sales: number;
    cashDrawerSessions: number;
  };
};
