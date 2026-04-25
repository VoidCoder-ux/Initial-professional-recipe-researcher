const form = document.querySelector("#research-form");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submit-button");
const depthButtons = [...document.querySelectorAll("[data-depth]")];
let depth = "deep";

for (const button of depthButtons) {
  button.addEventListener("click", () => {
    depth = button.dataset.depth;
    for (const candidate of depthButtons) candidate.classList.toggle("active", candidate === button);
  });
}

for (const button of document.querySelectorAll(".examples button")) {
  button.addEventListener("click", () => {
    document.querySelector("#query").value = button.textContent;
  });
}

fetch("/api/health")
  .then((response) => response.json())
  .then((health) => {
    document.querySelector("#search-status").textContent = `Arama: ${health.searchProvider}`;
    document.querySelector("#openai-status").textContent = `LLM: ${health.hasLlm ? health.llmProvider : "anahtar yok"}`;
  })
  .catch(() => {
    document.querySelector("#search-status").textContent = "Arama: bilinmiyor";
    document.querySelector("#openai-status").textContent = "OpenAI: bilinmiyor";
  });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = "Araştırılıyor...";
  result.className = "empty-state";
  result.innerHTML = "<h2>Kaynaklar ayıklanıyor</h2><p>Profesyonel sinyaller ve kaynak tutarlılığı kontrol ediliyor.</p>";

  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: document.querySelector("#query").value,
        cuisine: document.querySelector("#cuisine").value,
        targetYield: document.querySelector("#targetYield").value,
        depth,
        strictProfessional: document.querySelector("#strictProfessional").checked
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Araştırma tamamlanamadı.");
    renderReport(data);
  } catch (error) {
    result.className = "error";
    result.textContent = error instanceof Error ? error.message : "Beklenmeyen hata oluştu.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Tarifi Araştır";
  }
});

function renderReport(report) {
  result.className = "report";
  result.innerHTML = `
    <header class="report-header">
      <div>
        <span class="confidence ${escapeHtml(report.confidence)}">${escapeHtml(report.confidence)}</span>
        <h2>${escapeHtml(report.title)}</h2>
      </div>
      <p>${escapeHtml(report.professionalFit)}</p>
    </header>
    <p class="summary">${escapeHtml(report.summary)}</p>
    ${section("Malzemeler", report.ingredients)}
    ${section("Yöntem", report.method, true)}
    ${section("Oran ve Kontrol", report.ratiosAndChecks)}
    ${section("Süre ve Isı", report.timing)}
    ${section("Ekipman", report.equipment)}
    ${section("Sorun Giderme", report.troubleshooting)}
    ${section("Kaynak Notları", report.sourceNotes)}
    <section class="sources">
      <h3>Kaynaklar</h3>
      ${(report.sources ?? [])
        .map(
          (source) => `
            <a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">
              <span>${escapeHtml(source.title)}</span>
              <strong>${Number(source.professionalScore).toFixed(0)}/100</strong>
            </a>
          `
        )
        .join("")}
    </section>
  `;
}

function section(title, items = [], ordered = false) {
  if (!items.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `
    <section class="report-section">
      <h3>${escapeHtml(title)}</h3>
      <${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
