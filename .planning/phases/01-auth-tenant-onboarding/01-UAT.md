---
status: partial
phase: 01-auth-tenant-onboarding
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-06-20T18:35:00Z
updated: 2026-06-20T18:54:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 8 items outstanding; resume from Test 5]

## Tests

### 1. Smoke Test no Deploy (Vercel)
expected: Abra o deploy de produção (fynxia.vercel.app). App carrega sem erro 500, as 3 migrations do Supabase estão aplicadas ao vivo, e /login renderiza com dados ao vivo.
result: pass

### 2. Signup & Provisionamento de Clínica
expected: Em /signup, preenchendo nome da clínica + e-mail + senha (min 8) + documento (CPF ou CNPJ válido) + telefone e enviando, a clínica e o usuário admin são criados atomicamente e você é redirecionado para /clinica vendo o nome da clínica e o papel (admin). Documento inválido mostra erro de validação no campo.
result: pass

### 3. Login & Logout
expected: Em /login, com credenciais válidas, você entra e vai para /clinica. O botão "Sair" desloga e volta para /login. Credenciais inválidas mostram mensagem de erro real (não genérica).
result: pass

### 4. Reset de Senha
expected: Em /forgot-password, informando o e-mail, aparece estado de sucesso ("e-mail enviado"). O link recebido leva a /reset-password (via /auth/confirm), onde definir uma nova senha funciona e redireciona para /clinica.
result: pass

### 5. Proteção de Rotas por Papel (RBAC)
expected: Um usuário receptionist ou dentist NÃO consegue acessar /superadmin nem /config (é bloqueado/redirecionado). Admin acessa /clinica, /perfil, /config, /superadmin. Paciente acessa /paciente e /perfil. Rotas públicas (/invite, /agendar, /auth/confirm) abrem sem login.
result: [pending]

### 6. Convite por E-mail (envio + entrega)
expected: Em /clinica/equipe (como admin), preenchendo e-mail + papel no modo "Convite por e-mail" e enviando, um e-mail FYNXIA-branded chega na caixa de entrada real (via Resend) com link de convite. O convite aparece na tabela de pendentes. Falha de envio mostra o erro real da Resend.
result: [pending]

### 7. Aceitar Convite
expected: Abrindo o link /invite/[token], a página mostra o nome da clínica + papel, com e-mail somente-leitura. Definindo a senha (min 8) e aceitando, a conta é criada com o papel vindo do convite (não editável pelo cliente), você é logado e redirecionado (/clinica ou /paciente conforme papel).
result: [pending]

### 8. Reenvio de Convite (single-pending)
expected: Reenviar convite para um e-mail que já tem convite pendente invalida o anterior (status revoked) e cria um novo pendente — nunca há dois convites pendentes para o mesmo e-mail/clínica ao mesmo tempo.
result: [pending]

### 9. Criação Direta de Membro (sem e-mail)
expected: No modo "Criação direta" em /clinica/equipe, informando e-mail + papel + senha temporária (min 8), a conta é criada imediatamente sem envio de e-mail, e o membro consegue logar em /login com essa senha.
result: [pending]

### 10. Auto-cadastro Público de Paciente (API)
expected: `POST /api/invitations` (sem autenticação) com clinicSlug + e-mail + nome retorna 201 com requestId. A rota é pública (não exige login) e registra uma solicitação pendente com role=patient para a clínica.
result: [pending]

### 11. Página de Gestão de Equipe
expected: /clinica/equipe mostra o formulário de convite apenas para admin/superadmin; não-admins veem aviso (sem formulário). A tabela lista convites pendentes com e-mail, papel (rótulo pt-BR), status e data de expiração.
result: [pending]

### 12. Trilha de Auditoria & Mascaramento LGPD
expected: Ações registram eventos em audit_logs (INVITE_SENT, INVITE_ACCEPTED, USER_CREATED_DIRECT, PATIENT_SELF_REGISTER_REQUEST) com o tenant_id correto. Em listagens, o e-mail de outros usuários aparece mascarado (ex: jo***@gmail.com) para papéis receptionist/patient via view users_masked; admin/dentist veem o e-mail completo.
result: [pending]

## Summary

total: 12
passed: 4
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

[none yet]
