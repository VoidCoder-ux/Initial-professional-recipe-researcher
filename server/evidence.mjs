const positiveSignals = [
  "chef",
  "restaurant",
  "professional",
  "culinary",
  "grams",
  "gram",
  "ratio",
  "baker",
  "pastry",
  "temperature",
  "technique",
  "mise en place",
  "hydration",
  "yield",
  "servings",
  "test kitchen"
];

const negativeSignals = [
  "mom",
  "grandma",
  "homemade",
  "easy",
  "quick",
  "weeknight",
  "family favorite",
  "blog",
  "ev yapimi",
  "anne",
  "kolay",
  "pratik"
];

const evidenceCache = new Map();
const cacheTtlMs = 15 * 60 * 1000;

export async function collectEvidence(results, limit) {
  const topResults = results.slice(0, Math.max(limit + 2, limit));
  const fetched = await Promise.allSettled(topResults.map(fetchEvidence));

  return fetched
    .flatMap((item) => (item.status === "fulfilled" ? [item.value] : []))
    .sort((a, b) => b.professionalScore - a.professionalScore)
    .slice(0, limit);
}

async function fetchEvidence(result) {
  const cached = evidenceCache.get(result.url);
  if (cached && Date.now() - cached.time < cacheTtlMs) return cached.value;

  const response = await Promise.race([
    fetch(result.url, {
      headers: {
        "User-Agent": "ProfessionalRecipeResearchBot/0.1 personal research"
      }
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Kaynak zaman asimina ugradi.")), 3500))
  ]);

  const html = response.ok ? await readTextWithTimeout(response, 2000) : "";
  const text = htmlToText(html).slice(0, 4500);
  const combined = `${result.title}\n${result.snippet}\n${text}`;
  const { score, warnings } = scoreProfessionalSource(combined);
  const value = {
    ...result,
    fetchedText: text || result.snippet,
    professionalScore: score,
    warnings
  };

  evidenceCache.set(result.url, { time: Date.now(), value });
  return value;
}

async function readTextWithTimeout(response, timeoutMs) {
  return Promise.race([
    response.text(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Kaynak okuma zaman asimina ugradi.")), timeoutMs))
  ]);
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function scoreProfessionalSource(text) {
  const lower = text.toLowerCase();
  const positives = positiveSignals.filter((signal) => lower.includes(signal)).length;
  const negatives = negativeSignals.filter((signal) => lower.includes(signal)).length;
  const hasMetric = /\b\d+(\.\d+)?\s?(g|kg|ml|l|c|f|%|minutes?|mins?|hours?)\b/i.test(text);
  const hasStructuredRecipe = /ingredients?|method|procedure|instructions?|yield|malzemeler|hazirlanisi/i.test(text);
  const score = Math.max(0, Math.min(100, 35 + positives * 7 + (hasMetric ? 10 : 0) + (hasStructuredRecipe ? 10 : 0) - negatives * 8));
  const warnings = [];

  if (negatives > 1) warnings.push("Ev tipi/blog sinyali var");
  if (!hasMetric) warnings.push("Metrik olcu veya oran zayif");
  if (!hasStructuredRecipe) warnings.push("Tarif yapisi zayif");

  return { score, warnings };
}
