'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'

import { patientSchema, type PatientInput } from '@/lib/validators/patient'
import { createPatient, updatePatient } from '@/actions/patients'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PatientFormProps {
  mode: 'create' | 'edit'
  patientId?: string
  defaultValues?: Partial<PatientInput>
}

export function PatientForm({ mode, patientId, defaultValues }: PatientFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<PatientInput>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      full_name: '',
      cpf: '',
      date_of_birth: '',
      phone: '',
      email: '',
      address: '',
      medical_history: '',
      allergies: '',
      medications: '',
      ...defaultValues,
    },
  })

  // CPF mask: apply format 000.000.000-00 on blur
  function handleCpfBlur(value: string) {
    const digits = value.replace(/\D/g, '')
    if (digits.length === 11) {
      const masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
      form.setValue('cpf', masked, { shouldValidate: true })
    }
  }

  async function onSubmit(data: PatientInput) {
    setServerError(null)
    setIsSubmitting(true)
    try {
      let result
      if (mode === 'create') {
        result = await createPatient(data)
        if (result.success && result.id) {
          router.push(`/clinica/pacientes/${result.id}`)
        }
      } else {
        if (!patientId) return
        result = await updatePatient(patientId, data)
        if (result.success) {
          router.push(`/clinica/pacientes/${patientId}`)
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

        {/* Dados de identificação */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Nome Completo *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Maria da Silva" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">CPF *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="000.000.000-00"
                    className="font-mono"
                    {...field}
                    onBlur={(e) => {
                      field.onBlur()
                      handleCpfBlur(e.target.value)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date of birth — shadcn Calendar in Popover */}
          <FormField
            control={form.control}
            name="date_of_birth"
            render={({ field }) => {
              const parsedDate =
                field.value && field.value.length > 0
                  ? parseISO(field.value)
                  : undefined
              const displayDate =
                parsedDate && isValid(parsedDate)
                  ? format(parsedDate, 'dd/MM/yyyy', { locale: ptBR })
                  : null

              return (
                <FormItem className="flex flex-col">
                  <FormLabel className="font-semibold">Data de Nascimento</FormLabel>
                  <Popover>
                    {/* PopoverTrigger uses @base-ui/react render prop — no asChild */}
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className={cn(
                            'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                            !displayDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {displayDate ?? 'Selecionar data'}
                        </button>
                      }
                    />
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parsedDate && isValid(parsedDate) ? parsedDate : undefined}
                        onSelect={(date) =>
                          field.onChange(date ? format(date, 'yyyy-MM-dd') : '')
                        }
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Telefone</FormLabel>
                <FormControl>
                  <Input placeholder="(11) 99999-9999" {...field} />
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
                <FormLabel className="font-semibold">E-mail</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@exemplo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Endereço</FormLabel>
              <FormControl>
                <Input placeholder="Rua, número, bairro, cidade" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campos de saúde — AES-256 no Server Action (D-07) */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground">
            Informações de Saúde (armazenadas de forma segura)
          </p>

          <FormField
            control={form.control}
            name="medical_history"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Histórico de Saúde</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Descreva condições médicas relevantes..."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="allergies"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Alergias</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ex: Penicilina, Dipirona..."
                    className="min-h-[60px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="medications"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Medicamentos em Uso</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ex: Losartana 50mg, Metformina 850mg..."
                    className="min-h-[60px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Salvando...'
              : mode === 'create'
              ? 'Cadastrar Paciente'
              : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
