# Feature Landscape: FYNXIA Dental ERP

**Domain:** Dental clinic ERP/management SaaS — Brazil market
**Researched:** 2026-06-02
**Confidence:** HIGH (market leaders verified, regulatory sources official)

---

## Context: Brazilian Dental ERP Market

Brazil has the largest dental market in Latin America. The dental practice management software segment is projected to reach USD 74.5M by 2030 (CAGR 10.9%). Key competitors and reference products:

- **Clinicorp** — Market leader, 70+ features, ARR near R$100M, growing 40%/year. Recently launched AI agents.
- **Simples Dental** — Strong mid-market, 100k+ dentists, known for usability and WhatsApp integration.
- **Dental Office** — Feature-complete, strong in teleodontology and digital platforms.
- **Capim** — Newer, mobile-first, differentiates on built-in patient financing ("Crédito Capim", up to 36x).
- **Codental, Prontuário Verde, IZI Soft, Amplimed** — Niche players covering specific segments.

The market is moving toward: AI-driven automation of confirmations/collections, WhatsApp as primary communication channel, embedded payments, and multi-unit management for franchise networks.

---

## Table Stakes

Features users expect at baseline. Missing any of these and the product feels incomplete — clinics will not switch or will churn quickly.

### Clinical Module

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-professional appointment calendar | Every clinic has multiple dentists with independent schedules | Medium | Color-coding by dentist, specialty, status. Block/buffer time between appointments. |
| Appointment status workflow | Scheduled → Confirmed → Arrived → In Progress → Completed / No-show | Low | No-show tracking is essential for absenteeism KPIs (15–20% rate in Brazil). |
| Patient registration (cadastro) | Legal and operational minimum | Low | CPF (mandatory, unique per tenant), full name, phone, email, birth date, address. |
| Digital odontogram | Clinical standard in Brazil; required in records per CFO guidelines | High | Interactive tooth chart. Must record per-tooth status, procedures planned vs completed. Visually driven. |
| Clinical records (prontuário eletrônico) | CFO Resolution 91/2009 authorizes paperless records; clinics need digital audit trail | High | Anamnesis, clinical notes per visit, procedure history, prescriptions, documents. Must support electronic signature for legal validity (ICP-Brasil NGS2 compliance). |
| Treatment plan with budget (plano de tratamento / orçamento) | Core clinical workflow. Patients approve a plan before treatment starts | Medium | Link procedures to teeth on odontogram, assign prices, stage by session. Budget approval tracked (pending, approved, in progress, completed). |
| Automated appointment reminders via WhatsApp | Market standard — reduces no-shows by 32–45%; every competitor offers this | Medium | Send 24h before appointment. Two-way: patient replies confirm/cancel, status updates in agenda. Requires WhatsApp Business API integration. |
| Patient document storage | Consent forms, X-rays, treatment contracts need to be attached | Medium | Upload/associate images and PDFs to patient or appointment record. Store in Supabase Storage. |
| Digital anamnesis | Replaces paper health history forms. Expected by patients in modern clinics | Medium | Configurable questionnaire. Send via link (WhatsApp/email). Patient fills before first visit. Electronically signed. |
| Return/recall scheduling | Controls which patients need follow-up and when | Low | Set return alert date per patient or per completed treatment. |
| Appointment online booking link | Patients expect self-scheduling, especially outside business hours | Medium | Public URL the clinic shares on WhatsApp, Google Business, website. Respects dentist availability rules set in system. |

