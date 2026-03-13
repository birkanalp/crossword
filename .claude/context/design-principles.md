# Bulmaca Admin – Design Principles

Project-specific design standards for all admin UI work. All redesigns and new components must conform to these standards.

---

## Color Tokens

### Background Hierarchy
```
--bg-base:      #0f0f14   /* page background */
--bg-surface:   #1a1a22   /* cards, panels */
--bg-elevated:  #22222c   /* dropdowns, hover states, modals */
--bg-active:    #2a3a4a   /* selected/active item */
```

### Border
```
--border:       #2a2a35   /* default border */
--border-focus: #6b9fff   /* focused input/selected */
--border-hover: #3a3a48   /* hover state */
```

### Text
```
--text-primary:   #e8e8ed   /* main text */
--text-secondary: #a0a0b0   /* labels, metadata, muted */
--text-tertiary:  #6a6a7a   /* placeholders, disabled */
--text-accent:    #6b9fff   /* links, interactive */
```

### Accent / Brand
```
--accent:         #6b9fff   /* primary blue */
--accent-dark:    #1e3a5f   /* blue background */
--accent-border:  #2a4a7f   /* blue border */
```

### Semantic Colors
```
--success:        #16a34a   /* approve, positive */
--success-bg:     #0d3d0d
--success-border: #1a5c1a
--error:          #dc2626   /* reject, destructive */
--error-bg:       #3d0d0d
--error-border:   #5c1a1a
--warning:        #d97706   /* pending, caution */
--warning-bg:     #3d3d00
--warning-border: #5c5c00
--info:           #6b9fff   /* informational */
--info-bg:        #1e3a5f
```

---

## Typography

Font family: `system-ui, -apple-system, sans-serif`

| Role | Size | Weight | Use |
|------|------|--------|-----|
| Display | 32px | 700 | Page titles (rare) |
| Heading 1 | 24px | 700 | Section headings |
| Heading 2 | 20px | 600 | Subsection headings |
| Heading 3 | 16px | 600 | Card titles, table headers |
| Body | 14px | 400 | Default text, labels |
| Small | 12px | 400 | Metadata, timestamps, badges |
| Micro | 11px | 500 | Uppercase labels |

Line height: `1.5` for body, `1.25` for headings

---

## Spacing Scale (Base-8 System)

```
4px   — micro gap (icon + label, inline elements)
8px   — small gap (form field gap, badge padding)
12px  — medium gap (card inner padding, list item gap)
16px  — base gap (section gap, button padding horizontal)
24px  — large gap (section separation, card padding)
32px  — xl gap (page section separation)
48px  — 2xl gap (hero/header padding)
```

---

## Border Radius

```
4px   — small tags/micro badges
6px   — small buttons, inputs
8px   — default: buttons, inputs, list items
12px  — cards, panels
16px  — large modals, overlays
```

---

## Component Patterns

### Cards
- Background: `--bg-surface` (#1a1a22)
- Border: `1px solid --border` (#2a2a35)
- Border radius: 12px
- Padding: 20px (content), 16px (compact)
- No shadow (dark theme — use border for depth)

### Buttons
| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | #6b9fff | #fff | none |
| Secondary | transparent | #a0a0b0 | 1px solid #444 |
| Danger | #dc2626 | #fff | none |
| Ghost | transparent | #6b9fff | 1px solid #2a4a7f |

Padding: `8px 16px` (md), `6px 12px` (sm), `12px 24px` (lg)
Border radius: 8px
Font weight: 600 for primary/danger, 400 for secondary/ghost

Disabled: `opacity: 0.5`, `cursor: not-allowed`

### Badges / Status Pills
| Status | Background | Text | Border |
|--------|-----------|------|--------|
| pending | #3d3d00 | #d97706 | 1px solid #5c5c00 |
| approved | #0d3d0d | #16a34a | 1px solid #1a5c1a |
| rejected | #3d0d0d | #dc2626 | 1px solid #5c1a1a |

Padding: `3px 8px`, border radius: 6px, font size: 12px, font weight: 500

### Form Inputs
- Background: `#1a1a22`
- Border: `1px solid #333`
- Border radius: 8px
- Padding: `10px 12px`
- Text: `#e8e8ed`
- Placeholder: `#6a6a7a`
- Focus ring: `outline: 2px solid #6b9fff`, `outline-offset: 1px`
- Error border: `1px solid #dc2626`

### Tables
- Header: `bg: #22222c`, `border-bottom: 1px solid #2a2a35`
- Row: hover `bg: #22222c`
- Row border: `border-bottom: 1px solid #2a2a35`
- Cell padding: `12px 16px`

### Sidebar Navigation
- Width: 240px
- Background: `#1a1a22`
- Border right: `1px solid #2a2a35`
- Active item: `bg: #2a3a4a`, `color: #6b9fff`, left border: `3px solid #6b9fff`
- Inactive item: `color: #a0a0b0`, hover `bg: #22222c`
- Item padding: `10px 16px`

---

## Layout Grid

- **Admin layout**: Sidebar (240px fixed) + Content area (flex-1)
- **Content max-width**: 1200px (centered in content area)
- **Content padding**: 24px
- **Dashboard metrics**: 4-column grid, `minmax(180px, 1fr)`, `gap: 16px`
- **Table**: Full width within content area

---

## Animation

- **Duration**: 150ms for micro-interactions (hover, focus), 200ms for transitions
- **Easing**: `ease-in-out` standard, `ease-out` for enter, `ease-in` for exit
- **Properties to animate**: `background-color`, `border-color`, `color`, `opacity`, `transform`
- **Never animate**: `width`, `height` (use `max-height` trick), `padding` (layout thrash)

---

## Accessibility (WCAG AA)

- Text contrast: minimum **4.5:1** for normal text, **3:1** for large text (18px+ or 14px bold)
- Interactive elements: minimum **44×44px** touch target
- Focus indicators: visible, not relying on color alone
- Form errors: announced via `aria-describedby`, not just color change
- Icon-only buttons: must have `aria-label`
- All images: `alt` attribute

---

## Language

- All UI strings in **Turkish**
- Difficulty labels: `Kolay` (easy), `Orta` (medium), `Zor` (hard), `Uzman` (expert)
- Status labels: `Onay bekleyen` (pending), `Onaylı` (approved), `Reddedilen` (rejected)
- Actions: `Onayla`, `Reddet`, `Düzenle`, `Kaydet`, `İptal`, `Çıkış`
