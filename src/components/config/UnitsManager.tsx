'use client'
/**
 * UnitsManager — admin UI to list, create, edit and deactivate units (filiais).
 *
 * SYS-01 / Plan 07-05:
 * - Displays a table of units with ativo/default badges
 * - "Adicionar Unidade" button opens a Dialog with RHF + unitSchema form
 * - "Editar" opens the same dialog pre-filled
 * - ativo toggle calls updateUnit (blocked for the default unit)
 * - Local React state drives the dialog — no nuqs/Zustand needed for this small surface
 *
 * Design tokens: bg-background, text-foreground, border-border, text-muted-foreground.
 * No raw slate/gray/white Tailwind classes.
 */
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

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
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createUnit, updateUnit, UnitRow } from '@/actions/units'
import { unitSchema, UnitInput } from '@/lib/validators/unit'

// ─── Props ────────────────────────────────────────────────────────────────────

interface UnitsManagerProps {
  units: UnitRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UnitsManager({ units: initialUnits }: UnitsManagerProps) {
  const [units, setUnits] = useState<UnitRow[]>(initialUnits)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogSuccess, setDialogSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<UnitInput>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      name: '',
      cnpj: '',
      slug: '',
      phone: '',
      address: '',
      ativo: true,
    },
  })

  function openCreate() {
    setEditingUnit(null)
    setDialogError(null)
    setDialogSuccess(null)
    form.reset({ name: '', cnpj: '', slug: '', phone: '', address: '', ativo: true })
    setDialogOpen(true)
  }

  function openEdit(unit: UnitRow) {
    setEditingUnit(unit)
    setDialogError(null)
    setDialogSuccess(null)
    form.reset({
      name: unit.name,
      cnpj: unit.cnpj ?? '',
      slug: unit.slug,
      phone: unit.phone ?? '',
      address: unit.address ?? '',
      ativo: unit.ativo,
    })
    setDialogOpen(true)
  }

  function handleAtivo(unit: UnitRow, newAtivo: boolean) {
    if (unit.is_default && !newAtivo) return // silently block — button is disabled anyway
    startTransition(async () => {
      const result = await updateUnit(unit.id, {
        name: unit.name,
        cnpj: unit.cnpj ?? '',
        slug: unit.slug,
        phone: unit.phone ?? '',
        address: unit.address ?? '',
        ativo: newAtivo,
      })
      if (result.success) {
        setUnits((prev) =>
          prev.map((u) => (u.id === unit.id ? { ...u, ativo: newAtivo } : u))
        )
      }
    })
  }

  async function onSubmit(data: UnitInput) {
    setDialogError(null)
    setDialogSuccess(null)

    if (editingUnit) {
      const result = await updateUnit(editingUnit.id, data)
      if (result.success) {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === editingUnit.id
              ? { ...u, ...data, cnpj: data.cnpj ?? null, phone: data.phone ?? null, address: data.address ?? null }
              : u
          )
        )
        setDialogSuccess('Unidade atualizada.')
        setTimeout(() => setDialogOpen(false), 900)
      } else {
        setDialogError(result.error ?? 'Erro ao atualizar unidade.')
      }
    } else {
      const result = await createUnit(data)
      if (result.success && result.unitId) {
        const newUnit: UnitRow = {
          id: result.unitId,
          name: data.name,
          cnpj: data.cnpj ?? null,
          slug: data.slug,
          phone: data.phone ?? null,
          address: data.address ?? null,
          ativo: data.ativo,
          is_default: false,
          clinic_id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        }
        setUnits((prev) => [...prev, newUnit])
        setDialogSuccess('Unidade criada com sucesso.')
        setTimeout(() => setDialogOpen(false), 900)
      } else {
        setDialogError(result.error ?? 'Erro ao criar unidade.')
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Unidades (Filiais)</h2>
        <Button size="sm" onClick={openCreate}>
          Adicionar Unidade
        </Button>
      </div>

      {/* ── Units Table ────────────────────────────────────────────────────── */}
      {units.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
      ) : (
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium text-foreground">
                    {unit.name}
                    {unit.is_default && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Padrão
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{unit.slug}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {unit.cnpj ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={unit.ativo ? 'default' : 'outline'}>
                      {unit.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {/* Disable toggle for the default unit (cannot deactivate) */}
                    <Switch
                      checked={unit.ativo}
                      onCheckedChange={(val) => handleAtivo(unit, val)}
                      disabled={unit.is_default || isPending}
                      aria-label={`Ativar/desativar ${unit.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openEdit(unit)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? 'Editar Unidade' : 'Nova Unidade'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {dialogSuccess && (
                <Alert>
                  <AlertDescription>{dialogSuccess}</AlertDescription>
                </Alert>
              )}
              {dialogError && (
                <Alert variant="destructive">
                  <AlertDescription>{dialogError}</AlertDescription>
                </Alert>
              )}

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex.: Unidade Centro"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Slug */}
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="unidade-centro"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CNPJ */}
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="00.000.000/0001-00"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(11) 99999-9999"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Rua, número, bairro"
                        className="bg-background border-border text-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ativo */}
              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={editingUnit?.is_default ?? false}
                        aria-label="Unidade ativa"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Unidade ativa</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
