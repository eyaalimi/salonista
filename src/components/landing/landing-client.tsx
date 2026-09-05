"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONTENU, type Langue } from "./content";

const IMG = "/images/lp/";
const CLE_LANGUE = "salonista-lang";

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

  /* ---------- revelations, parallaxe, fonctionnalites ---------- */
  const [featureActive, setFeatureActive] = useState(0);

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

    /* L'image des fonctionnalites suit la ligne en cours de lecture. */
    let ioFeat: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      ioFeat = new IntersectionObserver(
        (entrees) => {
          for (const e of entrees) {
            if (!e.isIntersecting) continue;
            const i = Number((e.target as HTMLElement).dataset.i);
            if (!Number.isNaN(i)) setFeatureActive(i);
          }
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
      );
      document.querySelectorAll(".feat").forEach((el) => ioFeat?.observe(el));
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
      ioFeat?.disconnect();
      document.body.classList.remove("js");
    };
  }, []);

  /* ---------- comparatif avant / avec ---------- */
  const cmpRef = useRef<HTMLDivElement>(null);
  const [coupe, setCoupe] = useState(50);

  const deplacer = useCallback(
    (clientX: number) => {
      const zone = cmpRef.current;
      if (!zone) return;
      const r = zone.getBoundingClientRect();
      const brut = ((clientX - r.left) / r.width) * 100;
      const p = rtl ? 100 - brut : brut;
      setCoupe(Math.max(6, Math.min(94, p)));
    },
    [rtl],
  );

  useEffect(() => {
    const zone = cmpRef.current;
    if (!zone) return;
    let glisse = false;

    const debut = (e: MouseEvent | TouchEvent) => {
      glisse = true;
      deplacer("touches" in e ? e.touches[0].clientX : e.clientX);
    };
    const pendant = (e: MouseEvent | TouchEvent) => {
      if (!glisse) return;
      deplacer("touches" in e ? e.touches[0].clientX : e.clientX);
      if (e.cancelable) e.preventDefault();
    };
    const fin = () => {
      glisse = false;
    };

    zone.addEventListener("mousedown", debut);
    zone.addEventListener("touchstart", debut, { passive: true });
    window.addEventListener("mousemove", pendant);
    window.addEventListener("touchmove", pendant, { passive: false });
    window.addEventListener("mouseup", fin);
    window.addEventListener("touchend", fin);

    return () => {
      zone.removeEventListener("mousedown", debut);
      zone.removeEventListener("touchstart", debut);
      window.removeEventListener("mousemove", pendant);
      window.removeEventListener("touchmove", pendant);
      window.removeEventListener("mouseup", fin);
      window.removeEventListener("touchend", fin);
    };
  }, [deplacer]);

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setCoupe((p) => Math.max(6, p - 4));
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      setCoupe((p) => Math.min(94, p + 4));
      e.preventDefault();
    }
  };

  const stylePanneauAvant: React.CSSProperties = rtl
    ? { width: `${coupe}%`, right: 0, left: "auto" }
    : { width: `${coupe}%`, left: 0, right: "auto" };
  const stylePoignee: React.CSSProperties = rtl
    ? { right: `${coupe}%`, left: "auto" }
    : { left: `${coupe}%`, right: "auto" };

  const FONCTIONS = [
    { no: "01", label: t.l1, phrase: t.s1, img: "f-encaissement" },
    { no: "02", label: t.l2, phrase: t.s2, img: "f-agenda" },
    { no: "03", label: t.l3, phrase: t.s3, img: "f-clients" },
    { no: "04", label: t.l4, phrase: t.s4, img: "f-stock" },
    { no: "05", label: t.l5, phrase: t.s5, img: "ui-stats" },
    { no: "06", label: t.l6, phrase: t.s6, img: "ui-tiroir" },
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
        <section className="hero">
          <div className="hero-media" data-par="0.16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}hero.jpg`} alt="" width={1760} height={990} fetchPriority="high" />
          </div>
          <div className="hero-scrim" />
          <div className="shell hero-in">
            <p className="eyebrow rv in">{t.eyebrow}</p>
            <h1 className="rv in d1">
              <span>{t.h1a}</span>
              <br />
              <em>{t.h1b}</em>
            </h1>
            <div className="hero-cta rv in d2">
              <a className="btn btn-solid" href="/pos-start">
                <span>{t.cta}</span>
                <span className="arrowc">→</span>
              </a>
              <a className="btn btn-ghost" href="#produit">
                <span>{t.cta2}</span>
              </a>
            </div>
            <div className="hero-foot rv in d3">
              <span>{t.hf1}</span>
              <span>{t.hf2}</span>
              <span>{t.hf3}</span>
            </div>
          </div>
          <aside className="hero-chip rv in d3">
            <div className="l1">{t.chip1}</div>
            <div className="l2">
              <span>{t.chip2}</span>
              <b>35,000</b>
            </div>
            <div className="l2">
              <span>{t.chip3}</span>
              <b>25,000</b>
            </div>
            <div className="l3">
              <span>{t.chip4}</span>
              <span>60,000</span>
            </div>
            <div className="ok">{t.chip5}</div>
          </aside>
        </section>

        {/* ---------------- la caisse ---------------- */}
        <section className="sec" id="produit">
          <div className="shell">
            <div className="sec-head rv">
              <p className="eyebrow">{t.e1}</p>
              <h2>
                <span>{t.h2a}</span>{" "}
                <em style={{ fontStyle: "italic", color: "var(--bordeaux)" }}>{t.h2b}</em>
              </h2>
            </div>

            <div className="compo">
              <div className="compo-main rvl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}ui-caisse.jpg`} alt={t.c1} width={1100} height={683} loading="lazy" />
              </div>
              <div className="float f-a rv" data-par="-0.05">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}ui-agenda.jpg`} alt={t.c2} width={820} height={269} loading="lazy" />
              </div>
              <div className="float f-b rv d1" data-par="0.07">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}ui-fidelite.jpg`} alt={t.c3} width={817} height={197} loading="lazy" />
              </div>
              <div className="float f-c rv d2" data-par="-0.09">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}ui-stats.jpg`} alt={t.c7} width={820} height={228} loading="lazy" />
              </div>
            </div>

            <div className="chips rv">
              <span>{t.c1}</span>
              <span>{t.c2}</span>
              <span>{t.c3}</span>
              <span>{t.c4}</span>
              <span>{t.c5}</span>
              <span>{t.c6}</span>
              <span>{t.c7}</span>
              <span>{t.c8}</span>
            </div>
          </div>
        </section>

        {/* ---------------- editorial ---------------- */}
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="shell edito">
            <div className="edito-img rvl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${IMG}editorial.jpg`} alt="" width={630} height={1120} loading="lazy" data-par="0.05" />
            </div>
            <div>
              <p className="eyebrow rv">{t.e2}</p>
              <h2 className="rv d1" style={{ marginTop: 18 }}>
                <span>{t.h3a}</span>
                <br />
                <em style={{ fontStyle: "italic", color: "var(--bordeaux)" }}>{t.h3b}</em>
              </h2>
              <p className="lede rv d2" style={{ marginTop: 26 }}>
                {t.p3}
              </p>
              <div className="figures rv d3">
                <div className="fig">
                  <b>{t.figv1}</b>
                  <span>{t.fig1}</span>
                </div>
                <div className="fig">
                  <b>{t.figv2}</b>
                  <span>{t.fig2}</span>
                </div>
                <div className="fig">
                  <b>{t.figv3}</b>
                  <span>{t.fig3}</span>
                </div>
                <div className="fig">
                  <b>{t.figv4}</b>
                  <span>{t.fig4}</span>
                </div>
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
                <span>{t.h4a}</span> <em style={{ fontStyle: "italic" }}>{t.h4b}</em>
              </h2>
            </div>

            <div className="feat-wrap">
              <div className="feat-list">
                {FONCTIONS.map((f, i) => (
                  <article
                    key={f.no}
                    className={`feat${featureActive === i ? " live" : ""}`}
                    data-i={i}
                  >
                    <span className="no">{f.no}</span>
                    <span className="lb">{f.label}</span>
                    <p className="ph">{f.phrase}</p>
                    <div className="inline-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${IMG}${f.img}.jpg`} alt="" loading="lazy" />
                    </div>
                  </article>
                ))}
              </div>

              <div className="feat-stage">
                {FONCTIONS.map((f, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f.no}
                    src={`${IMG}${f.img}.jpg`}
                    alt=""
                    loading="lazy"
                    className={featureActive === i ? "on" : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- respiration ---------------- */}
        <section className="emo">
          <div className="emo-media" data-par="0.12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}emotion.jpg`} alt="" width={1500} height={1590} loading="lazy" />
          </div>
          <div className="emo-in">
            <h2 className="rv">
              <span>{t.h5a}</span>
              <br />
              <em>{t.h5b}</em>
            </h2>
          </div>
        </section>

        {/* ---------------- avant / avec ---------------- */}
        <section className="sec">
          <div className="shell">
            <div className="sec-head rv">
              <p className="eyebrow">{t.e4}</p>
              <h2>
                <span>{t.h6a}</span>{" "}
                <em style={{ fontStyle: "italic", color: "var(--bordeaux)" }}>{t.h6b}</em>
              </h2>
            </div>

            <div className="cmp rv" ref={cmpRef}>
              <div className="cmp-pane cmp-b">
                <div className="inner">
                  <p className="tag">{t.apres}</p>
                  <h3 style={{ marginTop: 12 }}>{t.apresT}</h3>
                  <ul>
                    {[t.ap1, t.ap2, t.ap3, t.ap4, t.ap5, t.ap6].map((x) => (
                      <li key={x}>
                        <i>✓</i>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="cmp-pane cmp-a" style={stylePanneauAvant}>
                <div className="inner">
                  <p className="tag">{t.avant}</p>
                  <h3 style={{ marginTop: 12 }}>{t.avantT}</h3>
                  <ul>
                    {[t.av1, t.av2, t.av3, t.av4, t.av5, t.av6].map((x) => (
                      <li key={x}>
                        <i>—</i>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div
                className="handle"
                style={stylePoignee}
                role="slider"
                tabIndex={0}
                aria-label={t.hint}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(coupe)}
                onKeyDown={auClavier}
              />
            </div>
            <p className="cmp-hint">{t.hint}</p>
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
                <em style={{ fontStyle: "italic", color: "var(--bordeaux)" }}>{t.h7b}</em>
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
            <div className="sec-head rv" style={{ maxWidth: "none", textAlign: "center" }}>
              <p className="eyebrow">{t.e6}</p>
              <h2 style={{ marginTop: 16, maxWidth: "none" }}>{t.h8}</h2>
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

      <div className="sticky-cta">
        <a className="btn btn-solid" href="/pos-start">
          <span>{t.cta}</span>
          <span className="arrowc">→</span>
        </a>
      </div>
    </div>
  );
}
