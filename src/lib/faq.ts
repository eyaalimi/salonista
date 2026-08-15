/**
 * Questions frequentes affichees sur l'accueil.
 *
 * SOURCE UNIQUE, volontairement : la section visible et le balisage
 * FAQPage lisent ce meme tableau. Google exige que chaque question/reponse
 * du balisage soit reellement visible sur la page — deux listes separees
 * divergeraient a la premiere modification, et le balisage deviendrait une
 * violation sans que personne ne s'en apercoive.
 *
 * Les reponses decrivent le produit tel qu'il existe. Ne pas y annoncer une
 * fonctionnalite absente : une FAQ qui promet ce que le site ne fait pas
 * dessert plus qu'une FAQ absente.
 */

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Comment réserver un soin sur Salonista ?",
    answer:
      "Choisissez une offre, sélectionnez le créneau qui vous convient et confirmez votre réservation. Vous recevez un QR code à présenter au salon le jour de votre rendez-vous.",
  },
  {
    question: "Comment se passe le règlement ?",
    answer:
      "Vous réservez votre créneau en ligne, puis vous réglez votre soin directement au salon. De nouveaux moyens de paiement arriveront prochainement.",
  },
  {
    question: "Puis-je annuler ma réservation ?",
    answer:
      "Oui, depuis votre espace personnel, tant que le salon ne l'a pas encore confirmée. Une fois la réservation confirmée, contactez directement le salon pour la modifier ou l'annuler.",
  },
  {
    question: "Comment fonctionnent les points de fidélité ?",
    answer:
      "Les salons qui proposent un programme de fidélité vous font cumuler des points à chaque passage. Vos points sont ensuite déductibles d'un règlement suivant dans le même salon.",
  },
  {
    question: "Salonista est-il disponible partout en Tunisie ?",
    answer:
      "Oui. Nos salons partenaires accueillent des clientes dans toute la Tunisie, et le réseau s'agrandit chaque semaine.",
  },
  {
    question: "Je suis propriétaire d'un salon, comment rejoindre Salonista ?",
    answer:
      "Créez votre compte prestataire en quelques minutes. Vous pourrez publier vos offres, recevoir des réservations et gérer vos rendez-vous, votre caisse et votre programme de fidélité depuis Salonista.",
  },
];

/**
 * Balisage Schema.org FAQPage construit depuis FAQ_ITEMS.
 *
 * FAQPage fait partie des rares types que l'outil « Test des resultats
 * enrichis » de Google sait previsualiser — contrairement a WebSite et
 * Organization, valides mais non previsualisables, qui font afficher
 * « aucun element detecte » sur l'accueil.
 */
export function buildFaqJsonLd(items: FaqItem[] = FAQ_ITEMS): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
