/**
 * Decoupage administratif tunisien : 24 gouvernorats et leurs delegations.
 *
 * L'adresse d'un salon etait deux champs de texte libre (`city`, `address`).
 * Resultat en production : « Hometna, Ba7dha sousse », « Sfax », « sfax ville »
 * — impossible de filtrer les salons par zone, et le geocodage echouait faute
 * de nom reconnaissable.
 *
 * La saisie devient : gouvernorat -> delegation -> rue. Les deux premiers sont
 * choisis dans des listes, la rue reste libre.
 *
 * `governorate` est une nouvelle colonne ; `city` continue de porter la
 * DELEGATION. C'est deliberé : `city` est lu a 47 endroits du code (fiches,
 * admin, fidelite) et continue donc d'afficher quelque chose de juste sans
 * qu'aucun de ces appels soit touche.
 *
 * Les noms sont en francais, comme le reste de l'interface.
 *
 * PRECISION SUR LES DONNEES : les 24 gouvernorats sont exhaustifs et surs.
 * Les delegations couvrent l'essentiel du territoire mais n'ont pas ete
 * confrontees au decoupage officiel de l'INS ligne a ligne — quelques
 * variantes d'orthographe ou creations recentes peuvent manquer. Chaque nom
 * present est reel ; l'inverse n'est pas garanti.
 *
 * Si un salon ne trouve pas sa delegation, completer la liste ici : c'est un
 * simple ajout de chaine, sans migration.
 */

export type Gouvernorat = {
  /** Nom affiche et stocke en base. */
  nom: string;
  delegations: readonly string[];
};

