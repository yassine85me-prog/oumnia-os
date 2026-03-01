# 🚀 OUMNIA OS — Personal Command Center

> Ton cockpit de pilotage personnel. Agent AI intégré, gestion de projets, quick access, météo, gamification.

![Electron](https://img.shields.io/badge/Electron-33-blue) ![React](https://img.shields.io/badge/React-18-cyan) ![Claude](https://img.shields.io/badge/Claude_AI-Integrated-purple)

---

## ⚡ Installation rapide (MacBook M5)

### 1. Clone et installe

```bash
# Clone le repo
git clone https://github.com/yassine85me-prog/oumnia-os.git
cd oumnia-os

# Installe les dépendances
npm install
```

### 2. Configure ton environnement

```bash
# Copie le fichier d'exemple
cp .env.example .env

# Édite avec ton éditeur préféré
nano .env
```

**Minimum requis :** Ajoute ta clé API Anthropic pour activer l'agent AI :
```
ANTHROPIC_API_KEY=sk-ant-api03-ta-cle-ici
```

### 3. Lance l'app

```bash
npm run dev
```

L'app Electron s'ouvre automatiquement avec le dashboard OUMNIA OS !

---

## 🏗️ Structure du projet

```
oumnia-os/
├── electron/
│   ├── main.js          # Process principal Electron
│   └── preload.js       # Bridge sécurisé IPC
├── src/
│   ├── components/
│   │   └── JarvisHologram.jsx  # Animation holographique Canvas
│   ├── data/
│   │   └── config.js    # ⭐ TES DONNÉES — projets, agents, liens
│   ├── styles/
│   │   └── global.css   # Variables CSS et animations
│   ├── App.jsx          # Interface principale
│   └── main.jsx         # Point d'entrée React
├── .env.example         # Template configuration
├── package.json
├── vite.config.js
└── index.html
```

### 📝 Pour personnaliser tes données :

Édite `src/data/config.js` pour modifier :
- **USER** — ton nom, machines, timezone
- **DEFAULT_PROJECTS** — tes projets (statut, progression, liens)
- **AGENTS** — tes agents AI
- **FOCUS_TASKS** — tâches du jour
- **QUICK_ACCESS** — liens rapides (dev, google, création, média)

---

## 🔌 Fonctionnalités branchées

| Feature | Statut | Comment activer |
|---------|--------|----------------|
| Interface JARVIS | ✅ Prêt | Fonctionne directement |
| Hologramme animé | ✅ Prêt | Canvas WebGL |
| Agent AI Claude | ✅ Prêt | Ajoute `ANTHROPIC_API_KEY` dans .env |
| Auto-launch au démarrage | ✅ Prêt | Activé par défaut |
| Google Sheets sync | ✅ Prêt | Ajoute `GOOGLE_SHEETS_ID` + `GOOGLE_API_KEY` |
| Gamification XP | ✅ Prêt | Gagne du XP en interagissant avec l'agent |
| Quick Access links | ✅ Prêt | Ouvre dans le navigateur par défaut |
| Widget Météo live | 🔜 À brancher | API OpenWeather |
| News feed live | 🔜 À brancher | RSS ou API News |

---

## 🛠️ Commandes utiles

```bash
# Développement (hot reload)
npm run dev

# Build pour production (créé un .dmg / .exe)
npm run build

# Lancer la version buildée
npm start
```

---

## 📋 Google Sheets — Format attendu

Si tu veux synchro tes projets via Google Sheets, crée un onglet `Projects` avec ces colonnes :

| A: Nom | B: Catégorie | C: Description | D: Statut | E: Progression | F: Priorité | G: GitHub | H: Sheets |
|--------|-------------|----------------|-----------|----------------|-------------|-----------|-----------|
| GASTROFLOW ERP | command center | Système ERP... | in_progress | 75 | high | https://... | https://... |

---

## 🎮 Raccourcis

- **Ctrl/Cmd + Click** sur un lien → ouvre dans le navigateur
- **Enter** dans le chat → envoie le message à l'agent AI
- **Click** sur le logo OUMNIA OS → collapse/expand la sidebar

---

## 🚀 Prochaines étapes

1. [ ] Brancher l'API météo live (OpenWeather)
2. [ ] Intégrer le feed RSS pour les news
3. [ ] Ajouter le widget calendrier Google
4. [ ] Mode Pomodoro dans le Focus Mode
5. [ ] Notifications desktop
6. [ ] Synchro Lenovo via Google Drive

---

**Built with ❤️ by Yassine · Oumnia Systems · Marrakech**
