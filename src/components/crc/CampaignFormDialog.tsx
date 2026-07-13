'use client'

// CampaignFormDialog — 3-step reactivation campaign builder (CRC-03, D-07/D-08/D-09).
// Internal shadcn Tabs (NOT a route wizard): Passo 1 "Segmento" -> Passo 2 "Canal e
// Mensagem" -> Passo 3 "Revisão e Envio". Trigger-wrapper convention mirrors
// LeadFormDialog/LeadSourceManager (`children` opens the Dialog on click).
//
// SAFETY-CRITICAL (T-18-28 / D-09 EoP threat): this dialog NEVER calls
// approveCampaignAndDispatch — the only outbound action from Passo 3 is
// submitCampaignForApproval, which creates an approval_requests row and moves
// the campaign to 'aguardando_aprovacao'. Dispatch happens exclusively from the
// approval inbox (ApprovalInbox.tsx), after a human approves.
//
// campaignId lifecycle: undefined until the first "Pré-visualizar Segmento"
// click, which calls createCampaign() (mode="create") once, then reuses the
// same id for every subsequent updateCampaign/previewCampaignSegment/
// requestCampaignPersonalization/submitCampaignForApproval call. In
// mode="edit"/"view" the id is seeded from the campaign prop and createCampaign
// is never called.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ShieldCheck } from 'lucide-react'

import {
  createCampaign,
  updateCampaign,
  previewCampaignSegment,
  requestCampaignPersonalization,
  submitCampaignForApproval,
} from '@/actions/campaigns'
import { campaignSegmentSchema, campaignChannelSchema } from '@/lib/validators/crc'
import type { CampaignSegmentInput } from '@/lib/validators/crc'
import { SegmentPreview } from '@/components/crc/SegmentPreview'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Shared row type (also used by CampaignsTable) ────────────────────────────

export interface CampaignRow {
  id: string
  name: string
  status: string
  channel_whatsapp: boolean
  channel_email: boolean
  inactive_days: number
  filters: CampaignSegmentInput | null
  recipient_count: number | null
  preview_message: string | null
  approval_request_id: string | null
  created_at: string
}

interface UnitOption {
  id: string
  name: string
}

interface ServiceOption {
  id: string
  name: string
}

interface CampaignFormDialogProps {
  mode: 'create' | 'edit' | 'view'
  campaign?: CampaignRow
  units: UnitOption[]
  services: ServiceOption[]
  children: React.ReactNode
}

// ─── Form schema (mirrors campaignInputSchema in actions/campaigns.ts — that
// file is 'use server' and cannot export a non-async const, D-133 pattern) ────

const campaignFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(120, 'Nome muito longo'),
  segment: campaignSegmentSchema,
  channel: campaignChannelSchema,
})

type CampaignFormValues = z.infer<typeof campaignFormSchema>

type Step = 'segmento' | 'canal' | 'revisao'

function defaultValues(campaign?: CampaignRow): CampaignFormValues {
  return {
    name: campaign?.name ?? '',
    segment: {
      inactiveDays: campaign?.inactive_days ?? campaign?.filters?.inactiveDays ?? 90,
      lastProcedureServiceId: campaign?.filters?.lastProcedureServiceId,
      ageMin: campaign?.filters?.ageMin,
      ageMax: campaign?.filters?.ageMax,
      unitId: campaign?.filters?.unitId,
    },
    channel: {
      whatsapp: campaign?.channel_whatsapp ?? true,
      email: campaign?.channel_email ?? false,
    },
  }
}

/**
 * Builds 2-3 read-only chat-bubble previews from a single AI-generated message
 * by substituting the primary sample's first name with the other sample names
 * (first-name-only personalization, D-09/LGPD-ZDR — no additional LLM calls).
 */
function buildPreviewBubbles(
  message: string,
  primaryName: string,
  sampleNames: string[]
): string[] {
  const names = sampleNames.length > 0 ? sampleNames.slice(0, 3) : [primaryName]
  return names.map((name) => (primaryName ? message.split(primaryName).join(name) : message))
}

