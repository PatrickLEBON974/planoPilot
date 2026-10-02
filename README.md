# PlanoPilot

Application de planogrammes pour Windows x64, entièrement hors ligne. L’interface, les données, la bibliothèque des projets et les exports fonctionnent sans compte ni serveur.

## Installation

Lancer `release/PlanoPilot Setup 1.2.0.exe`, ou décompresser `release/PlanoPilot-1.2.0-win.zip` puis lancer `PlanoPilot.exe`.

Les projets sont enregistrés dans le dossier `plans` du répertoire de données de l’application, sous `%APPDATA%\planopilot` sur Windows. L’installation d’une nouvelle version conserve ce répertoire. Pour transférer un projet sur un autre ordinateur, utiliser **Exporter le projet .plano**.

## Utilisation

Un tutoriel en six étapes s’ouvre à la première utilisation. Sa progression est conservée sur cet ordinateur si l’application est fermée pendant le parcours. **Passer le tutoriel**, Échap ou sa fermeture désactivent le lancement automatique. Le bouton **Aide et tutoriel**, en haut à droite, permet de le revoir à tout moment. Ce parcours ne modifie pas vos projets.

1. Créer et nommer un plan, ou ouvrir l’exemple depuis l’accueil.
2. Importer un CSV ou un XLSX. Choisir l’onglet, la ligne des en-têtes, la mesure des ventes et les colonnes.
3. Corriger le fichier si des lignes sont invalides, ou autoriser explicitement leur exclusion.
4. Choisir le périmètre et configurer les éléments, tablettes et unités.
5. Choisir le mode et le niveau de regroupement, puis générer le plan.
6. Ajuster les unités, déplacer ou redimensionner les blocs, créer des regroupements et choisir les couleurs.
7. Exporter le PDF, le CSV ou le projet modifiable depuis la barre supérieure.

La sauvegarde est automatique. **Mes plans** permet d’ouvrir, dupliquer et supprimer les projets. Le plan actif est restauré au prochain lancement. À la fermeture, les dernières modifications sont enregistrées avant de quitter.

Un clic sur le planogramme sélectionne un élément pour le déplacer ou le redimensionner. Un **double-clic** ouvre sa fenêtre d’édition : ajuster les unités d’une descente, les dimensions et le groupe d’un bloc, ou la référence et la position d’un article, puis choisir **Appliquer** ou **Annuler**. Les emplacements occupés et les dimensions hors du meuble sont refusés.

Le panneau de droite est masqué par défaut. **Paramètres → Affichage → Afficher le panneau de droite**, ou **Affichage → Panneau de droite**, affiche l’assortiment, sa recherche et ses filtres. Ce choix est conservé sur cet ordinateur. L’édition reste accessible au double-clic quel que soit l’affichage du panneau.

La barre de menus de bureau regroupe **Fichier**, **Édition**, **Affichage**, **Outils** et **Aide**. Elle donne accès aux projets, à la sauvegarde, aux exports, à l’annulation, à la modification et à la duplication de la sélection, aux imports et au tutoriel. Les commandes indisponibles sont grisées.

Le bouton **Télécharger l’image**, en haut du planogramme, enregistre un PNG en haute résolution. L’image reprend le plan complet, son nom, ses dimensions, les tablettes, les jonctions des éléments, les couleurs et les libellés. Cet export fonctionne dans les trois modes et reste indépendant du zoom, du défilement et de la sélection à l’écran.

## Paramètres et import de catalogues

Le menu **Paramètres**, dans la barre supérieure, regroupe l’import de catalogues, l’import de ventes et le téléchargement d’un modèle CSV. L’assistant accepte CSV et XLSX, propose l’association des colonnes, affiche un aperçu et signale les lignes invalides.

Le mode **Catalogue sans ventes** exige uniquement la désignation, la marque et le segment. Il conserve aussi la référence, le sous-segment, le conditionnement, le fournisseur, l’URL source et les notes. Les ventes sont affichées comme non renseignées, les parts de ventes et les écarts sont indisponibles, et la pondération par les ventes est désactivée. Les exports CSV laissent les ventes vides et les PDF indiquent leur absence. Les références répétées dans un catalogue sont exclues après la première occurrence ; les imports de ventes conservent leur comportement d’addition.

Un catalogue crée un nouveau plan par défaut. L’assistant permet également d’utiliser le plan actuel : son assortiment et ses implantations sont alors remplacés, avec possibilité d’annulation.

### Royal Bourbon Industries

