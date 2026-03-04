# OUMNIA OS — Rapport Complet

**Date** : 4 mars 2026
**Auteur** : Yassine — Co-fondateur Oumnia, DG & Développeur
**Version** : 1.0

---

## 1. QU'EST-CE QU'OUMNIA OS ?

OUMNIA OS est un **Command Center desktop** personnel construit avec Electron, React et Claude AI. C'est le cerveau digital de Yassine : un assistant IA multi-agent qui connaît ses restaurants, ses projets, son historique, et qui peut agir (lire/écrire des fichiers, exécuter du code, scanner des documents, créer du contenu).

**En une phrase** : Un JARVIS personnel pour gérer 3 restaurants, 5+ projets tech, et une agence digitale — par la voix ou le clavier.

---

## 2. STACK TECHNIQUE

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Desktop | Electron | 33.3.1 |
| Frontend | React + Vite | 18.3.1 / 6.0.7 |
| Base de données | SQLite (better-sqlite3) | 12.6.2 |
| Intelligence artificielle | Claude Sonnet 4 (Anthropic) | SDK 0.39.0 |
| Terminal | xterm.js + node-pty | 5.5.0 / 1.0.0 |
| Voix | macOS SFSpeechRecognizer + Web Speech TTS | Natif |
| Build | electron-builder | 25.1.8 |

**Plateforme** : macOS (MacBook M5, 24Go RAM)
**Code total** : ~6 800 lignes
**Base de données** : `~/.oumnia-os/oumnia.db` (7 tables SQLite)

---

## 3. CE QUE L'APPLICATION FAIT AUJOURD'HUI

### 3.1 Système Multi-Agent IA (4 agents actifs)

Le coeur d'OUMNIA OS est un moteur IA partagé (`agent-core.js`) qui alimente 4 agents spécialisés. Le système route automatiquement les messages vers le bon agent grâce à un routeur intelligent à 2 niveaux (mots-clés + classification Claude Haiku).

| Agent | Rôle | Spécialité | Statut |
|-------|------|------------|--------|
| **G.E.N.E.R.A.L** | Chef d'orchestre | Assistant polyvalent, coding, gestion projets | Actif |
| **GastroBot** | Expert ERP | Stock, fournisseurs, commandes, recettes, trésorerie (286+ articles, 9 fournisseurs) | Actif |
| **VisionOCR** | Scanner intelligent | OCR bons de livraison, extraction texte → JSON structuré | Actif |
| **ContentGen** | Directeur créatif | Concepts viraux, captions Instagram, scripts vidéo, calendrier éditorial | Actif |
| **Apollo** | Business & Sales | (Prévu — pas encore développé) | Idle |

**Chaque agent a accès à 6 outils de base** : lire/écrire fichiers, lister répertoires, exécuter commandes shell, rechercher dans le code, déléguer à Claude Code.

**Les agents spécialisés ajoutent des outils propres** :
- GastroBot : lecture du script GastroFlow (2000+ lignes Google Apps Script)
- VisionOCR : scan d'image (OCR général) + analyse structurée de bons de livraison
- ContentGen : sauvegarde de contenu organisée par catégorie (`~/Oumnia-Content/`)

### 3.2 Conversation Vocale Trilingue

L'app supporte la conversation vocale naturelle en 3 langues :

- **Français** (voix Thomas) — langue par défaut
- **Arabe / Darija** (voix Majed) — détection auto si 30%+ de caractères arabes
- **Anglais** (voix Daniel) — détection par mots-clés

**Fonctionnement** : Microphone → Reconnaissance vocale native macOS → Traitement par l'agent → Réponse streaming → Synthèse vocale phrase par phrase → Le micro se relance automatiquement.

En mode vocal, les agents adaptent leurs réponses : 2-3 phrases max, pas de markdown, ton conversationnel naturel.

### 3.3 Mémoire Persistante & Auto-Apprentissage

OUMNIA OS apprend et se souvient entre les sessions :

| Fonctionnalité | Mécanisme |
|----------------|-----------|
| **Faits auto-appris** | Claude Haiku extrait 1-3 faits de chaque conversation (préférences, décisions, infos business) |
| **Résumés de session** | Toutes les 10 messages, un résumé est généré et stocké |
| **Journal quotidien** | Chaque jour : humeur, score productivité, highlights, sujets abordés |
| **Profil utilisateur** | Nom, rôle, ville, expertise, stack technique |
| **Historique par agent** | 40 messages par agent, conservés en session |

Toute cette mémoire est injectée dans le contexte de chaque agent à chaque message.

### 3.4 Gestion de Projets Intelligente

