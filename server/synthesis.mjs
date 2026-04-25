const fallbackModel = "gpt-5.4-mini";

export async function synthesizeRecipe(request, evidence) {
  if (!process.env.OPENAI_API_KEY) return missingOpenAiReport(request, evidence);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || fallbackModel,
      reasoning: { effort: request.depth === "deep" ? "medium" : "low" },
      input: [
        {
          role: "system",
          content:
            "Sen profesyonel mutfak araştırmacısısın. Global kaynaklardan gelen bilgileri Türkçe sentezle. Ev tipi, blog odaklı, ölçüsüz veya doğrulanamayan tarifleri cezalandır. Sadece verilen kaynaklara dayan. Belirsiz bilgiyi kesinmiş gibi yazma. JSON dışında çıktı verme."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Profesyonel seviyede doğrulanmış tarif raporu üret.",
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
              confidence: "yüksek | orta | düşük",
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
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recipe_report",
          strict: true,
          schema: {
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
              confidence: { type: "string", enum: ["yüksek", "orta", "düşük"] },
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
          }
        }
      }
    })
  });

  if (!response.ok) throw new Error(`OpenAI sentezi başarısız: ${response.status} ${await response.text()}`);

  const data = await response.json();
  const parsed = JSON.parse(extractOutputText(data));

  return {
    ...parsed,
    sources: evidence.map((item) => ({
      title: item.title,
      url: item.url,
      professionalScore: item.professionalScore
    }))
  };
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const text = (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("");

  if (!text) throw new Error("OpenAI yanıtında metin bulunamadı.");
  return text;
}

function missingOpenAiReport(request, evidence) {
  return {
    title: `${request.query} araştırması hazır değil`,
    confidence: "düşük",
    professionalFit: "OpenAI API anahtarı olmadığı için profesyonel sentez üretilemedi.",
    summary: "Arama kaynakları toplanır; Türkçe, doğrulanmış tarif raporu için OPENAI_API_KEY eklenmelidir.",
    ingredients: [],
    method: [],
    ratiosAndChecks: ["OPENAI_API_KEY olmadan malzeme oranı ve çapraz kaynak kontrolü yapılmadı."],
    timing: [],
    equipment: [],
    troubleshooting: [],
    sourceNotes: evidence.map((item) => `${item.title}: profesyonel skor ${item.professionalScore}/100`),
    sources: evidence.map((item) => ({
      title: item.title,
      url: item.url,
      professionalScore: item.professionalScore
    }))
  };
}
