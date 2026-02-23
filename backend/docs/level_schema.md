# Level JSON Schema

## `grid_json`

```json
{
  "rows": 13,
  "cols": 13,
  "cells": [
    {
      "row": 0,
      "col": 0,
      "type": "letter",
      "number": 1
    },
    {
      "row": 0,
      "col": 1,
      "type": "black"
    }
  ]
}
```

### Cell fields

| Field    | Type             | Required | Notes                                       |
|---------|-----------------|---------|---------------------------------------------|
| `row`    | integer ≥ 0      | yes      | 0-indexed row position                      |
| `col`    | integer ≥ 0      | yes      | 0-indexed column position                   |
| `type`   | `"letter"\|"black"` | yes  | `black` = blocked cell, not playable        |
| `number` | integer ≥ 1      | no       | Clue number; only on first cell of a word   |

---

## `clues_json`

```json
{
  "across": [
    {
      "number": 1,
      "clue": "Capital of France",
      "answer_length": 5,
      "start": { "row": 0, "col": 0 }
    }
  ],
  "down": [
    {
      "number": 1,
      "clue": "Largest planet",
      "answer_length": 7,
      "start": { "row": 0, "col": 0 }
    }
  ]
}
```

### Clue fields

| Field           | Type    | Notes                                     |
|----------------|---------|-------------------------------------------|
| `number`        | integer | Matches the `number` on the starting cell |
| `clue`          | string  | Human-readable clue text                  |
| `answer_length` | integer | How many letters in the answer            |
| `start.row`     | integer | Row of first letter                       |
| `start.col`     | integer | Col of first letter                       |

---

## Answer Hash Computation (Server Only)

The `answer_hash` stored in the `levels` table is computed as:

```
canonical = level_id + ":" + version + ":" + answers_sorted_by_key.join(":")
hash      = lowercase hex SHA-256(canonical)
```

**Sorting rule**: answers keyed as `"<number><direction>"` (e.g. `"1A"`, `"1D"`, `"10A"`).
Sort numerically by number, then alphabetically by direction (A before D).

**Example canonical string**:
```
550e8400-e29b-41d4-a716-446655440000:1:PARIS:JUPITER:LONDON:MARS
```

This is computed and stored when a level is created. It is never returned to clients.
