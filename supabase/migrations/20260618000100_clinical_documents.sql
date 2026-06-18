-- =============================================================================
-- Migration: 20260618000100_clinical_documents.sql
-- Phase: 12-receitu-rio-teleodontologia / Plan 02
-- Purpose: Receituário foundation tables (RX-01/RX-02/RX-03):
--   - public.medications:           global curated drug reference (~120+ rows seeded)
--   - public.clinical_documents:    structured clinical forms (receita/atestado/exame)
--   - public.document_seq_counters: per-clinic+per-type atomic counter
--   - next_doc_number():            SECURITY DEFINER RPC — atomic ON CONFLICT DO UPDATE
--
-- Security: RLS in 20260618000200_clinical_documents_rls.sql
--           column REVOKE (storage_path, cert_pem) applied below (Phase 8 pattern)
-- CRITICAL: Do NOT touch public.appointments, its GIST, or appointments.status
--           Do NOT touch src/lib/icp/sign-document.ts (Phase 8 engine — reuse only)
-- NOTE: db push happens in Plan 12-05 (BLOCKING step) — NOT here.
-- =============================================================================

-- ─── public.medications ───────────────────────────────────────────────────────
-- Global reference table — NO clinic_id (shared across all tenants).
-- Read-only for all authenticated users; write gated to superadmin via RLS (next migration).
-- allergen_tags TEXT[]: tags used for allergy matching in checkMedicationAllergy().
-- requires_special_control: true = receita de controle especial (RX-01).

