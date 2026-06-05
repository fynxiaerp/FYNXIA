'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, Pencil } from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string
  full_name: string
  cpf: string
  phone: string | null
  email: string | null
  created_at: string
  is_anonymized: boolean
}

interface PatientTableProps {
  patients: Patient[]
  userRole: string
}

// ─── Masking Contract (SEC-01, T-2-10) ───────────────────────────────────────
// CPF: 123.***.***-** for receptionist/patient roles
// Phone: (11) 9****-1234 for receptionist/patient roles
// E-mail: jo***@gmail.com for receptionist/patient roles
// Server-side masking preferred (users_masked view) — this is a fallback for client

function maskCpf(cpf: string): string {
  // format: 123.***.***-**
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.***.***-**`
}

function maskPhone(phone: string): string {
  // format: (11) 9****-1234
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]}****-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ****-${d.slice(6)}`
  return phone
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain || !local) return email
  const prefix = local.slice(0, Math.min(2, local.length))
  return `${prefix}***@${domain}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PatientTable({ patients, userRole }: PatientTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  // Roles that get masked fields (SEC-01)
  const shouldMask = userRole === 'receptionist' || userRole === 'patient'

  const columns: ColumnDef<Patient>[] = [
    {
      accessorKey: 'full_name',
      header: 'Nome',
      cell: ({ row }) => (
        <Link
          href={`/clinica/pacientes/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.getValue('full_name')}
        </Link>
      ),
    },
    {
      accessorKey: 'cpf',
      header: 'CPF',
      cell: ({ row }) => {
        const cpf = row.getValue<string>('cpf')
        return (
          <span className="font-mono text-sm">
            {shouldMask ? maskCpf(cpf) : cpf}
          </span>
        )
      },
    },
    {
      accessorKey: 'phone',
      header: 'Telefone',
      cell: ({ row }) => {
        const phone = row.getValue<string | null>('phone')
        if (!phone) return <span className="text-muted-foreground text-sm">—</span>
        return (
          <span className="font-mono text-sm">
            {shouldMask ? maskPhone(phone) : phone}
          </span>
        )
      },
    },
    {
      accessorKey: 'email',
      header: 'E-mail',
      cell: ({ row }) => {
        const email = row.getValue<string | null>('email')
        if (!email) return <span className="text-muted-foreground text-sm">—</span>
        return (
          <span className="font-mono text-sm">
            {shouldMask ? maskEmail(email) : email}
          </span>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        if (row.original.is_anonymized) {
          return <Badge variant="destructive">Anonimizado</Badge>
        }
        return <Badge variant="secondary">Ativo</Badge>
      },
    },
    {
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/clinica/pacientes/${row.original.id}`)}
            aria-label={`Ver ficha de ${row.original.full_name}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {!row.original.is_anonymized && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(`/clinica/pacientes/${row.original.id}/editar`)
              }
              aria-label={`Editar paciente ${row.original.full_name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: patients,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nome, CPF..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Nenhum paciente encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
