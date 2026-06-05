-- Phase 2: proactive audit_logs partition for September 2026
CREATE TABLE public.audit_logs_2026_09 PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
