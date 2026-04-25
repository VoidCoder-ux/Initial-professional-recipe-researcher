const professionalTerms = [
  "professional recipe",
  "chef recipe",
  "restaurant recipe",
  "culinary school",
  "pastry chef",
  "baker's percentage",
  "technique",
  "ratio",
  "grams"
];

const multilingualTerms = [
  "recette professionnelle",
  "ricetta professionale",
  "receta profesional",
  "professionelles rezept",
  "professional recipe japanese",
  "professional recipe chinese"
];

export function buildSearchQueries(request) {
  const base = [request.query, request.cuisine, request.targetYield].filter(Boolean).join(" ");
  const strict = request.strictProfessional ? professionalTerms : professionalTerms.slice(0, 4);
  const queries = [
    `${base} ${strict.slice(0, 5).join(" ")}`,
    `${base} ${strict.slice(5).join(" ")}`,
    `${base} ${multilingualTerms.slice(0, 3).join(" ")}`,
    `${base} ${multilingualTerms.slice(3).join(" ")}`
  ].map((query) => query.trim());

  return request.depth === "deep" ? queries : queries.slice(0, 2);
}

export async function searchWeb(request) {
  const queries = buildSearchQueries(request);
  const maxPerQuery = request.depth === "deep" ? 6 : 3;
  const settled = await Promise.allSettled(queries.map((query) => searchOne(query, maxPerQuery)));
  const batches = settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
  const seen = new Set();

  return batches.flat().filter((result) => {
    const key = normalizeUrl(result.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchOne(query, maxResults) {
  if (process.env.SEARCH_API_URL) return searchCustom(query, maxResults);
  if (process.env.TAVILY_API_KEY) return searchTavily(query, maxResults);
  if (process.env.SERPER_API_KEY) return searchSerper(query, maxResults);
  return searchDuckDuckGo(query, maxResults);
}

async function searchCustom(query, maxResults) {
  const method = (process.env.SEARCH_API_METHOD || "POST").toUpperCase();
  const url = interpolate(process.env.SEARCH_API_URL, { query, maxResults });
  const headers = {
    "Content-Type": "application/json",
    ...parseJsonObject(process.env.SEARCH_API_HEADERS)
  };

  if (process.env.SEARCH_API_KEY) {
    const headerName = process.env.SEARCH_API_KEY_HEADER || "Authorization";
    const prefix = process.env.SEARCH_API_KEY_PREFIX ?? "Bearer ";
    headers[headerName] = `${prefix}${process.env.SEARCH_API_KEY}`;
  }

  const options = { method, headers };
  if (method !== "GET") {
    const bodyTemplate = process.env.SEARCH_API_BODY || '{"query":"{{query}}","max_results":{{maxResults}}}';
    options.body = interpolate(bodyTemplate, { query, maxResults });
  }

  const response = await fetchWithTimeout(url, options, 6000);
  if (!response.ok) throw new Error(`Ozel arama API istegi basarisiz: ${response.status}`);

  const data = await readJsonWithTimeout(response, 3000);
  const items = getPath(data, process.env.SEARCH_API_RESULTS_PATH || "results") ?? [];
  const titlePath = process.env.SEARCH_API_TITLE_PATH || "title";
  const urlPath = process.env.SEARCH_API_URL_PATH || "url";
  const snippetPath = process.env.SEARCH_API_SNIPPET_PATH || "content";

  return items
    .filter((item) => getPath(item, titlePath) && getPath(item, urlPath))
    .map((item) => ({
      title: String(getPath(item, titlePath)),
      url: String(getPath(item, urlPath)),
      snippet: String(getPath(item, snippetPath) ?? ""),
      provider: "custom"
    }));
}

async function searchTavily(query, maxResults) {
  const response = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: maxResults
    })
  }, 6000);

  if (!response.ok) throw new Error(`Tavily aramasi basarisiz: ${response.status}`);
  const data = await readJsonWithTimeout(response, 3000);

  return (data.results ?? [])
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content ?? "",
      provider: "tavily"
    }));
}

async function searchSerper(query, maxResults) {
  const response = await fetchWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.SERPER_API_KEY ?? ""
    },
    body: JSON.stringify({ q: query, num: maxResults })
  }, 6000);

  if (!response.ok) throw new Error(`Serper aramasi basarisiz: ${response.status}`);
  const data = await readJsonWithTimeout(response, 3000);

  return (data.organic ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet ?? "",
      provider: "serper"
    }));
}

async function searchDuckDuckGo(query, maxResults) {
  const response = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 ProfessionalRecipeResearcher/0.1"
    }
  }, 6000);

  if (!response.ok) throw new Error(`Anahtarsiz arama basarisiz: ${response.status}`);
  const html = await readTextWithTimeout(response, 3000);
  const matches = [
    ...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)
  ];

  return matches.slice(0, maxResults).map((match) => ({
    title: cleanHtml(match[2]),
    url: decodeDuckUrl(match[1]),
    snippet: cleanHtml(match[3]),
    provider: "duckduckgo"
  }));
}

function cleanHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDuckUrl(value) {
  const cleaned = value.replace(/&amp;/g, "&");
  try {
    const parsed = new URL(cleaned, "https://duckduckgo.com");
    return parsed.searchParams.get("uddg") || parsed.href;
  } catch {
    return cleaned;
  }
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function interpolate(template = "", values) {
  return template
    .replaceAll("{{query}}", String(values.query).replaceAll('"', '\\"'))
    .replaceAll("{{queryUrl}}", encodeURIComponent(values.query))
    .replaceAll("{{maxResults}}", String(values.maxResults));
}

function parseJsonObject(value) {
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("SEARCH_API_HEADERS JSON obje olmali.");
  }
  return parsed;
}

function getPath(value, path) {
  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => {
      if (current == null) return undefined;
      if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
      return current[key];
    }, value);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Arama zaman asimina ugradi.")), timeoutMs))
  ]);
}

async function readTextWithTimeout(response, timeoutMs) {
  return Promise.race([
    response.text(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Cevap okuma zaman asimina ugradi.")), timeoutMs))
  ]);
}

async function readJsonWithTimeout(response, timeoutMs) {
  const text = await readTextWithTimeout(response, timeoutMs);
  return JSON.parse(text);
}