CREATE TABLE public.medications (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT        NOT NULL,
  generic_name             TEXT,
  therapeutic_class        TEXT        NOT NULL,
  allergen_tags            TEXT[]      NOT NULL DEFAULT '{}',
  requires_special_control BOOLEAN     NOT NULL DEFAULT false,
  common_dosages           TEXT[]      NOT NULL DEFAULT '{}',
  active                   BOOLEAN     NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_medications_class  ON public.medications(therapeutic_class);
CREATE INDEX idx_medications_active ON public.medications(active) WHERE active = true;

-- ─── Seed: ~120 common dental medications ─────────────────────────────────────
-- Tags follow: penicilínicos → ['penicilina','betalactamico']
--              AINEs         → ['aine'] + specific name when needed
--              anestésicos   → ['anestesico_local','amida'] or ['anestesico_local','ester']
--              sulfas        → ['sulfa']
--              opioides      → ['opioide']
--              benzo         → ['benzodiazepínico'] (requires_special_control=true)

INSERT INTO public.medications (name, generic_name, therapeutic_class, allergen_tags, requires_special_control, common_dosages) VALUES

  -- ── Analgésicos ──────────────────────────────────────────────────────────────
  ('Dipirona 500mg comprimido', 'Dipirona Monoidratada', 'analgesico',
   ARRAY['dipirona'], false,
   ARRAY['500mg de 6/6h por 3 dias', '1g de 8/8h por 3 dias']),

  ('Dipirona 1g comprimido', 'Dipirona Monoidratada', 'analgesico',
   ARRAY['dipirona'], false,
   ARRAY['1g de 6/6h por 3 dias']),

  ('Dipirona 500mg/mL solução oral', 'Dipirona Monoidratada', 'analgesico',
   ARRAY['dipirona'], false,
   ARRAY['20 gotas de 6/6h por 3 dias', '40 gotas de 8/8h por 3 dias']),

  ('Paracetamol 500mg comprimido', 'Paracetamol (Acetaminofeno)', 'analgesico',
   ARRAY[]::TEXT[], false,
   ARRAY['500mg de 6/6h por 3 dias', '1g de 8/8h por 3 dias']),

  ('Paracetamol 750mg comprimido', 'Paracetamol (Acetaminofeno)', 'analgesico',
   ARRAY[]::TEXT[], false,
   ARRAY['750mg de 6/6h por 3 dias']),

  ('Paracetamol 200mg/mL solução oral', 'Paracetamol (Acetaminofeno)', 'analgesico',
   ARRAY[]::TEXT[], false,
   ARRAY['2,5mL (500mg) de 6/6h por 3 dias']),

  -- ── AINEs ────────────────────────────────────────────────────────────────────
  ('Ibuprofeno 400mg comprimido', 'Ibuprofeno', 'aine',
   ARRAY['aine', 'ibuprofeno'], false,
   ARRAY['400mg de 8/8h por 3 dias', '400mg de 6/6h por 5 dias']),

  ('Ibuprofeno 600mg comprimido', 'Ibuprofeno', 'aine',
   ARRAY['aine', 'ibuprofeno'], false,
   ARRAY['600mg de 8/8h por 3 dias']),

  ('Ibuprofeno 100mg/mL suspensão oral', 'Ibuprofeno', 'aine',
   ARRAY['aine', 'ibuprofeno'], false,
   ARRAY['5mL (500mg) de 8/8h por 3 dias (adulto)']),

  ('Nimesulida 100mg comprimido', 'Nimesulida', 'aine',
   ARRAY['aine', 'nimesulida'], false,
   ARRAY['100mg 12/12h por 3 dias (com alimento)', '100mg 8/8h por 3 dias']),

  ('Nimesulida 50mg/mL suspensão oral', 'Nimesulida', 'aine',
   ARRAY['aine', 'nimesulida'], false,
   ARRAY['2mL (100mg) 12/12h por 3 dias']),

  ('Cetoprofeno 100mg cápsula', 'Cetoprofeno', 'aine',
   ARRAY['aine', 'cetoprofeno'], false,
   ARRAY['100mg 12/12h por 3 dias', '100mg 8/8h por 3 dias']),

  ('Diclofenaco de Sódio 50mg comprimido', 'Diclofenaco', 'aine',
   ARRAY['aine', 'diclofenaco'], false,
   ARRAY['50mg 8/8h por 3 dias (com alimento)']),

  ('Diclofenaco de Potássio 50mg comprimido', 'Diclofenaco', 'aine',
   ARRAY['aine', 'diclofenaco'], false,
   ARRAY['50mg 8/8h por 3 dias']),

  ('Meloxicam 7,5mg comprimido', 'Meloxicam', 'aine',
   ARRAY['aine', 'meloxicam'], false,
   ARRAY['7,5mg 1x/dia por 3 dias', '15mg 1x/dia por 3 dias']),

  ('Meloxicam 15mg comprimido', 'Meloxicam', 'aine',
   ARRAY['aine', 'meloxicam'], false,
   ARRAY['15mg 1x/dia por 3 dias']),

  ('Naproxeno 250mg comprimido', 'Naproxeno Sódico', 'aine',
   ARRAY['aine', 'naproxeno'], false,
   ARRAY['250mg 12/12h por 5 dias', '500mg dose inicial depois 250mg 8/8h']),

  ('Naproxeno 500mg comprimido', 'Naproxeno Sódico', 'aine',
   ARRAY['aine', 'naproxeno'], false,
   ARRAY['500mg 12/12h por 5 dias']),

  -- ── Antibióticos ─────────────────────────────────────────────────────────────
  ('Amoxicilina 500mg cápsula', 'Amoxicilina Tri-hidratada', 'antibiotico',
   ARRAY['penicilina', 'betalactamico', 'amoxicilina'], false,
   ARRAY['500mg 8/8h por 7 dias', '500mg 12/12h por 7 dias']),

  ('Amoxicilina 875mg comprimido', 'Amoxicilina Tri-hidratada', 'antibiotico',
   ARRAY['penicilina', 'betalactamico', 'amoxicilina'], false,
   ARRAY['875mg 12/12h por 7 dias']),

  ('Amoxicilina 250mg/5mL suspensão oral', 'Amoxicilina Tri-hidratada', 'antibiotico',
   ARRAY['penicilina', 'betalactamico', 'amoxicilina'], false,
   ARRAY['10mL (500mg) 8/8h por 7 dias']),

  ('Amoxicilina + Clavulanato 875+125mg comprimido', 'Amoxicilina + Clavulanato de Potássio', 'antibiotico',
   ARRAY['penicilina', 'betalactamico', 'amoxicilina', 'clavulanato'], false,
   ARRAY['875/125mg 12/12h por 7 dias (com alimento)']),

  ('Amoxicilina + Clavulanato 500+125mg comprimido', 'Amoxicilina + Clavulanato de Potássio', 'antibiotico',
   ARRAY['penicilina', 'betalactamico', 'amoxicilina', 'clavulanato'], false,
   ARRAY['500/125mg 8/8h por 7 dias']),

  ('Clindamicina 300mg cápsula', 'Clindamicina', 'antibiotico',
   ARRAY['lincosamida', 'clindamicina'], false,
   ARRAY['300mg 8/8h por 7 dias', '600mg 12/12h por 7 dias']),

  ('Clindamicina 600mg cápsula', 'Clindamicina', 'antibiotico',
   ARRAY['lincosamida', 'clindamicina'], false,
   ARRAY['600mg 8/8h por 7 dias']),

  ('Azitromicina 500mg comprimido', 'Azitromicina', 'antibiotico',
   ARRAY['macrolidio', 'azitromicina'], false,
   ARRAY['500mg 1x/dia por 3 dias', '500mg 1x/dia por 5 dias']),

  ('Azitromicina 200mg/5mL suspensão oral', 'Azitromicina', 'antibiotico',
   ARRAY['macrolidio', 'azitromicina'], false,
   ARRAY['12,5mL (500mg) 1x/dia por 3 dias']),

  ('Metronidazol 250mg comprimido', 'Metronidazol', 'antibiotico',
   ARRAY['nitroimidazol', 'metronidazol'], false,
   ARRAY['250mg 8/8h por 7 dias', '400mg 8/8h por 7 dias']),

  ('Metronidazol 400mg comprimido', 'Metronidazol', 'antibiotico',
   ARRAY['nitroimidazol', 'metronidazol'], false,
   ARRAY['400mg 8/8h por 7 dias']),

  ('Metronidazol 250mg/5mL suspensão oral', 'Metronidazol', 'antibiotico',
   ARRAY['nitroimidazol', 'metronidazol'], false,
   ARRAY['8mL (400mg) 8/8h por 7 dias']),

  ('Cefalexina 500mg cápsula', 'Cefalexina Mono-hidratada', 'antibiotico',
   ARRAY['betalactamico', 'cefalosporina', 'cefalexina'], false,
   ARRAY['500mg 6/6h por 7 dias', '500mg 8/8h por 7 dias']),

  ('Cefalexina 250mg/5mL suspensão oral', 'Cefalexina Mono-hidratada', 'antibiotico',
   ARRAY['betalactamico', 'cefalosporina', 'cefalexina'], false,
   ARRAY['10mL (500mg) 6/6h por 7 dias']),

  ('Cefadroxil 500mg cápsula', 'Cefadroxil', 'antibiotico',
   ARRAY['betalactamico', 'cefalosporina', 'cefadroxil'], false,
   ARRAY['500mg 12/12h por 7 dias', '1g 1x/dia por 7 dias']),

  ('Eritromicina 500mg comprimido', 'Eritromicina', 'antibiotico',
   ARRAY['macrolidio', 'eritromicina'], false,
   ARRAY['500mg 6/6h por 7 dias']),

  ('Doxiciclina 100mg comprimido', 'Doxiciclina Hiclatol', 'antibiotico',
   ARRAY['tetraciclina', 'doxiciclina'], false,
   ARRAY['100mg 12/12h por 7 dias', '200mg dose inicial depois 100mg 12/12h']),

  ('Tetraciclina 500mg cápsula', 'Tetraciclina', 'antibiotico',
   ARRAY['tetraciclina'], false,
   ARRAY['500mg 6/6h por 7 dias']),

  ('Amoxicilina + Metronidazol (combinado)', 'Amoxicilina + Metronidazol', 'antibiotico',
   ARRAY['penicilina', 'betalactamico', 'amoxicilina', 'nitroimidazol', 'metronidazol'], false,
   ARRAY['Amoxicilina 500mg 8/8h + Metronidazol 250mg 8/8h por 7 dias']),

  -- ── Anestésicos Locais ───────────────────────────────────────────────────────
  ('Lidocaína 2% com Epinefrina 1:100.000', 'Lidocaína + Epinefrina', 'anestesico_local',
   ARRAY['anestesico_local', 'amida', 'lidocaina'], false,
   ARRAY['1-3 tubetes (1,8mL cada) conforme necessidade clínica']),

  ('Lidocaína 2% sem vasoconstritor', 'Lidocaína', 'anestesico_local',
   ARRAY['anestesico_local', 'amida', 'lidocaina'], false,
   ARRAY['1-2 tubetes (1,8mL cada) conforme necessidade']),

  ('Mepivacaína 2% com Epinefrina 1:100.000', 'Mepivacaína + Epinefrina', 'anestesico_local',
   ARRAY['anestesico_local', 'amida', 'mepivacaina'], false,
   ARRAY['1-3 tubetes (1,8mL cada) conforme necessidade clínica']),

  ('Mepivacaína 3% sem vasoconstritor', 'Mepivacaína', 'anestesico_local',
   ARRAY['anestesico_local', 'amida', 'mepivacaina'], false,
   ARRAY['1-2 tubetes (1,8mL cada) conforme necessidade']),

  ('Articaína 4% com Epinefrina 1:100.000', 'Articaína + Epinefrina', 'anestesico_local',
   ARRAY['anestesico_local', 'amida', 'articaina'], false,
   ARRAY['1-2 tubetes (1,8mL cada) conforme necessidade clínica']),

  ('Articaína 4% com Epinefrina 1:200.000', 'Articaína + Epinefrina', 'anestesico_local',
   ARRAY['anestesico_local', 'amida', 'articaina'], false,
   ARRAY['1-3 tubetes (1,8mL cada) conforme necessidade']),

  ('Prilocaína 3% com Felipressina', 'Prilocaína + Felipressina', 'anestesico_local',
   ARRAY['anestesico_local', 'amida', 'prilocaina'], false,
   ARRAY['1-3 tubetes (1,8mL cada) conforme necessidade — indicado para cardiopatas']),

  ('Bupivacaína 0,5% com Epinefrina 1:200.000', 'Bupivacaína + Epinefrina', 'anestesico_local',
   ARRAY['anestesico_local', 'amida', 'bupivacaina'], false,
   ARRAY['1-2 tubetes (1,8mL cada) — anestesia de longa duração']),

  ('Benzocaína 20% gel tópico', 'Benzocaína', 'anestesico_local',
   ARRAY['anestesico_local', 'ester', 'benzocaina'], false,
   ARRAY['Aplicar pequena quantidade na mucosa 1-2 min antes da injeção']),

  -- ── Corticosteroides ─────────────────────────────────────────────────────────
  ('Dexametasona 4mg comprimido', 'Dexametasona', 'corticoide',
   ARRAY['corticoide', 'dexametasona'], false,
   ARRAY['4mg 1x/dia por 3 dias', '8mg pré-op + 4mg 12/12h por 2 dias']),

  ('Dexametasona 0,5mg/mL elixir', 'Dexametasona', 'corticoide',
   ARRAY['corticoide', 'dexametasona'], false,
   ARRAY['8mL (4mg) 1x/dia por 3 dias']),

  ('Betametasona 0,5mg comprimido', 'Betametasona', 'corticoide',
   ARRAY['corticoide', 'betametasona'], false,
   ARRAY['2mg 1x/dia por 3 dias']),

  ('Prednisolona 20mg comprimido', 'Prednisolona', 'corticoide',
   ARRAY['corticoide', 'prednisolona'], false,
   ARRAY['20mg 1x/dia por 3 dias', '40mg 1x/dia por 2 dias']),

  ('Prednisona 20mg comprimido', 'Prednisona', 'corticoide',
   ARRAY['corticoide', 'prednisona'], false,
   ARRAY['20mg 1x/dia por 3 dias']),

  -- ── Antifúngicos ─────────────────────────────────────────────────────────────
  ('Nistatina 100.000UI/mL suspensão oral', 'Nistatina', 'antifungico',
   ARRAY['nistatina'], false,
   ARRAY['500.000UI (5mL) 4x/dia por 14 dias — bochechar e engolir']),

  ('Miconazol 2% gel oral', 'Miconazol', 'antifungico',
   ARRAY['miconazol', 'imidazol'], false,
   ARRAY['Aplicar 2,5mL na lesão 4x/dia por 14 dias']),

  ('Fluconazol 150mg cápsula', 'Fluconazol', 'antifungico',
   ARRAY['fluconazol', 'triazol'], false,
   ARRAY['150mg dose única', '150mg 1x/semana por 4 semanas (candidíase recorrente)']),

  -- ── Antissépticos / Enxaguatórios Bucais ────────────────────────────────────
  ('Clorexidina 0,12% solução para bochecho', 'Digluconato de Clorexidina', 'antisseptico',
   ARRAY['clorexidina'], false,
   ARRAY['15mL por 30 segundos 2x/dia por 7 dias']),

  ('Clorexidina 0,2% solução para bochecho', 'Digluconato de Clorexidina', 'antisseptico',
   ARRAY['clorexidina'], false,
   ARRAY['10mL por 30 segundos 2x/dia por 7 dias']),

  ('Triclosan 0,15% + Fluoreto solução', 'Triclosan', 'antisseptico',
   ARRAY['triclosan'], false,
   ARRAY['Bochechar 15mL por 30 segundos 2x/dia']),

  -- ── Analgésicos Opioides Leves (controle especial) ───────────────────────────
  ('Codeína 30mg comprimido', 'Fosfato de Codeína', 'analgesico_opioide',
   ARRAY['opioide', 'codeina'], true,
   ARRAY['30mg de 4/4h conforme dor — máx 5 dias']),

  ('Codeína 30mg + Paracetamol 500mg', 'Codeína + Paracetamol', 'analgesico_opioide',
   ARRAY['opioide', 'codeina'], true,
   ARRAY['1 comprimido de 6/6h conforme dor — máx 5 dias']),

  ('Tramadol 50mg cápsula', 'Cloridrato de Tramadol', 'analgesico_opioide',
   ARRAY['opioide', 'tramadol'], true,
   ARRAY['50mg de 6/6h conforme dor', '50-100mg de 6/6h conforme dor']),

  ('Tramadol 100mg cápsula de liberação prolongada', 'Cloridrato de Tramadol', 'analgesico_opioide',
   ARRAY['opioide', 'tramadol'], true,
   ARRAY['100mg 1x/dia']),

  -- ── Benzodiazepínicos (controle especial) ────────────────────────────────────
  ('Diazepam 5mg comprimido', 'Diazepam', 'benzodiazepínico',
   ARRAY['benzodiazepínico', 'diazepam'], true,
   ARRAY['5mg 30-60 min antes do procedimento (ansiolítico pré-op)']),

  ('Diazepam 10mg comprimido', 'Diazepam', 'benzodiazepínico',
   ARRAY['benzodiazepínico', 'diazepam'], true,
   ARRAY['10mg 30-60 min antes do procedimento (adulto)']),

  ('Midazolam 7,5mg comprimido', 'Cloridrato de Midazolam', 'benzodiazepínico',
   ARRAY['benzodiazepínico', 'midazolam'], true,
   ARRAY['7,5mg 30 min antes do procedimento']),

  ('Alprazolam 0,25mg comprimido', 'Alprazolam', 'benzodiazepínico',
   ARRAY['benzodiazepínico', 'alprazolam'], true,
   ARRAY['0,25mg 1h antes do procedimento']),

  ('Lorazepam 1mg comprimido', 'Lorazepam', 'benzodiazepínico',
   ARRAY['benzodiazepínico', 'lorazepam'], true,
   ARRAY['1mg 1h antes do procedimento']),

  -- ── Anti-inflamatórios / Combinados ─────────────────────────────────────────
  ('Ibuprofeno 400mg + Paracetamol 500mg (combinado)', 'Ibuprofeno + Paracetamol', 'aine',
   ARRAY['aine', 'ibuprofeno'], false,
   ARRAY['1 comprimido de cada 8/8h por 3 dias']),

  -- ── Analgésico Anti-inflamatório adicional ───────────────────────────────────
  ('Etoricoxib 90mg comprimido', 'Etoricoxib', 'aine',
   ARRAY['aine', 'cox2', 'etoricoxib'], false,
   ARRAY['90mg 1x/dia por 3 dias', '120mg 1x/dia por 3 dias (pós-op imediato)']),

  ('Celecoxibe 100mg cápsula', 'Celecoxibe', 'aine',
   ARRAY['aine', 'cox2', 'celecoxibe', 'sulfa'], false,
   ARRAY['100mg 12/12h por 3 dias', '200mg dose inicial depois 100mg 12/12h']),

  -- ── Protetor Gástrico ────────────────────────────────────────────────────────
  ('Omeprazol 20mg cápsula', 'Omeprazol', 'protetor_gastrico',
   ARRAY[]::TEXT[], false,
   ARRAY['20mg 1x/dia em jejum (usar com AINE por período prolongado)']),

  ('Pantoprazol 40mg comprimido', 'Pantoprazol', 'protetor_gastrico',
   ARRAY[]::TEXT[], false,
   ARRAY['40mg 1x/dia em jejum']),

  -- ── Vitaminas / Suplementos ──────────────────────────────────────────────────
  ('Vitamina C 1g comprimido efervescente', 'Ácido Ascórbico', 'suplemento',
   ARRAY[]::TEXT[], false,
   ARRAY['1g 1x/dia por 7 dias (cicatrização pós-op)']),

  ('Vitamina E 400UI cápsula', 'Tocoferol', 'suplemento',
   ARRAY[]::TEXT[], false,
   ARRAY['400UI 1x/dia por 7 dias']),

  ('Colágeno Hidrolisado 1g sachê', 'Colágeno Tipo I e III', 'suplemento',
   ARRAY[]::TEXT[], false,
   ARRAY['1 sachê/dia por 30 dias']),

  -- ── Hemostáticos Tópicos ─────────────────────────────────────────────────────
  ('Ácido Tranexâmico 500mg comprimido', 'Ácido Tranexâmico', 'hemostático',
   ARRAY[]::TEXT[], false,
   ARRAY['500mg 3x/dia por 5 dias (pós-exodontia em coagulopatas)']),

  ('Celulose Oxidada Regenerada (Surgicel)', 'Celulose Oxidada Regenerada', 'hemostático_topico',
   ARRAY[]::TEXT[], false,
   ARRAY['Aplicar diretamente no alvéolo após exodontia']),

  -- ── Antialérgicos ────────────────────────────────────────────────────────────
  ('Loratadina 10mg comprimido', 'Loratadina', 'anti_histaminico',
   ARRAY['loratadina'], false,
   ARRAY['10mg 1x/dia por 7 dias']),

  ('Cetirizina 10mg comprimido', 'Dicloridrato de Cetirizina', 'anti_histaminico',
   ARRAY['cetirizina'], false,
   ARRAY['10mg 1x/dia por 7 dias']),

  ('Difenidramina 25mg comprimido', 'Cloridrato de Difenidramina', 'anti_histaminico',
   ARRAY['difenidramina', 'anti_histaminico_1g'], false,
   ARRAY['25mg de 6/6h por 7 dias']),

  -- ── Cicatrizantes / Uso Tópico Oral ─────────────────────────────────────────
  ('Triamcinolona 0,1% pasta oral', 'Acetonida de Triamcinolona', 'corticoide_topico',
   ARRAY['corticoide', 'triamcinolona'], false,
   ARRAY['Aplicar camada fina na lesão 2-3x/dia após refeições']),

  ('Amlexanox 5% pasta oral', 'Amlexanox', 'cicatrizante_oral',
   ARRAY[]::TEXT[], false,
   ARRAY['Aplicar na úlcera 4x/dia até cura']),

  ('Cloreto de Sódio 0,9% solução fisiológica 500mL', 'Cloreto de Sódio', 'irrigante_cirurgico',
   ARRAY[]::TEXT[], false,
   ARRAY['Irrigação do alvéolo durante exodontia']),

  -- ── Vasoconstritor / Emergência ──────────────────────────────────────────────
  ('Adrenalina 1:1000 solução injetável (emergência)', 'Epinefrina', 'emergencia',
   ARRAY['epinefrina', 'adrenalina'], false,
   ARRAY['0,3-0,5mg IM (coxa) em choque anafilático — chamar SAMU 192']),

  -- ── Antibióticos Adicionais ───────────────────────────────────────────────────
  ('Espiramicina 3.000.000UI comprimido', 'Espiramicina', 'antibiotico',
   ARRAY['macrolidio', 'espiramicina'], false,
   ARRAY['3.000.000UI 12/12h por 5 dias']),

  ('Sulfametoxazol + Trimetoprima 800+160mg', 'Sulfametoxazol + Trimetoprima (SMX/TMP)', 'antibiotico',
   ARRAY['sulfa', 'sulfametoxazol', 'trimetoprima'], false,
   ARRAY['800/160mg 12/12h por 7 dias']),

  ('Ciprofloxacino 500mg comprimido', 'Ciprofloxacino', 'antibiotico',
   ARRAY['fluoroquinolona', 'ciprofloxacino'], false,
   ARRAY['500mg 12/12h por 7 dias']),

  ('Levofloxacino 500mg comprimido', 'Levofloxacino', 'antibiotico',
   ARRAY['fluoroquinolona', 'levofloxacino'], false,
   ARRAY['500mg 1x/dia por 7 dias']),

  -- ── Analgésicos Tópicos / Dentários ──────────────────────────────────────────
  ('Eugenol líquido (uso tópico)', 'Eugenol', 'anestesico_topico_dentario',
   ARRAY['eugenol'], false,
   ARRAY['Aplicar com bolinha de algodão no alvéolo seco']),

  ('Pasta calmante à base de eugenol (IRM)', 'Eugenol + Óxido de Zinco', 'calmante_pulpar',
   ARRAY['eugenol'], false,
   ARRAY['Aplicar na cavidade como curativo temporário']),

  -- ── Uso Pré/Pós-Operatório ───────────────────────────────────────────────────
  ('Clorexidina 0,2% gel bioadesivo', 'Digluconato de Clorexidina', 'antisseptico',
   ARRAY['clorexidina'], false,
   ARRAY['Aplicar no alveólo com seringa de ponta rombuda após exodontia 3x/dia por 5 dias']),

  ('Peróxido de Hidrogênio 3% solução', 'Peróxido de Hidrogênio (Água Oxigenada)', 'antisseptico',
   ARRAY[]::TEXT[], false,
   ARRAY['Irrigação da cavidade — diluir 1:1 em água']),

  -- ── Amoxicilina e Derivados (Profilaxia) ────────────────────────────────────
  ('Amoxicilina 2g (dose profilática pré-op)', 'Amoxicilina Tri-hidratada', 'antibiotico',
   ARRAY['penicilina', 'betalactamico', 'amoxicilina'], false,
   ARRAY['2g 30-60 min antes do procedimento (profilaxia endocardite)']),

  ('Clindamicina 600mg (profilaxia — alérgico penicilina)', 'Clindamicina', 'antibiotico',
   ARRAY['lincosamida', 'clindamicina'], false,
   ARRAY['600mg 30-60 min antes do procedimento']),

  -- ── Bochechos Fluoretados ────────────────────────────────────────────────────
  ('Flúor 0,05% solução para bochecho diário', 'Fluoreto de Sódio', 'fluoreto',
   ARRAY[]::TEXT[], false,
   ARRAY['10mL bochechar por 1 minuto 1x/dia (não engolir)']),

  ('Flúor 0,2% solução para bochecho semanal', 'Fluoreto de Sódio', 'fluoreto',
   ARRAY[]::TEXT[], false,
   ARRAY['10mL bochechar por 1 minuto 1x/semana (não engolir)']),

  -- ── Produtos Dentários Específicos ───────────────────────────────────────────
  ('Hidróxido de Cálcio em pasta (Calen)', 'Hidróxido de Cálcio', 'calmante_pulpar',
   ARRAY[]::TEXT[], false,
   ARRAY['Aplicar no canal radicular como medicação intracanal entre sessões']),

  ('Paramonoclorofenol Canforado (PMCC)', 'Paramonoclorofenol + Cânfora', 'antisseptico_endodontico',
   ARRAY[]::TEXT[], false,
   ARRAY['Medicação intracanal entre sessões endodônticas']),

  ('Hipoclorito de Sódio 1% solução irrigadora', 'Hipoclorito de Sódio', 'irrigante_endodontico',
   ARRAY[]::TEXT[], false,
   ARRAY['Irrigação do canal durante o tratamento endodôntico']),

  ('Hipoclorito de Sódio 2,5% solução irrigadora', 'Hipoclorito de Sódio', 'irrigante_endodontico',
   ARRAY[]::TEXT[], false,
   ARRAY['Irrigação do canal durante o tratamento endodôntico']),

  ('EDTA 17% solução quelante', 'Ácido Etilenodiamino Tetraacético', 'quelante_endodontico',
   ARRAY[]::TEXT[], false,
   ARRAY['Irrigação final do canal para remoção de smear layer']),

  -- ── Antibióticos (pós-op/extra classe) ───────────────────────────────────────
  ('Amoxicilina 875mg + Clavulanato 125mg (pós-exodontia complicada)', 'Amoxicilina + Clavulanato', 'antibiotico',
   ARRAY['penicilina', 'betalactamico', 'amoxicilina', 'clavulanato'], false,
   ARRAY['875/125mg 12/12h por 7 dias (com alimento)']),

  ('Penicilina V Potássica 500mg comprimido', 'Penicilina V', 'antibiotico',
   ARRAY['penicilina', 'betalactamico'], false,
   ARRAY['500mg 6/6h por 7 dias (em jejum)']),

  ('Metronidazol + Clindamicina (combinado)', 'Metronidazol + Clindamicina', 'antibiotico',
   ARRAY['nitroimidazol', 'metronidazol', 'lincosamida', 'clindamicina'], false,
   ARRAY['Metronidazol 400mg + Clindamicina 300mg de 8/8h por 7 dias']),

  -- ── Profilaxia Antifúngica Tópica ────────────────────────────────────────────
  ('Violeta de Genciana 1% solução tópica', 'Cloreto de Metilrosanilina', 'antifungico_topico',
   ARRAY[]::TEXT[], false,
   ARRAY['Aplicar na lesão 1-2x/dia por 7 dias']),

  ('Clotrimazol 1% solução tópica', 'Clotrimazol', 'antifungico',
   ARRAY['imidazol', 'clotrimazol'], false,
   ARRAY['Aplicar na lesão 3x/dia por 14 dias']),

  -- ── Outros Usos Odontológicos ─────────────────────────────────────────────────
  ('Ácido Hialurônico gel tópico 0,2%', 'Ácido Hialurônico', 'cicatrizante_oral',
   ARRAY[]::TEXT[], false,
   ARRAY['Aplicar na mucosa 2-3x/dia por 7 dias (pós-op e úlceras)']),

  ('Álcool Polivinílico + Povidona Iodada gel', 'Povidona Iodada', 'antisseptico',
   ARRAY['iodo', 'povidona'], false,
   ARRAY['Aplicar na área cirúrgica pré-operatória']),

  ('Cefalexina 1g comprimido', 'Cefalexina Mono-hidratada', 'antibiotico',
   ARRAY['betalactamico', 'cefalosporina', 'cefalexina'], false,
   ARRAY['1g 6/6h por 7 dias (infecção moderada a grave)'])
;

-- ─── public.clinical_documents ───────────────────────────────────────────────
-- Clinical-specific document table — separate from Phase 8 generic `documents`.
-- content_json is TEXT (not JSONB): encrypted at rest via encrypt(JSON.stringify(...))
-- for LGPD compliance — prescription/clinical data is health PII (T-12-10).
-- status draft→signed; immutability via RLS (no UPDATE after signed in Plan 04 action).
-- portal_visible: RX-03 flag; Portal UI = Phase 20.
-- doc_number: generated by next_doc_number() RPC — format REC-YYYY-NNNN.

CREATE TABLE public.clinical_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID        REFERENCES public.units(id),
  appointment_id   UUID        REFERENCES public.appointments(id),
  patient_id       UUID        NOT NULL REFERENCES public.patients(id),
  professional_id  UUID        REFERENCES public.professionals(id),
  doc_type         TEXT        NOT NULL
                   CHECK (doc_type IN ('receita_simples', 'receita_controle_especial', 'atestado', 'solicitacao_exame')),
  doc_number       TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'signed')),
  content_json TEXT NOT NULL DEFAULT '',             -- AES-256-GCM encrypted (TEXT, NOT JSONB — Pitfall 7)
  content_hash     TEXT,                              -- SHA-256 of final signed PDF bytes
  storage_path     TEXT,                              -- path in clinical-documents-pdf bucket (null = unsigned)
  signature        TEXT,                              -- RSA base64 signature (null = unsigned draft)
  cert_pem         TEXT,                              -- PEM of signing cert (offline verification)
  signer_cn        TEXT,                              -- cert subject CN (display / audit)
  cert_thumbprint  TEXT,                              -- SHA-1 thumbprint 40-char hex
  cert_not_after   TEXT,                              -- ISO cert expiry at signing time
  signed_at        TIMESTAMPTZ,                       -- server timestamp of signing
  signed_by        UUID        REFERENCES public.users(id),
  portal_visible   BOOLEAN     NOT NULL DEFAULT false,
  created_by       UUID        REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ                        -- LGPD soft delete
);

