import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Politique de confidentialité — Salonista",
  description:
    "Quelles données Salonista collecte, pourquoi, combien de temps, et comment les supprimer.",
};

/*
 * Page exigee par Meta pour diffuser des publicites et tenir une Page
 * Business, et par la loi tunisienne n° 2004-63 sur la protection des donnees
 * personnelles.
 *
 * REGLE : ce texte decrit ce que le code fait REELLEMENT. Chaque affirmation
 * ci-dessous a ete verifiee dans le depot. Si une fonctionnalite change (un
 * traceur ajoute, un sous-traitant change, une duree de conservation
 * differente), cette page doit changer avec elle — une politique fausse est
 * pire que pas de politique du tout.
 *
 * Verifie au 23/09/2026 : aucun pixel Meta, aucun Google Analytics, aucun
 * traceur publicitaire dans le code. Les seuls tiers charges cote navigateur
 * sont Google Fonts et le CDN Workbox (service worker).
 */
export default function ConfidentialitePage() {
  return (
    <LegalPage titre="Politique de confidentialité" miseAJour="23 septembre 2026">
      <p>
        Salonista est une caisse enregistreuse en ligne destinée aux salons de
        beauté en Tunisie. Cette page explique quelles données nous traitons,
        pourquoi, pendant combien de temps, et comment en demander la
        suppression.
      </p>
      <p>
        Elle est écrite pour être lue. Si un point vous paraît obscur, écrivez-nous
        à <a href="mailto:contact@salonista.tn">contact@salonista.tn</a> et nous
        vous répondrons.
      </p>

      <h2>Qui est responsable de vos données</h2>
      <p>
        L&apos;éditeur du site <strong>salonista.tn</strong> est responsable du
        traitement des données décrites ci-dessous. Contact :{" "}
        <a href="mailto:contact@salonista.tn">contact@salonista.tn</a>.
      </p>

      <h2>Deux rôles à distinguer</h2>
      <p>
        Cette distinction commande tout le reste, et nous préférons l&apos;énoncer
        clairement plutôt que de la noyer dans le texte :
      </p>
      <ul>
        <li>
          <strong>Pour les salons</strong> qui utilisent la caisse, nous sommes
          responsables des données de leur compte.
        </li>
        <li>
          <strong>Pour les clientes d&apos;un salon</strong>, c&apos;est le salon
          qui décide quelles fiches il crée et ce qu&apos;il en fait. Nous
          n&apos;hébergeons ces fiches que pour son compte, et nous ne les
          utilisons ni pour notre publicité, ni pour les revendre, ni pour les
          partager avec un autre salon. Une cliente qui veut faire supprimer sa
          fiche doit s&apos;adresser à son salon ; nous l&apos;aidons si elle nous
          écrit.
        </li>
      </ul>

      <h2>Ce que nous collectons</h2>

      <h3>Si vous créez un compte salon</h3>
      <ul>
        <li>Votre adresse e-mail et votre mot de passe (chiffré, jamais lisible par nous)</li>
        <li>Votre numéro de téléphone</li>
        <li>Le nom de votre salon, sa ville, son gouvernorat</li>
        <li>Votre matricule fiscal, si vous le renseignez</li>
        <li>Les codes PIN de votre équipe (chiffrés)</li>
      </ul>

      <h3>Ce que votre salon saisit dans la caisse</h3>
      <ul>
        <li>Les fiches de vos clientes : nom, téléphone, e-mail et date de naissance si vous les renseignez, ainsi que vos notes</li>
        <li>Vos ventes, vos rendez-vous, votre stock, votre tiroir-caisse</li>
        <li>Les points de fidélité que vous attribuez</li>
      </ul>
      <p>
        <strong>Chaque salon ne voit que ses propres fiches.</strong> Une cliente
        qui fréquente deux salons a une fiche chez chacun, et aucun des deux ne
        voit celle de l&apos;autre.
      </p>

      <h3>Techniquement, en naviguant</h3>
      <ul>
        <li>
          Des <strong>cookies strictement nécessaires</strong> : votre session de
          connexion, et le cookie qui associe votre tablette à votre salon. Sans
          eux, le site ne peut pas fonctionner.
        </li>
        <li>
          Les <strong>journaux du serveur</strong> (adresse IP, date, page
          consultée), conservés pour la sécurité et pour limiter les tentatives
          d&apos;intrusion.
        </li>
      </ul>

      <h2>Ce que nous ne faisons pas</h2>
      <p>
        Nous préférons le dire explicitement, parce que c&apos;est rarement le cas
        ailleurs :
      </p>
      <ul>
        <li>
          <strong>Aucun traceur publicitaire sur le site.</strong> Pas de pixel
          Meta, pas de Google Analytics, aucun cookie de mesure d&apos;audience ou
          de ciblage.
        </li>
        <li><strong>Nous ne vendons aucune donnée</strong>, à personne.</li>
        <li>
          <strong>Nous n&apos;encaissons aucun paiement en ligne</strong> et ne
          traitons donc <strong>aucune donnée bancaire</strong>. Les règlements se
          font directement au salon.
        </li>
        <li>
          Nous n&apos;utilisons pas les fiches clientes d&apos;un salon pour lui
          envoyer de la publicité, ni pour en envoyer à ses clientes.
        </li>
      </ul>
      <p>
        Si nous diffusons des publicités sur Facebook ou Instagram, elles sont
        gérées depuis les outils de Meta et ne reposent sur <strong>aucune donnée
        issue de votre caisse</strong>.
      </p>

      <h2>À qui nous confions des données</h2>
      <table>
        <thead>
          <tr>
            <th>Prestataire</th>
            <th>Pourquoi</th>
            <th>Où</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Amazon Web Services</td>
            <td>Hébergement du site et de la base de données</td>
            <td>Union européenne (Francfort)</td>
          </tr>
          <tr>
            <td>Google (Gmail)</td>
            <td>Envoi des e-mails du service : vérification, mot de passe oublié, code d&apos;appairage</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>Google (connexion)</td>
            <td>Uniquement si vous choisissez « Continuer avec Google »</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>Google Fonts</td>
            <td>Polices d&apos;écriture du site</td>
            <td>États-Unis</td>
          </tr>
          <tr>
            <td>Cloudflare</td>
            <td>Gestion du nom de domaine</td>
            <td>États-Unis</td>
          </tr>
        </tbody>
      </table>
      <p>
        Ces transferts hors de Tunisie sont inhérents à l&apos;usage de services
        en ligne. Nous n&apos;en ajouterons pas sans mettre cette page à jour.
      </p>

      <h2>Combien de temps nous les gardons</h2>
      <ul>
        <li>
          <strong>Les données de votre compte et de votre caisse</strong> : tant
          que votre compte est actif, puis <strong>12 mois</strong> après sa
          fermeture.
        </li>
        <li>
          <strong>Les ventes</strong> : <strong>10 ans</strong>, conformément aux
          obligations comptables tunisiennes. Ce délai s&apos;impose à nous comme
          à vous.
        </li>
        <li>
          <strong>Les journaux techniques</strong> : <strong>12 mois</strong>.
        </li>
        <li>
          <strong>Le cookie d&apos;appairage d&apos;un appareil</strong> :{" "}
          <strong>30 jours</strong>.
        </li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Conformément à la loi tunisienne n° 2004-63 relative à la protection des
        données à caractère personnel, vous pouvez demander à{" "}
        <strong>accéder</strong> à vos données, à les <strong>corriger</strong>,
        à les <strong>supprimer</strong>, ou à en <strong>recevoir une copie</strong>.
      </p>
      <p>
        Écrivez à <a href="mailto:contact@salonista.tn">contact@salonista.tn</a>.
        Nous répondons sous <strong>30 jours</strong>. La seule limite est légale :
        nous ne pouvons pas effacer des écritures de vente avant l&apos;échéance
        comptable de 10 ans.
      </p>

      <h2>Sécurité</h2>
      <ul>
        <li>Le site est servi exclusivement en HTTPS.</li>
        <li>Les mots de passe et les codes PIN sont stockés chiffrés (bcrypt) et ne sont jamais lisibles, y compris par nous.</li>
        <li>La caisse se verrouille automatiquement après 4 minutes d&apos;inactivité.</li>
        <li>Un appareil doit être appairé par un code envoyé au propriétaire avant d&apos;accéder à la caisse.</li>
        <li>Les tentatives de PIN sont limitées et le compte se bloque temporairement après 5 échecs.</li>
      </ul>
      <p>
        Aucun système n&apos;est infaillible. En cas de faille affectant vos
        données, nous vous préviendrons directement.
      </p>

      <h2>Enfants</h2>
      <p>
        Salonista est un outil professionnel destiné aux salons. Nous ne créons
        pas sciemment de compte pour une personne de moins de 16 ans.
      </p>

      <h2>Modifications</h2>
      <p>
        Toute modification de cette page sera signalée par la date de mise à jour
        en haut. Un changement important vous sera annoncé par e-mail.
      </p>
    </LegalPage>
  );
}