Le système scanne automatiquement les dossiers projets et analyse :

- Stack technique (détection auto via package.json, requirements.txt, etc.)
- Activité Git (commits récents, branches, momentum)
- Métriques code (nombre de fichiers, lignes de code)
- Arborescence (3 niveaux de profondeur)

**Projets suivis actuellement** :

| Projet | Progression | Statut |
|--------|-------------|--------|
| GASTROFLOW ERP | 75% | En cours |
| OCR Bons System | 65% | En cours |
| Oumnia Digital Agency | 60% | En cours |
| Oumnia Studio v2.0 | 50% | En cours |
| Catalogue Digital | 100% | Terminé |
| OUMNIA OS | 20% | En cours |

### 3.5 Terminal Intégré

Un terminal complet (xterm.js + node-pty) intégré dans l'application :
- Shell natif avec tout l'environnement PATH
- Support 256 couleurs
- Redimensionnable
- Ouverture contextuelle depuis un projet

### 3.6 Interface Utilisateur

- **Dashboard** : Greeting contextuel, 4 cards statistiques, hologramme animé
- **Agent AI** : Chat avec tabs multi-agent, bulles markdown, notifications d'outils
- **Projets** : Liste scannée avec détails techniques et liens rapides
- **Terminal** : PTY intégré
- **Sidebar** : Navigation collapsible avec sections Overview, Workspace, Personal
- **Design** : Thème sombre sci-fi, fonts Orbitron/Outfit/JetBrains Mono, animations cosmiques
- **Gamification** : Système XP/Level (10 XP par conversation)

### 3.7 Sécurité & Confirmation

Les outils "destructeurs" (écriture fichier, commandes shell, délégation Claude Code) nécessitent une confirmation utilisateur via une modale avant exécution. Les outils de lecture s'exécutent immédiatement.

---

## 4. ARCHITECTURE TECHNIQUE

```
OUMNIA OS
├── Electron (Main Process)
│   ├── main.js ..................... Point d'entrée, 25+ IPC handlers
│   ├── preload.js ................. Bridge sécurisé (context isolation)
│   ├── agent-core.js .............. Moteur IA streaming + outils + mémoire
│   ├── agent-router.js ............ Routage intelligent (keywords + Haiku)
│   ├── memory-manager.js .......... Système de mémoire SQLite
│   ├── project-manager.js ......... Tracking projets + analyse Git
│   ├── profile-manager.js ......... Profil utilisateur
│   ├── database.js ................ Schéma SQLite (7 tables)
│   ├── terminal-manager.js ........ PTY + xterm bridge
│   ├── native-speech.js ........... Reconnaissance vocale macOS
│   └── agents/
│       ├── registry.js ............ Catalogue des agents
│       ├── general.js ............. Agent GENERAL + BASE_TOOLS
│       ├── gastrobot.js ........... Agent GastroBot (ERP)
│       ├── visionocr.js ........... Agent VisionOCR (OCR)
│       └── contentgen.js .......... Agent ContentGen (contenu)
│
├── React (Renderer Process)
│   ├── App.jsx .................... Shell principal + state global
│   ├── views/
│   │   ├── DashboardView.jsx ...... Écran d'accueil
│   │   ├── AgentView.jsx .......... Interface chat multi-agent
│   │   ├── ProjectsView.jsx ....... Explorateur de projets
│   │   ├── TerminalView.jsx ....... Terminal intégré
│   │   └── SettingsView.jsx ....... Paramètres
│   ├── components/
│   │   ├── GeneralHologram.jsx .... Hologramme animé
│   │   └── MessageBubble.jsx ...... Bulle de chat (markdown)
│   ├── utils/
│   │   ├── voice-input.js ......... Capture micro
│   │   ├── voice-output.js ........ Synthèse vocale
│   │   └── ui-constants.js ........ Styles & constantes
│   └── data/
│       └── config.js .............. Configuration frontend
│
└── SQLite Database
    ├── conversations .............. Historique chat
    ├── memories ................... Faits appris (catégorie, importance)
    ├── profile .................... Infos utilisateur
    ├── projects ................... Suivi projets
    ├── stats ...................... Statistiques globales
    ├── session_summaries .......... Résumés de session
    └── daily_journal .............. Journal quotidien
```

---

## 5. CE QU'ON EST PRÊT À DÉVELOPPER

### 5.1 Priorité Haute — Impact Immédiat

#### Agent Apollo (Business & Sales)
L'agent est déjà enregistré dans le frontend (status "idle"). Il manque l'implémentation backend.

