-- =============================================================================
-- Seed: Onay bekleyen bulmaca (admin panel testi için)
--
-- Grid (4 satır × 4 sütun):
--      0    1    2    3
-- 0:  [S]  [U]  [N]  [İ]   1Y: SUNİ  (yapay)
-- 1:  [E]  [█]  [█]  [L]
-- 2:  [R]  [N]  [E]  [K]   3Y: RNEK  -> ÖRNEK (örnek)
-- 3:  [İ]  [█]  [█]  [E]
--
-- Aşağı: 1A: SERİ (col 0), 2A: UNİE -> UNİ (col 3)
-- Düzeltme: Gerçek kelimeler kullanalım
-- 1Y: SUNİ (0,0), 2Y: NEL (1,1) - hayır, black var
-- 1Y: SUNİ (0,0), 2Y: İLE (3,0) - hayır
--
-- Basit grid: SUNİ (yatay 0), SERİ (dikey 0), NEL? -> NERİ? 
-- Daha basit: 4 kelime - SUNA, SERİ, NERİ, AİLE gibi
--
-- Yeniden:
-- 0: S U N İ   -> 1Y SUNİ
-- 1: E █ █ L   -> 2Y (col 3) EL? -> İLE (col 3 down)
-- 2: R N E K   -> 3Y RNEK (örnek)
-- 3: İ █ █ E
--
-- 1A: SERİ (0,0), 2A: UNİ (0,1)? hayır - 1,1 black. 2A: İLE (0,3)
-- Kelimeler: SUNİ, SERİ, İLE, RNEK (ÖRNEK) - RNEK 4 harf, ÖRNEK 5. Kısalım: NEKE?
-- ÖRNEK = 5 harf. 4x4 grid için 4 harfli kelimeler: SUNİ, SERİ, İLE, ??? 
-- İLE 3 harf. NEL 3 harf.
--
-- Basit 4x4:
-- SUNİ (row 0), SERİ (col 0), İLE (col 3), NERİ (row 2) - NERİ? 
-- NERE (4 harf) - row 2: N E R E
-- 0: S U N İ
-- 1: E █ █ L  
-- 2: N E R E
-- 3: İ █ █ E
-- 1Y SUNİ, 2Y NERE, 1A SERİ, 2A İLE - İLE 3 harf (row 0 col 3 to row 2 col 3 = S, L, E) -> SİLE? 4 harf
-- SİLE: row 0 col 3 = İ, row 1 col 3 = L, row 2 col 3 = E, row 3 col 3 = ? 
-- İLE = 3 harf. Col 3: İ, L, E = 3 cells. Row 3 col 3 = E (NERE sonu). O zaman İLEN? Hayır.
--
-- En basit: KALE, KOMA, MASA, ESAS (002'deki gibi) - sadece farklı ID ve review_status=pending
-- =============================================================================

DO $$
DECLARE
  v_level_id UUID := 'c2ffcd00-0a1c-5f19-cc7e-7cc0ce491b33';
  v_answers  TEXT := 'ESAS,KALE,KOMA,MASA';
  v_hash_str TEXT;
  v_sol_hash TEXT;
BEGIN
  v_hash_str := v_level_id::text || ':1:' || v_answers;
  v_sol_hash := encode(digest(v_hash_str, 'sha256'), 'hex');

  INSERT INTO levels (
    id,
    version,
    difficulty,
    target_difficulty,
    computed_difficulty_score,
    language,
    grid_size,
    word_count,
    words_breakdown,
    quality_score,
    grid_json,
    clues_json,
    answer_hash,
    solution_hash,
    auto_generated,
    review_status,
    is_premium,
    difficulty_multiplier
  )
  VALUES (
    v_level_id,
    1,
    'easy',
    'easy',
    25.0,
    'tr',
    4,
    4,
    '{"easy": 4}'::jsonb,
    60,
    jsonb_build_object(
      'rows', 4,
      'cols', 4,
      'cells', jsonb_build_array(
        jsonb_build_object('row',0,'col',0,'type','letter','number',1),
        jsonb_build_object('row',0,'col',1,'type','letter'),
        jsonb_build_object('row',0,'col',2,'type','letter'),
        jsonb_build_object('row',0,'col',3,'type','letter','number',2),
        jsonb_build_object('row',1,'col',0,'type','letter'),
        jsonb_build_object('row',1,'col',1,'type','black'),
        jsonb_build_object('row',1,'col',2,'type','black'),
        jsonb_build_object('row',1,'col',3,'type','letter'),
        jsonb_build_object('row',2,'col',0,'type','letter','number',3),
        jsonb_build_object('row',2,'col',1,'type','letter'),
        jsonb_build_object('row',2,'col',2,'type','letter'),
        jsonb_build_object('row',2,'col',3,'type','letter'),
        jsonb_build_object('row',3,'col',0,'type','letter'),
        jsonb_build_object('row',3,'col',1,'type','black'),
        jsonb_build_object('row',3,'col',2,'type','black'),
        jsonb_build_object('row',3,'col',3,'type','letter')
      )
    ),
    jsonb_build_object(
      'across', jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'clue', 'Surlarla çevrili tarihi savunma yapısı',
          'answer_length', 4,
          'answer', 'KALE',
          'start', jsonb_build_object('row',0,'col',0)
        ),
        jsonb_build_object(
          'number', 3,
          'clue', 'Üzerinde yemek yenen veya çalışılan mobilya',
          'answer_length', 4,
          'answer', 'MASA',
          'start', jsonb_build_object('row',2,'col',0)
        )
      ),
      'down', jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'clue', 'Derin bilinçsizlik hali; tıbbi terim',
          'answer_length', 4,
          'answer', 'KOMA',
          'start', jsonb_build_object('row',0,'col',0)
        ),
        jsonb_build_object(
          'number', 2,
          'clue', 'Temel, asıl, ana',
          'answer_length', 4,
          'answer', 'ESAS',
          'start', jsonb_build_object('row',0,'col',3)
        )
      )
    ),
    v_sol_hash,
    v_sol_hash,
    true,
    'pending',
    false,
    1.0
  )
  ON CONFLICT (id) DO UPDATE SET
    review_status = 'pending',
    review_notes = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

END $$;
