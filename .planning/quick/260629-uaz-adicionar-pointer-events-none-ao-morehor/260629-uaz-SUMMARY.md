# Quick Task 260629-uaz — Summary

**Task:** Adicionar pointer-events-none ao MoreHorizontal icon em PayablesTable.tsx
**Status:** Complete
**Commit:** 2189958

## What was done

Added `pointer-events-none` to the `className` of both `<MoreHorizontal>` icon instances
in `src/components/financeiro/PayablesTable.tsx`:

- Line 228: branch `!canWrite` trigger icon
- Line 252: `PayableRowActions` main branch trigger icon

**Before:** `<MoreHorizontal className="size-4" />`
**After:** `<MoreHorizontal className="size-4 pointer-events-none" />`

## Why

The SVG `<circle>` elements of the MoreHorizontal icon were intercepting
`document.elementFromPoint()` at the button center. CDP-based automation tools
failed with "element did not become interactive". With `pointer-events-none`
on the SVG, mouse events pass through to the parent `<button>`. No behavioral
change — decorative icons should not capture pointer events.

## Files changed

- `src/components/financeiro/PayablesTable.tsx` — 2 lines (className only)
