# PlanoPilot

Application de planogrammes pour Windows x64. L’édition, l’ouverture et l’enregistrement des fichiers, les imports de données et les exports fonctionnent hors ligne, sans compte ni serveur. L’outil de recherche Open Food Facts utilise Internet à la demande.

## Installation

Lancer `release/PlanoPilot Setup 1.2.0.exe`, ou décompresser `release/PlanoPilot-1.2.0-win.zip` puis lancer `PlanoPilot.exe`.

Les plans sont des fichiers `.plano` enregistrés à l’emplacement de votre choix. Pour transférer un plan sur un autre ordinateur, copiez son fichier. Les fichiers créés par les anciennes versions restent dans `%APPDATA%\planopilot\plans` sur Windows et peuvent être ouverts depuis **Fichier → Ouvrir un plan (.plano)**.

## Utilisation

Un tutoriel en six étapes s’ouvre à la première utilisation. Sa progression est conservée sur cet ordinateur si l’application est fermée pendant le parcours. **Passer le tutoriel**, Échap ou sa fermeture désactivent le lancement automatique. Le menu **Aide → Revoir le tutoriel** permet de le revoir à tout moment. Ce parcours ne modifie pas vos plans.

1. Créer un plan et choisir sa structure, son mode d’implantation et son regroupement, ou ouvrir l’exemple depuis l’accueil.
2. Importer un CSV ou un XLSX depuis **Fichier → Données de ventes** ou **Catalogue de produits**. Choisir l’onglet, la ligne des en-têtes, la mesure des ventes et les colonnes.
3. Corriger le fichier si des lignes sont invalides, ou autoriser explicitement leur exclusion.
4. Choisir le périmètre et configurer les éléments, tablettes et unités.
5. Choisir le mode et le niveau de regroupement, puis générer le plan.
6. Ajuster les unités, déplacer ou redimensionner les blocs, créer des regroupements et choisir les couleurs.
7. Enregistrer le fichier `.plano` depuis **Fichier → Enregistrer**, puis exporter le PDF, le PNG ou le CSV depuis **Fichier → Exporter**.

**Fichier → Enregistrer** (`Ctrl S`) met à jour le fichier `.plano` ouvert. Pour un nouveau plan, une fenêtre demande son nom de fichier et son emplacement. **Fichier → Enregistrer sous** (`Ctrl Maj S`) crée un autre fichier et poursuit le travail dans celui-ci. Les modifications restent en mémoire jusqu’à l’enregistrement ; un astérisque dans le titre et le statut « Modifications non enregistrées » les signalent. Avant de fermer, de créer un autre plan, d’ouvrir un fichier, un exemple ou un import dans un nouveau plan, choisissez **Enregistrer**, **Ne pas enregistrer** ou **Annuler**. Annuler la sélection du fichier d’enregistrement ou rencontrer une erreur d’écriture conserve le plan en cours. Le lancement affiche l’accueil sans plan ouvert, sauf si un fichier `.plano` est fourni par l’Explorateur ou en argument.

**Fichier → Plans récents** ouvre un tiroir des vingt derniers fichiers ouverts ou enregistrés, avec leur nom et leur dossier. La liste conserve uniquement leurs chemins et dates d’utilisation ; elle ne crée aucune copie des plans. Les fichiers déplacés ou supprimés sont signalés comme introuvables. Retirer une entrée de cette liste conserve le fichier sur disque.

**Fichier → Ouvrir un plan (.plano)** charge un plan complet avec ses données, ses réglages et son implantation enregistrée. **Fichier → Données de ventes** et **Catalogue de produits** lisent des produits et des ventes depuis un CSV ou un XLSX pour créer un nouveau plan ou remplacer l’assortiment et l’implantation du plan actuel, selon la destination choisie dans l’assistant.

Un clic sur le planogramme sélectionne un élément pour le déplacer ou le redimensionner. Un **double-clic** ouvre sa fenêtre d’édition, avec les réglages à gauche et un aperçu du meuble à droite : ajuster les unités d’une descente, les dimensions et le groupe d’un bloc, ou la référence et la position d’un article, puis choisir **Appliquer** ou **Annuler**. L’aperçu suit les dimensions, la position et la couleur pendant la saisie. Les références du groupe se consultent dans une section repliable. **Appliquer** devient disponible après une modification valide ; les actions restent visibles sur une petite fenêtre. Les emplacements occupés et les dimensions hors du meuble sont refusés.

