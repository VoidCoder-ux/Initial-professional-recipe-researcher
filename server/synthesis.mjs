const defaultOpenAiModel = "gpt-5.4-mini";
const defaultDeepSeekModel = "deepseek-v4-flash";

export async function synthesizeRecipe(request, evidence) {
  if (process.env.DEEPSEEK_API_KEY || process.env.LLM_PROVIDER === "deepseek") {
    return synthesizeWithChatCompletions({
      apiKey: process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY,
      baseUrl: process.env.DEEPSEEK_BASE_URL || process.env.LLM_BASE_URL || "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL || process.env.LLM_MODEL || defaultDeepSeekModel,
      request,
      evidence,
      providerName: "DeepSeek"
    });
  }

  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
    return synthesizeWithChatCompletions({
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL || defaultDeepSeekModel,
      request,
      evidence,
      providerName: "OpenAI uyumlu LLM"
    });
  }

  if (process.env.OPENAI_API_KEY) return synthesizeWithOpenAiResponses(request, evidence);

  return keylessSourceReport(request, evidence);
}

async function synthesizeWithOpenAiResponses(request, evidence) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || defaultOpenAiModel,
      reasoning: { effort: request.depth === "deep" ? "medium" : "low" },
      input: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: JSON.stringify(userPayload(request, evidence)) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recipe_report",
          strict: true,
          schema: recipeJsonSchema()
        }
      }
    })
  });

  if (!response.ok) throw new Error(`OpenAI sentezi basarisiz: ${response.status} ${await response.text()}`);

  const data = await response.json();
  const parsed = JSON.parse(extractResponsesText(data));
  return withSources(parsed, evidence);
}

async function synthesizeWithChatCompletions({ apiKey, baseUrl, model, request, evidence, providerName }) {
  if (!apiKey) return keylessSourceReport(request, evidence);

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${systemPrompt()} JSON disinda hicbir sey yazma.` },
        { role: "user", content: JSON.stringify(userPayload(request, evidence)) }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    })
  });

  if (!response.ok) throw new Error(`${providerName} sentezi basarisiz: ${response.status} ${await response.text()}`);

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${providerName} yanitinda metin bulunamadi.`);

  return withSources(JSON.parse(text), evidence);
}

function systemPrompt() {
  return [
    "Sen profesyonel mutfak arastirmacisisin.",
    "Global kaynaklardan gelen bilgileri Turkce sentezle.",
    "Ev tipi, blog odakli, olcusuz veya dogrulanamayan tarifleri cezalandir.",
    "Sadece verilen kaynaklara dayan.",
    "Belirsiz bilgiyi kesinmis gibi yazma.",
    "Cikti recipe_report semasina uygun JSON olmali."
  ].join(" ");
}

function userPayload(request, evidence) {
  return {
    task: "Profesyonel seviyede dogrulanmis tarif raporu uret.",
    request,
    evidence: evidence.map((item, index) => ({
      id: index + 1,
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      professionalScore: item.professionalScore,
      warnings: item.warnings,
      text: item.fetchedText.slice(0, 4500)
    })),
    requiredJsonShape: {
      title: "string",
      confidence: "yuksek | orta | dusuk",
      professionalFit: "string",
      summary: "string",
      ingredients: ["string"],
      method: ["string"],
      ratiosAndChecks: ["string"],
      timing: ["string"],
      equipment: ["string"],
      troubleshooting: ["string"],
      sourceNotes: ["string"]
    }
  };
}

function recipeJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "confidence",
      "professionalFit",
      "summary",
      "ingredients",
      "method",
      "ratiosAndChecks",
      "timing",
      "equipment",
      "troubleshooting",
      "sourceNotes"
    ],
    properties: {
      title: { type: "string" },
      confidence: { type: "string", enum: ["yuksek", "orta", "dusuk"] },
      professionalFit: { type: "string" },
      summary: { type: "string" },
      ingredients: { type: "array", items: { type: "string" } },
      method: { type: "array", items: { type: "string" } },
      ratiosAndChecks: { type: "array", items: { type: "string" } },
      timing: { type: "array", items: { type: "string" } },
      equipment: { type: "array", items: { type: "string" } },
      troubleshooting: { type: "array", items: { type: "string" } },
      sourceNotes: { type: "array", items: { type: "string" } }
    }
  };
}

