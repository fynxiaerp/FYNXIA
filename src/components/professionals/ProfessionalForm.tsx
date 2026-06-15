'use client'
/**
 * ProfessionalForm — RHF + Zod v3 tabbed form for professionals cadastro (PRO-01, PRO-03).
 *
 * Three tabs:
 *   - Ficha: dados cadastrais (CRO, UF, especialidades, vínculo, unidade, login)
 *   - Horários: grade semanal de disponibilidade + exceções (AvailabilityGrid)
 *   - Comissão: commission_rules JSONB editor (armazenamento — sem cálculo)
 *
 * Design tokens only. @base-ui Select (render-prop, NEVER asChild). No .default() em schemas.
 * pt-BR labels e mensagens de erro.
 */
import { useState } from 'react'
import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'

import {
  professionalSchema,
  type ProfessionalInput,
  type AvailabilityWindowInput,
  type AvailabilityExceptionInput,
  type CommissionRules,
} from '@/lib/validators/professional'
import { createProfessional, updateProfessional } from '@/actions/professionals'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { AvailabilityGrid, type AvailabilityGridValue } from './AvailabilityGrid'
import { Plus, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Unit {
  id: string
  name: string
}

export interface DentistUser {
  id: string
  full_name: string
}

interface ProfessionalFormProps {
  mode: 'create' | 'edit'
  professionalId?: string
  units: Unit[]
  dentistUsers: DentistUser[]
  defaultValues?: Partial<ProfessionalInput>
  defaultAvailability?: AvailabilityWindowInput[]
  defaultExceptions?: AvailabilityExceptionInput[]
}

// ─── Vínculo labels ───────────────────────────────────────────────────────────

const VINCULO_LABELS: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  autonomo: 'Autônomo',
}

// ─── CommissionRulesEditor ────────────────────────────────────────────────────

interface CommissionRulesEditorProps {
  value: CommissionRules
  onChange: (rules: CommissionRules) => void
}