### Financial Module

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Accounts receivable per patient | Core financial control — track what each patient owes, installments, due dates | Medium | Link to treatment plan. Track partial payments. Show outstanding balance. |
| Cash flow (fluxo de caixa) | Minimum for clinic owner to know if the business is profitable | Medium | Daily/weekly/monthly view. Income vs expense. Projection forward. |
| Pix payment integration | Pix is the dominant payment method in Brazil (mandatory) | Medium | Receive via Pix, automatic payment confirmation ("baixa automática"). QR code generation and link. |
| Boleto bancário | Still required for certain patients and corporate billing | Medium | Generate, send via email/WhatsApp, track payment status. |
| Credit/debit card | Via payment link or POS integration. Expected for larger treatment values | Medium | Integration with payment gateway (Asaas, PagSeguro, or Stripe). |
| Installment plan control | Most dental treatments are expensive; patients pay in parcelas | Medium | Set number of installments, due dates, payment method per installment. Track each installment status. |
| Receipt/recibo generation | Clinics must provide proof of payment | Low | Printable/downloadable receipt per transaction. |
| NFSe (Nota Fiscal de Serviço eletrônica) emission | Required for fiscal compliance. Prefectura integration | High | Certificate A1 required. NFSe Nacional standard (replacing 100+ municipal layouts). Note: this is high complexity due to fragmented municipal APIs. |
| Dentist commission calculation | Most clinics pay dentists by procedure % | Medium | Configure per-dentist commission rules (% per procedure category). Auto-calculate at period close. |
| Accounts payable (contas a pagar) | Operational control of clinic expenses | Low | Register supplier invoices, recurring bills, due dates. |
| Inadimplência dashboard | Clinics need to know who owes what, overdue by how long | Low | Filter receivables by status: current, overdue 1-30d, 31-60d, 60d+. |
| Basic financial reports | Owner needs monthly income/expense summary | Low | Period P&L, cash flow report, receivables aging. |

### Configuration / Admin

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Role-based access control (RBAC) | Receptionist must not see financial totals; dentist must not edit billing | Low | Roles: Admin, Dentist, Receptionist. Granular permission flags per module. |
| Clinic profile setup | Business name, CNPJ, logo, address, opening hours | Low | Used in documents, receipts, NF headers. |
| Dentist profile with CRO number | CRO (Conselho Regional de Odontologia) is the professional registration number — required in records | Low | CRO number, specialty, schedule availability, commission %. |
| Procedure catalog (tabela de procedimentos) | Standardize procedure names, codes, default prices | Low | Reusable when building treatment plans. Tuss code (for insurance) optional at v1. |

---

## Differentiators

Features that set a product apart in the Brazilian dental ERP market. Not baseline expectations, but valued when present and a reason to choose one product over another.

### Automation & Communication

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI scheduling agent (reagendamento automático) | Clinicorp's AI agents confirm appointments, recover no-shows, and re-book without human intervention. 32–45% reduction in no-shows. | High | Requires WhatsApp Business API + LLM logic. FYNXIA's AI agent layer is a planned differentiator. |
| Automated collection sequence (régua de cobrança) | Automated multi-step collection via WhatsApp, email, SMS. Reduces inadimplência by ~30%. | Medium | Configure triggers: 3 days before due, due date, 7 days overdue, 30 days overdue. Each step has message template and channel. |
| Treatment budget recovery automation | Automatically follow up on approved-but-not-started or abandoned treatment plans | Medium | CRM-triggered: patient approved budget 30 days ago and has not returned — trigger outreach. |
| Birthday/recall automation | Humanizes the clinic relationship; drives return visits | Low | Automated WhatsApp message on patient birthday or when return date arrives. |
| Post-consultation NPS/feedback collection | Builds online reputation; surfaces issues before they become reviews | Low | Send satisfaction survey via WhatsApp 24h after appointment. |

### Financial Sophistication

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Embedded patient financing (crédito ao paciente) | Capim's "Crédito Capim" (up to 36x installments) is a proven differentiator; enables higher treatment ticket acceptance | High | Requires fintech partnership (Asaas, Adyen, or white-label credit partner). Not v1 unless partnership is pre-arranged. |
| Automatic bank reconciliation (conciliação bancária) | Eliminates manual matching of bank statement to system records | High | Integration with Open Banking or bank OFX import. Match incoming Pix/boleto payments to open receivables automatically. |
| Payment link generation | Send a payment link via WhatsApp for remote payment | Low | Single URL that opens Pix QR or card form. Easy win via gateway integration. |
| Recurrent billing (cobrança recorrente) | Clinics with maintenance programs (orthodontics monthly, implant stages) need auto-charge | Medium | Tokenized card or recurring Pix. Less mature in Brazil but growing demand. |
| Insurance/convenio guide tracking | ~32M Brazilians have dental insurance (ANS data, 2025). Clinics credentialed with OdontoPrev, Unimed need guide submission and reimbursement tracking | High | Complex: each insurer has different guide format and reimbursement rules. Defer TISS integration to post-MVP. Track manually in v1 with guide upload. |

