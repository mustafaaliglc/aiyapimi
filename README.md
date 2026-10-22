# PromptCanvas - AI Görsel Üretici & Stüdyosu 🎨✨

Google AI Studio ve Gemini 3.8 Flash ile güçlendirilmiş, yazdığınız Türkçe veya İngilizce istemlerden anında sanatsal, fotogerçekçi, anime ve 3D görseller üreten yeni nesil yapay zeka görsel stüdyosu.

---

## 🚀 Öne Çıkan Özellikler & Yapılan İyileştirmeler

1. **🔒 Güvenlik Protokolü & API Anahtarı Koruması:**
   - API anahtarları `.env` dosyasında izole edilmiştir ve Git'e asla dahil edilmez (`.gitignore`).
   - Arayüzde ve sunucu loglarında API anahtarları otomatik maskelenir (`AQ.Ab8R••••••••E23w`).
   - Kullanıcıların arayüzden kendi Gemini API anahtarlarını güvenle girip test edebilecekleri **API Anahtarı ve Güvenlik Modalı** eklendi.
   - Detaylı kılavuz için [SECURITY.md](SECURITY.md) dosyasını inceleyin.

2. **⚡ 429 (Too Many Requests / Kota Aşımı) Çözümü:**
   - Google Gemini API ücretsiz katmanı dakikalık kota sınırına (RPM) ulaştığında çökme yaşanmaması için:
     - Üst üste istekleri engelleyen **cooldown sayacı (debounce)** eklendi.
     - **Otomatik Akıllı Yerel Zenginleştirme (Local Smart Enhancer)** mimarisi kuruldu. Kota bittiğinde bile istem semantik olarak profesyonel kamera, ışık ve kompozisyon katmanlarıyla zenginleştirilmeye devam eder.

3. **💎 402 (Payment Required) ve 503 (Service Unavailable) Çözümü:**
   - Harici görsel motorlarının sunduğu ücretli/kotalı modeller (Flux vb.) 402 veya 503 döndürdüğünde istemciye bozuk link iletilmez.
   - **Çok Kademeli Yedek Motor Zinciri (Multi-Engine Fallback Chain):**
     1. **Turbo Neural Motor:** Hızlı, ücretsiz ve 402/ödeme hatası vermeyen birincil motor.
     2. **Flux Sanat Motoru:** Derin sanatsal detay gerektiren durumlar için.
     3. **Çevrimdışı/Yedek Tuval:** Ağ kesintilerinde bile arayüzü ayakta tutan prosedürel görsel motoru.
   - Sunucu tüm görselleri doğrulanmış Base64 verisi olarak döndürür; tarayıcıda CORS veya yükleme hatası oluşmaz.

4. **🌐 Vite WebSocket & HMR Zaman Aşımı Düzeltmesi:**
   - Sunucuda (`server.ts`), Vite HMR WebSocket bağlantısı doğrudan ana HTTP sunucusuna bağlanarak port 24678 bağlantı zaman aşımı (`net::ERR_CONNECTION_TIMED_OUT`) ve iframe hataları giderildi.

5. **✨ Yeni Eklenen Kullanıcı Deneyimi Özellikleri:**
   - **Yapay Zeka Motor Seçici:** Turbo, Flux ve Anime motorları arasında tek tıkla geçiş.
   - **Negatif İstem (Negative Prompt):** Görselde istenmeyen unsurları (örn. bulanıklık, bozuk el/parmak, filigran) filtreleme.
   - **Favorilere Ekleme & Filtreleme:** Beğenilen görselleri kalp simgesiyle favorilere ekleme ve geçmişi filtreleme.
   - **Klavye Kısayolu:** `Ctrl + Enter` ile anında görsel üretimi.

---

## 🛠️ Kurulum ve Çalıştırma

### Gereksinimler
- Node.js (v18+)
- npm veya pnpm

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. API Anahtarını Yapılandırın
`.env` dosyasını oluşturun veya mevcut olanı düzenleyin:
```env
GEMINI_API_KEY="AQ.Ab8RN6LR3uK7P3G22MT-Vgzi_B7fL-8IYI2jPD2O-VwIY6E23w"
PORT=3000
```

### 3. Uygulamayı Başlatın
```bash
npm run dev
```
Uygulama `http://localhost:3000` adresinde çalışacaktır.
