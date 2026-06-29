'use client'

// ContaCorrenteSelector — client component for ?conta= nuqs URL state.
// Used in Conciliação page header. Mirrors CashFlowFilters pattern.

import { useQueryState } from 'nuqs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type BankAccountOption = { id: string; name: string; ativo: boolean }

interface ContaCorrenteSelectorProps {
  bankAccounts: BankAccountOption[]
  selectedContaId: string
}

export function ContaCorrenteSelector({ bankAccounts }: ContaCorrenteSelectorProps) {
  const [conta, setConta] = useQueryState('conta', { defaultValue: '' })

  return (
    <Select
      value={conta || 'none'}
      onValueChange={(v) => setConta(v === 'none' ? '' : v)}
    >
      <SelectTrigger className="w-52">
        <SelectValue placeholder="Selecione a conta">
          {conta && conta !== 'none' ? (bankAccounts.find(ba => ba.id === conta)?.name ?? 'Selecione a conta') : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Selecione a conta…</SelectItem>
        {bankAccounts.map((ba) => (
          <SelectItem key={ba.id} value={ba.id}>
            {ba.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