### Clinical Intelligence

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI-assisted clinical notes (voice or structured input) | Clinicorp launched Voice Control — dentist dictates, AI fills the prontuário | High | High differentiation but requires careful accuracy validation in medical context. |
| Treatment plan visual presentation for patient | Show the odontogram with highlighted teeth and proposed procedures to the patient on screen/tablet | Medium | Increases budget acceptance rate. Visual proposal is more persuasive than text list. |
| Before/after photo management | Aesthetic dentistry drives revenue; clinics want photo evidence linked to patient | Medium | Upload/tag photos by tooth/treatment. Side-by-side comparison view. |
| Clinical alerts (drug interactions, allergy flags) | Anamnesis data surfaced as warnings when creating prescriptions | Medium | Flag if patient reported allergy to a drug being prescribed. Requires drug database or simple free-text matching. |

### Practice Management

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Executive dashboard with KPIs | Clinic owner's single screen: ocupação, inadimplência, ticket médio, faturamento. Most competitors have this but poorly executed | Medium | Key KPIs: schedule occupancy %, no-show rate, conversion rate (budgets), monthly revenue, outstanding receivables, inadimplência rate. |
| Multi-unit / franchise management | FYNXIA targets franchise networks — consolidated reporting across units is a key differentiator for that segment | High | Network-level dashboard: per-unit and aggregated KPIs. Central admin can configure procedures/prices. Unit-level isolation via tenant architecture. |
| Waiting list management | When a slot opens (cancellation), automatically offer it to patients on waitlist | Low | Simple queue per dentist/specialty. Trigger WhatsApp notification when slot opens. |
| Inventory with auto-alert | Reduce stockouts, track expiry | Medium | Min stock threshold alerts, expiry date tracking per batch. Not in MVP core but expected in complete systems. |
| Patient portal / app | Patients view appointments, receive documents, sign consent forms | High | Defer to post-MVP. Complex UX. Competitors do it poorly. |

---

## Anti-Features

Things FYNXIA should deliberately NOT build in v1. Each adds complexity without proportional value at early stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full TISS insurance integration (ANS standard) | TISS is a complex XML-based standard with 100+ insurer variations. Each insurer negotiates rules separately. High integration effort, high maintenance burden, low addressable market in v1 (most small clinics are not heavily insurance-dependent) | Allow manual guide upload and free-text tracking. Build proper TISS in v2 after customer demand validates it. |
| Custom report builder | Users request it but rarely use it. Adds UI/data complexity without immediate retention value | Ship 6–8 pre-built reports that cover 90% of use cases. Add export to CSV/Excel. |
| Native mobile app (iOS/Android) | High cost, separate codebase, slow iteration. PWA with responsive design covers most usage patterns in a clinic setting (tablets, laptops) | Build responsive web. PWA with offline-lite for schedule view. Native app is a post-Series A project. |
| Teleodontology video consultation | CFO Resolution 278/2025 regulates this. Real clinical value is limited for physical procedures. High complexity to build compliant video + clinical workflow integration | Add external video link field (Google Meet, Zoom URL) in appointment if needed. Do not build native video. |
| Imaging / CBCT viewer | Dental imaging software (Romexis, Carestream, Sidexis) is a separate specialist category. Integration is complex and highly hardware-dependent. Clinics already have dedicated imaging software | Allow document upload (PDF/JPEG/DICOM link). Do not attempt to render DICOM natively. |
| Lab/prosthetics order management | Integration with dental labs is niche (implants, prosthetics specialists). Low ROI for general dentistry MVP | Add a "lab request" text note field in treatment plan. Full lab module is v3+. |
| CRM/marketing campaign builder | Email marketing and campaign automation is a separate product category. Competitors bolt this on badly. | Use WhatsApp notifications and automated sequences for retention. Integrate with external tools (ActiveCampaign) via webhook. |
| SPC/credit score consultation | Clinicorp offers this but it is a minor feature. Adds legal liability, third-party dependency | Flag overdue patients manually. SPC integration is a bolt-on, not a core feature. |
| Multi-currency support | Irrelevant for Brazilian market. All transactions in BRL | Hard-code BRL. Currency handling adds complexity with no use case. |
| Patient-facing app with real-time chat | Patients already use WhatsApp. Building a proprietary chat nobody checks is wasted effort | All patient communication goes through WhatsApp integration. |
| Telemedicine/triage form for general health | FYNXIA is dental-specific. General health intake forms dilute the domain focus | Keep anamnesis dental-specific (CFO-aligned forms). |

