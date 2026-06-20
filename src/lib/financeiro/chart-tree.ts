// src/lib/financeiro/chart-tree.ts
// FCAD-01: Pure tree helpers for chart_of_accounts adjacency list.
// NO 'use server' — importable from both client and server contexts.

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccountNodeFlat = {
  id: string
  parent_id: string | null
  code: string
  name: string
  type: 'grupo' | 'receita' | 'despesa'
  ativo: boolean
  depth: number
}

export type AccountNode = AccountNodeFlat & { children: AccountNode[] }

// ─── buildTree ────────────────────────────────────────────────────────────────
// Converts a flat adjacency list of AccountNodeFlat rows into a nested tree.
// Two-pass Map-based implementation:
//   Pass 1: build Map<id, AccountNode> initialising children: []
//   Pass 2: attach each node to its parent's children array, or to roots[]
//           if parent_id is null OR parent_id is not in the map (orphan-safe).
//
// Source: padrão canônico de buildTree para adjacency list (RESEARCH Code Example)

export function buildTree(rows: AccountNodeFlat[]): AccountNode[] {
  const map = new Map<string, AccountNode>()

  // Pass 1: populate map
  for (const row of rows) {
    map.set(row.id, { ...row, children: [] })
  }

  const roots: AccountNode[] = []

  // Pass 2: wire children or add as root
  for (const row of rows) {
    const node = map.get(row.id)!
    if (row.parent_id !== null && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(node)
    } else {
      // null parent OR orphan (parent_id not in map) → treat as root
      roots.push(node)
    }
  }

  return roots
}

// ─── nextChildCode ────────────────────────────────────────────────────────────
// Computes the code for a new child account given:
//   parentCode    — the code of the parent account (or null for root level)
//   siblingCount  — number of existing siblings (accounts already at this level)
//
// Examples:
//   nextChildCode('1.1', 2) → '1.1.3'   (3rd child of 1.1 — 0-indexed count)
//   nextChildCode('2.1', 0) → '2.1.1'   (1st child of 2.1)
//   nextChildCode(null, 1)  → '2'        (2nd root-level account)
//   nextChildCode(null, 0)  → '1'        (1st root-level account)

export function nextChildCode(parentCode: string | null, siblingCount: number): string {
  const nextIndex = siblingCount + 1
  if (parentCode === null) {
    return String(nextIndex)
  }
  return `${parentCode}.${nextIndex}`
}
