# Polices hébergées

Ces fichiers remplacent `next/font/google`, qui téléchargeait les polices chez
Google à chaque build et a fait échouer deux déploiements (voir le commentaire
de `src/app/layout.tsx`).

Ce sont les fichiers servis par Google Fonts (sous-ensemble **latin**), récupérés
le 12/11/2026. Toutes ces polices sont sous **SIL Open Font License 1.1**, qui
autorise leur redistribution et leur hébergement.

| Fichier | Police | Source |
|---|---|---|
| `geist.woff2` | Geist (variable, 100–900) | fonts.gstatic.com/s/geist/v5 |
| `playfair-display.woff2` | Playfair Display (variable) | fonts.gstatic.com/s/playfairdisplay/v40 |
| `archivo.woff2` | Archivo (variable) | fonts.gstatic.com/s/archivo/v25 |
| `ibm-plex-sans.woff2` | IBM Plex Sans (variable) | fonts.gstatic.com/s/ibmplexsans/v23 |
| `ibm-plex-mono-400/500/600.woff2` | IBM Plex Mono | fonts.gstatic.com/s/ibmplexmono/v23 |

Pour ajouter une graisse ou une police : télécharger le `.woff2` du sous-ensemble
latin depuis la feuille `fonts.googleapis.com/css2?family=…`, le déposer ici et
le déclarer avec `next/font/local`. **Ne pas revenir à `next/font/google`.**

Noto Kufi Arabic reste chargée par `<link>` dans `layout.tsx`, côté navigateur :
elle ne touche pas au build.
