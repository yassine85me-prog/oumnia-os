// ═══════════════════════════════════════════
// OUMNIA OS — Intelligent Agent Router
// GENERAL orchestre : keyword matching + Haiku classifier
// ═══════════════════════════════════════════

const { listAgents } = require("./agents/registry");

// Strip accents and normalize for matching
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "'");
}

// Heuristic: does the message look like a domain-specific query?
function looksLikeDomainQuery(normalized) {
  const signals = [
    "combien", "montre", "analyse", "verifie", "calcule",
    "lis", "check", "total", "liste", "affiche",
    "cherche", "trouve", "donne", "regarde",
  ];
  return signals.some((s) => normalized.includes(s));
}

// Tier 2: Haiku classifier for ambiguous cases
async function classifyWithHaiku(message, agents) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const descriptions = agents
    .map((a) => `- ${a.id}: ${a.description}`)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      system: `Tu es un routeur de messages. Determine quel agent specialise doit repondre.

AGENTS :
${descriptions}
- general: Assistant polyvalent (si aucun specialiste ne convient)

Reponds UNIQUEMENT en JSON : {"agent":"id","confidence":0.0}`,
      messages: [{ role: "user", content: message }],
    });

    const text = response.content[0]?.text?.trim();
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) return JSON.parse(match[0]);
  } catch (err) {
    console.error("[ROUTER] Haiku classifier error:", err.message);
  }
  return null;
}

/**
 * Route a message to the best agent.
 * Only routes from GENERAL — respects manual agent selection.
 */
async function routeMessage(message, currentAgentId) {
  // Guard: only route from GENERAL
  if (currentAgentId !== "general") {
    return { targetAgentId: currentAgentId, confidence: 1.0, reason: "direct" };
  }

  const normalized = normalize(message);
  const agents = listAgents().filter((a) => a.id !== "general" && a.triggers?.length > 0);

  // ── Tier 1: Keyword scoring (~0ms) ──
  const scores = agents
    .map((agent) => {
      const matchCount = agent.triggers.filter((t) => normalized.includes(normalize(t))).length;
      return { agentId: agent.id, matchCount };
    })
    .filter((s) => s.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount);

  // Clear single match
  if (scores.length === 1 && scores[0].matchCount >= 1) {
    console.log(`[ROUTER] Tier 1 → ${scores[0].agentId} (${scores[0].matchCount} triggers)`);
    return {
      targetAgentId: scores[0].agentId,
      confidence: 0.9,
      reason: `keyword_match (${scores[0].matchCount} triggers)`,
    };
  }

  // One agent clearly dominates
  if (scores.length > 1 && scores[0].matchCount > scores[1].matchCount + 1) {
    console.log(`[ROUTER] Tier 1 dominant → ${scores[0].agentId} (${scores[0].matchCount} vs ${scores[1].matchCount})`);
    return {
      targetAgentId: scores[0].agentId,
      confidence: 0.85,
      reason: `keyword_dominant (${scores[0].matchCount} vs ${scores[1].matchCount})`,
    };
  }

  // ── Tier 2: Haiku classifier (~300ms) — only if ambiguous or domain-like ──
  if (scores.length > 1 || looksLikeDomainQuery(normalized)) {
    console.log("[ROUTER] Tier 1 ambiguous, falling back to Haiku...");
    const result = await classifyWithHaiku(message, agents);
    if (result && result.confidence >= 0.7 && result.agent !== "general") {
      console.log(`[ROUTER] Tier 2 → ${result.agent} (confidence: ${result.confidence})`);
      return {
        targetAgentId: result.agent,
        confidence: result.confidence,
        reason: "haiku_classifier",
      };
    }
  }

  // Default: stay on GENERAL
  return { targetAgentId: "general", confidence: 1.0, reason: "default" };
}

module.exports = { routeMessage };