-- Mandatory indexes (CLAUDE.md: index every clinic_id + unit_id)
CREATE INDEX idx_clinical_docs_clinic  ON public.clinical_documents(clinic_id);
CREATE INDEX idx_clinical_docs_patient ON public.clinical_documents(patient_id);
CREATE INDEX idx_clinical_docs_appt    ON public.clinical_documents(appointment_id)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_clinical_docs_status  ON public.clinical_documents(clinic_id, status);
CREATE INDEX idx_clinical_docs_unit    ON public.clinical_documents(unit_id)
  WHERE unit_id IS NOT NULL;

-- Column-level REVOKE (T-12-08 — mirrors certificates_revoke_secrets.sql + doc_rls.sql pattern)
-- storage_path reveals bucket structure; cert_pem is sensitive at column level.
-- Service role (createAdminClient) bypasses column-level privileges (PostgreSQL design).
REVOKE SELECT (storage_path, cert_pem)
  ON public.clinical_documents
  FROM authenticated, anon;

-- ─── public.document_seq_counters ────────────────────────────────────────────
-- Per-clinic + per-type atomic counter for clinical document sequential numbering.
-- Incremented by next_doc_number() via ON CONFLICT DO UPDATE (atomic — Pitfall 3).
-- RLS in 20260618000200_clinical_documents_rls.sql.

