-- =============================================================================
-- Seed: 002_simple_puzzle
-- Basit 4-soruluk Türkçe bulmaca – geliştirici testi için
--
-- Grid (4 satır × 4 sütun):
--      0    1    2    3
-- 0:  [K]  [A]  [L]  [E]   1Y: KALE  (kale = hisar, kale)
-- 1:  [O]  [█]  [█]  [S]
-- 2:  [M]  [A]  [S]  [A]   3Y: MASA  (masa = table)
-- 3:  [A]  [█]  [█]  [S]
--
-- Aşağı: 1A: KOMA (col 0), 2A: ESAS (col 3)
-- =============================================================================

DO $$
DECLARE
  v_level_id UUID := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  v_today    DATE := CURRENT_DATE;
BEGIN

  -- ── Seviyeyi ekle ──────────────────────────────────────────────────────────
  INSERT INTO levels (
    id, version, difficulty, is_premium,
    grid_json, clues_json, answer_hash, difficulty_multiplier
  )
  VALUES (
    v_level_id,
    1,
    'easy',
    false,

    -- grid_json
    jsonb_build_object(
      'rows', 4,
      'cols', 4,
      'cells', jsonb_build_array(
        -- Satır 0
        jsonb_build_object('row',0,'col',0,'type','letter','number',1),
        jsonb_build_object('row',0,'col',1,'type','letter'),
        jsonb_build_object('row',0,'col',2,'type','letter'),
        jsonb_build_object('row',0,'col',3,'type','letter','number',2),
        -- Satır 1
        jsonb_build_object('row',1,'col',0,'type','letter'),
        jsonb_build_object('row',1,'col',1,'type','black'),
        jsonb_build_object('row',1,'col',2,'type','black'),
        jsonb_build_object('row',1,'col',3,'type','letter'),
        -- Satır 2
        jsonb_build_object('row',2,'col',0,'type','letter','number',3),
        jsonb_build_object('row',2,'col',1,'type','letter'),
        jsonb_build_object('row',2,'col',2,'type','letter'),
        jsonb_build_object('row',2,'col',3,'type','letter'),
        -- Satır 3
        jsonb_build_object('row',3,'col',0,'type','letter'),
        jsonb_build_object('row',3,'col',1,'type','black'),
        jsonb_build_object('row',3,'col',2,'type','black'),
        jsonb_build_object('row',3,'col',3,'type','letter')
      )
    ),

    -- clues_json
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

    -- answer_hash: SHA-256(level_id || ':' || version || ':' || sorted_answers)
    -- String: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22:1:ESAS,KALE,KOMA,MASA'
    encode(
      digest(
        'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22:1:ESAS,KALE,KOMA,MASA',
        'sha256'
      ),
      'hex'
    ),

    1.0  -- easy için difficulty_multiplier
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Bugün + sonraki 30 gün için günlük bulmaca ata (local dev) ───────────
  FOR i IN 0..30 LOOP
    INSERT INTO daily_challenges (date, level_id, leaderboard_enabled)
    VALUES (v_today + i, v_level_id, true)
    ON CONFLICT (date) DO UPDATE
      SET level_id = EXCLUDED.level_id;
  END LOOP;

END $$;