export function CampaignFormDialog({
  mode,
  campaign,
  units,
  services,
  children,
}: CampaignFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('segmento')
  const [campaignId, setCampaignId] = useState<string | undefined>(campaign?.id)
  const [serverError, setServerError] = useState<string | null>(null)

  const [previewCount, setPreviewCount] = useState<number | null>(campaign?.recipient_count ?? null)
  const [sampleNames, setSampleNames] = useState<string[]>([])
  const [personalizationPreview, setPersonalizationPreview] = useState<string | null>(
    campaign?.preview_message ?? null
  )

  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isPersonalizing, setIsPersonalizing] = useState(false)
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false)

  const readOnly = mode === 'view'

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: defaultValues(campaign),
  })

  const channel = useWatch({ control: form.control, name: 'channel' })

  function handleOpenChange(value: boolean) {
    if (value) {
      form.reset(defaultValues(campaign))
      setStep('segmento')
      setCampaignId(campaign?.id)
      setServerError(null)
      setPreviewCount(campaign?.recipient_count ?? null)
      setSampleNames([])
      setPersonalizationPreview(campaign?.preview_message ?? null)
    }
    setOpen(value)
  }

  /** Persists the current form values (create on first call, update thereafter). */
  async function persistCampaign(): Promise<{ id: string } | { error: string }> {
    const values = form.getValues()
    if (!campaignId) {
      const result = await createCampaign(values)
      if (!result.success || !result.id) {
        return { error: result.error ?? 'Erro ao criar campanha' }
      }
      setCampaignId(result.id)
      return { id: result.id }
    }
    const result = await updateCampaign(campaignId, values)
    if (!result.success) {
      return { error: result.error ?? 'Erro ao atualizar campanha' }
    }
    return { id: campaignId }
  }

  async function handlePreviewSegment() {
    setServerError(null)
    const valid = await form.trigger(['name', 'segment'])
    if (!valid) return

    setIsPreviewing(true)
    const persisted = await persistCampaign()
    if ('error' in persisted) {
      setIsPreviewing(false)
      setServerError(persisted.error)
      return
    }

    const result = await previewCampaignSegment(persisted.id)
    setIsPreviewing(false)
    if (!result.success) {
      setServerError(result.error ?? 'Erro ao pré-visualizar segmento')
      return
    }
    setPreviewCount(result.count ?? 0)
    setSampleNames((result.sample ?? []).map((s) => s.firstName))
  }

  async function handleGeneratePersonalization() {
    setServerError(null)
    const valid = await form.trigger(['channel'])
    if (!valid) return
    if (!campaignId) {
      setServerError('Pré-visualize o segmento antes de gerar a personalização')
      return
    }

    setIsPersonalizing(true)
    // Sync the current channel selection before generating — the preview
    // must reflect the channel(s) that will actually be submitted.
    const persisted = await persistCampaign()
    if ('error' in persisted) {
      setIsPersonalizing(false)
      setServerError(persisted.error)
      return
    }

    const result = await requestCampaignPersonalization(persisted.id)
    setIsPersonalizing(false)
    if (!result.success) {
      setServerError(result.error ?? 'Erro ao gerar personalização')
      return
    }
    setPersonalizationPreview(result.preview ?? null)
  }

  async function handleSubmitForApproval() {
    if (!campaignId) return
    setServerError(null)
    setIsSubmittingApproval(true)
    const result = await submitCampaignForApproval(campaignId)
    setIsSubmittingApproval(false)
    if (!result.success) {
      setServerError(result.error ?? 'Erro ao enviar campanha para aprovação')
      return
    }
    setOpen(false)
    router.refresh()
  }

  const primaryName = sampleNames[0] ?? ''
  const previewBubbles = personalizationPreview
    ? buildPreviewBubbles(personalizationPreview, primaryName, sampleNames)
    : []

  const channelLabel =
    channel?.whatsapp && channel?.email
      ? 'WhatsApp + E-mail'
      : channel?.whatsapp
        ? 'WhatsApp'
        : channel?.email
          ? 'E-mail'
          : '—'

  const dialogTitle =
    mode === 'create' ? 'Nova Campanha' : mode === 'edit' ? 'Editar Campanha' : 'Detalhes da Campanha'

  return (
    <>
      <div
        className="contents"
        onClick={() => handleOpenChange(true)}
        onKeyDown={(e) => e.key === 'Enter' && handleOpenChange(true)}
        role="presentation"
      >
        {children}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <Tabs value={step} onValueChange={(v) => setStep(v as Step)}>
              <TabsList className="w-full">
                <TabsTrigger value="segmento">Segmento</TabsTrigger>
                <TabsTrigger value="canal">Canal e Mensagem</TabsTrigger>
                <TabsTrigger value="revisao">Revisão</TabsTrigger>
              </TabsList>

              {/* ── Passo 1: Segmento ─────────────────────────────────────── */}
              <TabsContent value="segmento" className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Campanha *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: Reativação 90 dias" disabled={readOnly} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="segment.inactiveDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inativo há (dias) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          disabled={readOnly}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Accordion>
                  <AccordionItem value="filtros">
                    <AccordionTrigger>Filtros opcionais</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="segment.lastProcedureServiceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Último procedimento</FormLabel>
                            <Select
                              disabled={readOnly}
                              onValueChange={(v) => field.onChange(v === 'none' ? undefined : v)}
                              value={field.value ?? 'none'}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full bg-background border-border">
                                  <SelectValue placeholder="Qualquer procedimento" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Qualquer procedimento</SelectItem>
                                {services.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="segment.ageMin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Idade mínima</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  disabled={readOnly}
                                  value={field.value ?? ''}
                                  onChange={(e) =>
                                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="segment.ageMax"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Idade máxima</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  disabled={readOnly}
                                  value={field.value ?? ''}
                                  onChange={(e) =>
                                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="segment.unitId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unidade</FormLabel>
                            <Select
                              disabled={readOnly}
                              onValueChange={(v) => field.onChange(v === 'none' ? undefined : v)}
                              value={field.value ?? 'none'}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full bg-background border-border">
                                  <SelectValue placeholder="Todas as unidades" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Todas as unidades</SelectItem>
                                {units.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {!readOnly && (
                  <Button type="button" onClick={handlePreviewSegment} disabled={isPreviewing}>
                    {isPreviewing && <Loader2 className="size-4 animate-spin" />}
                    Pré-visualizar Segmento
                  </Button>
                )}

                <SegmentPreview count={previewCount} loading={isPreviewing} />
              </TabsContent>

              {/* ── Passo 2: Canal e Mensagem ─────────────────────────────── */}
              <TabsContent value="canal" className="space-y-4 pt-2">
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="channel.whatsapp"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            disabled={readOnly}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">WhatsApp</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channel.email"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            disabled={readOnly}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">E-mail</FormLabel>
                      </FormItem>
                    )}
                  />
                  {form.formState.errors.channel && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.channel.message ?? 'Selecione ao menos um canal'}
                    </p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Mensagens de WhatsApp usam template aprovado pela Meta — variáveis são preenchidas
                  automaticamente, texto livre não é permitido.
                </p>

                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGeneratePersonalization}
                    disabled={isPersonalizing}
                  >
                    {isPersonalizing && <Loader2 className="size-4 animate-spin" />}
                    Gerar Personalização com IA
                  </Button>
                )}

                {previewBubbles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Amostra de mensagem personalizada</p>
                    <div className="flex flex-col gap-2">
                      {previewBubbles.map((bubble, i) => (
                        <div
                          key={i}
                          className="max-w-sm rounded-lg rounded-tl-none bg-muted px-3 py-2 text-sm"
                        >
                          {bubble}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Passo 3: Revisão e Envio ───────────────────────────────── */}
              <TabsContent value="revisao" className="space-y-4 pt-2">
                <div className="space-y-2 rounded-md border border-border p-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">Pacientes elegíveis: </span>
                    <span className="font-semibold tabular-nums">{previewCount ?? '—'}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Canal: </span>
                    <span className="font-semibold">{channelLabel}</span>
                  </p>
                  {personalizationPreview && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Preview da mensagem:</p>
                      <p className="rounded-md bg-muted px-3 py-2">{personalizationPreview}</p>
                    </div>
                  )}
                </div>

                <Alert>
                  <ShieldCheck />
                  <AlertDescription>
                    O disparo em massa só ocorre após aprovação de um administrador ou gestor.
                  </AlertDescription>
                </Alert>

                {!readOnly && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          type="button"
                          disabled={isSubmittingApproval || !campaignId || !previewCount || !personalizationPreview}
                        />
                      }
                    >
                      {isSubmittingApproval && <Loader2 className="size-4 animate-spin" />}
                      Enviar para Aprovação
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Enviar campanha para aprovação</AlertDialogTitle>
                        <AlertDialogDescription>
                          A campanha será personalizada por IA e enviada para aprovação antes do disparo em
                          massa. Nenhuma mensagem sai sem aprovação humana.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSubmitForApproval}>
                          Enviar para Aprovação
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TabsContent>
            </Tabs>
          </Form>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {readOnly ? 'Fechar' : 'Cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
