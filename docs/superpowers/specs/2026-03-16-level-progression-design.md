# Level Progression & Unlock System — Design Spec

**Date:** 2026-03-16
**Status:** Implemented

---

## Amaç

Oyuncunun tüm bulmacalara baştan erişmesini engelleyerek kademeli bir ilerleme deneyimi sunmak. Bu sistem tutunmayı artırır ve her zorluk grubunu anlamlı bir milestone'a dönüştürür.

---

## Kurallar

### Başlangıç Durumu
- Tüm zorluk grupları kilitlidir.
- Sadece **Kolay #1** başlangıçta açıktır (tüm kullanıcılar için otomatik).

### İlerleme Kilidi Açma
- Bir bulmaca tamamlandığında, aynı zorluk grubundaki bir sonraki bulmaca (sort_order + 1) açılır.

### Çapraz Zorluk Kilidi Açma
- Bir zorluk grubundan **3 bulmaca tamamlanınca**, bir sonraki zorluk grubunda hiç açık bulmaca yoksa, o grubun **#1 bulmacası** otomatik açılır.
- Örnek: Kolay'dan 3 bulmaca → Orta #1 açılır.
- Sıralama: Kolay → Orta → Zor → Uzman

### Premium Bulmacalar
- Progression kilidinden **bağımsızdır**.
- Hem kilit açılmış hem de satın alınmış olması gerekir.
- Kilitli premium bulmaca: gri + kilit ikonu
- Açık premium bulmaca: renkli + taç (👑) ikonu

---

## Veri Modeli

### `levels.sort_order` (yeni sütun)
```sql
ALTER TABLE levels ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
```
- Her zorluk grubu içinde 1'den başlar (Kolay: 1,2,3... / Orta: 1,2,3...)
- Admin panelinden düzenlenebilir
- Mevcut bulmacalar `created_at ASC` sırasına göre backfill edildi

### `user_level_unlocks` (yeni tablo)
```sql
CREATE TABLE user_level_unlocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id    UUID,
  level_id    UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
- Hem authenticated kullanıcılar hem de guest'ler desteklenir
- Her satır = "bu kullanıcı bu bulmacayı oynayabilir"
- Guest → kullanıcı geçişinde `mergeGuestProgress` tarafından migrate edilir

---

## Backend Davranışı

### `listLevels` endpoint'i
- Seviyeleri `sort_order ASC` sırasıyla döndürür (artık `last_completed_first` yok)
- Her level'a `sort_order` ve `is_unlocked` alanları eklendi
- Kullanıcının hiç unlock'u yoksa → easy sort_order=1 otomatik açılır (idempotent upsert)

### `submitScore` endpoint'i
- Level tamamlanınca `triggerUnlocks()` çağrılır:
  1. Aynı zorlukta sort_order+1 → açılır
  2. Bu zorlukta tamamlanan sayısı ≥ 3 ve sonraki zorlukta 0 açık → sonraki zorluğun #1'i açılır
- Unlock hataları loglanır, ana flow'u kesmez

### `mergeGuestProgress` endpoint'i
- `user_progress` migration'ından sonra `user_level_unlocks` da migrate edilir
- `ignoreDuplicates: true` ile idempotent

---

## Frontend Değişiklikleri

### `LevelSummary` interface'i
```typescript
interface LevelSummary {
  id: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  is_premium: boolean;
  sort_order: number;    // difficulty içinde 1-tabanlı
  is_unlocked: boolean;  // false → oynamak için kilit açılmalı
  progress: { completed_at: string | null; time_spent: number } | null;
}
```

### Kutu Görsel Durumları (öncelik sırasıyla)

| Durum | Görünüm |
|-------|---------|
| Progression kilitli | Gri (#D1D1D6), opacity 0.65, kilit ikonu 🔒 |
| Premium kilitli (açık ama ücretli) | Renkli, taç ikonu 👑 |
| Tamamlandı | Renkli, opacity 0.6, checkmark ✓ |
| Devam ediyor | Renkli, kalın border |
| Başlanmamış | Renkli, temiz |

- Her kutunun **ortasında** `sort_order` numarası görünür
- Kilitli kutulara tıklamak hiçbir şey yapmaz (`onPress={undefined}`)

---

## Admin Paneli

- Bulmaca listesinde yeni **Sort** sütunu
- Sort değerine tıklanınca inline input açılır (Enter kaydet / Escape iptal)
- `PATCH /admin/puzzles/:id/sort-order` endpoint'i
- Unique constraint ihlali → 409 Conflict hatası

---

## Migration: `024_level_progression.sql`

Dosya: `backend/supabase/migrations/024_level_progression.sql`
