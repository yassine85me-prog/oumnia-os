# OUMNIA OS v2 — Vision & Plan d'Action

**Date** : 4 mars 2026
**Objectif** : Transformer OUMNIA OS d'un chatbot en cockpit opérationnel pour 2 sociétés

---

## 1. LA RÉALITÉ AUJOURD'HUI

### Les 2 sociétés de Yassine

**OUMNIA (société)** — 3 restaurants à Marrakech
- Semlalia (l'original, 2011), Médina (face Koutoubia), Guéliz (terrasse)
- 286+ articles au menu, 5-325 DH
- Besoin : contenu marketing, catalogue digital, commande en ligne (futur)

**GASTROFLOW (société B2B)** — Unité centrale d'approvisionnement
- Sert exclusivement les 3 restaurants Oumnia
- Gère : achats fournisseurs, stockage, production, mise en place, facturation
- 9 fournisseurs référencés

### Le problème : données dispersées partout
- Google Sheets (GastroFlow ERP, stock, fournisseurs)
- Caisse/POS (ventes restaurant)
- Excel et fichiers locaux
- Bons papier
- Kaalix (livraison)
- Instagram/Facebook (insights, contenu)

### Ce qui prend du temps CHAQUE JOUR
- Commandes fournisseurs (calcul, envoi, suivi)
- Suivi stock et inventaire
- Création de contenu marketing
- Facturation et bons (livraison, achat, commande)

---

## 2. LA VISION : OUMNIA OS = COCKPIT CENTRAL

```
┌─────────────────────────────────────────────────┐
│                  OUMNIA OS v2                     │
│           Cockpit Opérationnel Yassine            │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  DASHBOARD   │  │   AGENTS    │  │ DOCUMENTS│ │
│  │             │  │             │  │          │ │
│  │ CA du jour  │  │ JARVIS      │  │ Factures │ │
│  │ Stock alerts│  │ GastroBot   │  │ Bons LIV │ │
│  │ Top ventes  │  │ VisionOCR   │  │ Bons CMD │ │
│  │ Fournisseurs│  │ ContentGen  │  │ Bons ACH │ │
│  │ Planning    │  │ Apollo      │  │ Devis    │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │            SOURCES DE DONNÉES                │ │
│  │                                               │ │
│  │  Google Sheets ←→ GastroFlow ERP             │ │
│  │  Caisse/POS ←→ Ventes temps réel            │ │
│  │  Kaalix ←→ Livraisons                       │ │
│  │  Instagram API ←→ Performance contenu        │ │
│  │  Bons scannés (OCR) ←→ Saisie auto          │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 3. PLAN D'ACTION EN 4 PHASES

### PHASE 1 — Fondation : Google Sheets Live (Semaine 1-2)
**Objectif** : Brancher GastroFlow ERP (Google Sheets) en temps réel

**Ce qu'on construit :**
- Connexion OAuth2 Google Sheets (la dépendance googleapis est déjà installée)
- Lecture automatique des sheets : STOCK, ACHATS, BONS_COMMANDE, VENTES, FOURNISSEURS, ARTICLES
- Dashboard live dans OUMNIA OS :
  - Stock actuel par catégorie (alertes rouge/orange/vert)
  - Derniers achats et livraisons
  - Fournisseurs + soldes
- GastroBot connecté aux vraies données (plus besoin de lui dire "lis le fichier")
- Sync toutes les 5 minutes + refresh manuel

**Résultat** : Tu ouvres OUMNIA OS le matin → tu vois l'état des 3 restos en un coup d'oeil.

---

### PHASE 2 — Actions : Génération de Documents (Semaine 3-4)
**Objectif** : OUMNIA OS génère les documents business

**Ce qu'on construit :**
- Générateur de bons de commande (vocal : "commande 50kg poulet chez Hamid")
  - Template professionnel PDF
  - Envoi direct par WhatsApp/email (optionnel)
  - Écriture automatique dans Google Sheets
- Générateur de factures
  - Depuis les données de livraison
  - Numérotation automatique
  - Export PDF
- Générateur de bons de livraison
  - Depuis les commandes en cours
  - Rapprochement auto avec les bons scannés (VisionOCR)
- Tout sauvegardé sur Google Drive (déjà synced)

**Résultat** : "Fais-moi la commande de la semaine" → JARVIS analyse le stock, propose les quantités, génère les bons, te demande validation.

---

### PHASE 3 — Intelligence : JARVIS Conseiller (Semaine 5-6)
**Objectif** : L'agent principal devient un vrai conseiller proactif

**Ce qu'on construit :**
- Alertes automatiques au lancement :
  - "Stock mozzarella critique, reste 3kg pour 3 restos. Tu veux que je commande chez Abderezak ?"
  - "Fournisseur X pas payé depuis 15 jours"
  - "Le Reel pizza de mardi a fait 45K vues, on refait le même format ?"
  - "CA Guéliz en baisse de 12% cette semaine vs la dernière"
- Analyse des marges par produit (prix d'achat vs prix de vente)
- Recommandations :
  - "Ta Pizza Oumnia a une marge de 68%, c'est ton produit le plus rentable. Pousse-le en contenu."
  - "Les tacos ont une marge de 23%, vérifie le coût matière."
- Planning de la semaine auto-généré (commandes à passer, contenu à poster, factures à envoyer)

**Résultat** : JARVIS te dit quoi faire chaque matin. Tu valides, il exécute.

---

### PHASE 4 — Expansion (Mois 2-3)
**Objectif** : Boucler l'écosystème

- **ContentGen → Instagram** : Post directement depuis l'app via Meta API
- **Catalogue digital** : Site web vitrine avec menu + commande (nouveau projet)
- **Apollo activé** : Agent business qui analyse CA, prédit les tendances, optimise les prix
- **App mobile companion** : Version simplifiée pour usage au restaurant
- **Multi-utilisateur** : Oussama et les managers ont leur accès

---

## 4. CE QUI EXISTE DÉJÀ (acquis)

| Composant | Status | Utilisé dans |
|-----------|--------|--------------|
| Multi-agent engine | ✅ Fait | Toutes les phases |
| GastroBot (ERP expert) | ✅ Fait | Phase 1, 2, 3 |
| VisionOCR (scan bons) | ✅ Fait | Phase 2 |
| ContentGen (contenu) | ✅ Fait | Phase 3, 4 |
| Voice trilingue | ✅ Fait | Toutes les phases |
| Mémoire persistante | ✅ Fait | Phase 3 |
| googleapis (npm) | ✅ Installé | Phase 1 |
| Google Drive sync local | ✅ Configuré | Phase 2 |
| Terminal intégré | ✅ Fait | Debug/dev |
| Routeur intelligent | ✅ Fait | Toutes les phases |

---

## 5. CE QUE JARVIS DOIT SAVOIR

Pour être un vrai conseiller, JARVIS a besoin de :

**Données temps réel (Phase 1)** :
- Stock actuel (quantités, seuils min, catégories)
- Dernières commandes et livraisons
- Fournisseurs (contacts, historique, soldes)
- Articles (prix achat, prix vente, marges)

**Données business (Phase 3)** :
- Ventes par jour/semaine/mois par restaurant
- Top produits et flops
- Coûts matière et marges
- Historique des commandes fournisseurs
- Performance contenu (vues, engagement)

**Contexte permanent** :
- Calendrier Yassine (quand il est dispo)
- Saisonnalité (Ramadan, été, fêtes)
- Objectifs business (CA cible, nombre de posts/semaine)

---

## 6. PROCHAINE ACTION CONCRÈTE

**Phase 1, Étape 1 : Connecter Google Sheets**

Fichiers à créer/modifier :
1. `electron/sheets-connector.js` — OAuth2 + lecture des sheets GastroFlow
2. `electron/data-sync.js` — Sync périodique + cache local
3. `src/views/DashboardView.jsx` — Refonte avec widgets live (stock, ventes, alertes)
4. Modifier `electron/agents/gastrobot.js` — Injecter les vraies données dans le contexte
5. Modifier `electron/main.js` — Nouveaux IPC handlers pour les données

**Prérequis** :
- ID du Google Sheet GastroFlow
- Clé API Google ou Service Account (déjà dans .env.example)
- Structure exacte des sheets (colonnes, onglets)

---

*Document de vision — OUMNIA OS v2*
*Généré le 4 mars 2026*
