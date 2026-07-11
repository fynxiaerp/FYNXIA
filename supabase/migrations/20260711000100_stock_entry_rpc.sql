-- WR-04: create_stock_entry RPC — entrada de estoque atômica.
--
-- Antes, createStockEntry fazia 5 round-trips sem transação (SUM saldo →
-- read custo_medio → insert lote → insert entrada → update custo_medio).
-- Duas entradas concorrentes para o mesmo produto liam o mesmo custo_medio/saldo
-- e a segunda sobrescrevia a primeira (lost update no custo médio móvel); uma
-- falha após o insert do lote deixava lote órfão sem entrada correspondente.
--
-- Este RPC roda tudo numa única transação. O SELECT ... FOR UPDATE na linha do
-- produto serializa entradas concorrentes do mesmo produto, garantindo que o
-- custo médio móvel seja recalculado sobre o saldo já atualizado pela entrada
-- anterior. SECURITY INVOKER: respeita a RLS admin_write (o chamador é
-- admin/superadmin — gate já aplicado na Server Action).

CREATE OR REPLACE FUNCTION public.create_stock_entry(
  p_clinic_id      UUID,
  p_unit_id        UUID,
  p_product_id     UUID,
  p_numero_lote    TEXT,
  p_numero_anvisa  TEXT,
  p_data_validade  DATE,
  p_qtd            NUMERIC,
  p_custo_unitario NUMERIC,
  p_supplier_id    UUID,
  p_nota_fiscal    TEXT,
  p_created_by     UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_saldo_atual    NUMERIC(12,4);
  v_custo_anterior NUMERIC(12,4);
  v_novo_custo     NUMERIC(12,4);
  v_batch_id       UUID;
  v_entry_id       UUID;
BEGIN
  -- Trava a linha do produto para serializar entradas concorrentes (WR-04).
  SELECT custo_medio INTO v_custo_anterior
  FROM public.products
  WHERE id = p_product_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  -- Saldo atual da unidade = SUM(saldo_disponivel) dos lotes vivos.
  SELECT COALESCE(SUM(saldo_disponivel), 0) INTO v_saldo_atual
  FROM public.product_batches
  WHERE product_id = p_product_id
    AND unit_id = p_unit_id
    AND deleted_at IS NULL;

  -- Custo médio móvel (D-02) — mesmo guard de calcularCustoMedioMovel:
  -- saldo_atual <= 0 (primeiro lote/zerado) OU novo_saldo <= 0 → custo_unitario puro.
  IF v_saldo_atual <= 0 OR (v_saldo_atual + p_qtd) <= 0 THEN
    v_novo_custo := round(p_custo_unitario, 4);
  ELSE
    v_novo_custo := round(
      (v_saldo_atual * v_custo_anterior + p_qtd * p_custo_unitario) / (v_saldo_atual + p_qtd),
      4
    );
  END IF;

  -- Novo lote.
  INSERT INTO public.product_batches (
    clinic_id, unit_id, product_id, numero_lote, numero_anvisa,
    data_validade, qtd_inicial, saldo_disponivel, custo_unitario
  ) VALUES (
    p_clinic_id, p_unit_id, p_product_id, p_numero_lote, p_numero_anvisa,
    p_data_validade, p_qtd, p_qtd, p_custo_unitario
  ) RETURNING id INTO v_batch_id;

  -- Registro da entrada.
  INSERT INTO public.stock_entries (
    clinic_id, unit_id, product_id, batch_id, supplier_id,
    qtd, custo_unitario, custo_medio_apos, nota_fiscal, created_by
  ) VALUES (
    p_clinic_id, p_unit_id, p_product_id, v_batch_id, p_supplier_id,
    p_qtd, p_custo_unitario, v_novo_custo, p_nota_fiscal, p_created_by
  ) RETURNING id INTO v_entry_id;

  -- Custo médio denormalizado no produto (D-02).
  UPDATE public.products
  SET custo_medio = v_novo_custo
  WHERE id = p_product_id AND clinic_id = p_clinic_id;

  RETURN v_entry_id;
END;
$$;

COMMENT ON FUNCTION public.create_stock_entry IS
  'Entrada de estoque atômica (WR-04): lote + entrada + custo médio móvel numa transação, com FOR UPDATE no produto para serializar concorrência.';
