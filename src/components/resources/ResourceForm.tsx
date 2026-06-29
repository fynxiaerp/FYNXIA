'use client'
/**
 * ResourceForm — RHF + Zod v3 form for creating/editing a physical resource (RES-01).
 *
 * Fields: nome, tipo (sala/cadeira/equipamento), unit_id, patrimônio, número de série,
 *         status (ativo/manutencao/inativo), manutenção prevista (optional date).
 *
 * Design tokens only — no raw slate/gray/white Tailwind classes (dark mode support).
 * Select from shadcn/ui (@base-ui/react under the hood) — no asChild.
 * No .default() in schema (CLAUDE.md constraint D-133/D-158).
 *
 * Status 'manutencao' blocks booking via isResourceAvailable() in Plan 04 —
 * this form just sets the value.
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'

import { resourceSchema, type ResourceInput } from '@/lib/validators/resource'
import { RESOURCE_TYPES, RESOURCE_STATUS } from '@/lib/scheduling/resources'
import { createResource, updateResource } from '@/actions/resources'

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

// ─── pt-BR labels ──────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<(typeof RESOURCE_TYPES)[number], string> = {
  sala: 'Sala',
  cadeira: 'Cadeira',
  equipamento: 'Equipamento',
}

const STATUS_LABELS: Record<(typeof RESOURCE_STATUS)[number], string> = {
  ativo: 'Ativo',
  manutencao: 'Manutenção',
  inativo: 'Inativo',
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface Unit {
  id: string
  name: string
}

interface ResourceFormProps {
  mode: 'create' | 'edit'
  resourceId?: string
  units: Unit[]
  defaultValues?: Partial<ResourceInput>
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ResourceForm({ mode, resourceId, units, defaultValues }: ResourceFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ResourceInput>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      nome: '',
      tipo: 'sala',
      unit_id: units[0]?.id ?? '',
      patrimonio: '',
      numero_serie: '',
      status: 'ativo',
      manutencao_prevista: '',
      ...defaultValues,
    },
  })

  async function onSubmit(data: ResourceInput) {
    setServerError(null)
    setIsSubmitting(true)
    try {
      let result
      if (mode === 'create') {
        result = await createResource(data)
        if (result.success && result.id) {
          router.push(`/clinica/recursos/${result.id}`)
          return
        }
      } else {
        if (!resourceId) return
        result = await updateResource(resourceId, data)
        if (result.success) {
          router.push('/clinica/recursos')
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

        {/* ── Identificação ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Nome */}
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel className="font-semibold">Nome *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Sala 01, Cadeira 3, Raio-X digital" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tipo */}
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Tipo *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RESOURCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Unidade */}
          <FormField
            control={form.control}
            name="unit_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Unidade *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a unidade">
                      {field.value ? (units.find(u => u.id === field.value)?.name ?? 'Selecione a unidade') : null}
                    </SelectValue>
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
        </div>

        {/* ── Patrimônio + Número de Série ──────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="patrimonio"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Patrimônio</FormLabel>
                <FormControl>
                  <Input placeholder="Código patrimonial" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numero_serie"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Número de Série</FormLabel>
                <FormControl>
                  <Input placeholder="S/N ou tag do fabricante" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Status + Manutenção Prevista ──────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Status — ativo | manutencao | inativo */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Status *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RESOURCE_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Manutenção Prevista (optional date) */}
          <FormField
            control={form.control}
            name="manutencao_prevista"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Manutenção Prevista</FormLabel>
                <FormControl>
                  <input
                    type="date"
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Submit ──────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'create'
                ? 'Cadastrando...'
                : 'Salvando...'
              : mode === 'create'
                ? 'Cadastrar Recurso'
                : 'Salvar Alterações'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/clinica/recursos')}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  )
}