---

## Patient Journey Mapping

The full lifecycle from first contact to completed payment, mapped to system features required at each stage.

```
AWARENESS → BOOKING → INTAKE → CLINICAL → BILLING → RETENTION
```

### Stage 1: Awareness / Lead Capture
- Patient finds clinic on Google Maps, social media, referral
- Clicks booking link on Google Business profile, WhatsApp, or clinic website
- **System requirement:** Public booking link (agendamento online) that respects dentist availability

### Stage 2: Booking
- Patient selects dentist, specialty, date/time
- System confirms slot and creates appointment with status "Scheduled"
- Patient receives WhatsApp confirmation with appointment details
- **System requirements:** Online booking widget, appointment creation, WhatsApp confirmation message

### Stage 3: Pre-appointment Engagement (24–48h before)
- Automated reminder sent via WhatsApp: "Your appointment is tomorrow at 14h with Dr. Ana. Please confirm."
- Patient clicks Confirm → status updates to "Confirmed"
- Patient clicks Cancel → slot freed, waitlist notified (optional)
- New patient: receives anamnesis link to complete before arriving
- **System requirements:** Automated reminder, two-way status update, anamnesis link dispatch

### Stage 4: Arrival & Check-in
- Receptionist marks patient as "Arrived" in agenda
- For new patient: reviews completed anamnesis, prints/confirms consent
- **System requirements:** Appointment status update, patient record view with anamnesis data

### Stage 5: Clinical Consultation
- Dentist opens patient record: views anamnesis, allergy flags, previous history
- Updates odontogram with current findings
- Creates or updates treatment plan with planned procedures and costs
- Presents budget visually to patient (on screen/printed)
- Patient approves budget (signature or verbal — document in system)
- Dentist writes clinical note for the session
- **System requirements:** Odontogram editor, treatment plan creation, budget approval tracking, clinical notes per visit

### Stage 6: Payment / Billing
- Receptionist creates financial transaction linked to patient and treatment plan
- Patient chooses payment method: Pix (QR displayed/sent), boleto, credit card
- Pix: QR generated, system polls for confirmation, auto-marks as paid
- Boleto: PDF generated, sent to patient email/WhatsApp
- Credit card: payment link sent, patient pays on phone
- Installment plan: create schedule of future installments
- Receipt generated and sent
- **System requirements:** Payment method selection, Pix/boleto/card generation, automatic reconciliation, installment plan, receipt generation

### Stage 7: NFSe (optional, depends on clinic regime)
- If clinic operates as Simples Nacional with ISS obligation, issue NFSe
- **System requirements:** NFSe emission integration with municipal API (Certificate A1)

### Stage 8: Post-consultation
- 24h later: satisfaction survey sent via WhatsApp (optional)
- Return date set in patient record
- **System requirements:** Return date scheduler, optional NPS automation