Sans plan ouvert, les colonnes latérales sont masquées. **Nouveau plan** propose les dimensions du meuble, les capacités, le mode, le regroupement et la pondération sans demander de nom. Le nom affiché provient uniquement du fichier choisi à l’enregistrement ; le planogramme n’affiche aucun nom avant l’ouverture ou l’enregistrement d’un fichier. Le bouton **Paramètres** réduit ou affiche la colonne de gauche, en conservant les réglages en cours de saisie.

**Fichier → Paramètres** définit la structure par défaut du meuble, le type d’implantation et le niveau de regroupement des nouveaux plans. **Enregistrer** mémorise ces choix après la fermeture de l’application ; **Annuler** abandonne les changements de cette fenêtre. Ils sont proposés dans **Nouveau plan** et utilisés pour les nouveaux plans créés par un import ou un premier ajout Open Food Facts. Les imports de catalogues respectent aussi le regroupement choisi. Dans la prévisualisation navigateur, l’icône **Paramètres** donne accès à ces mêmes réglages.

Le panneau de droite est masqué par défaut. **Affichage → Assortiment (panneau de droite)** affiche l’assortiment, sa recherche et ses filtres. Ce choix est conservé sur cet ordinateur. L’édition reste accessible au double-clic quel que soit l’affichage du panneau.

La barre de menus de bureau centralise les commandes générales. Les commandes indisponibles sont grisées, les préférences d’affichage sont cochées et les limites du zoom sont respectées. La grille des unités est affichée par défaut ; **Affichage → Afficher la grille des unités** permet de la masquer.

| Menu | Commandes |
| --- | --- |
| **Fichier** | Nouveau plan, ouverture, Plans récents, Données de ventes, Catalogue de produits, Enregistrer, Enregistrer sous, exports PDF/PNG/CSV, Paramètres, quitter. |
| **Édition** | Annuler/rétablir, couper/copier/coller le texte, modifier, dupliquer ou supprimer la sélection. |
| **Affichage** | Assortiment, grille des unités, agrandir/réduire/ajuster le plan, plein écran. |
| **Outils** | Régénérer le plan, créer un regroupement, composer un bloc, modèles d’import CSV, rechercher sur Open Food Facts. |
| **Aide** | Aide, tutoriel, raccourcis, ouvrir un exemple. |

Sur bureau, les boutons de plans, d’import, d’export, d’historique, de zoom et de regroupement qui répétaient ces menus sont retirés de l’espace de travail. Les réglages de périmètre, de meuble, de mode, de regroupement et de pondération restent dans la colonne gauche, avec le bouton **Régénérer le plan** qui termine ce parcours. Les sélecteurs de périmètre, de regroupement et de tablettes, ainsi que les dimensions saisies, préparent des réglages en attente sans modifier le meuble ni ses placements. **Régénérer le plan** ou **Outils → Régénérer le plan** applique ces réglages ensemble après confirmation. Annuler conserve le plan actuel et les réglages en attente ; `Ctrl Z` restaure les paramètres et les placements précédents après application. Dans un plan vide, **Appliquer les paramètres** ajuste le meuble sans import. Les couleurs et unités restent près des groupes. Le nom du fichier est affiché sur le planogramme ; la bande de titre sous le logo est supprimée. **Nouveau bloc** reste disponible pour le glisser-déposer ; les dimensions de création sont saisies uniquement dans la fenêtre de composition. L’accueil propose **Nouveau plan**, l’import et un exemple ; l’import reste disponible dans un plan vide. Les fenêtres d’import et d’édition conservent leurs actions contextuelles.

La prévisualisation dans un navigateur conserve les boutons nécessaires, puisqu’elle ne dispose pas de la barre de menus native. Enregistrer y télécharge un fichier `.plano` ; le navigateur ne permet pas de réécrire directement le fichier ouvert. Une fermeture ou un rechargement avec des modifications déclenche l’avertissement du navigateur.

La commande **Fichier → Exporter → Image PNG** enregistre un PNG en haute résolution. L’image reprend le plan complet, son nom, ses dimensions, les tablettes, les jonctions des éléments, les couleurs et les libellés. Cet export fonctionne dans les trois modes et reste indépendant du zoom, du défilement et de la sélection à l’écran.

## Imports, catalogues et modèles

