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
  /* La barre fixe du bas n'a pas le meme seuil que la barre du haut : elle
     occupe 11 % d'un ecran de telephone, et repeter le bouton du hero pendant
     qu'il est encore visible ne sert a rien. Elle attend que le hero soit
     reellement passe. */
  const [ctaVisible, setCtaVisible] = useState(false);

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

    /* Le seuil de la barre fixe se mesure sur le hero lui-meme : elle
       apparait quand son bas passe au-dessus du bord de l'ecran. Une valeur
       en dur aurait ete fausse des que la hauteur du hero change — et elle
       change avec la langue, la taille de police et l'orientation. */
    const hero = document.querySelector(".hero");

    const auScroll = () => {
      setNavOpaque(window.scrollY > 60);
      const bas = hero?.getBoundingClientRect().bottom ?? 0;
      setCtaVisible(bas < 80);
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
   * Quatre apercus de la caisse, en teaser : chacun montre la capture
   * ENTIERE, sans rognage ni fondu. La troisieme montre le programme de
   * fidelite — nom du salon et identites des clientes FLOUTES a la source,
   * comme partout ailleurs sur cette page.
   */
  const TEASERS = [
    { no: "01", img: "ecran-caisse", label: t.tzLabel1, titre: t.tzTitre1, texte: t.tzTexte1, alt: t.tzAlt1 },
    { no: "02", img: "ecran-salon", label: t.tzLabel2, titre: t.tzTitre2, texte: t.tzTexte2, alt: t.tzAlt2 },
    { no: "03", img: "ecran-fidelite2", label: t.tzLabel3, titre: t.tzTitre3, texte: t.tzTexte3, alt: t.tzAlt3 },
    { no: "04", img: "ecran-commissions", label: t.tzLabel4, titre: t.tzTitre4, texte: t.tzTexte4, alt: t.tzAlt4 },
  ] as const;

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
        {/**
         * SUR TELEPHONE, le hero est en TROIS temps : titre, photo, puis la
         * phrase et le bouton. Le texte occupait 595 px avant la photo sur un
         * ecran qui en montre 700 : le visiteur lisait une promesse sans
         * jamais voir le produit. La photo remonte donc au-dessus de la ligne
         * de flottaison.
         *
         * Sur ordinateur, les deux colonnes reprennent leur place : le titre
         * et sa suite se rejoignent a gauche, la photo tient la droite.
         * L'ordre du DOM suit la lecture MOBILE ; c'est la grille de bureau
         * qui recompose, pas l'inverse.
         */}
        <section className="hero">
          <div className="shell hero-in">
            <div className="hero-titre">
              <p className="eyebrow rv in">{t.eyebrow}</p>
              {/* Trois lignes courtes empilees, chacune lisible d'un coup
                  d'oeil. Le <br> est porte par le CSS sur telephone, ou
                  trois lignes forcees deborderaient. */}
              <h1 className="rv in d1">
                <span>{t.h1a}</span>
                <br />
                <span>{t.h1b}</span>
                <br />
                <em>{t.h1c}</em>
              </h1>
            </div>

            {/* `fetchPriority="high"` : c'est l'image la plus grande de la
                zone visible au chargement, donc celle que mesure le LCP. */}
            <div className="hero-photo rv in d2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${IMG}${HERO_PHOTO}.webp`}
                /* La source fait 1536 px : la variante « -1600 » y plafonne.
                   L'annoncer a sa VRAIE largeur, sinon le navigateur la croit
                   plus grande et telecharge 106 Ko la ou 76 suffisaient. */
                srcSet={`${IMG}${HERO_PHOTO}-800.webp 800w, ${IMG}${HERO_PHOTO}-1200.webp 1200w, ${IMG}${HERO_PHOTO}-1600.webp 1536w`}
                sizes="(min-width: 900px) 60vw, 100vw"
                alt={t.altHero}
                width={1536}
                height={1024}
                fetchPriority="high"
              />
            </div>

            <div className="hero-suite">
              <hr className="hero-trait rv in d2" />
              <p className="hero-lede rv in d2">{t.heroLede}</p>

              {/* Les quatre benefices, en deux colonnes. Une <ul> et non des
                  <div> : c'est une liste, et un lecteur d'ecran doit
                  l'annoncer comme telle. */}
              <ul className="hero-plus rv in d2">
                {[t.b1, t.b2, t.b3, t.b4].map((b) => (
                  <li key={b}>
                    <span aria-hidden="true">✦</span>
                    {b}
                  </li>
                ))}
              </ul>

              <div className="hero-cta rv in d2">
                <a className="btn btn-solid" href="/pos-start">
                  <span>{t.cta}</span>
                  <span className="arrowc">→</span>
                </a>
                {/* « Decouvrir Salonista » n'est qu'un lien vers le bas de la
                    page : en bouton, il prenait autant de place que l'action
                    principale. Sur telephone il devient un lien discret. */}
                <a className="btn btn-line hero-second" href="#produit">
                  <span>{t.cta2}</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- la caisse, en teaser ---------------- */}
        {/**
         * Remplace le navigateur d'ecrans (choix d'appareil + neuf onglets +
         * fleches) par QUATRE cartes en apercu. Le selecteur montrait tout
         * l'ecran tout de suite ; ici chaque carte ne montre qu'un FRAGMENT
         * -- juste assez pour donner envie d'ouvrir sa caisse gratuite et
         * voir le reste. Le detail complet n'a plus besoin d'exister sur la
         * landing, il existe dans le produit.
         */}
        <section className="sec" id="produit">
          <div className="shell">
            <div className="sec-head rv">
              <p className="eyebrow">{t.e1}</p>
              <h2>
                <span>{t.h2a}</span> <em style={{ color: "var(--bordeaux)" }}>{t.h2b}</em>
              </h2>
              <p className="lede" style={{ marginTop: 16 }}>{t.h2lede}</p>
            </div>

            <div className="teasers rv">
              {TEASERS.map((tz) => (
                <article key={tz.no} className="teaser">
                  <div className="teaser-tete">
                    <span className="teaser-no">{tz.no}</span>
                    <span className="teaser-label">{tz.label}</span>
                  </div>

                  {/* La capture s'affiche ENTIERE, a son propre ratio : pas
                      de rognage, pas de fondu. Chacune est decrite pour qui
                      ne la voit pas. */}
                  <div className="teaser-apercu">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${IMG}${tz.img}-760.webp`}
                      alt={tz.alt}
                      loading="lazy"
                    />
                  </div>

                  <h3 className="teaser-titre">{tz.titre}</h3>
                  <p className="teaser-texte">{tz.texte}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- toujours avec vous (mobile) ---------------- */}
        {/**
         * Section sombre, seule de son espece sur la page : elle casse le
         * rythme clair pour mettre en avant ce que le prestataire utilise le
         * plus souvent au comptoir -- son telephone. Une vraie capture de la
         * caisse mobile plutot qu'une maquette vide, deux etiquettes de
         * chiffres flottent a cote comme sur la reference fournie.
         */}
        <section className="sec mob" id="mobile">
          <div className="shell mob-in">
            <div className="mob-texte rv">
              <p className="eyebrow mob-eyebrow">{t.mobEyebrow}</p>
              <h2>
                <span>{t.mobH2a}</span> <em>{t.mobH2b}</em>
              </h2>
              <p className="lede mob-lede">{t.mobLede}</p>
            </div>

            <div className="mob-vitrine rv">
              <div className="mob-tel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${IMG}m-caisse-420.webp`}
                  srcSet={`${IMG}m-caisse-420.webp 420w, ${IMG}m-caisse-591.webp 591w`}
                  sizes="220px"
                  alt={t.mobAlt}
                  loading="lazy"
                />
              </div>

              <div className="mob-chip mob-chip1" aria-hidden="true">
                <span className="mob-chip-label">{t.mobChip1Label}</span>
                <span className="mob-chip-valeur">{t.mobChip1Valeur}</span>
              </div>
              <div className="mob-chip mob-chip2 mob-chip-menthe" aria-hidden="true">
                <span className="mob-chip-label">{t.mobChip2Label}</span>
                <span className="mob-chip-valeur">{t.mobChip2Valeur}</span>
              </div>
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

      <div className={`sticky-cta${ctaVisible ? " on" : ""}`}>
        <a className="btn btn-solid" href="/pos-start">
          <span>{t.cta}</span>
          <span className="arrowc">→</span>
        </a>
      </div>
    </div>
  );
}
