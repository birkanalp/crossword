---
name: rn-svg-crossword-grid
description: Implements performant crossword grid using react-native-svg.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# React Native SVG Crossword Grid

You are implementing a high-performance crossword grid component using `react-native-svg` for a crossword puzzle mobile game built with Expo.

## Step 1 — Read Level Schema

Read `CONTRACTS/level.schema.json` to understand the grid data shape (dimensions, cells, clues, blocked cells, etc.). All component types must align with this schema.

## Step 2 — Build `<CrosswordGrid />` Component

Create or update `frontend/src/components/grid/CrosswordGrid.tsx`.

### Props API

Design a clean, minimal props interface:

```ts
interface CrosswordGridProps {
  /** Grid dimensions */
  rows: number;
  cols: number;
  /** Cell data indexed by "row,col" key */
  cells: Map<string, CellData>;
  /** Currently active cell coordinates */
  activeCell: { row: number; col: number } | null;
  /** Current input direction */
  direction: 'across' | 'down';
  /** Cells belonging to the active word (for highlighting) */
  activeWordCells: Set<string>;
  /** User-entered letters indexed by "row,col" */
  userInput: Map<string, string>;
  /** Callback when a cell is tapped */
  onCellPress: (row: number, col: number) => void;
  /** Optional: revealed/checked cells for visual feedback */
  revealedCells?: Set<string>;
  incorrectCells?: Set<string>;
}
```

Adjust as needed based on the actual level schema, but keep the surface area small. Do NOT accept the entire game store as props — only accept the data the grid needs to render.

### SVG Structure

- Use `<Svg>` as the root with a computed `viewBox` based on `rows * cellSize` and `cols * cellSize`.
- Each cell is a `<G>` group containing:
  - `<Rect>` for the cell background (white for open, dark for blocked).
  - `<Text>` for the user's entered letter (centered).
  - `<Text>` for the clue number (top-left, smaller font).
- Active cell gets a distinct fill color.
- Active word cells get a lighter highlight fill.
- Incorrect cells get a subtle error indicator.

## Step 3 — Interaction Handling

### Cell Tap
- Attach `onPress` to each cell's `<Rect>` (or wrap in `<G onPress>`).
- Call `onCellPress(row, col)`.
- The parent component handles direction toggling (tap same cell = switch direction).

### Direction Switching
- The grid itself does NOT manage direction state.
- It receives `direction` and `activeWordCells` as props — the parent (game screen or store) computes these.

### Clue Selection
- When a clue is tapped externally, the parent updates `activeCell` and `activeWordCells`.
- The grid simply re-renders the affected cells.

## Step 4 — Active Word Highlighting

- Cells in `activeWordCells` set get a highlight fill (e.g., light blue).
- The `activeCell` itself gets a stronger highlight (e.g., deeper blue).
- Blocked cells are always dark and non-interactive.
- Use distinct colors so the hierarchy is clear: **active cell > active word > normal > blocked**.

## Step 5 — Prevent Full-Grid Rerenders

This is critical for performance. A 15x15 grid has 225 cells — re-rendering all of them on every keystroke is unacceptable.

### Strategy

1. **Extract `<GridCell />` as a separate memoized component.**
   - File: `frontend/src/components/grid/GridCell.tsx`
   - Wrap with `React.memo()` with a custom comparison function.
   - A cell only re-renders when its own data changes:
     - `userInput` letter changed
     - `isActive` changed (became or stopped being the active cell)
     - `isInActiveWord` changed
     - `isRevealed` or `isIncorrect` changed

2. **Use stable references.**
   - `onCellPress` must be a stable callback (wrapped in `useCallback` in the parent, or passed as a single handler that takes row/col).
   - Do NOT create new closures per cell inside the map loop.

3. **Derive per-cell props outside the render loop** where possible, or compute them with minimal overhead inside.

### `GridCell` Props

```ts
interface GridCellProps {
  row: number;
  col: number;
  cellSize: number;
  letter: string;         // user's entered letter or ''
  solution?: string;      // only if revealed
  clueNumber?: number;
  isBlocked: boolean;
  isActive: boolean;
  isInActiveWord: boolean;
  isRevealed: boolean;
  isIncorrect: boolean;
  onPress: (row: number, col: number) => void;
}
```

## Step 6 — Memoize Cells

- `GridCell` must be wrapped in `React.memo` with a shallow comparison that covers all props.
- If the grid data shape allows it, consider using `useMemo` to precompute the cell props array so React can bail out of the parent render early.
- Avoid creating new objects/arrays in render that would break memoization:
  - BAD: `isActive={activeCell?.row === row && activeCell?.col === col}` creates no issue, but `style={{ fill: ... }}` inline objects DO.
  - Precompute fill colors as constants or use a lookup.

## Step 7 — Clean Props API

Final checklist for the public API:

- [ ] No game logic inside the grid component — it's a pure rendering layer.
- [ ] All state derivation (active word computation, direction logic) lives in the parent or store.
- [ ] The component accepts only what it needs to render.
- [ ] Exported types (`CrosswordGridProps`, `CellData`, `GridCellProps`) are in a separate `types.ts` file.
- [ ] The component handles edge cases: empty grid, single row/column, no active cell.

## Step 8 — Update Status

Update `CONTRACTS/status.frontend.md` with:
- `CrosswordGrid` component status.
- `GridCell` memoization status.
- Interaction handling status.
- Performance notes.
- Any open TODOs.

## Rules

- **Performance first.** Every decision should favor fewer rerenders and less GC pressure.
- **No unnecessary state duplication.** The grid does not keep its own copy of game state. It renders from props.
- **No game logic in the grid.** Word computation, validation, scoring — all external.
- Use `react-native-svg` primitives (`Svg`, `G`, `Rect`, `Text`, `Line`). Do not use `<View>` or `<TouchableOpacity>` inside the SVG tree.
- Keep the component tree flat where possible — avoid deep nesting of SVG groups.
- Test on both iOS and Android — SVG text rendering can differ.

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/rn-svg-crossword-grid cell` for GridCell only).
