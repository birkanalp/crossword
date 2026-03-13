# Ollama Kurulumu (AI Bulmaca İncelemesi)

Bulmaca kalite incelemesi **Ollama** ile yapılır. Admin panelden "Yeni Bulmaca" ile üretilen seviyeler otomatik olarak Ollama üzerinden incelenir.

---

## Nasıl Çalışır

### 1. Kalite İncelemesi (AI Review)
1. Admin "Yeni Bulmaca Üret" → seviye oluşturulur
2. Edge Function `ai-review` endpoint'i çağrılır
3. Ollama bulmacayı değerlendirir
4. Sonuç: `pending` (geçti) veya `rejected` (reddedildi)

### 2. İpucu Üretimi (Generate Hints)
- **Ayrı akış:** Kalite incelemesi geçtikten sonra
- Admin panelde bulmaca detay sayfasında "İpuçlarını Üret (YZ)" butonu
- Sadece `pending` veya `approved` seviyelerde, ipucu boş olan sorular için
- Ollama her soru-cevap çifti için kısa ipucu üretir

---

## Kurulum

1. **Stack'i başlat:**
   ```bash
   docker compose up -d --build
   ```

2. **İlk açılışta** Ollama `qwen2.5:3b` modelini otomatik çeker (~2 GB). Bu işlem birkaç dakika sürebilir. Logları izlemek için:
   ```bash
   docker compose logs -f ollama
   ```

3. Model hazır olduğunda "Model qwen2.5:3b ready" mesajı görünür.

---

## Yapılandırma

`.env` dosyasında (opsiyonel):

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Ollama API adresi (Docker içi) |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Kullanılacak model |
| `OLLAMA_PORT` | `11435` | Host'tan erişim portu (11434 yerel Ollama ile çakışabilir) |

### Farklı model kullanmak

Örn. Türkçe için `mistral-turkish-v2` veya `Turkcell-LLM-7b-v1`:

```bash
# .env
OLLAMA_MODEL=mistral-turkish-v2
```

Ardından stack'i yeniden başlatın. Init script yeni modeli otomatik çeker.

---

## Manuel model çekme

Ollama zaten çalışıyorsa, modeli elle çekmek için:

```bash
docker compose exec ollama ollama pull qwen2.5:3b
```

---

## Sorun giderme

- **503 AI review service unavailable:** Ollama servisi çalışmıyor veya model yüklü değil. `docker compose ps ollama` ile kontrol edin.
- **Model yüklenmiyor:** İlk açılışta internet bağlantısı gerekir. `docker compose logs ollama` ile indirme durumunu izleyin.
- **Yavaş yanıt:** CPU modunda çalışır; ilk istekte model yüklemesi 10–30 saniye sürebilir.
