-- Phase 3: RLS policies for financial tables
-- Pattern: USING + WITH CHECK via get_my_tenant_id() (T-3-01)
-- webhook_events intentionally has NO RLS (T-3-04 — service-role only)

-- ============ financial_categories (D-05, T-3-03) ============
-- All tenant members SELECT; only admin INSERT/UPDATE/DELETE
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_categories_tenant_read" ON public.financial_categories
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "financial_categories_admin_write" ON public.financial_categories
  FOR ALL
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'admin')
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'admin');

-- ============ charges (FIN-04, FIN-05, FIN-06, T-3-01) ============
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "charges_tenant_read" ON public.charges
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "charges_staff_write" ON public.charges
  FOR ALL
  USING (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'))
  WITH CHECK (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'));

-- ============ receivables (FIN-03, FIN-06, T-3-01) ============
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receivables_tenant_read" ON public.receivables
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "receivables_staff_write" ON public.receivables
  FOR ALL
  USING (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'))
  WITH CHECK (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'));

-- ============ financial_transactions (FIN-01, FIN-02, T-3-01, T-3-02) ============
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_transactions_tenant_read" ON public.financial_transactions
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "financial_transactions_staff_write" ON public.financial_transactions
  FOR ALL
  USING (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'))
  WITH CHECK (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'));

-- ============ webhook_events: NO RLS (T-3-04) ============
-- webhook handler uses createAdminClient() (service role) — never queried by client
-- DO NOT add ENABLE ROW LEVEL SECURITY here

-- ============ collection_rules (FIN-07, D-10, T-3-03) ============
-- SELECT for all tenant members; write gated to admin only
ALTER TABLE public.collection_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_rules_tenant_read" ON public.collection_rules
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "collection_rules_admin_write" ON public.collection_rules
  FOR ALL
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'admin')
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'admin');

-- ============ collection_log (FIN-07, D-10, T-3-01) ============
ALTER TABLE public.collection_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_log_tenant_read" ON public.collection_log
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "collection_log_staff_write" ON public.collection_log
  FOR ALL
  USING (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'))
  WITH CHECK (tenant_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'dentist', 'receptionist', 'superadmin'));
