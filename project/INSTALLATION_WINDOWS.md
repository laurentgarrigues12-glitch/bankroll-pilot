# Bankroll Pilot — application Windows

## Prérequis

- Windows 10 ou 11
- Node.js LTS installé
- Une connexion Internet uniquement pour installer les dépendances et fabriquer l'installateur

## Tester l'application bureau

Ouvrez PowerShell dans ce dossier, puis exécutez :

```powershell
npm install
npm run build
npm run desktop
```

## Créer l'installateur Windows

```powershell
npm run dist:win
```

L'installateur sera créé dans le dossier `release`.

## Utilisation

1. Ouvrez la page **Import Winamax**.
2. Choisissez une seule fois le dossier `History` configuré dans Winamax.
3. L'application scanne ce dossier au lancement, au retour sur la fenêtre et toutes les 15 secondes.
4. Les nouvelles sessions mettent automatiquement à jour la bankroll et les résultats du jour et du mois.

Cette version repart avec une base locale neuve. Elle ne récupère pas les statistiques enregistrées dans Chrome.


## Essai local de 3 jours

- Le délai commence au clic sur « Commencer la bêta gratuite ».
- La durée est de 72 heures exactes.
- Le statut est enregistré dans le dossier de données local d’Electron.
- Fermer l’application ou redémarrer Windows ne remet pas le délai à zéro.
- L’application vérifie le délai toutes les 30 secondes et au retour sur la fenêtre.
- À l’expiration, l’application affiche un écran de blocage sans supprimer les données locales.

## Détection automatique du dossier Winamax

Au premier lancement, Bankroll Pilot recherche automatiquement un dossier `History` contenant des historiques Winamax dans les emplacements Windows habituels (Documents et OneDrive/Documents). S'il est trouvé, il est enregistré et le scan automatique démarre sans sélection manuelle. Si aucun dossier valide n'est trouvé, la sélection manuelle reste disponible dans « Import Winamax ».
