-- ============================================================
-- WRAPSTORE STAGE 3 — SCHEMA ADDITIONS
-- Run AFTER schema.sql and schema_stage2.sql
-- Adds: WhatsApp delivery tracking, logs, and analytics views
-- ============================================================

-- ============================================================
-- 1. EXTEND INVOICES TABLE FOR WHATSAPP STATUS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'whatsapp_status'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN whatsapp_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (whatsapp_status IN ('PENDING', 'SENT', 'FAILED')),
      ADD COLUMN whatsapp_sent_at TIMESTAMPTZ,
      ADD COLUMN whatsapp_error TEXT,
      ADD COLUMN whatsapp_message_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_whatsapp_status ON invoices(whatsapp_status);

-- ============================================================
-- 2. WHATSAPP LOGS TABLE
-- Complete audit trail of all WhatsApp messages dispatched
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  recipient_phone  TEXT NOT NULL,
  message_body     TEXT NOT NULL,
  pdf_url          TEXT,
  status           TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  response_payload JSONB,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_invoice ON whatsapp_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON whatsapp_logs(created_at DESC);

-- ============================================================
-- 3. ROW LEVEL SECURITY FOR WHATSAPP LOGS
-- ============================================================
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read whatsapp logs" ON whatsapp_logs;
CREATE POLICY "Authenticated can read whatsapp logs"
  ON whatsapp_logs FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can insert whatsapp logs" ON whatsapp_logs;
CREATE POLICY "Authenticated can insert whatsapp logs"
  ON whatsapp_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Super admin can manage whatsapp logs" ON whatsapp_logs;
CREATE POLICY "Super admin can manage whatsapp logs"
  ON whatsapp_logs FOR ALL
  USING (get_user_role() = 'super_admin');
