# Atelier de planètes

Une démo 3D qui tourne entièrement dans le navigateur : un système de six planètes générées par le code, que l'on peut façonner depuis l'orbite, puis explorer au sol à pied ou en vaisseau.

Aucune texture, aucun modèle 3D importé, aucun fichier son : le relief, le climat, les nuages, les anneaux, la faune et les sons sont calculés en direct.

Construit au fil d'une conversation avec Claude (Anthropic).

## Aperçu

![La planète tellurique vue depuis l'orbite, avec ses anneaux et le panneau de réglages](docs/01-orbite.png)

| | |
|---|---|
| ![Monde de lave](docs/02-monde-de-lave.png) Monde de lave | ![Géante gazeuse](docs/03-geante-gazeuse.png) Géante gazeuse |
| ![Vue du système et de ses six mondes](docs/04-systeme.png) Le système et ses six mondes | ![Fin de la descente : la côte, un bosquet et un troupeau](docs/05-descente.png) Fin de la descente |
| ![Au sol : troupeau, forêt, volants et anneaux dans le ciel](docs/06-au-sol.png) Au sol, à pied | ![En vaisseau au-dessus d'un troupeau](docs/07-en-vaisseau.png) En vaisseau |

Ces captures viennent de `index.html`, sans retouche ; les trois du sol (descente, à pied, en vaisseau) datent d'avant la refonte de l'interface. Elles ont été prises avec un rendu logiciel (sans carte graphique) : sur une vraie machine, l'image est la même mais fluide.

## Lancer la démo

Ouvrez `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari), avec l'accélération matérielle activée. Une connexion est nécessaire au premier chargement : la page récupère three.js (r128) et deux polices depuis un CDN.

Pour la mettre en ligne, activez GitHub Pages sur la branche principale : `index.html` est à la racine.

## Ce qu'on peut faire

- **En orbite :** choisir un type de monde (tellurique, océan, désert, glace, lave, géante gazeuse), régler niveau des mers, température, nuages, atmosphère et anneaux, ou tirer une planète au hasard.
- **Se poser :** bouton « Se poser » (plaine tempérée la plus proche) ou double-clic sur un lieu précis. La descente traverse les nuages sans coupure.
- **Au sol :** marcher (flèches ou ZQSD/WASD, Maj pour courir) ou piloter le vaisseau. Le terrain est celui vu depuis l'orbite ; le soleil, les anneaux et les lunes sont à leur vraie place dans le ciel.
- **Faune :** chaque planète tire ses espèces de sa graine : troupeaux, prédateurs, volants, bancs marins et un géant des profondeurs.
- **Système :** voyager entre les six mondes autour de l'étoile.
- **Partage :** « Partager » copie un lien (ou un code) qui recrée exactement une planète.
- **Photo :** masque l'interface, propose des cadres (plein écran, 16:9, 4:5, carré) et enregistre l'image en PNG.
- **Clavier :** P (photo), M (son), V (vaisseau), R (redécoller) et ? pour l'aide des raccourcis de la vue en cours ; les touches de déplacement y sont nommées selon le clavier utilisé (ZQSD ou WASD).

## Fichiers

| Fichier | Contenu |
|---|---|
| `index.html` | La démo complète, en un seul fichier |
| `ile-au-phare.html` | La première démo de la série : une île générée, avec phare, forêt et cycle jour/nuit |
| `VIDEO-LINKEDIN.md` | Script de vidéo et texte de post pour présenter la démo sur LinkedIn |
| `docs/` | Captures d'écran utilisées dans ce README |
| `tests/parcours.js` | Tests de parcours dans Chromium (voir plus bas) |

## Comment ça marche, en bref

- **Vue d'orbite :** une sphère dont chaque pixel est calculé par un shader (bruit fractal pour les continents, climat par latitude et altitude, ombres des lunes et des anneaux calculées géométriquement).
- **Vue du sol :** un lancer de rayons sur un champ de hauteur. Le relief à grande échelle est échantillonné dans la fonction de hauteur de la planète autour du site d'atterrissage, puis du détail fin est ajouté. La zone se recentre sous le joueur, ce qui permet de traverser toute la planète.
- **Faune et vaisseau :** des maillages three.js dessinés par-dessus, masqués par le relief grâce à la profondeur écrite par le lancer de rayons.
- **Son :** synthèse Web Audio (bruit filtré et oscillateurs).

## Tests

La démo n'a besoin de rien d'autre que `index.html`. Les tests, eux, pilotent un vrai Chromium avec Playwright :

```
npm install
npm test             # parcours complet : chargement, système, atterrissage, aide clavier, vaisseau, redécollage, voyage
npm run test:rapide  # chargement (bureau et téléphone) et fiches des mondes, sans descente
```

Sans carte graphique, le rendu logiciel rend le parcours complet lent (plusieurs minutes). Si le CDN n'est pas joignable, `THREE_JS=/chemin/three.min.js` sert three.js r128 depuis un fichier local.

## Limites connues

- La vue du sol est exigeante pour la carte graphique ; la résolution baisse automatiquement si l'appareil peine.
- Les mondes de lave, de glace et de désert ont été parcourus en rendu logiciel (atterrissage, marche, vaisseau, redécollage) sans erreur, mais pas regardés sur une vraie carte graphique. Le son et la navigation tactile n'ont été vérifiés qu'en émulation, sans écoute ni vrai écran tactile.
- Les chasses des prédateurs n'aboutissent jamais : la proie s'échappe toujours.