Le menu **Fichier** propose directement **Données de ventes** et **Catalogue de produits**. **Outils → Modèles d’import CSV** propose deux fichiers vierges : un modèle de catalogue et un modèle de ventes avec chiffre d’affaires. Aucun catalogue d’entreprise n’est intégré à l’interface. L’assistant accepte CSV et XLSX, propose l’association des colonnes, affiche un aperçu et signale les lignes invalides. Pour un import de ventes, le choix **Chiffre d’affaires en euros** est affiché par défaut dès l’ouverture. Il reste sélectionné si aucune colonne de ventes n’est détectée : choisissez alors la colonne appropriée ou passez explicitement en **Catalogue sans ventes**. Les entrées de menu dédiées aux catalogues ouvrent directement ce dernier mode.

Le mode **Catalogue sans ventes** exige uniquement la désignation, la marque et le segment. Il conserve aussi la référence, le sous-segment, le conditionnement, le fournisseur, l’URL source et les notes. Les ventes sont affichées comme non renseignées, les parts de ventes et les écarts sont indisponibles, et la pondération par les ventes est désactivée. Les exports CSV laissent les ventes vides et les PDF indiquent leur absence. Les références répétées dans un catalogue sont exclues après la première occurrence ; les imports de ventes conservent leur comportement d’addition.

Un catalogue crée un nouveau plan par défaut. L’assistant permet également d’utiliser le plan actuel : son assortiment et ses implantations sont alors remplacés, avec possibilité d’annulation.

Les marques, fournisseurs et noms de produits affichés proviennent de vos imports ou des fiches de produits que vous ajoutez. L’exemple utilise des marques génériques et des données fictives. La colonne facultative **Référence interne** distingue les références internes, concurrentes et non identifiées ; les anciens en-têtes comme **Notre référence** restent acceptés. Le fichier source est indiqué dans les données importées ; le titre du plan provient de son fichier `.plano` lors de l’enregistrement.

