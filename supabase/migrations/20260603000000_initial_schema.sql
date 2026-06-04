-- =============================================================================
-- Migration: 20260603000000_initial_schema.sql
-- Phase: 00-foundation / Plan 02
-- Purpose: Core multi-tenant schema — tenants, users, audit_logs (Phase 0 scope only)
--          + SECURITY DEFINER functions for RLS (FREE plan — no Custom Access Token Hook)
-- SEC-07: ALL timestamps use TIMESTAMPTZ (never timezone-unaware variant)
-- D-01:   Only core tables — feature tables belong to their respective feature phases
-- D-02:   Naming: plural English
-- C-5:    tenant_id stored in public.users (never in auth.users.user_metadata)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TENANTS: The root multi-tenant entity
-- ---------------------------------------------------------------------------
CREATE TABLE public.tenants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,         -- URL-friendly clinic identifier
  timezone   VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  plan       VARCHAR(20) NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ                          -- soft delete (LGPD)
);

-- Index slug for fast tenant lookups by URL
CREATE INDEX idx_tenants_slug ON public.tenants(slug);

-- ---------------------------------------------------------------------------
-- USERS: Application user profiles (mirrors auth.users, stores tenant context)
-- CRITICAL (C-5): tenant_id lives HERE, never in auth.users.user_metadata
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  full_name      TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT 'receptionist'
                             CHECK (role IN ('admin', 'dentist', 'receptionist', 'patient', 'superadmin')),
  sensitive_data TEXT,       -- AES-256-GCM encrypted JSONB blob (SEC-08, D-05)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ              -- soft delete (LGPD)
);

-- CRITICAL (H-1): Index tenant_id on every tenant-scoped table to prevent table scans
CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_users_email     ON public.users(email);

-- ---------------------------------------------------------------------------
-- AUDIT_LOGS: Append-only compliance log (LGPD + CFO Lei 13.787/2018)
-- Partitioned by month for long-term performance (20-year retention requirement)
-- No FK to tenants — immutable log must survive tenant deletion
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id         UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL,
  actor_id   UUID,                    -- auth.uid(); NULL for system events
  action     TEXT        NOT NULL,    -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', etc.
  table_name TEXT,
  record_id  UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Initial partition — subsequent partitions created via pg_cron (Phase 4+)
CREATE TABLE public.audit_logs_2026_06
  PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Composite index for tenant-scoped time-range queries (most common audit query)
CREATE INDEX idx_audit_logs_tenant_created
  ON public.audit_logs(tenant_id, created_at DESC);

-- Index by actor for user-activity audit queries
CREATE INDEX idx_audit_logs_actor
  ON public.audit_logs(actor_id);

-- =============================================================================
-- SECURITY DEFINER FUNCTIONS
-- FREE plan approach: no Custom Access Token Hook (Pro-only, D-11).
-- These two functions replace JWT claims for ALL RLS policies.
-- SECURITY DEFINER: bypass RLS internally for the lookup (C-1 resolution).
-- SET search_path = public: prevent search_path injection (Pitfall 7).
-- STABLE: PostgreSQL caches result per transaction — O(1) per query not per row.
-- REVOKE EXECUTE FROM PUBLIC: only RLS policies (running as definer) may call these.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_my_tenant_id(): returns the tenant_id for the currently authenticated user
-- Called by every RLS policy that needs to enforce tenant isolation.
-- C-1 resolution: policy uses this function instead of SELECT FROM users directly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid()
$$;

-- Revoke public execution — this function is called only by RLS policies internally
REVOKE EXECUTE ON FUNCTION get_my_tenant_id() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- get_my_role(): returns the role text for the currently authenticated user
-- Called by RLS policies that enforce role-based access (admin, superadmin, etc.)
-- FREE plan replacement for JWT claim 'user_role' from Custom Access Token Hook.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- Revoke public execution — this function is called only by RLS policies internally
REVOKE EXECUTE ON FUNCTION get_my_role() FROM PUBLIC;
