-- ============================================================
-- WRAPSTORE STAGE 2 — SCHEMA ADDITIONS
-- Run AFTER schema.sql (Stage 1 must already exist)
-- Adds: customers, invoices, invoice_items, payments
-- ============================================================

-- ============================================================
-- INVOICE NUMBER SEQUENCE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_id_seq START 1;

-- ============================================================
-- CUSTOMERS
-- No login accounts — stored for purchase history only
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  address      TEXT,
  gstin        TEXT,
  total_orders INT NOT NULL DEFAULT 0,
  total_spent  NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_purchase_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number    TEXT UNIQUE NOT NULL,            -- WS-INV-000001
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,                   -- snapshot at time of sale
  customer_phone    TEXT NOT NULL,                   -- snapshot at time of sale
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxable_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method    TEXT NOT NULL DEFAULT 'Cash'
                      CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Other')),
  payment_status    TEXT NOT NULL DEFAULT 'PAID'
                      CHECK (payment_status IN ('PAID', 'PENDING', 'CANCELLED')),
  notes             TEXT,
  pdf_url           TEXT,                            -- Supabase Storage path
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);

-- ============================================================
-- INVOICE ITEMS
-- Stores historical product info — product edits won't change old invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  product_id_code  TEXT NOT NULL,                   -- WS-000001 snapshot
  product_name     TEXT NOT NULL,                   -- snapshot
  product_type     TEXT NOT NULL,                   -- snapshot
  mobile_brand     TEXT,                            -- snapshot
  mobile_model     TEXT,                            -- snapshot
  quantity         INT NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(10,2) NOT NULL,          -- selling price snapshot
  discount_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
  gst_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(10,2) NOT NULL,          -- after discount + GST
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  reference      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- ============================================================
-- AUTO-GENERATE INVOICE NUMBER TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
BEGIN
  SELECT COALESCE(invoice_prefix, 'WS') INTO prefix FROM store_settings LIMIT 1;
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := prefix || '-INV-' || LPAD(nextval('invoice_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON invoices;
CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();

-- ============================================================
-- UPDATED_AT TRIGGER FOR NEW TABLES
-- ============================================================
DROP TRIGGER IF EXISTS trigger_customers_updated_at ON customers;
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
CREATE TRIGGER trigger_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Customers: all authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated can manage customers" ON customers;
CREATE POLICY "Authenticated can manage customers"
  ON customers FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Invoices: all authenticated users can read/write
DROP POLICY IF EXISTS "Authenticated can read invoices" ON invoices;
CREATE POLICY "Authenticated can read invoices"
  ON invoices FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can create invoices" ON invoices;
CREATE POLICY "Authenticated can create invoices"
  ON invoices FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Super admin can update invoices" ON invoices;
CREATE POLICY "Super admin can update invoices"
  ON invoices FOR UPDATE
  USING (get_user_role() = 'super_admin');

-- Invoice items: all authenticated can read
DROP POLICY IF EXISTS "Authenticated can manage invoice items" ON invoice_items;
CREATE POLICY "Authenticated can manage invoice items"
  ON invoice_items FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Payments: all authenticated can read/write
DROP POLICY IF EXISTS "Authenticated can manage payments" ON payments;
CREATE POLICY "Authenticated can manage payments"
  ON payments FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- SUPABASE STORAGE: PDF BUCKET
-- Create in Supabase Dashboard > Storage
-- Or run if storage extension is available:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('invoices', 'invoices', FALSE)
-- ON CONFLICT DO NOTHING;
-- ============================================================