export const GOUVERNORATS: readonly Gouvernorat[] = [
  {
    nom: "Ariana",
    delegations: [
      "Ariana Ville", "Ettadhamen", "Kalâat el-Andalous", "La Soukra",
      "Mnihla", "Raoued", "Sidi Thabet",
    ],
  },
  {
    nom: "Béja",
    delegations: [
      "Amdoun", "Béja Nord", "Béja Sud", "Goubellat", "Medjez el-Bab",
      "Nefza", "Téboursouk", "Testour", "Thibar",
    ],
  },
  {
    nom: "Ben Arous",
    delegations: [
      "Ben Arous", "Bou Mhel el-Bassatine", "El Mourouj", "Ezzahra",
      "Fouchana", "Hammam Chott", "Hammam Lif", "Mégrine", "Mohamedia",
      "Mornag", "Nouvelle Médina", "Radès",
    ],
  },
  {
    nom: "Bizerte",
    delegations: [
      "Bizerte Nord", "Bizerte Sud", "El Alia", "Ghar El Melh", "Ghezala",
      "Joumine", "Mateur", "Menzel Bourguiba", "Menzel Jemil", "Ras Jebel",
      "Sejnane", "Tinja", "Utique", "Zarzouna",
    ],
  },
  {
    nom: "Gabès",
    delegations: [
      "El Hamma", "Gabès Médina", "Gabès Ouest", "Gabès Sud", "Ghannouch",
      "Mareth", "Matmata", "Menzel Habib", "Métouia", "Nouvelle Matmata",
    ],
  },
  {
    nom: "Gafsa",
    delegations: [
      "Belkhir", "El Guettar", "El Ksar", "Gafsa Nord", "Gafsa Sud",
      "Mdhilla", "Métlaoui", "Moularès", "Redeyef", "Sened", "Sidi Aïch",
    ],
  },
  {
    nom: "Jendouba",
    delegations: [
      "Aïn Draham", "Balta-Bou Aouane", "Bou Salem", "Fernana", "Ghardimaou",
      "Jendouba", "Jendouba Nord", "Oued Meliz", "Tabarka",
    ],
  },
  {
    nom: "Kairouan",
    delegations: [
      "Bou Hajla", "Chebika", "Echrarda", "Haffouz", "Hajeb El Ayoun",
      "Kairouan Nord", "Kairouan Sud", "Nasrallah", "Oueslatia", "Sbikha",
    ],
  },
  {
    nom: "Kasserine",
    delegations: [
      "Ezzouhour", "Fériana", "Foussana", "Haïdra", "Hassi El Ferid",
      "Jedelienne", "Kasserine Nord", "Kasserine Sud", "Majel Bel Abbès",
      "Sbeitla", "Sbiba", "Thala", "El Ayoun",
    ],
  },
  {
    nom: "Kébili",
    delegations: [
      "Douz Nord", "Douz Sud", "Faouar", "Kébili Nord", "Kébili Sud",
      "Souk Lahad",
    ],
  },
  {
    nom: "Le Kef",
    delegations: [
      "Dahmani", "El Ksour", "Jérissa", "Kalaa Khasba", "Kalâat Senan",
      "Le Kef Est", "Le Kef Ouest", "Nebeur", "Sakiet Sidi Youssef",
      "Sers", "Tajerouine", "Touiref",
    ],
  },
  {
    nom: "Mahdia",
    delegations: [
      "Bou Merdès", "Chorbane", "El Jem", "Hébira", "Ksour Essef",
      "La Chebba", "Mahdia", "Melloulèche", "Ouled Chamekh", "Sidi Alouane",
      "Souassi",
    ],
  },
  {
    nom: "La Manouba",
    delegations: [
      "Borj El Amri", "Djedeida", "Douar Hicher", "El Battan", "La Manouba",
      "Mornaguia", "Oued Ellil", "Tebourba",
    ],
  },
  {
    nom: "Médenine",
    delegations: [
      "Ben Gardane", "Beni Khedache", "Djerba Ajim", "Djerba Houmt Souk",
      "Djerba Midoun", "Médenine Nord", "Médenine Sud", "Sidi Makhlouf",
      "Zarzis",
    ],
  },
  {
    nom: "Monastir",
    delegations: [
      "Bekalta", "Bembla", "Beni Hassen", "Jemmal", "Ksar Hellal",
      "Ksibet el-Médiouni", "Moknine", "Monastir", "Ouerdanine", "Sahline",
      "Sayada-Lamta-Bou Hajar", "Téboulba", "Zéramdine",
    ],
  },
  {
    nom: "Nabeul",
    delegations: [
      "Béni Khalled", "Béni Khiar", "Bou Argoub", "Dar Chaâbane El Fehri",
      "El Haouaria", "El Mida", "Grombalia", "Hammam Ghezèze", "Hammamet",
      "Kélibia", "Korba", "Menzel Bouzelfa", "Menzel Temime", "Nabeul",
      "Soliman", "Takelsa",
    ],
  },
  {
    nom: "Sfax",
    delegations: [
      "Agareb", "Bir Ali Ben Khalifa", "El Amra", "El Hencha", "Ghraiba",
      "Jebiniana", "Kerkennah", "Mahrès", "Menzel Chaker", "Sakiet Eddaïer",
      "Sakiet Ezzit", "Sfax Ville", "Sfax Ouest", "Sfax Sud", "Skhira",
      "Thyna",
    ],
  },
  {
    nom: "Sidi Bouzid",
    delegations: [
      "Ben Oun", "Bir El Hafey", "Cebbala Ouled Asker", "Jilma",
      "Meknassy", "Menzel Bouzaiene", "Mezzouna", "Ouled Haffouz",
      "Regueb", "Sidi Bouzid Est", "Sidi Bouzid Ouest", "Souk Jedid",
    ],
  },
  {
    nom: "Siliana",
    delegations: [
      "Bargou", "Bou Arada", "El Aroussa", "Gaâfour", "Kesra", "Le Krib",
      "Makthar", "Rouhia", "Sidi Bou Rouis", "Siliana Nord", "Siliana Sud",
    ],
  },
  {
    nom: "Sousse",
    delegations: [
      "Akouda", "Bouficha", "Enfidha", "Hammam Sousse", "Hergla",
      "Kalâa Kebira", "Kalâa Seghira", "Kondar", "M'saken", "Sidi Bou Ali",
      "Sidi El Hani", "Sousse Jawhara", "Sousse Médina", "Sousse Riadh",
      "Sousse Sidi Abdelhamid",
    ],
  },
  {
    nom: "Tataouine",
    delegations: [
      "Bir Lahmar", "Dehiba", "Ghomrassen", "Remada", "Smâr",
      "Tataouine Nord", "Tataouine Sud",
    ],
  },
  {
    nom: "Tozeur",
    delegations: ["Degache", "Hazoua", "Nefta", "Tameghza", "Tozeur"],
  },
  {
    nom: "Tunis",
    delegations: [
      "Bab El Bhar", "Bab Souika", "Carthage", "Cité El Khadra", "Djebel Jelloud",
      "El Hrairia", "El Kabaria", "El Menzah", "El Omrane", "El Omrane Supérieur",
      "El Ouardia", "Ettahrir", "Ezzouhour", "La Goulette",
      "La Marsa", "Le Bardo", "Le Kram", "Médina", "Séjoumi", "Sidi El Béchir",
      "Sidi Hassine",
    ],
  },
  {
    nom: "Zaghouan",
    delegations: [
      "Bir Mcherga", "El Fahs", "Nadhour", "Saouaf", "Zaghouan", "Zriba",
    ],
  },
] as const;

