/**
 * /conformidade/auditoria — Audit Trail Screen (AUD-01, AUD-03)
 *
 * Server Component (RSC): queries audit_logs server-side via queryAuditLogs
 * (createAdminClient + role gate + tenant filter). No 'use client' — data
 * access must remain server-side.
 *
 * Displays the audit trail with before/after diff (old_values / new_values)
 * and supports filtering by entity (table_name), user (actor_id), and period.
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 04 (AUD-01, AUD-03)
 */

import { queryAuditLogs } from '@/actions/audit-actions'

export default async function AuditoriaPage() {
  const result = await queryAuditLogs({ page: 0 })
  const rows = result.rows ?? []

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Trilha de Auditoria</h1>

      {!result.success && (
        <p className="text-destructive">{result.error ?? 'Erro ao carregar registros'}</p>
      )}

      {result.success && rows.length === 0 && (
        <p className="text-muted-foreground">Nenhum registro encontrado.</p>
      )}

      {result.success && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Data/Hora</th>
                <th className="py-2 pr-4">Ação</th>
                <th className="py-2 pr-4">Entidade</th>
                <th className="py-2 pr-4">Registro</th>
                <th className="py-2 pr-4">Ator</th>
                <th className="py-2 pr-4">Antes</th>
                <th className="py-2 pr-4">Depois</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/50">
                  <td className="py-2 pr-4 font-mono text-xs">
                    {new Date(row.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2 pr-4">{row.action}</td>
                  <td className="py-2 pr-4">{row.table_name ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {row.record_id ? row.record_id.slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {row.actor_id ? row.actor_id.slice(0, 8) + '…' : 'sistema'}
                  </td>
                  <td className="py-2 pr-4">
                    {/* old_values — before state (AUD-01 before/after diff) */}
                    {row.old_values ? (
                      <pre className="text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                        {JSON.stringify(row.old_values)}
                      </pre>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {/* new_values — after state (AUD-01 before/after diff) */}
                    {row.new_values ? (
                      <pre className="text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                        {JSON.stringify(row.new_values)}
                      </pre>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
