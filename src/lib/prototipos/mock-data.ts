// ⚠️ MOCK DATA — PROTÓTIPO. Dados 100% fictícios para visualização de telas v2.
// Nada aqui toca Supabase/RLS. Não usar em produção.

export const BRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const BRLcents = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

export const MONTHS_6 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']
export const MONTHS_12 = [
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
]

// ───────────────────────────── Dashboard de Franquias ─────────────────────────────

export interface FranchiseUnit {
  id: string
  name: string
  city: string
  uf: string
  revenue: number // mês corrente
  prevRevenue: number // mês anterior
  occupancy: number // % ocupação de agenda
  appointments: number
  overdueRate: number // % inadimplência
  dentists: number
}

export const FRANCHISE_UNITS: FranchiseUnit[] = [
  { id: 'u1', name: 'FYNXIA Centro',        city: 'São Paulo',      uf: 'SP', revenue: 184500, prevRevenue: 171200, occupancy: 87, appointments: 612, overdueRate: 4.2, dentists: 6 },
  { id: 'u2', name: 'FYNXIA Jardins',       city: 'São Paulo',      uf: 'SP', revenue: 221300, prevRevenue: 198400, occupancy: 91, appointments: 588, overdueRate: 3.1, dentists: 7 },
  { id: 'u3', name: 'FYNXIA Barra',         city: 'Rio de Janeiro', uf: 'RJ', revenue: 142800, prevRevenue: 150100, occupancy: 73, appointments: 471, overdueRate: 6.8, dentists: 5 },
  { id: 'u4', name: 'FYNXIA Savassi',       city: 'Belo Horizonte', uf: 'MG', revenue: 98600,  prevRevenue: 88300,  occupancy: 81, appointments: 392, overdueRate: 5.0, dentists: 4 },
  { id: 'u5', name: 'FYNXIA Moinhos',       city: 'Porto Alegre',   uf: 'RS', revenue: 76400,  prevRevenue: 79900,  occupancy: 68, appointments: 318, overdueRate: 7.4, dentists: 3 },
  { id: 'u6', name: 'FYNXIA Boa Viagem',    city: 'Recife',         uf: 'PE', revenue: 64200,  prevRevenue: 51800,  occupancy: 79, appointments: 287, overdueRate: 4.9, dentists: 3 },
]

// Faturamento da rede — últimos 6 meses (soma de todas as unidades)
export const NETWORK_REVENUE_6M = [612000, 648000, 631000, 689000, 742000, 787800]

export const networkKpis = () => {
  const revenue = FRANCHISE_UNITS.reduce((s, u) => s + u.revenue, 0)
  const prev = FRANCHISE_UNITS.reduce((s, u) => s + u.prevRevenue, 0)
  const appointments = FRANCHISE_UNITS.reduce((s, u) => s + u.appointments, 0)
  const occupancy = FRANCHISE_UNITS.reduce((s, u) => s + u.occupancy, 0) / FRANCHISE_UNITS.length
  const overdue = FRANCHISE_UNITS.reduce((s, u) => s + u.overdueRate, 0) / FRANCHISE_UNITS.length
  const ticket = revenue / appointments
  return {
    revenue,
    revenueDelta: ((revenue - prev) / prev) * 100,
    appointments,
    occupancy,
    overdue,
    ticket,
    units: FRANCHISE_UNITS.length,
  }
}

// ───────────────────────────── Relatórios / BI ─────────────────────────────

// Receita x Despesa — 12 meses (clínica única)
export const REVENUE_12M = [148, 156, 151, 168, 172, 165, 181, 176, 189, 195, 188, 203].map((v) => v * 1000)
export const EXPENSE_12M = [92, 98, 95, 101, 104, 99, 108, 106, 112, 115, 110, 118].map((v) => v * 1000)

export interface DentistProductivity {
  name: string
  appointments: number
  revenue: number
}
export const DENTIST_PRODUCTIVITY: DentistProductivity[] = [
  { name: 'Dra. Marina Alves',     appointments: 142, revenue: 78400 },
  { name: 'Dr. Rafael Costa',      appointments: 128, revenue: 69200 },
  { name: 'Dra. Beatriz Lima',     appointments: 116, revenue: 61800 },
  { name: 'Dr. Thiago Nunes',      appointments: 97,  revenue: 48300 },
  { name: 'Dra. Helena Prado',     appointments: 73,  revenue: 39100 },
]

export type ChartTone = 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5'

export interface PaymentSplit {
  label: string
  value: number
  tone: ChartTone
}
export const PAYMENT_SPLIT: PaymentSplit[] = [
  { label: 'Pix',      value: 96400, tone: 'chart-2' },
  { label: 'Cartão',   value: 58200, tone: 'chart-3' },
  { label: 'Boleto',   value: 31700, tone: 'chart-4' },
  { label: 'Dinheiro', value: 16700, tone: 'chart-1' },
]

export interface ProcedureRow {
  name: string
  count: number
  revenue: number
}
export const TOP_PROCEDURES: ProcedureRow[] = [
  { name: 'Restauração em resina',     count: 184, revenue: 64400 },
  { name: 'Profilaxia / limpeza',      count: 167, revenue: 25050 },
  { name: 'Tratamento de canal',       count: 89,  revenue: 71200 },
  { name: 'Clareamento dental',        count: 64,  revenue: 51200 },
  { name: 'Extração',                  count: 58,  revenue: 17400 },
  { name: 'Implante unitário',         count: 23,  revenue: 80500 },
]

export const biKpis = () => {
  const revenue = REVENUE_12M[REVENUE_12M.length - 1] ?? 0
  const expense = EXPENSE_12M[EXPENSE_12M.length - 1] ?? 0
  const prevRevenue = REVENUE_12M[REVENUE_12M.length - 2] ?? revenue
  const profit = revenue - expense
  return {
    revenue,
    revenueDelta: ((revenue - prevRevenue) / prevRevenue) * 100,
    expense,
    profit,
    margin: (profit / revenue) * 100,
  }
}