### Stage 9: Retention / Recall
- 30/60/90 days before return date: automated recall message via WhatsApp
- Abandoned treatment: patient approved budget but hasn't returned → AI agent triggers outreach
- Overdue payment: automated collection sequence via WhatsApp
- Birthday: automated message
- **System requirements:** Recall automation, CRM triggers, collection sequence

---

## Brazil-Specific Requirements

### LGPD (Lei Geral de Proteção de Dados — Law 13709/2018)

Health data is classified as **sensitive personal data** under LGPD Article 5, XII, requiring stricter treatment than ordinary personal data.

**Mandatory technical controls:**

| Requirement | Implementation |
|-------------|----------------|
| Explicit consent for data collection | Consent checkbox at patient registration. Store consent timestamp and version. |
| Purpose specification | Log what data is collected and why. Cannot use health data for other purposes without new consent. |
| Access log (who viewed what) | `audit_logs` table captures all reads/writes with `user_id`, `timestamp`, `table`, `record_id`. Immutable via RLS policy. |
| Right to data portability | Patient can request export of all their data. Must be fulfillable within 15 days. |
| Right to erasure (direito ao esquecimento) | `deleted_at` soft-delete. Clinical records have legal retention obligation (20 years per CFO), so true erasure applies only to non-clinical PII. Requires legal analysis. |
| Data minimization | Only collect what is necessary. Do not store unnecessary fields. |
| Encryption at rest | Supabase AES-256 at rest. Sensitive fields (CPF, medical_history) additionally encrypted at application layer. |
| Data breach notification | Must notify ANPD within 72 hours of discovery of a breach affecting sensitive data. |
| DPA (Encarregado de Dados) | Clinic must designate a DPO. FYNXIA should provide tooling to record this. |
| Third-party processing agreements | WhatsApp (Meta), payment gateways, and AI APIs are subprocessors. DPA agreements required with each. |

**Confidence:** HIGH — sourced from Lei 13709/2018 text, CROSP and ABRO dental council guidance, and Clinicorp LGPD documentation.

### CFO (Conselho Federal de Odontologia) Regulations

| Regulation | Requirement |
|------------|-------------|
| CFO Resolution 91/2009 | Electronic records valid without paper if system meets NGS2 (Nível de Garantia de Segurança 2). Requires electronic signature using ICP-Brasil certificate. |
| CFO Manual do Prontuário (2026) | Prontuário must include: identification, anamnesis, clinical examination, diagnosis, treatment plan, evolution notes, prescriptions, exam results. Minimum retention: 20 years or 5 years after patient death. |
| CFO Resolution 278/2025 | Teleodontologia regulated. Teleconsulta permitted if records are maintained compliant with LGPD and stored properly. |
| CRO number mandatory | Every dentist using the system must have CRO number recorded. Appears on documents and records. |

**Practical implication for FYNXIA:** In v1, electronic signature for clinical records is the highest-risk compliance gap. Options: (a) use a third-party e-signature provider (DocuSign, D4Sign — Brazilian ICP-Brasil compliant), (b) accept physical signature with scanned upload initially, (c) build native ICP-Brasil signature. Option (a) is recommended for v1.

### Payment Methods (Mandatory in Brazilian Market)

