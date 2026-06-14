'use client'
/**
 * PerfisMatrix — SYS-03 / Plan 07-06
 *
 * Read-only table of MODULE_PERMISSIONS (role rows × module columns).
 * Imports the server-side source of truth from @/proxy.
 *
 * Display:
 * - allowed (not readOnly) → check icon (primary color)
 * - allowed + readOnly     → "somente leitura" badge
 * - not allowed            → dash (muted)
 *
 * Covers all 7 module columns: clinica, config, superadmin, paciente, financeiro, ia, bi.
 * Governance roles (socio/dpo/auditor) read-only flags asserted in tests (WARNING 6).
 *
 * Design system: design tokens only — no raw slate-/gray-/text-white/bg-white.
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MODULE_PERMISSIONS, type AppRole } from '@/proxy'

// ─── Module display names ─────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  clinica: 'Clínica',
  config: 'Config',
  superadmin: 'Superadmin',
  paciente: 'Paciente',
  financeiro: 'Financeiro',
  ia: 'IA',
  bi: 'BI',
}

// Ordered list of all 7 modules
const ALL_MODULES = ['clinica', 'config', 'superadmin', 'paciente', 'financeiro', 'ia', 'bi'] as const
type ModuleKey = (typeof ALL_MODULES)[number]

// ─── Role display names ───────────────────────────────────────────────────────

const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrador',
  dentist: 'Dentista',
  receptionist: 'Recepcionista',
  patient: 'Paciente',
  dpo: 'DPO',
  auditor: 'Auditor',
  socio: 'Sócio',
  ti: 'TI',
  implantacao: 'Implantação',
  aluno: 'Aluno',
}

// Ordered list of all 11 roles
const ALL_ROLES: AppRole[] = [
  'superadmin', 'admin', 'dentist', 'receptionist',
  'patient', 'dpo', 'auditor', 'socio', 'ti', 'implantacao', 'aluno',
]

// ─── Cell renderer ────────────────────────────────────────────────────────────

function PermissionCell({ role, module: mod }: { role: AppRole; module: ModuleKey }) {
  const access = MODULE_PERMISSIONS[role]?.[mod]

  if (!access?.allowed) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  if (access.readOnly) {
    return (
      <Badge
        variant="outline"
        className="text-xs border-border text-muted-foreground"
      >
        leitura
      </Badge>
    )
  }

  return (
    <span
      className="text-primary font-bold text-base leading-none"
      aria-label="permitido"
    >
      ✓
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PerfisMatrix() {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-32 text-foreground font-semibold">Papel</TableHead>
            {ALL_MODULES.map((mod) => (
              <TableHead
                key={mod}
                className="text-center text-foreground font-semibold text-xs"
              >
                {MODULE_LABELS[mod]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ALL_ROLES.map((role) => (
            <TableRow key={role} className="hover:bg-muted/30">
              <TableCell className="font-medium text-foreground text-sm">
                {ROLE_LABELS[role]}
              </TableCell>
              {ALL_MODULES.map((mod) => (
                <TableCell key={mod} className="text-center">
                  <PermissionCell role={role} module={mod} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