**Outils → Rechercher sur Open Food Facts** recherche par nom, marque ou code-barres. Les noms et marques sont recherchés via le [moteur officiel Search-a-licious](https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/), les codes-barres via l’API produit v3.6. Les résultats sont paginés, avec photo si disponible, conditionnement, catégories et lien vers la fiche source. Un « + » signale un nombre de résultats estimé par le moteur. Une recherche se déclenche au clic sur **Rechercher**, jamais pendant la saisie. Une connexion Internet est nécessaire pour cet outil. Les résultats sont conservés en mémoire pendant cinq minutes, et les requêtes sont limitées à dix par minute conformément à la [documentation de l’API](https://openfoodfacts.github.io/openfoodfacts-server/api/).

Chaque fiche propose **Ajouter à l’assortiment**. Vérifiez la désignation, la marque et le segment avant l’ajout. Dans un plan vide, le premier ajout crée un catalogue sans ventes. Dans un plan commercial, le chiffre d’affaires ou les ventes en unités sont à renseigner explicitement : ces données ne proviennent pas d’Open Food Facts. Un ajout conserve les ventes et l’implantation existantes ; **Régénérer le plan** permet ensuite de répartir le nouvel assortiment. **Annuler** retire aussi un ajout. Les codes-barres déjà présents sont signalés. L’URL source et la mention Open Food Facts / ODbL sont conservées dans chaque référence ajoutée. Les attributions des données et des images sont affichées dans l’outil.

Les déplacements et redimensionnements s’alignent sur la grille et refusent les collisions. La suppression et la duplication concernent uniquement le bloc ou l’article sélectionné. Les poignées apparaissent au survol et à la sélection. En mode article, glisser une référence de l’assortiment vers une case libre.

`Ctrl N` crée un plan, `Ctrl S` enregistre, `Ctrl O` ouvre un plan, `Ctrl Z` annule, `Ctrl Y` rétablit, `Ctrl E` modifie la sélection et `Ctrl D` la duplique. `Ctrl Maj A` affiche ou masque le panneau de droite. `Ctrl Maj S` enregistre sous un autre nom, `Ctrl P` exporte le PDF, et `Ctrl +`, `Ctrl -`, `Ctrl 0` agrandissent, réduisent ou ajustent le plan. Les flèches déplacent la sélection ; Supprimer et Retour arrière retirent un bloc ou un article. Les champs de saisie conservent leur comportement habituel.

## Règles de calcul

- Un élément mesure 1,33 m ; un demi-élément mesure 0,665 m.
- La capacité d’un demi-élément est un entier réglable séparément. Exemple : 2,5 éléments, 13 unités par élément et 7 unités dans le demi-élément donnent 33 unités en largeur.
- Les parts de ventes proviennent des données du périmètre sélectionné. Les modifications de l’implantation ne modifient jamais les ventes.
- La répartition automatique utilise les plus grands restes. Le total attribué respecte exactement la capacité.
- En descente, la part de linéaire correspond aux unités attribuées divisées par la capacité en largeur.
- Dans les autres modes, elle correspond aux cases occupées divisées par le nombre total de cases. Les blocs d’un même groupe sont additionnés.
- Les regroupements additionnent les ventes et les références sans supprimer les blocs. Les références répétées dans un import conservent leurs ventes ; le nombre de références compte les SKU distincts.
- Une appartenance absente est affichée comme non identifiée. Elle est conservée séparément des références internes et concurrentes.

Le PDF est généré depuis les données du plan avec un rendu dédié, sans capture d’écran. Les plans courants sont exportés sur une page paysage. Au-delà de 60 groupes, le plan reste sur la première page et le tableau commercial complet est ajouté en annexes paysage. Cela conserve les données et leur lisibilité.

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

Sur Linux, les tests de bureau lancent automatiquement Xvfb et Electron sur un écran virtuel séparé. Leurs fenêtres n’apparaissent pas sur votre bureau ; les dialogues système sont simulés. Installez le paquet `xvfb`, ou indiquez son exécutable avec `PLANOPILOT_XVFB_BIN`. Un exécutable placé dans `~/.cache/planopilot-tests/xvfb/usr/bin/Xvfb` est également détecté. Sans Xvfb, les tests s’arrêtent avant d’ouvrir Electron. Sur les autres systèmes, les fenêtres Electron restent masquées. Les tests utilisent un répertoire de données temporaire et vérifient notamment les imports multi-onglets, les CSV invalides, 5 000 références, les interactions à la souris, la sauvegarde, la réouverture et les exports. Les captures et un PDF d’exemple sont générés dans `screenshots/`.

## Structure

- `src/domain.ts` : données, regroupements, allocation, géométrie, contraintes et migrations.
- `src/importer.ts` : import CSV/XLSX et validation des lignes.
- `src/Board.tsx` : déplacements, redimensionnements et glisser-déposer.
- `src/Panels.tsx` : configuration, sélection et assortiment avec liste virtuelle.
- `src/exports.ts` : CSV et document PDF.
- `src/OpenFoodFactsDialog.tsx` : recherche de produits et ajout à l’assortiment.
- `electron/open-food-facts.mjs` : client Open Food Facts partagé, cache, pagination et limites de requêtes.
- `electron/main.cjs` : dialogues système, ouverture de fichiers et génération PDF.
- `electron/plan-files.cjs` : fichier actif et enregistrements atomiques.
- `electron/recent-plans.cjs` : historique des chemins de fichiers.
- `src/NewPlanDialog.tsx` et `src/PlanParameters.tsx` : création et réglages du meuble.
- `src/PreferencesDialog.tsx` et `src/planSettings.ts` : paramètres par défaut des nouveaux plans.
- `src/RecentPlansDrawer.tsx` : tiroir des fichiers récents.
- `src/usePlanFile.tsx` : suivi des modifications et confirmation avant de changer de fichier.
- `electron/preload.cjs` : API limitée entre l’interface et Electron.

Le rendu est isolé et n’accède pas directement à Node.js. Les écritures sont ordonnées et utilisent un remplacement atomique. La version distribuée bloque les requêtes HTTP et HTTPS du rendu, sauf les photos de produits sur le domaine Open Food Facts. Les appels à l’API passent par une interface dédiée du processus principal et une session réseau Electron distincte, qui utilise la configuration réseau du système sans être bloquée par le filtre du rendu. Les liens de fiches ouverts dans le navigateur sont limités au service. Les polices sont celles du système ; les ressources de l’interface sont incluses dans l’application.

La compilation Windows est réalisée depuis Linux. Les parcours Electron sont vérifiés sur Linux ; une recette sur Windows reste nécessaire avant une diffusion commerciale. Les exécutables générés ne disposent pas d’un certificat de signature de l’éditeur.
