class MyMemoryProvider {
  get name() {
    return "MyMemory";
  }

  async translate(text, sourceLang, targetLang) {
    const source = sourceLang === "zh" ? "zh-CN" : "en";
    const target = targetLang === "zh" ? "zh-CN" : "en";
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MyMemory request failed (${response.status})`);
    const data = await response.json();
    if (!data.responseData?.translatedText) throw new Error(data.responseDetails || "MyMemory returned no translation");
    return data.responseData.translatedText;
  }
}

class LibreTranslateProvider {
  get name() {
    return "LibreTranslate";
  }

  async translate(text, sourceLang, targetLang) {
    const response = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLang === "zh" ? "zh" : "en",
        target: targetLang === "zh" ? "zh" : "en",
        format: "text"
      })
    });
    if (!response.ok) throw new Error(`LibreTranslate request failed (${response.status})`);
    const data = await response.json();
    if (!data.translatedText) throw new Error("LibreTranslate returned no translation");
    return data.translatedText;
  }
}

class DeepLProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  get name() {
    return "DeepL";
  }

  async translate(text, sourceLang, targetLang) {
    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang === "zh" ? "ZH" : "EN",
        target_lang: targetLang === "zh" ? "ZH" : "EN-US"
      })
    });
    if (!response.ok) throw new Error(`DeepL request failed (${response.status})`);
    const data = await response.json();
    if (!data.translations?.[0]?.text) throw new Error("DeepL returned no translation");
    return data.translations[0].text;
  }
}

export class TranslationService {
  constructor(settings = {}) {
    this.providers = [];
    if (settings.deeplApiKey) this.providers.push(new DeepLProvider(settings.deeplApiKey));
    this.providers.push(new MyMemoryProvider(), new LibreTranslateProvider());
    this.lastProviderName = this.providers[0]?.name || "None";
  }

  async translate(text, direction) {
    const sourceLang = direction === "zh-en" ? "zh" : "en";
    const targetLang = direction === "zh-en" ? "en" : "zh";
    let lastError = null;

    for (const provider of this.providers) {
      try {
        const translatedText = await provider.translate(text, sourceLang, targetLang);
        this.lastProviderName = provider.name;
        return { translatedText, provider: provider.name };
      } catch (error) {
        lastError = error;
        console.warn(`${provider.name} failed, trying next provider`, error);
      }
    }

    throw lastError || new Error("No translation provider is available.");
  }
}
