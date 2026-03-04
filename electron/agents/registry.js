// ═══════════════════════════════════════════
// OUMNIA OS — Agent Registry
// Un moteur, plusieurs configs
// ═══════════════════════════════════════════

const general = require("./general");
const gastrobot = require("./gastrobot");

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
  },
};

function getAgent(id) {
  return AGENTS[id] || AGENTS.general;
}

function listAgents() {
  return Object.values(AGENTS);
}

module.exports = { getAgent, listAgents, AGENTS };
