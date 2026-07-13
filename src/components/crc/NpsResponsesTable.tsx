'use client'

// NpsResponsesTable — recent NPS responses (CRC-04). Classification badge via
// classifyNps (already applied server-side in listNpsResponses -> bucket).
// Status column ("Pendente"/"Tratado" + "Marcar como Tratado") only renders
// for detractor rows (D-15) -> markDetractorTreated. DropdownMenuTrigger uses
// render-prop + MoreHorizontal pointer-events-none (mandatory project
// convention — quick task 260629-uaz).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MoreHorizontal } from 'lucide-react'

import { markDetractorTreated } from '@/actions/nps'
import type { NpsResponseRow } from '@/actions/nps'

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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface NpsResponsesTableProps {
  responses: NpsResponseRow[]
}

// ─── Classification badge (UI-SPEC §Color) ────────────────────────────────────

function BucketBadge({ bucket }: { bucket: NpsResponseRow['bucket'] }) {
  switch (bucket) {
    case 'promotor':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Promotor
        </Badge>
      )
    case 'neutro':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Neutro
        </Badge>
      )
    case 'detrator':
      return <Badge variant="destructive">Detrator</Badge>
  }
}

// ─── Comment cell (truncate 2 lines, Popover to expand) ───────────────────────

function CommentCell({ comment }: { comment: string | null }) {
  if (!comment) return <span className="text-muted-foreground">—</span>

  if (comment.length <= 80) {
    return <p className="text-sm max-w-xs line-clamp-2">{comment}</p>
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="text-sm max-w-xs text-left line-clamp-2 underline decoration-dotted underline-offset-2"
          />
        }
      >
        {comment}
      </PopoverTrigger>
      <PopoverContent className="max-w-sm">
        <p className="text-sm whitespace-pre-wrap">{comment}</p>
      </PopoverContent>
    </Popover>
  )
}

// ─── Detractor status cell (D-15) ──────────────────────────────────────────────

function DetractorStatusCell({ response }: { response: NpsResponseRow }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (response.bucket !== 'detrator') {
    return <span className="text-muted-foreground">—</span>
  }

  const isTreated = response.detractorTreatedAt !== null

  async function handleMarkTreated() {
    setError(null)
    setIsPending(true)
    const result = await markDetractorTreated(response.id)
    setIsPending(false)
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? 'Erro ao marcar como tratado')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {isTreated ? (
          <Badge variant="secondary">Tratado</Badge>
        ) : (
          <>
            <Badge variant="destructive">Pendente</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Ações para a avaliação de ${response.patientName}`}
                  />
                }
              >
                <MoreHorizontal className="size-4 pointer-events-none" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={isPending} onSelect={() => void handleMarkTreated()}>
                  Marcar como Tratado
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── NpsResponsesTable ──────────────────────────────────────────────────────────

export function NpsResponsesTable({ responses }: NpsResponsesTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            <TableHead>Nota</TableHead>
            <TableHead>Comentário</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Nenhuma resposta encontrada para os filtros selecionados.
              </TableCell>
            </TableRow>
          ) : (
            responses.map((response) => (
              <TableRow key={response.id}>
                <TableCell className="font-medium text-sm">{response.patientName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{response.score}</span>
                    <BucketBadge bucket={response.bucket} />
                  </div>
                </TableCell>
                <TableCell>
                  <CommentCell comment={response.comment} />
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {format(parseISO(response.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <DetractorStatusCell response={response} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
