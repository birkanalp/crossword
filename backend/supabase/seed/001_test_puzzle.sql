-- =============================================================================
-- Seed: 001_test_puzzle
-- Turkish crossword puzzle for local development / testing
--
-- Grid (5 rows × 6 cols):
--      0    1    2    3    4    5
-- 0:  [█]  [K]  [A]  [L]  [E]  [M]   1Y: KALEM (kalem = pencil)
-- 1:  [█]  [A]  [S]  [A]  [█]  [A]
-- 2:  [█]  [R]  [K]  [M]  [█]  [S]
-- 3:  [█]  [M]  [E]  [B]  [█]  [A]
-- 4:  [█]  [A]  [R]  [A]  [Ç]  [█]   5Y: ARAÇ (araç = vehicle/tool)
--                                     1D: KARMA, 2D: ASKER, 3D: LAMBA, 4D: MASA
-- =============================================================================

-- Fixed UUID for reproducible local dev
DO $$
DECLARE
  v_level_id  UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  v_today     DATE := CURRENT_DATE;
BEGIN

  -- ── Insert level ──────────────────────────────────────────────────────────
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
      'rows', 5,
      'cols', 6,
      'cells', jsonb_build_array(
        -- Row 0
        jsonb_build_object('row',0,'col',0,'type','black'),
        jsonb_build_object('row',0,'col',1,'type','letter','number',1),
        jsonb_build_object('row',0,'col',2,'type','letter','number',2),
        jsonb_build_object('row',0,'col',3,'type','letter','number',3),
        jsonb_build_object('row',0,'col',4,'type','letter'),
        jsonb_build_object('row',0,'col',5,'type','letter','number',4),
        -- Row 1
        jsonb_build_object('row',1,'col',0,'type','black'),
        jsonb_build_object('row',1,'col',1,'type','letter'),
        jsonb_build_object('row',1,'col',2,'type','letter'),
        jsonb_build_object('row',1,'col',3,'type','letter'),
        jsonb_build_object('row',1,'col',4,'type','black'),
        jsonb_build_object('row',1,'col',5,'type','letter'),
        -- Row 2
        jsonb_build_object('row',2,'col',0,'type','black'),
        jsonb_build_object('row',2,'col',1,'type','letter'),
        jsonb_build_object('row',2,'col',2,'type','letter'),
        jsonb_build_object('row',2,'col',3,'type','letter'),
        jsonb_build_object('row',2,'col',4,'type','black'),
        jsonb_build_object('row',2,'col',5,'type','letter'),
        -- Row 3
        jsonb_build_object('row',3,'col',0,'type','black'),
        jsonb_build_object('row',3,'col',1,'type','letter'),
        jsonb_build_object('row',3,'col',2,'type','letter'),
        jsonb_build_object('row',3,'col',3,'type','letter'),
        jsonb_build_object('row',3,'col',4,'type','black'),
        jsonb_build_object('row',3,'col',5,'type','letter'),
        -- Row 4
        jsonb_build_object('row',4,'col',0,'type','black'),
        jsonb_build_object('row',4,'col',1,'type','letter','number',5),
        jsonb_build_object('row',4,'col',2,'type','letter'),
        jsonb_build_object('row',4,'col',3,'type','letter'),
        jsonb_build_object('row',4,'col',4,'type','letter'),
        jsonb_build_object('row',4,'col',5,'type','black')
      )
    ),

    -- clues_json
    jsonb_build_object(
      'across', jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'clue', 'Yazı yazmak veya çizmek için kullanılan alet',
          'answer_length', 5,
          'start', jsonb_build_object('row',0,'col',1)
        ),
        jsonb_build_object(
          'number', 5,
          'clue', 'Taşıt; alet ve gereç anlamına da gelir',
          'answer_length', 4,
          'start', jsonb_build_object('row',4,'col',1)
        )
      ),
      'down', jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'clue', 'Birbirine karışmış, birleşik',
          'answer_length', 5,
          'start', jsonb_build_object('row',0,'col',1)
        ),
        jsonb_build_object(
          'number', 2,
          'clue', 'Vatan savunmasında görevli er',
          'answer_length', 5,
          'start', jsonb_build_object('row',0,'col',2)
        ),
        jsonb_build_object(
          'number', 3,
          'clue', 'Elektrikle ışık veren cihaz',
          'answer_length', 5,
          'start', jsonb_build_object('row',0,'col',3)
        ),
        jsonb_build_object(
          'number', 4,
          'clue', 'Üzerinde çalışılan ya da yemek yenilen mobilya',
          'answer_length', 4,
          'start', jsonb_build_object('row',0,'col',5)
        )
      )
    ),

    -- answer_hash: SHA-256(level_id || ':' || version || ':' || sorted_answers)
    encode(
      digest(
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11:1:ARAÇ,ASKER,KALEM,KARMA,LAMBA,MASA',
        'sha256'
      ),
      'hex'
    ),

    1.0  -- difficulty_multiplier for easy
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Insert daily challenge for today ──────────────────────────────────────
  INSERT INTO daily_challenges (date, level_id, leaderboard_enabled)
  VALUES (v_today, v_level_id, true)
  ON CONFLICT (date) DO UPDATE
    SET level_id = EXCLUDED.level_id;

END $$;
