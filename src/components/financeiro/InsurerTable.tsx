'use client'

import * as React from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { deactivateInsurer } from '@/actions/insurers'

// Operadora status badge contract per UI-SPEC
const INSURER_STATUS: Record<string, { label: string; variant: 'secondary' | 'outline' }> = {
  ativo: { label: 'Ativo', variant: 'secondary' },
  em_negociacao: { label: 'Em negociação', variant: 'outline' },
  inativo: { label: 'Inativo', variant: 'outline' },
}

export interface InsurerRow {
  id: string
  name: string
  cnpj: string | null
  registro_ans: string | null
  tiss_version: string
  prazo_pagamento_dias: number
  status: string
  ativo: boolean
}

interface InsurerTableProps {
  insurers: InsurerRow[]
  onEdit?: (insurer: InsurerRow) => void
  canWrite: boolean
}

export function InsurerTable({ insurers, onEdit, canWrite }: InsurerTableProps) {
  const [deactivating, setDeactivating] = React.useState<string | null>(null)

  async function handleDeactivate(id: string) {
    setDeactivating(id)
    await deactivateInsurer(id)
    setDeactivating(null)
  }

  if (insurers.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma operadora cadastrada
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead>Registro ANS</TableHead>
          <TableHead>Versão TISS</TableHead>
          <TableHead className="text-right">Prazo (dias)</TableHead>
          <TableHead>Status</TableHead>
          {canWrite && <TableHead className="w-[50px]" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {insurers.map((ins) => {
          const s = INSURER_STATUS[ins.status] ?? { label: ins.status, variant: 'outline' as const }
          return (
            <TableRow key={ins.id}>
              <TableCell className="font-medium">{ins.name}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {ins.cnpj ?? '—'}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {ins.registro_ans ?? '—'}
              </TableCell>
              <TableCell className="tabular-nums">{ins.tiss_version}</TableCell>
              <TableCell className="text-right tabular-nums">{ins.prazo_pagamento_dias}</TableCell>
              <TableCell>
                <Badge variant={s.variant}>{s.label}</Badge>
              </TableCell>
              {canWrite && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="size-8" aria-label="Ações" />}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(ins)}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href={`/clinica/financeiro/faturamento/operadoras/${ins.id}/precos`} className="w-full">
                          Ver tabela de preços
                        </Link>
                      </DropdownMenuItem>
                      {ins.ativo && (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              />
                            }
                          >
                            Desativar
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Desativar operadora</AlertDialogTitle>
                              <AlertDialogDescription>
                                As guias existentes não serão afetadas. Novos faturamentos ficarão bloqueados para esta operadora.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeactivate(ins.id)}
                                disabled={deactivating === ins.id}
                              >
                                {deactivating === ins.id ? 'Desativando…' : 'Desativar'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
