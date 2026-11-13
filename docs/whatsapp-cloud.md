# Connecter un salon aux promos WhatsApp

Pas-à-pas pour les fondateurs. Il se fait **à la main, salon par salon** :
Salonista n'a pas d'inscription automatique chez Meta dans ce lot.

À la fin, la gérante voit « WhatsApp connecté » sur `/pos/promos` et peut
envoyer ses promos en un clic.

> **Vérifié dans la documentation de Meta le 12/11/2026.** Les écrans de
> Meta changent souvent : si un intitulé ne correspond plus, cherchez la
> même notion (WABA, Phone number ID, utilisateur système, modèle).

---

## ⚠️ Attention au numéro : il faut un numéro DÉDIÉ aux promos

Enregistrer un numéro sur l'API WhatsApp Cloud **le retire de l'application
WhatsApp Business du téléphone**. Si la gérante enregistre le numéro qu'elle
utilise tous les jours avec ses clientes, elle perd l'accès à ses
conversations dans l'application.

La « cohabitation » (le même numéro dans l'application ET sur l'API) existe
chez Meta, mais elle est **réservée aux partenaires officiels** (« Tech
Provider » ou « Solution Partner ») et passe par une inscription automatique
que Salonista n'a pas. Rien n'indique non plus qu'elle soit ouverte en
Tunisie.

**Donc : un numéro dédié aux promos est obligatoire.** Une ligne prépayée
suffit. Elle doit pouvoir recevoir un SMS ou un appel une fois, pour la
vérification par Meta.

C'est aussi pour ça que le modèle se termine par « ne répondez pas à ce
numéro » : **personne ne lit les réponses** arrivées sur ce numéro. Les
clientes doivent appeler le numéro habituel du salon pour réserver.

---

## 1. Compte Meta Business

1. Sur <https://business.facebook.com>, créer (ou réutiliser) le
   **portefeuille business du salon**, au nom du salon.
2. Ajouter un moyen de paiement dans le portefeuille : **Meta facture
   chaque message marketing**. Cette facture se règle hors de Salonista.

## 2. Compte WhatsApp Business (WABA) et numéro

1. Dans le portefeuille : **Comptes > Comptes WhatsApp > Ajouter**.
2. Ajouter le **numéro dédié** et le vérifier (SMS ou appel).
3. Renseigner le nom affiché : le nom du salon. Meta le valide.
4. Noter deux identifiants, affichés dans **WhatsApp Manager > Numéros de
   téléphone** :
   - le **Phone number ID** (identifiant du numéro, des chiffres) ;
   - le **WhatsApp Business Account ID** (WABA ID, des chiffres).

## 3. Application Meta et jeton permanent

1. Sur <https://developers.facebook.com/apps>, utiliser l'application
   Salonista (type Business) avec le produit **WhatsApp**. Une seule
   application sert pour tous les salons.
2. Dans le portefeuille du salon : **Paramètres > Utilisateurs système >
   Ajouter**, rôle Administrateur.
3. Lui donner accès au **compte WhatsApp** du salon et à l'application.
4. **Générer un jeton** pour l'application, **sans expiration**, avec les
   autorisations `whatsapp_business_messaging` et
   `whatsapp_business_management`.
5. Copier le jeton **une seule fois** dans la fiche superadmin (étape 6). Ne
   le collez nulle part ailleurs : ni e-mail, ni WhatsApp, ni document
   partagé.

## 4. Le modèle de message

Dans **WhatsApp Manager > Modèles de message > Créer** :

- **Catégorie** : Marketing.
- **Nom** : minuscules, chiffres et `_` seulement, par exemple
  `promo_salon_yasmine`.
- **Langue** : Français (`fr`).
- **Corps**, exactement :

  ```
  Aslema {{1}} ! 3andna promo jdida lik :

  {{2}}

  Nestanewk 3andna 💖 Pour réserver, appelez le salon au 22 345 678 (ne répondez pas à ce numéro).
  ```

  La **dernière phrase est propre au salon** : mettez son vrai numéro
  habituel. Elle sera recopiée **à l'identique** dans la fiche superadmin
  (champ « Texte de fin du modèle »). L'aperçu de la caisse s'en sert ;
  s'il diffère du modèle, la gérante verra un autre message que celui qui
  part.

- **Exemples de variables**, demandés par Meta : `{{1}}` = `Amira`,
  `{{2}}` = `Promo à 10 DT : épilation lèvre + sourcils + brushing`.
- **Bouton** : réponse rapide, libellé **« Ne plus recevoir »** (25
  caractères au plus).

**Pourquoi ce texte et pas seulement `Aslema {{1}} ! {{2}}`.** Meta refuse
un modèle qui commence ou finit par une variable, et rejette aussi un modèle
qui a trop de variables pour son texte fixe. Le texte de fin règle les deux.

**Prénom inconnu.** Quand la fiche n'a pas de prénom, Salonista envoie
« 3zizti » à la place : la cliente lit « Aslema 3zizti ! ».

Attendre l'**approbation** du modèle (de quelques minutes à 24 h).

## 5. Webhook (statuts et « Ne plus recevoir »)

Deux choses distinctes : la configuration du webhook (**une fois** pour
l'application) et l'abonnement de l'application au compte WhatsApp (**pour
CHAQUE salon**). Sans la seconde, Meta n'envoie **aucune** notification
pour ce salon, sans aucune erreur : les statuts restent bloqués sur
« envoyé » et le bouton « Ne plus recevoir » n'a aucun effet.

