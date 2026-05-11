# Arouet

Arouet est une extension Chrome que j'ai faite pour m'aider sur Projet Voltaire.

L'idée est simple : l'extension observe les exercices, mémorise les réponses qui ont déjà été validées, puis peut les rejouer automatiquement quand la même question revient.

Le projet est encore en version perso/test, donc le code est surtout pensé pour fonctionner sur les pages que j'ai rencontrées pendant mes essais.

## Ce que ça fait

- mémorise les réponses dans le stockage local de Chrome ;
- reconnaît certaines questions déjà vues ;
- clique automatiquement sur la bonne réponse quand elle est connue ;
- peut passer à la question suivante automatiquement ;
- permet d'exporter et importer la mémoire des réponses ;
- permet d'activer ou désactiver l'apprentissage, l'auto-réponse et quelques délais depuis le popup.

## Installation

Pour l'utiliser en local :

1. ouvrir Chrome ;
2. aller dans `chrome://extensions/` ;
3. activer le mode développeur ;
4. cliquer sur `Charger l'extension non empaquetée` ;
5. sélectionner le dossier du projet.

L'extension se lance seulement sur les pages `projet-voltaire.fr`.

## Fichiers principaux

- `manifest.json` : configuration de l'extension Chrome ;
- `content.js` : point d'entrée du script injecté, avec l'observer et le dispatch ;
- `utils.js` : helpers de texte, DOM, clics simulés et constantes partagées ;
- `storage.js` : lecture/écriture de la mémoire des réponses et des réglages ;
- `handlers-*.js` : logique par type d'exercice ou navigation ;
- `popup.html` : interface du popup ;
- `popup.js` : réglages, export/import et nettoyage de la mémoire ;
- `icons/` : icône de l'extension ;
- `page_exemples/` : captures/pages HTML gardées pour tester différents types d'exercices.

## Réglages du popup

Le popup permet de modifier le comportement sans toucher au code :

- auto-réponse ;
- apprentissage des nouvelles réponses ;
- passage automatique à la suite ;
- réponse aléatoire si la question est inconnue ;
- délais de clic et de changement de question ;
- export/import de la mémoire.

## Notes

Projet personnel, pas publié sur le Chrome Web Store.

Le fonctionnement dépend beaucoup de la structure HTML de Projet Voltaire. Si le site change ses classes, ses boutons ou ses couleurs, certaines détections peuvent casser.
