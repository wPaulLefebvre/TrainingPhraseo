# Phraséo Radio

Entraînement à la phraséologie radio VFR pour l'examen PPL : écoute d'ATIS, échanges avec un AFIS, auto-information, messages d'urgence et arrivée sur terrain contrôlé. Tu parles, l'app transcrit, puis corrige la terminologie et les collationnements.

La référence est le **Manuel de phraséologie à l'usage de la circulation aérienne générale** (DSNA, 10e édition, 15 avril 2023). Quand un cas n'y figure pas (auto-information, certaines annonces AFIS), l'app le signale comme « pratique usuelle, hors manuel ».

## Fonctionnement

- **Deux langues** : français ou anglais, au choix avant chaque exercice.
- **Mode débutant** : messages de la station affichés, réponse type disponible, correction après chaque transmission avec possibilité de recommencer.
- **Mode expérimenté** : messages à l'écoute uniquement, aucune aide, débrief complet à la fin du scénario.
- **Conditions aléatoires** à chaque essai : aérodrome de Nouvelle-Aquitaine, piste, vent, QNH, lettre ATIS, trafic, position.
- **Historique** stocké sur l'appareil : notes, erreurs récurrentes, export JSON.

### Scénarios

| Groupe | Exercice |
|---|---|
| ATIS | Écoute et relevé des éléments |
| AFIS | Départ, arrivée, tours de piste (toucher, remise de gaz), transit verticale |
| Auto-information | Arrivée avec trafic au sol |
| Urgence | PAN PAN (moteur irrégulier), MAYDAY (panne moteur) |
| Aérodrome contrôlé | Arrivée avec clairances et collationnement « j'atterris » |

## Mise en ligne sur GitHub Pages

1. Crée un dépôt public (par exemple `phraseo-radio`) et pousse-y le contenu de ce dossier, `index.html` à la racine.
2. Dans le dépôt : **Settings › Pages › Build and deployment**, source **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Après une à deux minutes, l'app est en ligne à l'adresse `https://<ton-pseudo>.github.io/phraseo-radio/`.

Le fichier `.nojekyll` évite que GitHub retraite les fichiers.

## Installation sur iPhone

1. Ouvre l'adresse dans **Safari**.
2. Bouton **Partager › Sur l'écran d'accueil**.
3. Au premier appui sur l'alternat, autorise le micro et la reconnaissance vocale.

Si la reconnaissance vocale ne répond pas (selon la version d'iOS, depuis l'icône de l'écran d'accueil ou dans claude.ai), touche la zone de texte et utilise **la dictée du clavier iOS** (icône micro du clavier) : elle fonctionne partout.

Pour une voix plus naturelle : **Réglages iOS › Accessibilité › Contenu énoncé › Voix**, télécharge une voix française et une voix anglaise « améliorée », puis choisis-les dans les réglages de l'app.

## Deux versions, même code, aucun coût d'API

| | Version GitHub Pages | Version artefact claude.ai |
|---|---|---|
| Adresse | `https://<pseudo>.github.io/phraseo-radio/` | lien claude.ai de l'artefact publié |
| Correction | règles locales | Claude, avec repli sur les règles locales |
| Coût | aucun | décompté de ton utilisation Claude, comme une conversation |
| Hors ligne | oui | non |

L'app détecte seule où elle tourne. Dans claude.ai, la première correction déclenche une demande d'autorisation ; ensuite, chaque transmission corrigée consomme un peu de ton quota (une seule demande par scénario en mode expérimenté). Dans les réglages, tu peux forcer les règles locales pour économiser ce quota.

**Règles locales** : indicatif complet ou abrégé selon le moment, indicatif en fin de collationnement, station appelée, valeurs collationnées (piste, QNH, main du circuit, lettre ATIS, avec détection des valeurs erronées), « roger » à la place d'un collationnement, demande d'autorisation à un AFIS, « autorisé » dans la bouche du pilote, éléments attendus dans chaque message (type, position, altitude, estimée, intentions…), structure MAYDAY / PAN PAN, termes non conventionnels (oui, non, OK, pardon, over, out). Elles ne jugent pas une formulation imprévue aussi finement que Claude.

**Republier la version claude.ai** après une modification : `python3 build.py` produit `dist/phraseo-radio.html`, un fichier unique à republier depuis une conversation Claude.

## Structure

```
index.html              page unique
css/style.css           façade radio + planchette
js/app.js               écrans, déroulé des exercices, alternat, historique, réglages
js/scenarios.js         scénarios et réponses types FR/EN
js/aerodromes.js        aérodromes de Nouvelle-Aquitaine
js/radio.js             génération des conditions, ATIS, énonciation (chiffres, alphabet)
js/speech.js            reconnaissance et synthèse vocales
js/evaluator.js         correction (Claude dans claude.ai, sinon règles locales)
build.py                assemble dist/phraseo-radio.html pour claude.ai
js/storage.js           réglages et historique
sw.js, manifest.webmanifest, icons/   installation sur l'écran d'accueil
```

## Personnaliser

- **Aérodromes** : `js/aerodromes.js`. Les pistes et fréquences fournies sont **indicatives** : vérifie et corrige-les avec les cartes VAC du [SIA](https://www.sia.aviation-civile.gouv.fr). Tu peux ajouter tes terrains habituels.
- **Scénarios** : `js/scenarios.js`. Chaque étape pilote contient une situation, une réponse type FR/EN et la liste des éléments obligatoires.
- Après une modification, incrémente `CACHE` dans `sw.js` (`phraseo-v2`…) pour que l'iPhone récupère la nouvelle version.

## Avertissement

Outil d'entraînement personnel. Il ne remplace ni l'instruction en aéroclub, ni les publications officielles (manuel DSNA, AIP, cartes VAC).
