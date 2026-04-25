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
  "プロ レシピ",
  "专业 食谱"
];

export function buildSearchQueries(request) {
  const base = [request.query, request.cuisine, request.targetYield].filter(Boolean).join(" ");
  const strict = request.strictProfessional ? professionalTerms : professionalTerms.slice(0, 4);
  return [
    `${base} ${strict.slice(0, 5).join(" ")}`,
    `${base} ${strict.slice(5).join(" ")}`,
    `${base} ${multilingualTerms.slice(0, 3).join(" ")}`,
    `${base} ${multilingualTerms.slice(3).join(" ")}`
  ].map((query) => query.trim());
}

export async function searchWeb(request) {
  const queries = buildSearchQueries(request);
  const maxPerQuery = request.depth === "deep" ? 8 : 5;
  const batches = await Promise.all(queries.map((query) => searchOne(query, maxPerQuery)));
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
  return [];
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

  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Özel arama API isteği başarısız: ${response.status}`);

  const data = await response.json();
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
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      max_results: maxResults
    })
  });

  if (!response.ok) throw new Error(`Tavily araması başarısız: ${response.status}`);
  const data = await response.json();

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
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.SERPER_API_KEY ?? ""
    },
    body: JSON.stringify({ q: query, num: maxResults })
  });

  if (!response.ok) throw new Error(`Serper araması başarısız: ${response.status}`);
  const data = await response.json();

  return (data.organic ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet ?? "",
      provider: "serper"
    }));
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
    throw new Error("SEARCH_API_HEADERS JSON obje olmalı.");
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
