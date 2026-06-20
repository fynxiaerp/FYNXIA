'use client'
// src/components/financeiro/ChartOfAccountsTree.tsx
// FCAD-01: Accordion-based recursive tree for chart_of_accounts.
// UI-SPEC: indent pl-{depth*6}, code font-mono, type badges, hover row actions.
// T-14-14: canEdit hides action buttons; admin-only controls (security gate is in Server Actions).

import { Pencil, Plus } from 'lucide-react'

import type { AccountNode } from '@/lib/financeiro/chart-tree'
import { AccountFormDialog, type AccountFlat } from './AccountFormDialog'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten the nested AccountNode tree to a flat list for parent selectors */
function flattenTree(nodes: AccountNode[]): AccountFlat[] {
  const result: AccountFlat[] = []
  function traverse(node: AccountNode) {
    result.push({ id: node.id, code: node.code, name: node.name, type: node.type })
    for (const child of node.children) {
      traverse(child)
    }
  }
  for (const node of nodes) {
    traverse(node)
  }
  return result
}

/** Collect all node IDs for defaultValue (all groups open by default) */
function collectGroupIds(nodes: AccountNode[]): string[] {
  const ids: string[] = []
  function traverse(node: AccountNode) {
    if (node.children.length > 0 || node.type === 'grupo') {
      ids.push(node.id)
    }
    for (const child of node.children) {
      traverse(child)
    }
  }
  for (const node of nodes) {
    traverse(node)
  }
  return ids
}

/** Compute indent class from depth — clamped at depth 2 (pl-12 max) */
function indentClass(depth: number): string {
  const clamped = Math.min(depth, 2)
  if (clamped === 0) return 'pl-0'
  if (clamped === 1) return 'pl-6'
  return 'pl-12'
}

/** Type badge color classes per UI-SPEC Color section */
function typeBadgeClass(type: 'grupo' | 'receita' | 'despesa'): string {
  if (type === 'receita') return 'text-green-700 dark:text-green-400'
  if (type === 'despesa') return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

function typeLabel(type: 'grupo' | 'receita' | 'despesa'): string {
  if (type === 'receita') return 'Receita'
  if (type === 'despesa') return 'Despesa'
  return 'Grupo'
}

// ─── Row anatomy shared between trigger and leaf ──────────────────────────────

interface RowContentProps {
  account: AccountNode
  canEdit: boolean
  allParents: AccountFlat[]
  isLeaf: boolean
}

function RowContent({ account, canEdit, allParents, isLeaf }: RowContentProps) {
  const { id, code, name, type, ativo, depth } = account

  return (
    <div
      className={`group flex h-10 w-full items-center gap-3 px-2 hover:bg-muted/50 transition-colors ${indentClass(depth)}`}
    >
      {/* Account code — font-mono, fixed width */}
      <span
        className="font-mono tabular-nums text-sm font-semibold text-muted-foreground w-20 shrink-0"
        aria-label={`Código ${code}`}
      >
        {code}
      </span>

      {/* Account name — semibold for groups, normal for leaves; strikethrough if inactive */}
      <span
        className={[
          'flex-1 text-sm truncate',
          isLeaf ? 'font-normal' : 'font-semibold',
          !ativo ? 'text-muted-foreground line-through' : 'text-foreground',
        ].join(' ')}
      >
        {name}
      </span>

      {/* Type badge */}
      <Badge
        variant="outline"
        className={`shrink-0 ${typeBadgeClass(type)}`}
      >
        {typeLabel(type)}
      </Badge>

      {/* Admin row actions — visible on hover only */}
      {canEdit && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
          {/* Edit button */}
          <AccountFormDialog
            mode="edit"
            account={{
              id,
              code,
              name,
              type,
              ativo,
              parent_id: account.parent_id,
            }}
            parents={allParents}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={`Editar ${code} — ${name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil className="size-3.5" />
              </Button>
            }
          />

          {/* Add child button — group rows only */}
          {!isLeaf && (
            <AccountFormDialog
              mode="create"
              parentId={id}
              parents={allParents}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={`Adicionar conta filha em ${code} — ${name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="size-3.5" />
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Recursive tree renderer ──────────────────────────────────────────────────

interface TreeNodesProps {
  nodes: AccountNode[]
  canEdit: boolean
  allParents: AccountFlat[]
}

function TreeNodes({ nodes, canEdit, allParents }: TreeNodesProps) {
  return (
    <>
      {nodes.map((node) => {
        const isLeaf = node.children.length === 0 && node.type !== 'grupo'

        if (isLeaf) {
          // Leaf node — plain div, no accordion expand affordance
          return (
            <div key={node.id} role="listitem">
              <RowContent
                account={node}
                canEdit={canEdit}
                allParents={allParents}
                isLeaf={true}
              />
            </div>
          )
        }

        // Group/parent node — AccordionItem
        return (
          <AccordionItem key={node.id} value={node.id} className="border-b-0">
            <AccordionTrigger
              className="py-0 hover:no-underline"
              aria-label={`Expandir ${node.code} — ${node.name}`}
            >
              <RowContent
                account={node}
                canEdit={canEdit}
                allParents={allParents}
                isLeaf={false}
              />
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <TreeNodes
                nodes={node.children}
                canEdit={canEdit}
                allParents={allParents}
              />
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </>
  )
}

// ─── ChartOfAccountsTree ──────────────────────────────────────────────────────

interface ChartOfAccountsTreeProps {
  accounts: AccountNode[]
  canEdit: boolean
}

export function ChartOfAccountsTree({ accounts, canEdit }: ChartOfAccountsTreeProps) {
  const allGroupIds = collectGroupIds(accounts)
  const allParents = flattenTree(accounts)

  if (accounts.length === 0) {
    return null
  }

  return (
    <Accordion
      multiple
      defaultValue={allGroupIds}
      className="w-full"
    >
      <TreeNodes
        nodes={accounts}
        canEdit={canEdit}
        allParents={allParents}
      />
    </Accordion>
  )
}
