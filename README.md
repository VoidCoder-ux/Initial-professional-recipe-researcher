# Profesyonel Tarif Araştırıcı

Kişisel kullanım için hazırlanmış global tarif araştırma aracı. Webde farklı dillerde arama yapar, ev tipi/blog sinyallerini eleyerek profesyonel kaynaklara öncelik verir ve sonucu Türkçe, kaynaklı bir üretim raporu olarak çıkarır.

## Özellikler

- Global web araması: Tavily, Serper veya `.env` ile tanımlanan herhangi bir HTTP arama API'siyle çok dilli sorgular üretir.
- Profesyonel kaynak filtresi: chef, culinary school, gramaj, oran, teknik ve yield gibi sinyalleri puanlar.
- Ev tipi tariflerden kaçınma: kolay/pratik/anne/blog/homemade gibi sinyalleri negatif puanlar.
- Türkçe çıktı: malzeme, yöntem, kritik oranlar, süre/ısı, ekipman, sorun giderme ve kaynak notları üretir.
- Gizli anahtar güvenliği: `.env` git dışında tutulur.

## Kurulum

```bash
cp .env.example .env
npm run dev
```

Windows PowerShell kullanıyorsan:

```powershell
Copy-Item .env.example .env
npm run dev
```

Sonra tarayıcıda `http://127.0.0.1:8787` adresini aç.

Bu proje dış bağımlılık kullanmaz. `npm` yerine doğrudan Node ile de çalıştırabilirsin:

```bash
node server/index.mjs
```

Sonra tarayıcıda `http://127.0.0.1:8787` adresini aç.

## Gerekli API anahtarları

`.env` içine şunları ekle:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
TAVILY_API_KEY=...
```

`TAVILY_API_KEY` yerine `SERPER_API_KEY` de kullanabilirsin. İkisi de varsa Tavily tercih edilir.

## Serbest API anahtarı

Tavily/Serper kullanmak istemezsen herhangi bir arama API'sini `.env` içinde tarif edebilirsin. `SEARCH_API_URL` doluysa uygulama önce bu özel sağlayıcıyı kullanır.

GET örneği:

```env
SEARCH_API_URL=https://example.com/search?q={{queryUrl}}&limit={{maxResults}}
SEARCH_API_METHOD=GET
SEARCH_API_KEY=...
SEARCH_API_KEY_HEADER=X-API-Key
SEARCH_API_KEY_PREFIX=
SEARCH_API_RESULTS_PATH=results
SEARCH_API_TITLE_PATH=title
SEARCH_API_URL_PATH=url
SEARCH_API_SNIPPET_PATH=snippet
```

POST örneği:

```env
SEARCH_API_URL=https://example.com/search
SEARCH_API_METHOD=POST
SEARCH_API_KEY=...
SEARCH_API_KEY_HEADER=Authorization
SEARCH_API_KEY_PREFIX=Bearer 
SEARCH_API_BODY={"query":"{{query}}","limit":{{maxResults}}}
SEARCH_API_RESULTS_PATH=data.items
SEARCH_API_TITLE_PATH=name
SEARCH_API_URL_PATH=link
SEARCH_API_SNIPPET_PATH=description
```

Kısaca: key adı, header adı, endpoint, GET/POST gövdesi ve sonuç JSON yolları serbest. API'nin arama sonucu döndürmesi gerekir; sadece key eklemek, sağlayıcının formatı bilinmiyorsa yeterli olmaz.

## GitHub'a yayınlama

```bash
git init
git add .
git commit -m "Initial professional recipe researcher"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/profesyonel-tarif-arastirici.git
git push -u origin main
```

`.env` dosyası `.gitignore` içinde olduğu için API anahtarların GitHub'a gitmez.

## Notlar

Bu araç “doğruluğu teyit edilmiş” raporu kaynaklar arası tutarlılığa, profesyonel kaynak puanına ve modelin belirsizliği açıkça işaretlemesine dayandırır. Tıbbi, alerjen, gıda güvenliği veya ticari üretim kararlarında son kontrol yine profesyonel mutfak standardına göre yapılmalıdır.
