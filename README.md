# Profesyonel Tarif Arastirici

Kisisel kullanim icin hazirlanmis global tarif arastirma araci. Webde farkli dillerde arama yapar, ev tipi/blog sinyallerini eleyerek profesyonel kaynaklara oncelik verir ve sonucu Turkce, kaynakli bir uretim raporu olarak cikarir.

## Ozellikler

- Global web aramasi: Tavily, Serper veya `.env` ile tanimlanan herhangi bir HTTP arama API'siyle cok dilli sorgular uretir.
- Profesyonel kaynak filtresi: chef, culinary school, gramaj, oran, teknik ve yield gibi sinyalleri puanlar.
- Ev tipi tariflerden kacinma: kolay/pratik/anne/blog/homemade gibi sinyalleri negatif puanlar.
- Turkce cikti: malzeme, yontem, kritik oranlar, sure/isi, ekipman, sorun giderme ve kaynak notlari uretir.
- Gizli anahtar guvenligi: `.env` git disinda tutulur.

## Kurulum

```bash
cp .env.example .env
npm run dev
```

Windows PowerShell kullaniyorsan:

```powershell
Copy-Item .env.example .env
npm run dev
```

Bu proje dis bagimlilik kullanmaz. `npm` yerine dogrudan Node ile de calistirabilirsin:

```bash
node server/index.mjs
```

Sonra tarayicida `http://127.0.0.1:8787` adresini ac.

## Gerekli API anahtarlari

`.env` icine sunlari ekle:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
TAVILY_API_KEY=...
```

`TAVILY_API_KEY` yerine `SERPER_API_KEY` de kullanabilirsin. Ikisi de varsa Tavily tercih edilir.

## DeepSeek ile kullanma

OpenAI yerine DeepSeek kullanmak istersen `.env` dosyasina sunlari ekle:

```env
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

DeepSeek resmi dokumanina gore OpenAI uyumlu Chat Completions API kullanir. Guncel base URL `https://api.deepseek.com`; V4 icin `deepseek-v4-flash` veya daha guclu kalite icin `deepseek-v4-pro` kullanabilirsin.

Baska OpenAI uyumlu bir servis kullanmak icin:

```env
LLM_PROVIDER=custom
LLM_API_KEY=...
LLM_BASE_URL=https://example.com
LLM_MODEL=...
```

## Hiz ayarlari

Arayuz varsayilan olarak `Hizli` modda acilir. Bu mod daha az sorgu ve daha az kaynak ceker. Daha kapsamli ama daha yavas arama icin `Derin` modunu sec.

LLM bekleme suresini `.env` icinden kisaltip uzatabilirsin:

```env
LLM_TIMEOUT_MS=8000
LLM_MAX_TOKENS=1200
```

DeepSeek/OpenAI yavas kalirsa uygulama hata vermek yerine kaynak raporuna duser.

## Serbest API anahtari

Tavily/Serper kullanmak istemezsen herhangi bir arama API'sini `.env` icinde tarif edebilirsin. `SEARCH_API_URL` doluysa uygulama once bu ozel saglayiciyi kullanir.

GET ornegi:

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

POST ornegi:

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

Kisaca: key adi, header adi, endpoint, GET/POST govdesi ve sonuc JSON yollari serbest. API'nin arama sonucu dondurmesi gerekir; sadece key eklemek, saglayicinin formati bilinmiyorsa yeterli olmaz.

## GitHub Pages notu

GitHub Pages sadece statik HTML/CSS/JS yayinlar. Bu proje ise arama, kaynak cekme ve DeepSeek/OpenAI sentezi icin `server/index.mjs` backend'ine ihtiyac duyar.

Bu nedenle `https://voidcoder-ux.github.io/Initial-professional-recipe-researcher/` adresinde arayuz gorunur, ama tam tarif arastirmasi calismaz. Tam internet yayini icin backend'i Render, Railway, Fly.io, Vercel serverless ya da bir VPS uzerinde yayinlamak gerekir.

## GitHub'a yayinlama

```bash
git init
git add .
git commit -m "Initial professional recipe researcher"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/profesyonel-tarif-arastirici.git
git push -u origin main
```

`.env` dosyasi `.gitignore` icinde oldugu icin API anahtarlarin GitHub'a gitmez.

## Notlar

Bu arac "dogrulugu teyit edilmis" raporu kaynaklar arasi tutarliliga, profesyonel kaynak puanina ve modelin belirsizligi acikca isaretlemesine dayandirir. Tibbi, alerjen, gida guvenligi veya ticari uretim kararlarinda son kontrol yine profesyonel mutfak standardina gore yapilmalidir.
