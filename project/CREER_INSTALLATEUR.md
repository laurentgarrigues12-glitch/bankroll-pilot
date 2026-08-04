# Créer le véritable installateur Bankroll Pilot

1. Ouvrir PowerShell dans ce dossier `project`.
2. Fermer Bankroll Pilot si l’application est ouverte.
3. Supprimer l’ancien dossier de fabrication :

```powershell
Remove-Item -Recurse -Force .\release -ErrorAction SilentlyContinue
```

4. Installer les dépendances si nécessaire :

```powershell
npm install
```

5. Créer l’installateur Windows :

```powershell
npm run dist:win
```

6. À la fin, rester dans le dossier `release` et lancer :

```text
Bankroll-Pilot-Setup-0.1.0.exe
```

L’assistant d’installation crée automatiquement :

- un raccourci **Bankroll Pilot** sur le Bureau ;
- un raccourci **Bankroll Pilot** dans le menu Démarrer ;
- l’application installée sous le nom **Bankroll Pilot**.

Ne pas utiliser directement `release\win-unpacked\electron.exe` : ce dossier est seulement un résultat intermédiaire de fabrication.