### 5a. Configuration du webhook (une seule fois)

Dans l'application Meta, **WhatsApp > Configuration** :

- **URL de rappel** : `https://salonista.tn/api/webhooks/whatsapp`
- **Jeton de vérification** : la valeur de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  du `.env` du serveur.
- **Abonnement** au champ **`messages`**. Il apporte les statuts (envoyé,
  délivré, lu, échec) et les réponses des clientes.

Le serveur vérifie la signature de chaque notification avec
`WHATSAPP_APP_SECRET` (App Secret de l'application). Une notification non
signée est refusée.

L'application doit être en mode **Live** (en ligne), pas en
développement : certaines notifications ne partent pas en mode
développement.

### 5b. Abonner l'application au compte WhatsApp du salon (À CHAQUE SALON)

La documentation de Meta est explicite : « You must individually subscribe
to every Messaging account for which you want to receive webhooks ». Ce
n'est **pas** automatique.

Depuis un terminal (Git Bash sur Windows, ou le serveur), avec le **WABA ID**
de l'étape 2 et le **jeton** de l'étape 3 :

```bash
# Le jeton est lu sans s'afficher, pour qu'il ne reste ni a l'ecran ni dans
# l'historique du terminal. Collez-le puis Entree.
read -rs JETON
WABA_ID=102290129340398   # <- le WABA ID du salon

curl -sS -X POST "https://graph.facebook.com/v27.0/$WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer $JETON"
```

Réponse attendue :

```json
{"success": true}
```

**Vérifier que l'abonnement est actif** (même terminal) :

```bash
curl -sS "https://graph.facebook.com/v27.0/$WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer $JETON"

unset JETON
```

L'abonnement est actif si la réponse contient l'application Salonista :

```json
{"data": [{"whatsapp_business_api_data": {"id": "<id de l'application>", "link": "...", "name": "Salonista"}}]}
```

`{"data": []}` : l'application n'est **pas** abonnée, relancez la commande
POST. Une erreur `190` : jeton expiré ou mal collé. Une erreur `200` ou `10` :
le jeton n'a pas l'autorisation `whatsapp_business_management` (étape 3).

Remplacez `v27.0` par la valeur de `WHATSAPP_GRAPH_VERSION` du serveur si elle
a changé.

**Contrôle en conditions réelles**, après l'étape 6 : depuis la caisse du
salon, envoyez une promo à une seule fiche cliente portant **votre** numéro
(« Je choisis moi-même »). Ouvrez le message sur votre téléphone, puis
regardez « Dernières promos » sur `/pos/promos` : la ligne doit afficher
« 1 lus » dans la minute. Si elle reste à « 0 lus » alors que vous avez lu le
message, l'abonnement 5b manque. (Le compteur « lus » n'apparaît que si vos
clientes n'ont pas désactivé les confirmations de lecture dans WhatsApp :
faites l'essai avec votre propre téléphone, réglage activé.)

## 6. Fiche superadmin

`/superadmin/salons/<salon>` > bloc **WhatsApp promos** :

| Champ | Valeur |
|---|---|
| Numéro affiché | `+216 22 345 678` (le numéro dédié, pour l'écran) |
| Phone number ID | étape 2 |
| WABA ID | étape 2 |
| Jeton permanent | étape 3, jamais réaffiché ensuite |
| Nom du modèle | étape 4, par exemple `promo_salon_yasmine` |
| Langue du modèle | `fr` |
| Texte de fin du modèle | la dernière phrase du modèle, **à l'identique** |
| Prix d'un message | facultatif, en DT. Il ne sert qu'à afficher un coût estimé. Vide : « coût selon le tarif Meta » |
| Statut | **Brouillon** tant que ce n'est pas testé |
| Motif | obligatoire (journal d'audit) |

1. Enregistrer en **Brouillon**.
2. **Envoyer un test** vers votre propre numéro. C'est un vrai message,
   facturé.
3. Vérifier l'abonnement de l'étape 5b (commande `GET`).
4. Message reçu et conforme, abonnement actif : passer le statut à
   **Active**. La gérante peut envoyer.

**Suspendre** bloque immédiatement tout envoi, y compris une campagne en
cours : ses destinataires restants passent en échec.

## En cas d'échec

Le détail est sur chaque destinataire (`DestinatairePromo.erreur`). Les
plus courants :

| Code | Sens | Que faire |
|---|---|---|
| 131026 | La cliente n'a pas WhatsApp | Rien |
| 131049 | Meta limite les messages marketing par cliente | Rien, c'est Meta qui décide |
| 131050 | La cliente a coupé les messages marketing dans WhatsApp | Elle passe automatiquement en « promos refusées » |
| 132001 | Modèle absent dans cette langue, ou pas approuvé | Vérifier le nom et la langue |
| 132015 / 132016 | Modèle mis en pause ou désactivé (qualité) | Créer un nouveau modèle |
| 190 | Jeton expiré | Générer un jeton sans expiration (étape 3) |
| 131048 | Numéro limité pour spam | Espacer les promos, revoir le texte |

## Variables du serveur

Voir `scripts/deploy/.env.production.example`. Le cron du moteur d'envoi
s'installe avec la commande du runbook (`scripts/deploy/README.md`).