function CommissionRulesEditor({ value, onChange }: CommissionRulesEditorProps) {
  function addFlatPct() {
    onChange([...value, { type: 'flat_pct', pct: 0 }])
  }

  function addServicePct() {
    onChange([...value, { type: 'service_pct', service_id: '', pct: 0 }])
  }

  function removeRule(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function updateRule(index: number, updates: Partial<CommissionRules[number]>) {
    const updated = value.map((rule, i) => {
      if (i !== index) return rule
      return { ...rule, ...updates } as CommissionRules[number]
    })
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Regra armazenada; o cálculo do repasse ocorre no módulo financeiro (Fase 16).
      </p>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma regra de comissão cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {value.map((rule, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {rule.type === 'flat_pct' ? 'Percentual geral' : 'Percentual por serviço'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRule(index)}
                  aria-label="Remover regra"
                >
                  <Trash2 />
                </Button>
              </div>

              {/* Percentual */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    Percentual (%) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={rule.pct}
                    onChange={(e) => updateRule(index, { pct: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-24 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>

                {/* UUID do serviço (apenas service_pct) */}
                {rule.type === 'service_pct' && (
                  <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-xs text-muted-foreground">
                      ID do serviço (UUID) <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={rule.service_id}
                      onChange={(e) => updateRule(index, { service_id: e.target.value })}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={addFlatPct}>
          <Plus />
          Percentual geral
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addServicePct}>
          <Plus />
          Percentual por serviço
        </Button>
      </div>
    </div>
  )
}

// ─── ProfessionalForm ─────────────────────────────────────────────────────────

export function ProfessionalForm({
  mode,
  professionalId,
  units,
  dentistUsers,
  defaultValues,
  defaultAvailability,
  defaultExceptions,
}: ProfessionalFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Availability state — managed outside RHF to avoid schema complexity
  const [availability, setAvailability] = useState<AvailabilityGridValue>({
    windows: defaultAvailability ?? [],
    exceptions: defaultExceptions ?? [],
  })

  const form = useForm<ProfessionalInput>({
    resolver: zodResolver(professionalSchema),
    defaultValues: {
      full_name: '',
      cro: '',
      cro_uf: '',
      especialidades: [],
      vinculo: 'autonomo',
      unit_id: units[0]?.id,
      user_id: null,
      commission_rules: [],
      ativo: true,
      ...defaultValues,
    },
  })

  // ── Especialidades ─────────────────────────────────────────────────────────
  const especialidadesField = useController({
    control: form.control,
    name: 'especialidades',
  })
  const [especialidadeInput, setEspecialidadeInput] = useState('')

  function addEspecialidade() {
    const trimmed = especialidadeInput.trim()
    if (!trimmed) return
    const current = especialidadesField.field.value ?? []
    if (!current.includes(trimmed)) {
      especialidadesField.field.onChange([...current, trimmed])
    }
    setEspecialidadeInput('')
  }

  function removeEspecialidade(idx: number) {
    const current = especialidadesField.field.value ?? []
    especialidadesField.field.onChange(current.filter((_, i) => i !== idx))
  }

  // ── commission_rules ───────────────────────────────────────────────────────
  const commissionField = useController({
    control: form.control,
    name: 'commission_rules',
  })

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function onSubmit(data: ProfessionalInput) {
    setServerError(null)
    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        availability: availability.windows,
        exceptions: availability.exceptions,
      }

      let result
      if (mode === 'create') {
        result = await createProfessional(payload)
        if (result.success) {
          router.push('/clinica/profissionais')
          return
        }
      } else {
        if (!professionalId) return
        result = await updateProfessional(professionalId, payload)
        if (result.success) {
          router.push('/clinica/profissionais')
          return
        }
      }

      if (result && !result.success && result.error) {
        setServerError(result.error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="ficha">
          <TabsList>
            <TabsTrigger value="ficha">Ficha</TabsTrigger>
            <TabsTrigger value="horarios">Horários</TabsTrigger>
            <TabsTrigger value="comissao">Comissão</TabsTrigger>
          </TabsList>

          {/* ── Aba Ficha ────────────────────────────────────────── */}
          <TabsContent value="ficha" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Nome completo */}
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="font-semibold">Nome completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Dr. João da Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CRO */}
              <FormField
                control={form.control}
                name="cro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">CRO *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CRO UF */}
              <FormField
                control={form.control}
                name="cro_uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">UF do CRO *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: SP"
                        maxLength={2}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Vínculo */}
              <FormField
                control={form.control}
                name="vinculo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Vínculo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o vínculo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(['clt', 'pj', 'autonomo'] as const).map((v) => (
                          <SelectItem key={v} value={v}>
                            {VINCULO_LABELS[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unidade */}
              {units.length > 0 && (
                <FormField
                  control={form.control}
                  name="unit_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Unidade</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ''}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a unidade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
              )}

              {/* Login do dentista (opcional) */}
              <FormField
                control={form.control}
                name="user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Login vinculado</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sem login" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sem login</SelectItem>
                        {dentistUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Especialidades (tag input) */}
            <div className="space-y-2">
              <FormLabel className="font-semibold">Especialidades</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={especialidadeInput}
                  onChange={(e) => setEspecialidadeInput(e.target.value)}
                  placeholder="Ex: Implantodontia, Ortodontia..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addEspecialidade()
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addEspecialidade}>
                  <Plus />
                  Adicionar
                </Button>
              </div>
              {especialidadesField.field.value.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {especialidadesField.field.value.map((esp, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                    >
                      {esp}
                      <button
                        type="button"
                        onClick={() => removeEspecialidade(idx)}
                        aria-label={`Remover ${esp}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {especialidadesField.fieldState.error && (
                <p className="text-sm text-destructive">
                  {especialidadesField.fieldState.error.message}
                </p>
              )}
            </div>
          </TabsContent>

          {/* ── Aba Horários ──────────────────────────────────────── */}
          <TabsContent value="horarios" className="mt-4">
            <AvailabilityGrid value={availability} onChange={setAvailability} />
          </TabsContent>

          {/* ── Aba Comissão ──────────────────────────────────────── */}
          <TabsContent value="comissao" className="mt-4">
            <CommissionRulesEditor
              value={commissionField.field.value}
              onChange={commissionField.field.onChange}
            />
            {commissionField.fieldState.error && (
              <p className="text-sm text-destructive mt-2">
                {commissionField.fieldState.error.message}
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Ações ──────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2 border-t border-border">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'create'
                ? 'Cadastrando...'
                : 'Salvando...'
              : mode === 'create'
                ? 'Cadastrar Profissional'
                : 'Salvar Alterações'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/clinica/profissionais')}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  )
}