/** Les noms des 24 gouvernorats, dans l'ordre d'affichage. */
export function nomsGouvernorats(): string[] {
  return GOUVERNORATS.map((g) => g.nom);
}

/**
 * Les delegations d'un gouvernorat.
 *
 * Rend une liste vide pour un gouvernorat inconnu — l'appelant affiche alors
 * un selecteur vide plutot que de planter.
 */
export function delegationsDe(gouvernorat: string | null | undefined): readonly string[] {
  if (!gouvernorat) return [];
  return GOUVERNORATS.find((g) => g.nom === gouvernorat)?.delegations ?? [];
}

/** Ce gouvernorat existe-t-il ? */
export function gouvernoratExiste(nom: unknown): boolean {
  return typeof nom === "string" && GOUVERNORATS.some((g) => g.nom === nom);
}

/** Cette delegation appartient-elle bien a ce gouvernorat ? */
export function delegationAppartient(
  gouvernorat: unknown,
  delegation: unknown,
): boolean {
  if (typeof delegation !== "string") return false;
  return delegationsDe(
    typeof gouvernorat === "string" ? gouvernorat : null,
  ).includes(delegation);
}

export type RefusAdresse = { message: string };

/**
 * L'adresse d'un salon est-elle valide ?
 *
 * Le couple est verifie, pas seulement chaque champ : sans cela on
 * enregistrerait « Sousse / La Marsa », une delegation qui n'existe pas dans
 * ce gouvernorat.
 *
 * La rue reste libre — impossible d'en tenir un referentiel — mais elle est
 * exigee : « Sousse Médina » seul ne permet pas de trouver un salon.
 */
export function refusAdresseSalon(
  gouvernorat: unknown,
  delegation: unknown,
  rue: unknown,
): RefusAdresse | null {
  if (!gouvernoratExiste(gouvernorat)) {
    return { message: "Sélectionne ton gouvernorat." };
  }
  if (!delegationAppartient(gouvernorat, delegation)) {
    return { message: "Sélectionne une délégation de ton gouvernorat." };
  }
  if (typeof rue !== "string" || rue.trim().length < 3) {
    return { message: "Indique le numéro et le nom de la rue." };
  }
  return null;
}

/**
 * L'adresse complete, telle qu'on la montre et qu'on la geocode.
 *
 * L'ordre va du plus precis au plus large, suivi de « Tunisie » : c'est ce que
 * Nominatim attend, et le geocodage echouait sur les adresses libres faute de
 * pays.
 */
export function adresseComplete(
  rue: string | null,
  delegation: string | null,
  gouvernorat: string | null,
): string {
  return [rue, delegation, gouvernorat, "Tunisie"]
    .filter((p): p is string => !!p && p.trim() !== "")
    .join(", ");
}
