"use client";

import Image, { type ImageProps, type ImageLoaderProps } from "next/image";
import { aDesVariantes, urlVariante } from "@/lib/upload-image";

/**
 * Images televersees, servies depuis `/uploads/`.
 *
 * Pourquoi pas `<Image>` directement : l'optimiseur de Next.js prend un
 * instantane de `public/` au moment du build. Les fichiers ecrits APRES —
 * c'est-a-dire toutes les photos de salon — lui sont invisibles et il repond
 * 400 « received null ». Nginx sert `/uploads/` en direct avec un cache de
 * 7 jours.
 *
 * Le `loader` remplace l'optimiseur : depuis le lot C, chaque televersement
 * ecrit des variantes `-400`, `-800` et `-1600` en WebP a cote du fichier
 * canonique. Next construit son `srcset` a partir de ce loader, et le
 * navigateur choisit la bonne taille. Sans cela, une vignette affichee dans
 * 160 px telechargeait l'image pleine largeur — mesure en production.
 *
 * Note : passer `srcSet` en prop ne fonctionne PAS. `get-img-props` fait un
 * `delete rest.srcSet`, et le force meme a `undefined` sous `unoptimized`.
 * Le loader est le seul point d'entree prevu.
 */

function loaderUploads({ src, width }: ImageLoaderProps): string {
  return urlVariante(src, width);
}

export function UploadedImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";

  // Les images d'avant le lot C sont en `.jpg`/`.png` et n'ont aucune
  // variante : elles restent en `unoptimized`, sans quoi le navigateur
  // demanderait des fichiers absents. Celles qui en ont passent par le
  // loader, qui fait construire a Next un `srcset` sur les variantes.
  const variantes = aDesVariantes(src)
    ? { loader: loaderUploads }
    : { unoptimized: true };

  // `alt` est obligatoire via `ImageProps` et arrive par `props` — la regle
  // jsx-a11y ne sait pas le voir a travers un composant enveloppant.
  return <Image {...props} {...variantes} />;
}
