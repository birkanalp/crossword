---
name: rn-performance-audit
description: Analyzes React Native rendering performance and prevents unnecessary re-renders.
disable-model-invocation: true
argument-hint: <optional-component-or-directory>
---

# React Native Performance Audit

You are auditing React Native component rendering performance in a crossword puzzle mobile game built with Expo. Your goal is to identify and fix unnecessary re-renders without changing behavior.

## Step 1 — Detect Heavy Components

Scan the component tree (default: `frontend/src/components/` and `frontend/app/`) for components that are likely performance bottlenecks:

- Components rendering large lists or grids (especially the crossword grid).
- Components with many children or deep nesting.
- Components that subscribe to broad store slices.
- Components using `useContext` with frequently-changing contexts.

For each heavy component, report:
- File path and component name.
- Estimated render cost (number of child elements, SVG nodes, etc.).
- How often it likely re-renders (based on its dependencies).

## Step 2 — Suggest Memoization

For each component that re-renders unnecessarily, recommend specific fixes:

### `React.memo`
- Identify components that receive the same props but re-render because the parent re-renders.
- Suggest wrapping with `React.memo()` and specify a custom comparator if needed.
- Flag components where `React.memo` would NOT help (e.g., props always change).

### `useMemo` / `useCallback`
- Find expensive computations inside render bodies that could be memoized.
- Find callback functions created on every render that break child memoization.
- Suggest `useMemo` for derived data and `useCallback` for event handlers.

### Zustand Selectors
- Find `useGameStore()` calls without selectors (subscribing to the entire store).
- Suggest narrow selectors: `useGameStore(s => s.specificField)`.
- Flag selectors that return new object references on every call.

## Step 3 — Detect State Duplication

Look for patterns where the same data exists in multiple places:

- Component local state that duplicates store state.
- Props drilled through multiple levels that could be read from the store directly.
- Multiple `useState` calls that could be a single object (or vice versa — a single object that causes re-renders when only one field changes).
- Derived state stored in state instead of computed on read.

For each duplication, explain:
- What is duplicated.
- Where the source of truth should be.
- How to eliminate the duplication.

## Step 4 — Detect Expensive Computations in Render

Find patterns in render functions that are costly:

- **Inline object/array creation**: `style={{ ... }}`, `data={[...items]}` — these create new references every render.
- **Inline functions in JSX**: `onPress={() => handlePress(id)}` — creates a new closure every render.
- **Array operations in render**: `.filter()`, `.map()`, `.sort()` on large arrays without `useMemo`.
- **JSON serialization**: `JSON.stringify` used for keys or comparisons in render.
- **Regex creation**: `new RegExp()` inside render.

## Step 5 — Performance Report

Output a structured report:

```markdown
# Performance Audit Report

## Critical Issues (fix immediately)
1. [Component] — [Issue] — [Fix]

## Warnings (fix for smooth experience)
1. [Component] — [Issue] — [Fix]

## Suggestions (nice to have)
1. [Component] — [Issue] — [Fix]

## Summary
- Components audited: N
- Critical issues: N
- Warnings: N
- Suggestions: N
```

Prioritize issues by impact:
- **Critical**: Causes visible jank or frame drops (e.g., full grid re-render on keystroke).
- **Warning**: Wastes CPU but may not be user-visible (e.g., unnecessary list re-renders).
- **Suggestion**: Minor optimization (e.g., memoizing a small computation).

## Step 6 — Update Status

Update `CONTRACTS/status.frontend.md` with:
- Date of last audit.
- Number of issues found by severity.
- Which components were optimized.
- Any open TODOs.

## Rules

- **Do not change behavior.** Every optimization must produce identical output. If unsure whether a change is safe, flag it as a suggestion, don't apply it.
- **Only optimize safely.** Memoization bugs (stale closures, missing dependencies) are worse than re-renders. When in doubt, leave it.
- Do not add `React.memo` to components that genuinely need to re-render on every parent render.
- Do not prematurely optimize components that render infrequently (e.g., settings screen).
- Focus on hot paths: the crossword grid, keyboard input, and any component that updates on every keystroke or gesture.

If `$ARGUMENTS` is provided, audit only that component or directory (e.g., `/rn-performance-audit CrosswordGrid` or `/rn-performance-audit frontend/src/components/grid`).
