/**
 * /clinica/protese/laboratorios — Laboratórios Fornecedores (RSC)
 *
 * Gated pelo módulo 'protese' em proxy.ts MODULE_PERMISSIONS (Plan 06).
 * runtime 'nodejs': Supabase requer Node.js (não Edge).
 *
 * Lista laboratórios cadastrados (nome, contato, telefone, email).
 * CTA "Cadastrar laboratório" abre LabFormDialog (Client Component).
 * Papéis somente leitura não veem o CTA.
 *
 * Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 07
 * Requirements: LAB-01
 */

import { headers } from 'next/headers'
import { Boxes } from 'lucide-react'

import { listLabs } from '@/actions/lab-orders'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/shell/EmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LabFormDialog } from '@/components/protese/LabFormDialog'

export const runtime = 'nodejs'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LaboratoriosPage() {
  const headerStore = await headers()
  const isReadOnly = headerStore.get('x-read-only') === 'true'

  const labsResult = await listLabs()
  const labs = labsResult.success ? (labsResult.data ?? []) : []

  return (
    <>
      <PageHeader
        title="Laboratórios (Fornecedores)"
        breadcrumbs={[
          { label: 'Clínica', href: '/clinica' },
          { label: 'Laboratório de Prótese', href: '/clinica/protese' },
          { label: 'Laboratórios' },
        ]}
        actions={!isReadOnly ? <LabFormDialog /> : undefined}
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {isReadOnly && (
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Acesso somente leitura. Seu papel não permite cadastrar laboratórios.
          </div>
        )}

        {labs.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nenhum laboratório cadastrado"
            description="Cadastre os laboratórios fornecedores de prótese para vinculá-los nas ordens de serviço (LAB-01)."
            cta={!isReadOnly ? <LabFormDialog /> : undefined}
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labs.map((lab) => (
                  <TableRow key={String(lab.id)}>
                    <TableCell className="font-medium text-sm">{String(lab.nome)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lab.contato_nome ? String(lab.contato_nome) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lab.telefone ? String(lab.telefone) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lab.email ? String(lab.email) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  )
}