**Ce qu'il ferait** :
- Analyse des ventes par jour/semaine/mois (connecté à GastroFlow)
- Calcul de marges par produit et par fournisseur
- Alertes business : produits les plus/moins rentables, tendances
- Recommandations pricing basées sur les données réelles
- Dashboard financier conversationnel ("Comment vont les ventes cette semaine ?")

**Effort estimé** : 1 fichier agent (~200 lignes) + modifications registry + agent-core

#### Google Sheets / Drive Sync
Le code est déjà stubbed dans main.js (`sheets-load-projects`, `sheets-update-progress`). La dépendance `googleapis` est installée.

**Ce qu'il ferait** :
- Sync bidirectionnelle projets ↔ Google Sheets
- Export rapports vers Google Drive
- Import données GastroFlow depuis Google Sheets
- Backup automatique de la mémoire

**Effort estimé** : Finaliser l'intégration OAuth2 + handlers IPC

#### Analytics View
La nav "Analytics" existe déjà dans le sidebar mais pointe vers un placeholder.

**Ce qu'il ferait** :
- Graphiques d'activité (messages/jour, outils utilisés, agents sollicités)
- Historique mémoire (faits appris, sessions résumées)
- Productivité (score journal, tendances)
- Métriques projets (progression dans le temps)

**Effort estimé** : 1 vue React avec des charts (recharts ou chart.js)

### 5.2 Priorité Moyenne — Valeur Ajoutée

#### Notifications & Alertes Proactives
- Rappel de projets stagnants (déjà détectés par `analyzeContext()`)
- Alertes stock bas (via GastroBot)
- Rappels calendrier
- Notifications push desktop (Electron Notification API)

#### Calendrier & Planning
- Vue calendrier avec les tâches et deadlines
- Intégration Google Calendar (API déjà disponible via googleapis)
- Planning éditorial ContentGen intégré visuellement

#### Mode Offline / Cache Intelligent
- Cache des dernières réponses pour fonctionner sans connexion
- Queue de messages en attente de connexion
- Mémoire locale consultable sans API

### 5.3 Priorité Future — Vision Long Terme

#### Application Mobile Companion
- Version React Native / Expo
- Notifications push
- Voice-first pour usage restaurant (mains occupées)
- Consultation rapide stock, ventes, contenu

#### Multi-Utilisateur
- Profils séparés (Yassine + Oussama + managers)
- Permissions par agent
- Historique par utilisateur

#### Marketplace d'Agents
- Agents installables à la demande
- Templates d'agents pour d'autres restaurants
- Partage de configurations

#### IA Générative Visuelle
- Génération d'images pour les posts (via Runway, DALL-E, etc.)
- Templates visuels Canva automatisés
- Montage vidéo assisté par IA

---

## 6. HISTORIQUE GIT

| Hash | Description |
|------|-------------|
| `968b14a` | v1.0 — Version initiale |
| `b61d36f` | Phase 1 : Agent IA interactif |
| `9b6a1d8` | Phase 2+3 : Code Vibing |
| `93312dc` | Fix : voice wake command + watchdog |
| `f9432ae` | Feat : blocs 5-7 + multi-agent framework + GastroBot |
| `e7c8b64` | Feat : add VisionOCR agent |
| *(non pushé)* | Feat : add ContentGen agent (directeur créatif digital) |

---

## 7. MÉTRIQUES CLÉS

| Métrique | Valeur |
|----------|--------|
| Lignes de code | ~6 800 |
| Agents actifs | 4 (+1 prévu) |
| Outils disponibles | 10 |
| Tables SQLite | 7 |
| Projets suivis | 6 |
| Langues supportées | 3 (FR, AR, EN) |
| Dépendances npm | 25+ |
| Articles menu Oumnia | 286+ |
| Fournisseurs trackés | 9 |

---

## 8. CONCLUSION

OUMNIA OS n'est pas juste un chatbot — c'est un **système d'exploitation personnel** qui combine IA conversationnelle, gestion de projets, automatisation métier, et création de contenu dans une seule interface desktop.

**Ce qui est fait** : Le moteur multi-agent est solide, la mémoire persiste, la voix fonctionne, 4 agents spécialisés sont opérationnels, le terminal est intégré, la gestion de projets est intelligente.

**Ce qui vient ensuite** : Apollo (Business), Google Drive sync, Analytics, notifications proactives, et à terme une app mobile companion.

L'avantage compétitif : Yassine est à la fois l'utilisateur et le développeur. Chaque feature est construite pour un besoin réel, pas théorique.

---

*Rapport généré le 4 mars 2026 par OUMNIA OS + Claude Code*
