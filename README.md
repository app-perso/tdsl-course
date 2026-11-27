# TDSL Course

Petite appli de course (PWA 100 % hors ligne) pour le TDSL du 29/11/2026.

- Ouvrir : https://app-perso.github.io/tdsl-course/
- Installer sur iPhone : Safari → Partager → « Sur l'écran d'accueil ».
- Modifier les horaires / consignes / objectifs : fichier `course.js` uniquement.
- Le site se met à jour tout seul à chaque envoi sur `main` (`.github/workflows/pages.yml`).

## Mode test
Appui long (1 s) sur le titre de n'importe quel écran :
- simuler une heure du dimanche, ou aller directement à un écran (scénarios) ;
- les données de test sont séparées de la vraie course ;
- numéro de version affiché en bas.

## Checklist samedi soir
1. Ouvrir l'appli avec du réseau (mise à jour automatique), vérifier la version.
2. Mode test → « Remettre la vraie course à zéro » (2 appuis).
3. Mode test → « Quitter le mode test ».
4. Vérifier : « Avant le départ · Dimanche 29/11 », pas de bandeau orange.
5. Passer l'iPhone en mode avion et rouvrir l'appli : elle doit s'afficher.
