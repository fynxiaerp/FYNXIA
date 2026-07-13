'use client'

// LeadFormDialog — lead creation (CRC-01). RHF v7 + zodResolver(leadSchema) —
// leadSchema is imported verbatim from validators/crc.ts (D-133: no .default()
// modifier, defaults supplied via useForm({ defaultValues })). "Indicado por" is
// a conditional field (watch on source_id) visible only when the selected
// source's name is 'Indicação' (D-16) — createLead already links the referral
// server-side when referred_by_patient_id is set, so this dialog never calls
// linkReferral directly (would double-call). Trigger-wrapper convention mirrors
// ProductFormDialog.tsx.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { createLead } from '@/actions/leads'
import { leadSchema, type LeadInput } from '@/lib/validators/crc'
import type { LeadSourceRow } from '@/actions/lead-sources'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PatientOption {
  id: string
  full_name: string
  cpf: string
}

interface LeadFormDialogProps {
  sources: LeadSourceRow[]
  patients: PatientOption[]
  children: React.ReactNode
}

function defaultValues(): LeadInput {
  return {
    full_name: '',
    phone: '',
    email: '',
    source_id: '',
    referred_by_patient_id: undefined,
    notes: '',
  }
}

// Telefone BR: (00) 00000-0000 (celular) / (00) 0000-0000 (fixo)
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_m, a, b, c) =>
      [a && `(${a}`, a?.length === 2 && ') ', b, c && `-${c}`].filter(Boolean).join('')
    )
  }
  return digits.replace(/(\d{0,2})(\d{0,5})(\d{0,4})/, (_m, a, b, c) =>
    [a && `(${a}`, a?.length === 2 && ') ', b, c && `-${c}`].filter(Boolean).join('')
  )
}

export function LeadFormDialog({ sources, patients, children }: LeadFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [patientSearch, setPatientSearch] = useState('')

  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: defaultValues(),
  })

  const sourceId = useWatch({ control: form.control, name: 'source_id' })
  const selectedSource = sources.find((s) => s.id === sourceId)
  const isIndicacao = selectedSource?.name === 'Indicação'

  function handleOpenChange(value: boolean) {
    if (value) {
      form.reset(defaultValues())
      setServerError(null)
      setPatientSearch('')
    }
    setOpen(value)
  }

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch) return true
    const q = patientSearch.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    )
  })

  async function onSubmit(values: LeadInput) {
    setServerError(null)
    const payload = {
      ...values,
      phone: values.phone || undefined,
      email: values.email || undefined,
      notes: values.notes || undefined,
      referred_by_patient_id: isIndicacao ? values.referred_by_patient_id : undefined,
    }
    const result = await createLead(payload)
    if (result.success) {
      setOpen(false)
      router.refresh()
    } else {
      setServerError(result.error ?? 'Erro ao cadastrar lead. Tente novamente.')
    }
  }

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
        <DialogContent className="sm:max-w-lg bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Cadastrar Lead</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo do lead" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(maskPhone(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full bg-background border-border">
                          <SelectValue placeholder="Selecione a origem">
                            {selectedSource?.name}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sources.map((s) => (
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

              {isIndicacao && (
                <FormField
                  control={form.control}
                  name="referred_by_patient_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indicado por</FormLabel>
                      <div className="space-y-2">
                        <Input
                          placeholder="Buscar paciente por nome ou CPF..."
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                        />
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-background border-border">
                              <SelectValue placeholder="Selecione o paciente indicador">
                                {field.value
                                  ? filteredPatients.find((p) => p.id === field.value)?.full_name
                                  : null}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredPatients.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                Nenhum paciente encontrado.
                              </div>
                            ) : (
                              filteredPatients.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.full_name} — {p.cpf}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observação</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações sobre o lead (opcional)"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Cadastrar Lead
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
