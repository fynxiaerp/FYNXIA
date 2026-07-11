/**
 * lib/stock/custo-medio.ts — Custo Médio Móvel (D-02)
 *
 * Pure function, no side effects, no DB access. Importable by Server Actions
 * (src/actions/stock-entries.ts) and by unit tests without mocking Supabase.
 *
 * Fórmula (padrão brasileiro, D-02 do CONTEXT.md):
 *   novo_custo = (saldo_atual × custo_anterior + qtd_entrada × custo_unitario) / novo_saldo
 *
 * Guard (Pitfall 6 RESEARCH): se saldo_atual <= 0 (primeiro lote ou saldo zerado/negativo),
 * o novo custo médio é simplesmente o custo_unitario da entrada — não pondera com um custo
 * anterior que não representa nenhum saldo real.
 *
 * Resultado sempre arredondado a 4 casas decimais (NUMERIC(12,4) no banco).
 *
 * Phase: 17-estoque-materiais / Plan 03
 * Requirements: EST-01
 */

export function calcularCustoMedioMovel(
  saldoAtual: number,
  custoAnterior: number,
  qtdEntrada: number,
  custoUnitario: number,
): number {
  // Guard divisão por zero / primeiro lote (Pitfall 6): saldo_atual <= 0 → custo_unitario puro
  if (saldoAtual <= 0) return custoUnitario

  const novoSaldo = saldoAtual + qtdEntrada
  if (novoSaldo <= 0) return custoUnitario

  const custo = (saldoAtual * custoAnterior + qtdEntrada * custoUnitario) / novoSaldo
  return Number(custo.toFixed(4))
}
