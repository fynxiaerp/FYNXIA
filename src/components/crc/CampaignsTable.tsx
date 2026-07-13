'use client'

// CampaignsTable — reactivation campaigns list (CRC-03, D-07..D-11).
// Row actions wire directly to Plan 05 Server Actions:
//   Ver Detalhes  -> CampaignFormDialog mode="view" (read-only)
//   Editar        -> CampaignFormDialog mode="edit" -> updateCampaign (rascunho-only,
//                     also CAS-guarded server-side)
//   Enviar para Aprovação -> submitCampaignForApproval (rascunho only)
//   Cancelar      -> cancelCampaign (rascunho/aguardando_aprovacao only)
// DropdownMenuTrigger uses render-prop + MoreHorizontal pointer-events-none
// (mandatory project convention — quick task 260629-uaz).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MoreHorizontal } from 'lucide-react'

import { submitCampaignForApproval, cancelCampaign } from '@/actions/campaigns'
import { CampaignFormDialog } from '@/components/crc/CampaignFormDialog'
import type { CampaignRow } from '@/components/crc/CampaignFormDialog'

export type { CampaignRow } from '@/components/crc/CampaignFormDialog'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'enviada'
  | 'rejeitada'
  | 'cancelada'

interface UnitOption {
  id: string
  name: string
}

interface ServiceOption {
  id: string
  name: string
}

interface CampaignsTableProps {
  campaigns: CampaignRow[]
  units: UnitOption[]
  services: ServiceOption[]
}

// ─── Status badge mapping (18-UI-SPEC §4) ─────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'rascunho':
      return <Badge variant="secondary">Rascunho</Badge>
    case 'aguardando_aprovacao':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Aguardando Aprovação
        </Badge>
      )
    case 'aprovada':
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          Aprovada
        </Badge>
      )
    case 'enviada':
      return <Badge variant="default">Enviada</Badge>
    case 'rejeitada':
      return <Badge variant="destructive">Rejeitada</Badge>
    case 'cancelada':
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          Cancelada
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function ChannelBadges({ campaign }: { campaign: CampaignRow }) {
  if (campaign.channel_whatsapp && campaign.channel_email) {
    return <Badge variant="outline">WhatsApp + E-mail</Badge>
  }
  if (campaign.channel_whatsapp) {
    return <Badge variant="outline">WhatsApp</Badge>
  }
  if (campaign.channel_email) {
    return <Badge variant="outline">E-mail</Badge>
  }
  return <span className="text-muted-foreground">—</span>
}

function SegmentSummary({ campaign }: { campaign: CampaignRow }) {
  const filters = campaign.filters
  const extraBadges: string[] = []
  if (filters?.lastProcedureServiceId) extraBadges.push('Procedimento')
  if (filters?.ageMin != null || filters?.ageMax != null) extraBadges.push('Faixa etária')
  if (filters?.unitId) extraBadges.push('Unidade')

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm">Inativos há {campaign.inactive_days}+ dias</span>
      {extraBadges.map((label) => (
        <Badge key={label} variant="outline" className="text-xs">
          {label}
        </Badge>
      ))}
    </div>
  )
}

// ─── Cancel confirmation ───────────────────────────────────────────────────────

function CancelCampaignDialog({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleCancel() {
    setError(null)
    setIsPending(true)
    const result = await cancelCampaign(campaignId)
    setIsPending(false)
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? 'Erro ao cancelar campanha')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => e.preventDefault()}
          />
        }
      >
        Cancelar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Campanha</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. A campanha será marcada como cancelada e não poderá mais ser
            enviada para aprovação.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Manter</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? 'Cancelando...' : 'Cancelar Campanha'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Submit-for-approval confirmation (row action — Copywriting Contract) ─────

function SubmitForApprovalDialog({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit() {
    setError(null)
    setIsPending(true)
    const result = await submitCampaignForApproval(campaignId)
    setIsPending(false)
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? 'Erro ao enviar campanha para aprovação')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<DropdownMenuItem onSelect={(e) => e.preventDefault()} />}>
        Enviar para Aprovação
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar campanha para aprovação</AlertDialogTitle>
          <AlertDialogDescription>
            A campanha será personalizada por IA e enviada para aprovação antes do disparo em massa. Nenhuma
            mensagem sai sem aprovação humana.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Enviando...' : 'Enviar para Aprovação'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Row actions ────────────────────────────────────────────────────────────

function CampaignRowActions({
  campaign,
  units,
  services,
}: {
  campaign: CampaignRow
  units: UnitOption[]
  services: ServiceOption[]
}) {
  const isRascunho = campaign.status === 'rascunho'
  const canCancel = campaign.status === 'rascunho' || campaign.status === 'aguardando_aprovacao'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Ações para a campanha ${campaign.name}`}
          />
        }
      >
        <MoreHorizontal className="size-4 pointer-events-none" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <CampaignFormDialog mode="view" campaign={campaign} units={units} services={services}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Ver Detalhes</DropdownMenuItem>
        </CampaignFormDialog>

        {isRascunho && (
          <CampaignFormDialog mode="edit" campaign={campaign} units={units} services={services}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>
          </CampaignFormDialog>
        )}

        {isRascunho && <SubmitForApprovalDialog campaignId={campaign.id} />}

        {canCancel && <CancelCampaignDialog campaignId={campaign.id} />}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── CampaignsTable ────────────────────────────────────────────────────────────

export function CampaignsTable({ campaigns, units, services }: CampaignsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Segmento</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Destinatários</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead className="w-10">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                Nenhuma campanha encontrada.
              </TableCell>
            </TableRow>
          ) : (
            campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium text-sm">{campaign.name}</TableCell>
                <TableCell>
                  <SegmentSummary campaign={campaign} />
                </TableCell>
                <TableCell>
                  <ChannelBadges campaign={campaign} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={campaign.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {campaign.recipient_count ?? '—'}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {format(parseISO(campaign.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <CampaignRowActions campaign={campaign} units={units} services={services} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
