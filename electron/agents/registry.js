// ═══════════════════════════════════════════
// OUMNIA OS — Agent Registry
// Un moteur, plusieurs configs
// ═══════════════════════════════════════════

const general = require("./general");
const gastrobot = require("./gastrobot");
const visionocr = require("./visionocr");
const contentgen = require("./contentgen");

const AGENTS = {
  general: {
    id: "general",
    name: "GENERAL",
    displayName: "G.E.N.E.R.A.L",
    color: "#00e5ff",
    model: "claude-sonnet-4-20250514",
    maxTokens: { text: 8192, voice: 1024 },
    tools: general.tools,
    buildSystemPrompt: general.buildSystemPrompt,
    triggers: [],
    description: "Assistant personnel polyvalent, chef d'orchestre",
  },
  gastrobot: {
    id: "gastrobot",
    name: "GastroBot",
    displayName: "GASTROBOT",
    color: "#00e676",
    model: "claude-sonnet-4-20250514",
    maxTokens: { text: 8192, voice: 1024 },
    tools: gastrobot.tools,
    buildSystemPrompt: gastrobot.buildSystemPrompt,
    triggers: [
      "stock", "fournisseur", "fournisseurs", "commande", "bon de commande",
      "production", "recette", "ingredient", "ingredients", "rupture", "reappro",
      "achat", "achats", "gastroflow", "apps script", "inventaire",
      "prix d'achat", "prix de vente", "marge", "vente", "ventes",
      "caisse", "tresorerie", "menu", "article", "articles",
    ],
    description: "Expert ERP restaurant : stock, fournisseurs, commandes, production, ventes, tresorerie, GastroFlow",
  },
  visionocr: {
    id: "visionocr",
    name: "VisionOCR",
    displayName: "VISIONOCR",
    color: "#ff6d00",
    model: "claude-sonnet-4-20250514",
    maxTokens: { text: 8192, voice: 1024 },
    tools: visionocr.tools,
    buildSystemPrompt: visionocr.buildSystemPrompt,
    triggers: [
      "scan", "scanner", "ocr", "photo", "bon de livraison",
      "analyser bon", "lire bon", "extraire texte", "reconnaissance",
      "document", "etiquette", "tampon", "bons de livraison",
    ],
    description: "Expert OCR : scan de bons de livraison, factures, extraction de texte depuis des images et photos",
  },
  contentgen: {
    id: "contentgen",
    name: "ContentGen",
    displayName: "CONTENTGEN",
    color: "#c084fc",
    model: "claude-sonnet-4-20250514",
    maxTokens: { text: 8192, voice: 1024 },
    tools: contentgen.tools,
    buildSystemPrompt: contentgen.buildSystemPrompt,
    triggers: [
      "contenu", "content", "video", "reel", "tiktok", "instagram",
      "caption", "hashtag", "hashtags", "script", "calendrier",
      "post", "publication", "story", "stories", "carousel",
      "creatif", "creation", "hook", "viral", "reseaux sociaux",
    ],
    description: "Directeur creatif digital : concepts, scripts video, captions, calendrier editorial pour Oumnia",
  },
};

function getAgent(id) {
  return AGENTS[id] || AGENTS.general;
}

function listAgents() {
  return Object.values(AGENTS);
}

module.exports = { getAgent, listAgents, AGENTS };