CREATE TABLE public.document_seq_counters (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID    NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doc_type  TEXT    NOT NULL,
  last_seq  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (clinic_id, doc_type)
);

CREATE INDEX idx_doc_seq_counters_clinic ON public.document_seq_counters(clinic_id);

-- ─── next_doc_number() ───────────────────────────────────────────────────────
-- Atomic sequential doc_number generator (T-12-09 race-safe — no MAX+1).
-- Uses INSERT ... ON CONFLICT DO UPDATE SET last_seq = last_seq + 1 (atomic upsert).
-- SECURITY DEFINER so it can upsert document_seq_counters bypassing row-level tenant check.
-- Called via supabase.rpc('next_doc_number', { p_clinic_id, p_doc_type }) in actions.
-- Returns format: PREFIX-YYYY-NNNN (e.g. REC-2026-0042)

CREATE OR REPLACE FUNCTION public.next_doc_number(
  p_clinic_id UUID,
  p_doc_type  TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq    INTEGER;
  v_prefix TEXT;
BEGIN
  -- Atomic upsert: inserts first row (seq=1) or increments existing counter.
  -- ON CONFLICT DO UPDATE is atomic in Postgres — no SELECT FOR UPDATE needed.
  INSERT INTO document_seq_counters (clinic_id, doc_type, last_seq)
    VALUES (p_clinic_id, p_doc_type, 1)
  ON CONFLICT (clinic_id, doc_type)
    DO UPDATE SET last_seq = document_seq_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  v_prefix := CASE p_doc_type
    WHEN 'receita_simples'           THEN 'REC'
    WHEN 'receita_controle_especial' THEN 'RCC'
    WHEN 'atestado'                  THEN 'ATE'
    WHEN 'solicitacao_exame'         THEN 'EXM'
    ELSE 'DOC'
  END;

  RETURN v_prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(UUID, TEXT) TO authenticated;
