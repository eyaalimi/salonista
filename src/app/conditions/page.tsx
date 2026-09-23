import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Conditions d'utilisation — Salonista",
  description:
    "Les règles d'utilisation de la caisse Salonista : service gratuit, sans engagement, règlement au salon.",
};

/*
 * Meta demande des conditions d'utilisation en plus de la politique de
 * confidentialite pour valider une Page Business et un compte publicitaire.
 *
 * REGLE, comme pour /confidentialite : ce texte decrit le service REEL.
 * Notamment : la caisse est gratuite (flags.ts / landing), aucun paiement
 * n'est encaisse en ligne (voir note 11 de CLAUDE.md), et la place de marche
 * est fermee (MARKETPLACE_PUBLIQUE = false).
 */
export default function ConditionsPage() {
  return (
    <LegalPage titre="Conditions d'utilisation" miseAJour="23 septembre 2026">
      <p>
        Ces conditions encadrent l&apos;utilisation de la caisse Salonista,
        accessible sur <strong>salonista.tn</strong>. En créant un compte, vous
        les acceptez.
      </p>

      <h2>Ce qu&apos;est le service</h2>
      <p>
        Salonista est une caisse enregistreuse en ligne pour les salons de beauté
        en Tunisie : encaissement, agenda, fiches clientes, stock, fidélité et
        statistiques. Elle fonctionne sur ordinateur, tablette et téléphone, et
        peut s&apos;installer comme une application.
      </p>
      <p>
        <strong>Le service est gratuit</strong> et sans engagement. Vous pouvez
        cesser de l&apos;utiliser à tout moment. Si une offre payante apparaît un
        jour, elle sera annoncée à l&apos;avance et ne s&apos;appliquera jamais
        rétroactivement à ce que vous utilisez déjà gratuitement.
      </p>

      <h2>Qui peut créer un compte</h2>
      <p>
        Le service s&apos;adresse aux professionnels de la beauté exerçant en
        Tunisie. En créant un compte, vous déclarez être majeur et habilité à
        engager votre salon.
      </p>

      <h2>Votre compte et vos codes</h2>
      <ul>
        <li>Vous êtes responsable de la confidentialité de votre mot de passe et des codes PIN de votre équipe.</li>
        <li>Vous répondez des actions effectuées depuis votre compte.</li>
        <li>Prévenez-nous sans délai si vous soupçonnez un accès non autorisé.</li>
      </ul>

      <h2>Vos données vous appartiennent</h2>
      <p>
        Les fiches de vos clientes, vos ventes et votre catalogue{" "}
        <strong>sont à vous</strong>. Nous les hébergeons pour votre compte, nous
        ne les exploitons pas et nous ne les partageons avec aucun autre salon.
        Vous pouvez en demander une copie à tout moment.
      </p>
      <p>
        En contrepartie, <strong>vous êtes responsable de ce que vous y
        saisissez</strong> : informer vos clientes, recueillir leur accord quand
        la loi l&apos;exige, et n&apos;enregistrer que ce qui vous est utile. Voir
        notre{" "}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>Ce que vous vous engagez à ne pas faire</h2>
      <ul>
        <li>Utiliser le service à des fins illégales.</li>
        <li>Tenter d&apos;accéder aux données d&apos;un autre salon.</li>
        <li>Perturber le fonctionnement du service ou contourner ses limites techniques.</li>
        <li>Revendre l&apos;accès au service sans notre accord.</li>
      </ul>

      <h2>Les paiements se font chez vous</h2>
      <p>
        <strong>Salonista n&apos;encaisse aucun paiement</strong> et ne perçoit
        aucune commission sur vos ventes. La caisse enregistre les règlements que
        vous recevez ; l&apos;argent ne transite jamais par nous. Nous ne sommes
        donc pas partie aux transactions entre vous et vos clientes.
      </p>

      <h2>Disponibilité</h2>
      <p>
        Nous faisons de notre mieux pour que le service reste disponible, sans
        pouvoir le garantir sans interruption : maintenance, panne ou incident
        chez un hébergeur peuvent survenir.
      </p>
      <p>
        La caisse continue de fonctionner <strong>hors connexion</strong> pour
        l&apos;encaissement : les ventes sont enregistrées sur l&apos;appareil et
        synchronisées au retour d&apos;Internet. Veillez à ne pas désinstaller
        l&apos;application tant que des ventes restent à synchroniser — un
        indicateur vous le signale.
      </p>
      <p>
        <strong>Conservez vos justificatifs comptables par vos propres moyens.</strong>{" "}
        Salonista est un outil de gestion, pas votre archivage légal.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Le service est fourni en l&apos;état. Dans les limites permises par la
        loi, notre responsabilité ne peut être engagée pour un manque à gagner,
        une perte d&apos;exploitation ou un dommage indirect résultant de
        l&apos;utilisation ou de l&apos;indisponibilité du service.
      </p>
      <p>
        Cette limitation ne s&apos;applique pas en cas de faute lourde ou
        intentionnelle de notre part.
      </p>

      <h2>Fermeture d&apos;un compte</h2>
      <p>
        Vous pouvez demander la fermeture de votre compte à tout moment en
        écrivant à{" "}
        <a href="mailto:contact@salonista.tn">contact@salonista.tn</a>. Nous
        pouvons suspendre un compte qui enfreint ces conditions, après vous en
        avoir informé sauf urgence.
      </p>
      <p>
        Après fermeture, vos données sont conservées puis supprimées selon les
        durées indiquées dans la{" "}
        <a href="/confidentialite">politique de confidentialité</a>. Demandez
        votre export avant de fermer le compte.
      </p>

      <h2>Modifications</h2>
      <p>
        Ces conditions peuvent évoluer. Tout changement important vous sera
        annoncé par e-mail avant son entrée en vigueur.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Ces conditions sont régies par le droit tunisien. En cas de différend,
        nous chercherons d&apos;abord une solution amiable : écrivez-nous à{" "}
        <a href="mailto:contact@salonista.tn">contact@salonista.tn</a>.
      </p>
    </LegalPage>
  );
}
