import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { collectEvidence } from "./evidence.mjs";
import { loadEnv } from "./env.mjs";
import { searchWeb } from "./search.mjs";
import { synthesizeRecipe } from "./synthesis.mjs";

loadEnv();

const port = Number(process.env.PORT || 8787);
const publicDir = resolve(process.cwd(), "public");

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json(response, 200, {
        ok: true,
        searchProvider: getSearchProvider(),
        hasOpenAi: Boolean(process.env.OPENAI_API_KEY),
        hasLlm: hasLlmKey(),
        llmProvider: getLlmProvider()
      });
    }

    if (request.method === "POST" && url.pathname === "/api/research") {
      const payload = validateResearchRequest(await readJson(request));
      const results = await searchWeb(payload);

      if (results.length === 0) {
        return json(response, 400, {
          error: "Arama sonucu donmedi. Daha guclu arama icin SEARCH_API_URL, TAVILY_API_KEY ya da SERPER_API_KEY ekleyin."
        });
      }

      const rawEvidence = await collectEvidence(results, payload.depth === "deep" ? 7 : 4);
      const professionalEvidence = payload.strictProfessional
        ? rawEvidence.filter((item) => item.professionalScore >= 50)
        : rawEvidence;
      const evidence = professionalEvidence.length >= 3 ? professionalEvidence : rawEvidence;
      const report = await synthesizeRecipe(payload, evidence);
      return json(response, 200, report);
    }

    if (request.method === "GET") return serveStatic(url.pathname, response);

    json(response, 405, { error: "Desteklenmeyen istek." });
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : "Bilinmeyen hata" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Profesyonel Tarif Arastirici: http://127.0.0.1:${port}`);
});

function validateResearchRequest(body) {
  const query = String(body.query ?? "").trim();
  if (query.length < 2 || query.length > 160) throw new Error("Tarif sorgusu 2-160 karakter olmali.");

  return {
    query,
    cuisine: String(body.cuisine ?? "").trim().slice(0, 80),
    targetYield: String(body.targetYield ?? "").trim().slice(0, 80),
    depth: body.depth === "fast" ? "fast" : "deep",
    strictProfessional: body.strictProfessional !== false
  };
}

function getSearchProvider() {
  if (process.env.SEARCH_API_URL) return "custom";
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.SERPER_API_KEY) return "serper";
  return "duckduckgo";
}

function hasLlmKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY);
}

function getLlmProvider() {
  if (process.env.DEEPSEEK_API_KEY || process.env.LLM_PROVIDER === "deepseek") return "deepseek";
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) return "custom";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

function readJson(request) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        request.destroy();
        reject(new Error("İstek çok büyük."));
      }
    });
    request.on("end", () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Geçersiz JSON."));
      }
    });
    request.on("error", reject);
  });
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(publicDir, safePath));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bulunamadı");
    return;
  }

  response.writeHead(200, { "Content-Type": contentType(filePath) });
  createReadStream(filePath).pipe(response);
}

function contentType(filePath) {
  const ext = extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}