Royal Bourbon Industries transforme et commercialise des produits agroalimentaires à Bras-Panon, à La Réunion. Son activité couvre les conserves, condiments, épices, confitures, desserts, boissons et surgelés. Son portefeuille présenté sur le site comprend Royal Bourbon, Maison Rama, Albius, Ceres et Kayamba. L’entreprise s’inscrit dans une histoire commencée dans les années 1950 ; la fusion qui constitue RBI date de 1996. Cette diversité conduit à organiser le catalogue par familles et marques. [Présentation officielle](https://royalbourbon.com/notre-soci%C3%A9t%C3%A9/).

Le fichier [royal-bourbon-produits-2026-10-01.csv](data/imports/royal-bourbon-produits-2026-10-01.csv) contient **72 entrées**, réparties en **11 segments** et **5 marques**, relevées sur le site et sa boutique officiels le 1er octobre 2026. Les 10 familles du site sont complétées par un segment de conserves et plats cuisinés provenant de la boutique. Certaines présentations ont été identifiées sur les photos des emballages. Le bouton **Importer Royal Bourbon** ouvre l’aperçu de ce fichier inclus dans l’application, utilisable hors ligne.

Le catalogue public ne permet pas de reconstituer les 350 références évoquées dans la présentation de la société. Les deux entrées de gamme non détaillées et les formats à confirmer sont signalés dans les désignations ou les notes. Les codes `RBI-WEB-*` sont des identifiants internes PlanoPilot. Les ventes, prix et EAN ne sont pas inventés. Les produits Chatel vendus par la boutique sont exclus de ce catalogue RBI. Les chiffres du site, notamment le chiffre d’affaires de 2017, ne constituent pas des indicateurs actuels. La liste des sources et les limites du relevé figurent dans [royal-bourbon-sources.json](data/imports/royal-bourbon-sources.json).

Les déplacements et redimensionnements s’alignent sur la grille et refusent les collisions. La suppression et la duplication concernent uniquement le bloc ou l’article sélectionné. Les poignées apparaissent au survol et à la sélection. En mode article, glisser une référence de l’assortiment vers une case libre.

`Ctrl N` crée un plan, `Ctrl S` enregistre, `Ctrl O` ouvre un projet, `Ctrl Z` annule, `Ctrl Y` rétablit, `Ctrl E` modifie la sélection et `Ctrl D` la duplique. `Ctrl Maj A` affiche ou masque le panneau de droite. Les flèches déplacent la sélection ; Supprimer et Retour arrière retirent un bloc ou un article. Les champs de saisie conservent leur comportement habituel.

## Règles de calcul

- Un élément mesure 1,33 m ; un demi-élément mesure 0,665 m.
- La capacité d’un demi-élément est un entier réglable séparément. Exemple : 2,5 éléments, 13 unités par élément et 7 unités dans le demi-élément donnent 33 unités en largeur.
- Les parts de ventes proviennent des données du périmètre sélectionné. Les modifications de l’implantation ne modifient jamais les ventes.
- La répartition automatique utilise les plus grands restes. Le total attribué respecte exactement la capacité.
- En descente, la part de linéaire correspond aux unités attribuées divisées par la capacité en largeur.
- Dans les autres modes, elle correspond aux cases occupées divisées par le nombre total de cases. Les blocs d’un même groupe sont additionnés.
- Les regroupements additionnent les ventes et les références sans supprimer les blocs. Les références répétées dans un import conservent leurs ventes ; le nombre de références compte les SKU distincts.
- Une appartenance absente est affichée comme non identifiée. Elle est conservée séparément des références internes et concurrentes.

Le PDF est généré depuis les données du projet avec un rendu dédié, sans capture d’écran. Les plans courants sont exportés sur une page paysage. Au-delà de 60 groupes, le plan reste sur la première page et le tableau commercial complet est ajouté en annexes paysage. Cela conserve les données et leur lisibilité.

Les anciens fichiers XLS doivent être convertis en XLSX. CSV et XLSX sont pris en charge jusqu’à 50 Mo. Le format `.plano` est un JSON versionné, contrôlé à l’ouverture ; le PDF est un document de présentation.

## Développement

Utiliser Node.js 24 et npm.

```sh
npm ci
npm run dev:desktop
```

```sh
npm run build
npm test
npm run dist:win
```

Les tests de bureau nécessitent une session graphique et lancent Electron avec un répertoire de données temporaire. Ils vérifient notamment les imports multi-onglets, les CSV invalides, 5 000 références, les interactions à la souris, la sauvegarde, la réouverture et les exports. Les captures et un PDF d’exemple sont générés dans `screenshots/`.

## Structure

- `src/domain.ts` : données, regroupements, allocation, géométrie, contraintes et migrations.
- `src/importer.ts` : import CSV/XLSX et validation des lignes.
- `src/Board.tsx` : déplacements, redimensionnements et glisser-déposer.
- `src/Panels.tsx` : configuration, sélection et assortiment avec liste virtuelle.
- `src/exports.ts` : CSV et document PDF.
- `electron/main.cjs` : fichiers locaux, bibliothèque, dialogues système et génération PDF.
- `electron/preload.cjs` : API limitée entre l’interface et Electron.

Le rendu est isolé et n’accède pas directement à Node.js. Les écritures sont ordonnées et utilisent un remplacement atomique. La version distribuée bloque les requêtes HTTP et HTTPS. Les polices sont celles du système ; les ressources sont incluses dans l’application.

La compilation Windows est réalisée depuis Linux. Les parcours Electron sont vérifiés sur Linux ; une recette sur Windows reste nécessaire avant une diffusion commerciale. Les exécutables générés ne disposent pas d’un certificat de signature de l’éditeur.
