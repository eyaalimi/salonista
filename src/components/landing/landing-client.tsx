"use client";

import { useEffect, useState } from "react";
import { CONTENU, type Langue } from "./content";

const IMG = "/images/lp/";
const CLE_LANGUE = "salonista-lang";

/**
 * La photo du hero : une employee de salon, telephone en main, servant de la
 * caisse. Nommee ici plutot qu'en dur dans le JSX — c'est le seul fichier a
 * remplacer quand une meilleure prise de vue arrive, et les trois variantes
 * suivent la meme racine.
 */
const HERO_PHOTO = "hero-caisse";

/**
 * La page d'accueil publique.
 *
 * Tout est ici : navigation, hero, presentation de la caisse, comparatif
 * avant/apres, FAQ. Le composant est client parce qu'il gere la langue, les
 * revelations au defilement, la parallaxe et le curseur du comparatif — mais
 * il ne fait aucun appel reseau : le HTML part complet depuis le serveur.
 */
export default function LandingClient() {
  const [langue, setLangue] = useState<Langue>("fr");
  const t = CONTENU[langue];
  const rtl = langue === "ar";

  /* ---------- langue ----------
     La langue retenue ne peut etre lue qu'APRES l'hydratation : le serveur
     n'a pas acces a localStorage, et l'initialiser au premier rendu ferait
     diverger le HTML serveur du HTML client. Le setState en effet est donc
     le seul chemin correct ici, malgre la regle React 19. */
  useEffect(() => {
    try {
      const enregistree = localStorage.getItem(CLE_LANGUE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (enregistree === "ar" || enregistree === "fr") setLangue(enregistree);
    } catch {
      /* navigation privee, stockage bloque : on reste en francais */
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("dir", rtl ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", langue);
    document.body.setAttribute("data-lang", langue);
    try {
      localStorage.setItem(CLE_LANGUE, langue);
    } catch {
      /* sans importance : la langue reste valable pour cette visite */
    }
    return () => {
      document.documentElement.setAttribute("dir", "ltr");
      document.documentElement.setAttribute("lang", "fr");
      document.body.removeAttribute("data-lang");
    };
  }, [langue, rtl]);

  /* ---------- navigation opaque au defilement ---------- */
  const [navOpaque, setNavOpaque] = useState(false);

  /* ---------- onglets des ecrans de la caisse ---------- */
  const [ecranActif, setEcranActif] = useState(0);
  /* « Sur ordinateur » ou « sur telephone » : le prestataire voit les DEUX,
     et choisit ce qu'il regarde. Rien n'est devine de son appareil — beaucoup
     decouvrent la page sur telephone mais installeront la caisse sur le
     comptoir, ou l'inverse. */
  const [appareil, setAppareil] = useState<"pc" | "mobile">("pc");

  useEffect(() => {
    document.body.classList.add("js");

    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Revelation a l'entree dans le viewport. Le clip-path des images vit sur
       l'image interne et non sur l'element observe : un element entierement
       masque par clip-path est rapporte comme jamais visible par
       IntersectionObserver, et ne se revelerait donc jamais. */
    let ioReveal: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      ioReveal = new IntersectionObserver(
        (entrees) => {
          for (const e of entrees) {
            if (!e.isIntersecting) continue;
            e.target.classList.add("in");
            ioReveal?.unobserve(e.target);
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
      );
      document.querySelectorAll(".rv, .rvl").forEach((el) => {
        if (!el.classList.contains("in")) ioReveal?.observe(el);
      });
    } else {
      document.querySelectorAll(".rv, .rvl").forEach((el) => el.classList.add("in"));
    }

    /* Parallaxe : une seule lecture du layout par frame. */
    const calques = Array.from(document.querySelectorAll<HTMLElement>("[data-par]"));
    let enAttente = false;

    const dessiner = () => {
      enAttente = false;
      const vh = window.innerHeight;
      for (const el of calques) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const centre = r.top + r.height / 2 - vh / 2;
        const f = Number(el.dataset.par);
        el.style.transform = `translate3d(0, ${(-centre * f).toFixed(1)}px, 0)`;
      }
    };

    const auScroll = () => {
      setNavOpaque(window.scrollY > 60);
      if (!enAttente && !reduit) {
        enAttente = true;
        requestAnimationFrame(dessiner);
      }
    };

    /* `dessiner` n'est jamais branche directement sur `resize` : il ecrirait
       des transformations de parallaxe a chaque rotation de telephone, y
       compris quand l'utilisateur a demande moins d'animations — le seul
       chemin qui respecte ce reglage passe par `auScroll`. */
    const auResize = () => {
      if (!reduit) dessiner();
    };

    auScroll();
    if (!reduit) dessiner();
    window.addEventListener("scroll", auScroll, { passive: true });
    window.addEventListener("resize", auResize);

    return () => {
      window.removeEventListener("scroll", auScroll);
      window.removeEventListener("resize", auResize);
      ioReveal?.disconnect();
      document.body.classList.remove("js");
    };
  }, []);

  /* Six cartes, sans illustration : les captures de la caisse sont montrees
     juste au-dessus, en grand et nommees. Les repeter ici en vignettes
     n'apprenait rien et faisait charger six images de plus. */
  const FONCTIONS = [
    { no: "01", label: t.l1, phrase: t.s1 },
    { no: "02", label: t.l2, phrase: t.s2 },
    { no: "03", label: t.l3, phrase: t.s3 },
    { no: "04", label: t.l4, phrase: t.s4 },
    { no: "05", label: t.l5, phrase: t.s5 },
    { no: "06", label: t.l6, phrase: t.s6 },
  ];

  /**
   * Les huit ecrans de la caisse, un par onglet, dans l'ordre du menu lateral
   * de l'application.
   *
   * Les captures nominatives sont FLOUTEES a la source : noms de clientes,
   * numeros de telephone et noms d'employees. Ce sont de vraies personnes du
   * salon de demonstration — les publier sur salonista.tn les exposerait sans
   * qu'elles aient rien demande. Les montants et la structure restent
   * lisibles, c'est ce que la page doit montrer.
   */
  /* Les ecrans en version ORDINATEUR, larges. */
  const ECRANS_PC = [
    { label: t.ecSalon, img: "ecran-salon", alt: t.altEcranSalon },
    { label: t.ecCaisse, img: "ecran-caisse", alt: t.altEcranCaisse },
    { label: t.ecRdv, img: "ecran-rdv", alt: t.altEcranRdv },
    { label: t.ecClientes, img: "ecran-clientes", alt: t.altEcranClientes },
    { label: t.ecFidelite, img: "ecran-fidelite", alt: t.altEcranFidelite },
    { label: t.ecCommissions, img: "ecran-commissions", alt: t.altEcranCommissions },
    { label: t.ecProduits, img: "ecran-produits", alt: t.altEcranProduits },
    { label: t.ecTiroir, img: "ecran-tiroir", alt: t.altEcranTiroir },
  ];

  /* Les memes ecrans, pris SUR TELEPHONE. Ce ne sont pas les captures de
     bureau redimensionnees : l'application change de mise en page, et c'est
     precisement ce que le prestataire doit voir avant de s'inscrire. */
  const ECRANS_MOBILE = [
    { label: t.ecCaisse, img: "m-caisse", alt: t.altEcranCaisse },
    { label: t.ecEncaissement, img: "m-encaissement", alt: t.altEcranEncaissement },
    { label: t.ecRdv, img: "m-rdv", alt: t.altEcranRdv },
    { label: t.ecClientes, img: "m-clientes", alt: t.altEcranClientes },
    { label: t.ecCommissions, img: "m-commissions", alt: t.altEcranCommissions },
    { label: t.ecProduits, img: "m-produits", alt: t.altEcranProduits },
    { label: t.ecTiroir, img: "m-tiroir", alt: t.altEcranTiroir },
  ];

  /* L'appareil choisi, et les ecrans qui vont avec. L'index est remis a zero
     au changement : les deux listes n'ont ni la meme longueur ni le meme
     ordre, et garder l'index aurait ouvert un onglet sans rapport. */
  const ECRANS = appareil === "pc" ? ECRANS_PC : ECRANS_MOBILE;
  const ecranSur = Math.min(ecranActif, ECRANS.length - 1);

  /* Chaque probleme face a SA solution. L'ordre des deux listes d'origine ne
     se correspondait pas : « des calculs a la main » se retrouvait en face de
     « l'agenda dans la caisse ». Les paires sont refaites pour que la ligne de
     droite reponde vraiment a celle de gauche. */
  const PAIRES: Array<[string, string]> = [
    [t.av1, t.ap1],
    [t.av2, t.ap5],
    [t.av3, t.ap2],
    [t.av4, t.ap4],
    [t.av5, t.ap3],
    [t.av6, t.ap6],
  ];

  const QUESTIONS = [
    { q: t.q1, a: t.a1 },
    { q: t.q2, a: t.a2 },
    { q: t.q3, a: t.a3 },
    { q: t.q4, a: t.a4 },
  ];

  return (
    <div className="lp-root">
      <header className={`nav${navOpaque ? " solid" : ""}`}>
        <div className="shell nav-in">
          {/* Meme composition que <Logo> : « salon » en italique, « ista »,
              puis le point rose. */}
          <a className="brand" href="#top">
            <em>salon</em>ista<b>.</b>
          </a>
          <nav className="nav-links">
            <a href="#produit">{t.nav1}</a>
            <a href="#pourquoi">{t.nav2}</a>
            <a href="#tarifs">{t.nav3}</a>
            <a href="#faq">{t.nav4}</a>
          </nav>
          <div className="lang">
            <button type="button" aria-pressed={langue === "fr"} onClick={() => setLangue("fr")}>
              FR
            </button>
            <i />
            <button
              type="button"
              data-l="ar"
              aria-pressed={langue === "ar"}
              onClick={() => setLangue("ar")}
            >
              عربي
            </button>
          </div>
          <a className="btn btn-solid" href="/pos-start">
            <span>{t.cta}</span>
            <span className="arrowc">→</span>
          </a>
        </div>
      </header>

      <div id="top">
        {/* ---------------- hero ---------------- */}
        {/**
         * Hero en deux temps : une phrase courte a gauche, une photo humaine
         * a droite qui deborde du cadre.
         *
         * Il affichait une photo de spa plein ecran, avec le texte pose par
         * dessus : un visiteur y lisait « institut de beaute haut de gamme »
         * la ou Salonista vend une caisse. Le fond est desormais blanc, le
         * texte tient en une phrase, et la photo montre quelqu'un en train de
         * SE SERVIR du produit.
         *
         * La carte flottante qui simulait un encaissement a disparu : elle
         * annoncait 60,000 TND quand la capture en montre 100,000.
         */}
        <section className="hero">
          <div className="shell hero-in">
            <div className="hero-texte">
              <p className="eyebrow rv in">{t.eyebrow}</p>
              <h1 className="rv in d1">
                <span>{t.h1a}</span>
                <br />
                <em>{t.h1b}</em>
              </h1>
              <p className="hero-lede rv in d2">{t.heroLede}</p>
              <div className="hero-cta rv in d2">
                <a className="btn btn-solid" href="/pos-start">
                  <span>{t.cta}</span>
                  <span className="arrowc">→</span>
                </a>
                <a className="btn btn-line" href="#produit">
                  <span>{t.cta2}</span>
                </a>
              </div>
            </div>

            {/* `fetchPriority="high"` : c'est l'image la plus grande de la
                zone visible au chargement, donc celle que mesure le LCP. */}
            <div className="hero-photo rv in d2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${IMG}${HERO_PHOTO}.webp`}
                /* La source fait 1376 px de large : la variante « -1600 »
                   plafonne donc a 1376. L'annoncer a sa VRAIE largeur, sinon
                   le navigateur la croit plus grande et telecharge 68 Ko la
                   ou 56 auraient suffi. */
                srcSet={`${IMG}${HERO_PHOTO}-800.webp 800w, ${IMG}${HERO_PHOTO}-1200.webp 1200w, ${IMG}${HERO_PHOTO}-1600.webp 1376w`}
                sizes="(min-width: 900px) 52vw, 100vw"
                alt={t.altHero}
                width={1376}
                height={768}
                fetchPriority="high"
              />
            </div>
          </div>
        </section>

        {/* ---------------- la caisse ---------------- */}
        <section className="sec" id="produit">
          <div className="shell">
            <div className="sec-head rv">
              <p className="eyebrow">{t.e1}</p>
              <h2>
                <span>{t.h2a}</span>{" "}
                <em style={{ color: "var(--bordeaux)" }}>{t.h2b}</em>
              </h2>
            </div>

            {/**
             * Un onglet par ecran de la caisse.
             *
             * Remplace un collage fige de quatre captures superposees : on y
             * voyait des bouts d'interface sans savoir a quoi ils
             * correspondaient. Ici chaque capture est nommee et se regarde en
             * entier.
             *
             * Seuls les ecrans REELLEMENT captures ont un onglet. En ajouter
             * un sans image afficherait un cadre vide, avec l'icone de lien
             * casse a la place de la capture.
             */}
            <div className="onglets rv">
              {/* Le choix de l'appareil. Il precede les onglets parce qu'il
                  change la liste en dessous. */}
              <div className="appareils" role="tablist" aria-label={t.appareilTitre}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appareil === "pc"}
                  className={appareil === "pc" ? "on" : undefined}
                  onClick={() => {
                    setAppareil("pc");
                    setEcranActif(0);
                  }}
                >
                  {t.appareilPc}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appareil === "mobile"}
                  className={appareil === "mobile" ? "on" : undefined}
                  onClick={() => {
                    setAppareil("mobile");
                    setEcranActif(0);
                  }}
                >
                  {t.appareilMobile}
                </button>
              </div>

              <div className="onglets-barre" role="tablist" aria-label={t.e1}>
                {ECRANS.map((e, i) => (
                  <button
                    key={e.img}
                    type="button"
                    role="tab"
                    id={`onglet-${i}`}
                    aria-selected={ecranSur === i}
                    aria-controls={`volet-${i}`}
                    className={ecranSur === i ? "on" : undefined}
                    onClick={() => setEcranActif(i)}
                  >
                    {e.label}
                  </button>
                ))}
              </div>

              {/* Les fleches vivent HORS du `tabpanel` : ce role ne doit
                  contenir que le contenu du volet, pas ses commandes.
                  Elles bouclent — depuis le premier ecran, « precedent » ramene
                  au dernier. Desactivees aux extremites, deux boutons grises
                  sur huit ecrans donneraient l'impression d'une panne. */}
              <div className={`onglets-vue vue-${appareil}`}>
                <button
                  type="button"
                  className="onglets-fleche prec"
                  aria-label={t.ecranPrec}
                  onClick={() =>
                    setEcranActif((i) => (i - 1 + ECRANS.length) % ECRANS.length)
                  }
                >
                  ‹
                </button>

                {/* Un seul volet est monte a la fois : les captures pesent
                    jusqu'a 80 Ko et les charger toutes d'un coup retarderait
                    le reste de la page. */}
                <div
                  role="tabpanel"
                  id={`volet-${ecranSur}`}
                  aria-labelledby={`onglet-${ecranSur}`}
                >
                  {/* Les captures mobiles n'existent qu'en 420 et 591 px, les
                      captures de bureau en 760, 1100 et 1540 : deux jeux de
                      variantes, deux `srcSet`. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={ECRANS[ecranSur].img}
                    src={`${IMG}${ECRANS[ecranSur].img}.webp`}
                    srcSet={
                      appareil === "mobile"
                        ? `${IMG}${ECRANS[ecranSur].img}-420.webp 420w, ${IMG}${ECRANS[ecranSur].img}-591.webp 591w`
                        : `${IMG}${ECRANS[ecranSur].img}-760.webp 760w, ${IMG}${ECRANS[ecranSur].img}-1100.webp 1100w, ${IMG}${ECRANS[ecranSur].img}-1540.webp 1540w`
                    }
                    sizes={
                      appareil === "mobile"
                        ? "300px"
                        : "(max-width: 899px) 860px, (min-width: 1400px) 1300px, 92vw"
                    }
                    alt={ECRANS[ecranSur].alt}
                    loading="lazy"
                  />
                </div>

                <button
                  type="button"
                  className="onglets-fleche suiv"
                  aria-label={t.ecranSuiv}
                  onClick={() => setEcranActif((i) => (i + 1) % ECRANS.length)}
                >
                  ›
                </button>
              </div>

              {/* Une zone qui defile sans le dire ne se decouvre pas. Le
                  message ne s'affiche que la ou le defilement existe. */}
              {/* L'astuce ne vaut que pour les captures de BUREAU, larges, sur
                  un petit ecran. Une capture mobile tient deja dedans. */}
              {appareil === "pc" && <p className="onglets-astuce">{t.balayer}</p>}
            </div>

          </div>
        </section>

        {/* ---------------- fonctionnalites ---------------- */}
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="shell">
            <div className="sec-head rv">
              <p className="eyebrow">{t.e3}</p>
              <h2>
                <span>{t.h4a}</span> <em>{t.h4b}</em>
              </h2>
            </div>

            {/* Six cartes, sans image : les captures de la caisse sont deja
                montrees juste au-dessus, en grand et nommees. Les repeter ici
                en vignettes n'apprenait rien et alourdissait la page.
                Le panneau lateral qui suivait la lecture disparait avec
                elles — son seul role etait d'afficher ces vignettes. */}
            <div className="cartes rv">
              {FONCTIONS.map((f) => (
                <article key={f.no} className="carte">
                  <span className="no">{f.no}</span>
                  <span className="lb">{f.label}</span>
                  <p className="ph">{f.phrase}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- avant / avec ---------------- */}
        <section className="sec">
          <div className="shell">
            <div className="sec-head rv">
              <p className="eyebrow">{t.e4}</p>
              <h2>
                <span>{t.h6a}</span>{" "}
                <em style={{ color: "var(--bordeaux)" }}>{t.h6b}</em>
              </h2>
            </div>

            {/**
             * Six paires, chaque probleme face a sa solution.
             *
             * Remplace un curseur glissant qui masquait la moitie du contenu
             * tant qu'on n'avait pas devine le geste — et qui demandait 70
             * lignes de JavaScript pour la souris, le tactile, le clavier et
             * l'arabe. Ici tout se lit d'un coup d'oeil, et le lien de cause a
             * effet est visible : la ligne de droite repond a celle de gauche.
             */}
            <div className="paires rv">
              <div className="paires-tete" aria-hidden="true">
                <span>{t.avant}</span>
                <span>{t.apres}</span>
              </div>
              <ul className="paires-liste">
                {PAIRES.map(([probleme, solution]) => (
                  <li key={probleme}>
                    <span className="pb">{probleme}</span>
                    <span className="fleche" aria-hidden="true">
                      →
                    </span>
                    {/* Le libelle est repete pour un lecteur d'ecran : sans
                        lui, la ligne se lirait « Des cahiers — Une caisse
                        centralisee », sans dire lequel est l'avant. */}
                    <span className="sol">
                      <span className="sr">{t.apres} : </span>
                      {solution}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------- pourquoi ---------------- */}
        <section className="sec" id="pourquoi" style={{ background: "var(--ivoire-2)" }}>
          <div className="shell why">
            <div className="sec-head rv">
              <p className="eyebrow">{t.e5}</p>
              <h2 style={{ marginTop: 18 }}>
                <span>{t.h7a}</span>
                <br />
                <em style={{ color: "var(--bordeaux)" }}>{t.h7b}</em>
              </h2>
            </div>
            <div className="why-list rv d1">
              {[t.w1, t.w2, t.w3, t.w4, t.w5, t.w6, t.w7].map((x) => (
                <div key={x}>
                  <i>✓</i>
                  <span>{x}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="sec" id="faq">
          <div className="shell">
            <div className="sec-head centre rv">
              <p className="eyebrow">{t.e6}</p>
              <h2>{t.h8}</h2>
            </div>
            <div className="faq rv d1">
              {QUESTIONS.map((item, i) => (
                <details key={item.q} open={i === 0}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- clôture ---------------- */}
        <section className="sec final" id="tarifs">
          <div className="shell">
            <h2 className="rv">
              <span>{t.h9a}</span>
              <br />
              <em>{t.h9b}</em>
            </h2>
            <p className="lede rv d1">{t.p9}</p>
            <a className="btn btn-solid rv d2" href="/pos-start">
              <span>{t.cta3}</span>
              <span className="arrowc">→</span>
            </a>
            <p className="fine rv d3">{t.fine}</p>
          </div>
        </section>

        <footer>
          <div className="shell foot">
            <span className="brand">
              <em>salon</em>ista<b>.</b>
            </span>
            <span>{t.foot}</span>
            <a href="/login">{t.deja}</a>
          </div>
        </footer>
      </div>

      {/* `navOpaque` vaut true des 60 px de defilement : la barre apparait
          quand le bouton du hero commence a sortir de l'ecran, et pas avant. */}
      <div className={`sticky-cta${navOpaque ? " on" : ""}`}>
        <a className="btn btn-solid" href="/pos-start">
          <span>{t.cta}</span>
          <span className="arrowc">→</span>
        </a>
      </div>
    </div>
  );
}