function extractResponsesText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const text = (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("");

  if (!text) throw new Error("OpenAI yanitinda metin bulunamadi.");
  return text;
}

function keylessSourceReport(request, evidence) {
  const strongSources = evidence.filter((item) => item.professionalScore >= 70);
  const bestSources = evidence.slice(0, 6);
  const confidence = strongSources.length >= 3 ? "orta" : "dusuk";

  return {
    title: `${request.query} kaynak raporu`,
    confidence,
    professionalFit:
      "Anahtarsiz modda web kaynaklari bulundu ve profesyonellik sinyallerine gore siralandi. Tam Turkce recete sentezi icin DeepSeek veya OpenAI API key eklenmeli.",
    summary:
      bestSources.length > 0
        ? `Bu aramada ${bestSources.length} kaynak one cikarildi. En guvenilir calisma icin yuksek puanli kaynaklardaki gramaj, sure, isi ve teknik notlarini karsilastir.`
        : "Kaynak bulunamadi. Daha guclu arama icin Tavily, Serper veya ozel SEARCH_API_URL eklenebilir.",
    ingredients: [
      "Anahtarsiz modda malzeme listesi otomatik birlestirilmez; kaynaklardaki gramajlari dogrudan kontrol et.",
      "Profesyonel recetede cup/spoon yerine gram, yuzde, isi ve hedef verim bilgisi olan kaynaklari onceliklendir."
    ],
    method: [
      "Kaynaklar bolumundeki en yuksek puanli 3-5 linki ac.",
      "Ayni teknik icin ortak adimlari isaretle; farkli verilen sure, isi veya oranlari not al.",
      "Ev tipi anlatim, belirsiz olcu ve sadece blog hikayesi iceren kaynaklari ele.",
      "Tam otomatik Turkce recete, LLM API key eklendiginde bu kaynaklar uzerinden uretilir."
    ],
    ratiosAndChecks: [
      "Profesyonel kontrol: gramaj, verim, kritik sicaklik, dinlendirme/sogutma suresi ve ekipman bilgisi arandi.",
      "Kaynak puani 70 ve uzeri olan linkler daha guvenilir kabul edildi.",
      "Bu mod kesin oran uretmez; yanlis recete vermemek icin kaynaklar arasi sentez kapali tutulur."
    ],
    timing: ["Sure ve isi bilgisi icin yuksek puanli kaynaklar karsilastirilmali."],
    equipment: [
      "Ekipman bilgisi kaynaklardan dogrulanmali; profesyonel kaynaklarda firin, termometre, mikser, kalip veya olcek net yazmali."
    ],
    troubleshooting: [
      "Sonuc zayifsa sorguya chef, professional, culinary school, grams veya mutfak dilindeki karsiligini ekle.",
      "Tam rapor istiyorsan .env dosyasina DEEPSEEK_API_KEY veya OPENAI_API_KEY ekleyip sunucuyu yeniden baslat."
    ],
    sourceNotes: evidence.map((item) => {
      const warnings = item.warnings.length ? ` Uyari: ${item.warnings.join(", ")}.` : "";
      return `${item.title}: profesyonel skor ${item.professionalScore}/100.${warnings}`;
    }),
    sources: evidence.map((item) => ({
      title: item.title,
      url: item.url,
      professionalScore: item.professionalScore
    }))
  };
}

function withSources(report, evidence) {
  return {
    ...report,
    sources: evidence.map((item) => ({
      title: item.title,
      url: item.url,
      professionalScore: item.professionalScore
    }))
  };
}