| Method | Mandatory? | Notes |
|--------|-----------|-------|
| Pix | Yes — dominant | Instant, 24/7, zero MDR for receiving. Clinics expect auto-confirmation. Gateway: Asaas, Pagar.me, Efí Bank. |
| Boleto bancário | Yes — still required | 3-day expiry standard. Used for corporate patients, installment plans. Gateway: same as above. |
| Cartão de crédito | Yes — for larger values | Via payment link (remote) or machine (in-person, handled by clinic's own POS). Integration via payment link is enough for v1. |
| Cartão de débito | Recommended | Less common in dental but expected. Covered by same payment link gateway. |
| Recorrência (subscription) | Differentiator, not mandatory | Tokenized card or Pix recurring. Growing demand for orthodontic monthly plans. |

**Recommended gateway for v1:** Asaas — natively supports Pix, boleto, credit card, installments, payment links, and has a well-documented REST API with SDKs. Already referenced by Simples Dental. Alternatively: Pagar.me (Stone group) for broader banking relationships.

### Fiscal / Tax Requirements

| Requirement | Detail |
|-------------|--------|
| NFSe (Nota Fiscal de Serviço Eletrônica) | Service invoices required for B2C dental services. Municipal tax (ISS). Each prefecture has its own layout, though NFSe Nacional standard is rolling out (2024–2026) to unify. |
| Certificate A1 (ICP-Brasil) | Required to sign NFSe. Clinic must obtain and store securely. Expires annually. |
| CNPJ | Clinic must be a registered legal entity (CNPJ) to issue NFSe. Sole-practitioner dentists (CPF) have simpler fiscal obligations. |
| Simples Nacional | Most small clinics are in Simples Nacional tax regime. Aliquots are fixed tables. NFSe still required but simpler. |
| Recibo (receipt) | For clinics that do not issue NF, a formal recibo (receipt) with clinic CNPJ and patient CPF is a minimum. |

**v1 stance on NFSe:** Implement NFSe Nacional standard (SEFIN API). This covers the growing number of municipalities migrating to the national standard. Maintain a fallback for legacy municipal formats for top-20 cities by clinic density (São Paulo, Rio, BH, Curitiba, Porto Alegre). Flag unsupported municipalities clearly to user.

---

## AI / Automation ROI Analysis

Ranked by evidence-based ROI for dental clinics in Brazil. Focus on what automation actually generates measurable return.

### Tier 1: Highest ROI — Build in v1

**1. Automated appointment confirmation via WhatsApp**
- Problem: 15–20% no-show rate is the #1 revenue leak in dental clinics
- Evidence: Simples Dental reports 70% reduction in no-shows; BCX Odontologia case study shows 45% reduction in 6 months
- Mechanism: Trigger WhatsApp message 24h before appointment. Two-way: patient confirms/cancels. Status syncs to agenda.
- Revenue impact: If clinic has 20 appointments/day at R$150 average, 15% no-show = R$450/day lost. 50% reduction = R$225/day recovered = R$4,500/month.
- Build cost: Medium (WhatsApp Business API + trigger logic)
- **Verdict: Build in v1. Highest leverage automation.**

**2. Overdue payment collection sequence (régua de cobrança automática)**
- Problem: Inadimplência above 5% signals cash flow distress. Target: below 5%.
- Evidence: Automated reminders reduce inadimplência by up to 30%
- Mechanism: Trigger WhatsApp messages at: 3 days before due date (reminder), due date (friendly notice), 7 days overdue (firm reminder), 30 days overdue (last attempt before SPC flag)
- Build cost: Low (message templates + date-based trigger scheduler)
- **Verdict: Build in v1. Low complexity, high financial impact.**

### Tier 2: High ROI — Build in v2

**3. No-show recovery agent**
- Problem: Patient missed appointment. Slot is now empty. Revenue already lost but can be partially recovered by rebooking.
- Evidence: Automation recovers up to 30% of missed appointments via immediate WhatsApp outreach
- Mechanism: When appointment status → "No-show", trigger automated message: "We noticed you couldn't make it. Would you like to reschedule?" with quick-reply buttons.
- Build cost: Medium (AI agent that understands free-text responses and books into available slots)
- Note: Requires natural language understanding to handle patient responses. Use LLM.
- **Verdict: v2. Needs AI agent layer to handle responses properly.**

**4. Abandoned treatment plan recovery**
- Problem: Patient approved budget but never returned to start treatment. Revenue was committed but never captured.
- Evidence: CRM trigger approach standard in Clinicorp's CRC module
- Mechanism: 30 days after budget approval with no appointment created → trigger outreach sequence
- Build cost: Low to medium (CRM trigger logic + WhatsApp message)
- **Verdict: v2 alongside CRM module.**

**5. Recall / return automation**
- Problem: Patients who finish treatment forget to return for maintenance, check-ups, or next treatment phase
- Evidence: Recurring patients have 3–5x higher lifetime value than one-time patients
- Mechanism: Set return date in system → automated WhatsApp reminder 7 days before
- Build cost: Low (date-based trigger)
- **Verdict: v2. Low effort, high retention value.**

### Tier 3: Future — Build in v3+

**6. AI-assisted clinical note generation (voice to text)**
- What: Dentist dictates during or after consultation; AI fills the prontuário fields
- Evidence: Clinicorp's Voice Control feature. Reduces documentation time per patient.
- Complexity: High — requires accurate transcription in dental vocabulary (Portuguese), structured output mapping to prontuário schema, and clinical accuracy validation
- Risk: Errors in clinical records have legal and patient safety implications. Requires careful guardrails.
- **Verdict: v3. High value but high risk in clinical context. Needs careful validation.**

**7. AI scheduling optimization (overbooking, gap filling)**
- What: AI detects low-occupancy slots and suggests offers or promotions to fill them
- Evidence: Theoretical; Clinicorp markets this direction but ROI data is anecdotal
- Complexity: High — requires demand modeling, patient segmentation, and automated outreach
- **Verdict: v3. Interesting but unproven ROI; complex to build right.**

**8. Automatic bank reconciliation**
- What: Match incoming Pix/boleto payments to open receivables automatically without human review
- Evidence: Expected in mature ERP products; reduces bookkeeping time significantly
- Complexity: High — requires bank API (Open Banking), reliable matching algorithm, exception handling
- **Verdict: v3. Valuable for multi-unit clients. Complex banking integration.**

**9. AI diagnostic support (X-ray / image analysis)**
- What: AI flags suspicious areas in uploaded X-rays or photos
- Evidence: Emerging globally (Pearl AI, Videa Health). Not yet mainstream in Brazil.
- Complexity: Extremely high — requires trained dental imaging model, regulatory approval, and clinical validation
- **Verdict: Out of scope. Not a dental ERP feature — separate product category.**

---

## Feature Dependencies

```
Appointment Calendar
  → Patient Registration (can't book without patient)
  → Dentist Profile (schedule is per-dentist)
  → WhatsApp Reminder (depends on appointment trigger)
  → No-show Recovery Agent (depends on no-show status)

Clinical Records (Prontuário)
  → Patient Registration
  → Odontogram (records reference tooth positions)
  → Treatment Plan / Budget (records execution against plan)
  → Digital Anamnesis (first record entry)
  → Electronic Signature (legal validity, CFO compliance)

Treatment Plan / Budget
  → Odontogram (procedures linked to teeth)
  → Procedure Catalog (standardized procedure names/prices)
  → Patient Registration

Financial Transaction
  → Treatment Plan / Budget (payment against plan)
  → Patient Registration
  → Payment Gateway Integration (Pix/boleto/card)
  → Dentist Commission (auto-calc on paid transaction)

NFSe Emission
  → Financial Transaction (NF issued per transaction)
  → Clinic Profile with CNPJ
  → Certificate A1 stored in system
  → Municipal API integration

Collection Sequence (Régua de Cobrança)
  → Financial Transaction (triggers on overdue)
  → WhatsApp Integration
  → Patient phone number

Automated Recall
  → Patient Registration
  → Return date field in records
  → WhatsApp Integration

Multi-unit / Franchise Dashboard
  → All modules above, multi-tenant isolated
  → Central admin role with cross-tenant read access
  → Aggregated reporting layer
```

---

## MVP Recommendation

### Must ship in v1 (Clinical + Financial as specified):

**Clinical:**
1. Patient registration (with CPF, full contact, basic health history)
2. Multi-professional appointment calendar with status workflow
3. Automated WhatsApp reminders (24h before, confirmation two-way)
4. Digital anamnesis (link-based pre-fill, electronic signature)
5. Interactive odontogram
6. Clinical records / prontuário with visit notes
7. Treatment plan with budget (procedure list + prices + approval tracking)
8. Document upload (consent forms, X-rays as files)
9. Online booking link (self-service scheduling)
10. RBAC: Admin, Dentist, Receptionist roles

**Financial:**
11. Accounts receivable linked to treatment plan (installments, status tracking)
12. Pix integration with auto-confirmation
13. Boleto generation
14. Credit card payment link
15. Dentist commission calculation
16. Cash flow view (income vs expense, period filter)
17. Receipt generation
18. Inadimplência dashboard (overdue receivables view)
19. Automated collection sequence (WhatsApp reminders at due date and overdue milestones)
20. Accounts payable (basic supplier invoice tracking)

**Reports (minimal viable set):**
21. Monthly revenue summary
22. Accounts receivable aging
23. Appointment occupancy rate
24. No-show rate

**Compliance:**
25. LGPD consent tracking on patient registration
26. Audit log (who changed what, when)
27. Soft-delete for patient records
28. NFSe emission (NFSe Nacional standard + top-5 cities fallback)

### Defer from v1:

- Native mobile app → PWA responsive
- TISS/insurance integration → manual guide upload
- Bank reconciliation → manual matching, auto-confirm Pix only
- AI clinical notes → v3
- Patient portal → v3
- Lab/prosthetics module → v3
- Full CRM with automated recall sequences → v2 (basic recall date field in v1)
- Multi-unit franchise reporting → v2 (architecture supports it from day 1; UI deferred)

---

## Sources

- Clinicorp features and AI strategy: https://www.clinicorp.com/ferramentas and https://brazileconomy.com.br/empresas/2026/02/clinicorp-aposta-em-agentes-de-ia-para-automatizar-clinicas-e-dobrar-de-tamanho-ate-2027/
- Brazilian dental software comparison (2026): https://blog.odontoresults.com.br/post/softwares-gestao-clinicas-odontologicas-2026
- Simples Dental vs Capim analysis: https://www.simplesdental.com/blog/simples-dental-ou-capim/
- CFO Resolution 91/2009 (electronic records): https://sistemas.cfo.org.br/visualizar/atos/RESOLU%C3%87%C3%83O/SEC/2009/91
- CFO Resolution 278/2025 (Teleodontology): https://website.cfo.org.br/cfo-regulamenta-a-teleodontologia-e-da-passo-fundamental-para-a-inclusao-de-consultas-odontologicas-no-programa-telessaude-do-sus/
- LGPD for dental clinics: https://abro.org.br/a-necessidade-da-implementacao-da-lei-geral-de-protecao-de-dados-em-consultorios-e-clinicas-odontologicas/
- CROSP LGPD guidance: https://crosp.org.br/noticia/crosp-reforca-a-importancia-de-estar-atento-a-lei-geral-de-protecao-de-dados-lgpd/
- WhatsApp integration for dental clinics: https://www.dentaloffice.com.br/confirmacao-automatica-de-consultas/
- Payment methods for dental clinics: https://www.clinicorp.com/post/meios-de-pagamento-para-dentistas
- Asaas + Simples Dental integration: https://www.simplesdental.com/blog/simples-dental-e-asaas/
- NFSe Nacional standard: https://blog.tecnospeed.com.br/nfse-nacional-tudo/
- Dentist commission management: https://www.simplesdental.com/blog/comissionar-dentista/
- No-show automation ROI: https://bcxconsultoria.com.br/blog/agendamento-inteligente-revolucione-sua-clinica-com-ia/
- Brazilian dental market size: https://www.grandviewresearch.com/horizon/outlook/dental-practice-management-software-market/brazil
- Collection automation: https://www.clinicorp.com/post/parceiros-regua-de-cobranca-felipe-bahls
- KPIs for dental clinics: https://www.clinicorp.com/post/kpis-software-odontologico
- Digital anamnesis: https://easydental.com.br/blog/gestao-odontologica/anamnese-online-diga-adeus-ao-papel-use-software-odontologico/
- OdontoCompany multi-unit platform: https://www.portaldofranchising.com.br/noticias/odontocompany-moderniza-com-nova-tecnologia/
