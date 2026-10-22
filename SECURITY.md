# PromptCanvas - Güvenlik Protokolü ve API Anahtarı Yönetim Kılavuzu
*(Security Protocol & API Key Management Guidelines)*

Bu belge, PromptCanvas projesinde kullanılan API anahtarlarının (Google Gemini, vb.) güvenliği, saklanması, yetkilendirilmesi ve sızıntı durumlarında izlenecek acil eylem planını içerir.

---

## 1. Altın Güvenlik Kuralları (Golden Rules)

1. **Kaynak Koda Asla API Anahtarı Yazmayın (No Hardcoding):**
   - API anahtarları asla `.ts`, `.tsx`, `.js`, `.html` veya Git'e dahil edilen dosyalara düz metin olarak yazılmamalıdır.
   - Anahtarlar yalnızca `.env` dosyasında veya barındırma platformunun (Google AI Studio Secrets, Cloud Run Environment Variables) güvenli kasasında saklanır.

2. **Git ve Versiyon Kontrol İzolasyonu:**
   - `.gitignore` dosyası içerisinde `.env*` deseni tanımlanmıştır.
   - Hiçbir `.env` dosyası Git deposuna veya GitHub/GitLab'a commit edilmemelidir.
   - Yalnızca örnek şablon olan `.env.example` deposunda tutulur.

3. **İstemci (Client) Tarafı Koruması ve Maskeleme:**
   - Tarayıcıda veya kullanıcı arayüzünde API anahtarları hiçbir zaman açık metin olarak gösterilmez (örn. `AQ.Ab8R••••••••E23w` şeklinde maskelenir).
   - Sunucu loglarında veya hata çıktılarında API anahtarları asla loglanmaz.

4. **Sohbet ve Açık Alan Paylaşımları:**
   - API anahtarlarını yapay zeka sohbet pencerelerinde, genel forumlarda, Discord veya Slack kanallarında doğrudan paylaşmayınız.

---

## 2. API Anahtarınız Açığa Çıkarsa Yapılacaklar (Olay Müdahale Protokolü)

Eğer bir API anahtarı istemeden paylaşıldıysa veya herkese açık bir yerde göründüyse şu adımlar uygulanmalıdır:

1. **Google AI Studio'ya Giriş Yapın:**
   - [Google AI Studio API Keys](https://aistudio.google.com/apikey) sayfasına gidin.
2. **Eski Anahtarı İptal Edin (Revoke/Delete):**
   - Açığa çıkan anahtarın yanındaki çöp kutusu/sil simgesine tıklayarak anahtarı derhal geçersiz kılın.
3. **Yeni Bir API Anahtarı Oluşturun (Generate New Key):**
   - "Create API Key" butonuna basarak yeni bir proje anahtarı üretin.
4. **`.env` Dosyasını Güncelleyin:**
   - Projenizdeki `.env` dosyasına yeni anahtarı yazın:
     ```env
     GEMINI_API_KEY="YENİ_GÜVENLİ_ANAHTARINIZ"
     ```
5. **Kullanım Kotaları ve Bütçe Limiti Belirleyin:**
   - Google Cloud Console üzerinden projenize günlük istek veya bütçe üst limiti (Quotas & Budgets) koyarak beklenmedik harcamaların önüne geçin.

---

## 3. Rate Limit (429) ve Hata Protokolü

- **429 (Too Many Requests - İstek Limiti):**
  - Gemini API'nin ücretsiz katmanında dakika başına istek sınırı (RPM) bulunur.
  - Proje mimarisinde üst üste istek gönderimini önleyen **debounce/cooldown mekanizması** ve **akıllı yerel yedek motor (Local Smart Enhancer)** bulunur.
  - 429 hatası alındığında sistem çökmek yerine yerel sanatsal prompt zenginleştirme motorunu devreye sokar.

- **402 (Payment Required) ve 503 (Service Unavailable):**
  - Harici görsel motorları kota veya sunucu yoğunluğu nedeniyle 402/503 hatası döndürdüğünde, sistem otomatik olarak **yedek ve ücretsiz alternatif motora (Turbo Engine)** geçiş yapar.
  - İstemciye asla bozuk görsel URL'si iletilmez; sunucu tüm görselleri Base64 veri formatında doğrular.

---

## 4. İletişim & Güvenlik Bildirimi

Bir güvenlik açığı veya yetkisiz erişim fark edildiğinde lütfen derhal proje yöneticisiyle iletişime geçiniz.
