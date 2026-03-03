// ═══════════════════════════════════════════
// OUMNIA OS — Data Configuration
// Edit these to customize your Command Center
// ═══════════════════════════════════════════

export const USER = {
  name: "Yassine",
  title: "Directeur Général · Développeur",
  location: "Marrakech",
  timezone: "GMT+1",
  machines: [
    { name: "MacBook M5", active: true },
    { name: "Lenovo", active: false },
  ],
};

export const DEFAULT_PROJECTS = [
  {
    id: 1, name: "GASTROFLOW ERP", category: "command center",
    desc: "Système ERP restaurant · Google Apps Script · 2000+ lignes",
    status: "in_progress", progress: 75, priority: "high",
    links: { github: "https://github.com/yassine85me-prog", sheets: "https://docs.google.com/spreadsheets" },
  },
  {
    id: 2, name: "Oumnia Digital Agency", category: "command center",
    desc: "Plateforme SaaS vidéo AI · 12 agents · 5 départements",
    status: "in_progress", progress: 60, priority: "high",
    links: { github: "https://github.com/yassine85me-prog/content-generator" },
  },
  {
    id: 3, name: "OCR_BONS_SYSTEM", category: "command center",
    desc: "Scan bons livraison · Claude Vision API · 9 fournisseurs",
    status: "in_progress", progress: 65, priority: "medium",
    links: { github: "https://github.com/yassine85me-prog" },
  },
  {
    id: 4, name: "Oumnia Studio v2.0", category: "personal brand",
    desc: "Learning system · Feedback · Google Reviews · Liquid Glass",
    status: "in_progress", progress: 50, priority: "high",
    links: { github: "https://github.com/yassine85me-prog/content-generator" },
  },
  {
    id: 5, name: "Catalogue Digital", category: "done",
    desc: "Catalogue en ligne Oumnia · Netlify",
    status: "done", progress: 100, priority: "done",
    links: { live: "https://gastroflow-by-oumnia.netlify.app" },
  },
  {
    id: 6, name: "Portfolio Vidéos x10", category: "personal brand",
    desc: "10 vidéos showcase pour l'agence digitale",
    status: "planned", progress: 0, priority: "medium", links: {},
  },
  {
    id: 7, name: "GASTROFLOW ↔ OCR Bridge", category: "command center",
    desc: "Connexion temps réel ERP ↔ OCR",
    status: "planned", progress: 0, priority: "high", links: {},
  },
  {
    id: 8, name: "SaaS Public Launch", category: "command center",
    desc: "Lancement public Oumnia Digital Agency",
    status: "planned", progress: 0, priority: "high", links: {},
  },
];

export const AGENTS = [
  { name: "Oumnia", role: "Chef d'Orchestre", emoji: "🧠", status: "active", color: "#00e5ff" },
  { name: "GastroBot", role: "ERP & Stock", emoji: "📊", status: "idle", color: "#00e676" },
  { name: "VisionOCR", role: "Scan & Extract", emoji: "👁️", status: "idle", color: "#ff6d00" },
  { name: "ContentGen", role: "Vidéo & Création", emoji: "🎬", status: "building", color: "#c084fc" },
  { name: "Apollo", role: "Business & Sales", emoji: "💰", status: "idle", color: "#ffd740" },
];

export const QUICK_ACCESS = {
  "Dev Tools": [
    { name: "GitHub", url: "https://github.com/yassine85me-prog", color: "#f0f0f0" },
    { name: "Claude.ai", url: "https://claude.ai", color: "#d4a574" },
    { name: "VS Code", url: "vscode://", color: "#007acc" },
    { name: "Claude Code", url: "vscode://", color: "#cc7832" },
    { name: "Netlify", url: "https://app.netlify.com", color: "#00c7b7" },
    { name: "Vercel", url: "https://vercel.com", color: "#fff" },
  ],
  "Google Workspace": [
    { name: "Sheets", url: "https://docs.google.com/spreadsheets", color: "#0f9d58" },
    { name: "Drive", url: "https://drive.google.com", color: "#4285f4" },
    { name: "Docs", url: "https://docs.google.com", color: "#4285f4" },
    { name: "Gmail", url: "https://mail.google.com", color: "#ea4335" },
    { name: "Calendar", url: "https://calendar.google.com", color: "#fbbc04" },
    { name: "Apps Script", url: "https://script.google.com", color: "#4285f4" },
  ],
  "Création AI": [
    { name: "Canva", url: "https://canva.com", color: "#00c4cc" },
    { name: "Runway", url: "https://runwayml.com", color: "#c084fc" },
    { name: "ImagineArt", url: "https://imagineart.ai", color: "#ff6b9d" },
    { name: "ElevenLabs", url: "https://elevenlabs.io", color: "#6366f1" },
    { name: "Kling AI", url: "https://klingai.com", color: "#f59e0b" },
  ],
  "Média & Musique": [
    { name: "YouTube", url: "https://youtube.com", color: "#ff0000" },
    { name: "Spotify", url: "https://open.spotify.com", color: "#1db954" },
    { name: "SoundCloud", url: "https://soundcloud.com", color: "#ff5500" },
    { name: "X / Twitter", url: "https://x.com", color: "#ffffff" },
  ],
};

export const NAV_ITEMS = [
  {
    section: "OVERVIEW", items: [
      { icon: "◎", label: "Dashboard", key: "dashboard" },
      { icon: "◈", label: "Agent AI", key: "agent" },
      { icon: "📊", label: "Analytics", key: "analytics" },
    ],
  },
  {
    section: "WORKSPACE", items: [
      { icon: "⚡", label: "Projets", key: "projects" },
      { icon: ">_", label: "Terminal", key: "terminal" },
      { icon: "🤖", label: "Agents", key: "agents" },
      { icon: "📋", label: "Tâches", key: "tasks" },
      { icon: "🔗", label: "Quick Links", key: "links" },
    ],
  },
  {
    section: "PERSONAL", items: [
      { icon: "🏥", label: "Santé & Énergie", key: "health" },
      { icon: "📅", label: "Planning", key: "calendar" },
      { icon: "🎯", label: "Objectifs", key: "goals" },
      { icon: "⚙️", label: "Paramètres", key: "settings" },
    ],
  },
];
