-- Phase 5: agent_outreach_log.to_phone (CR-01 / CR-02 — cross-tenant inbound fix)
-- Binds each confirmation outreach to the recipient's E.164 phone so that an inbound
-- free-text reply ("sim"/"não") can be resolved ONLY among outreach rows actually sent
-- to that sender — preventing Patient A from confirming/cancelling Patient B's appointment
-- across tenants (CR-01) and providing the identity/tenant scoping for the status update (CR-02).
--
-- Additive, nullable column — RLS unchanged (no INSERT/UPDATE/DELETE policy; service-role only).
-- Index supports the inbound resolver query: WHERE to_phone = $1 AND status='sent' ORDER BY created_at DESC.

ALTER TABLE public.agent_outreach_log
  ADD COLUMN to_phone TEXT;  -- recipient phone in E.164 (e.g. +5511999999999); NULL for legacy/system rows

-- Resolver index: bind inbound reply to the sender's phone + recency, newest first
CREATE INDEX idx_agent_outreach_log_to_phone_created
  ON public.agent_outreach_log(to_phone, created_at DESC);
