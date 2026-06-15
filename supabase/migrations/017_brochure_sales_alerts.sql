-- Sales alerts for Buyer Intent Analytics (hot buyers, re-opens, shared opens)
CREATE TABLE IF NOT EXISTS brochure_sales_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES property_brochures(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES buyer_sessions(id) ON DELETE CASCADE,
  intent_band TEXT NOT NULL DEFAULT 'warm',
  intent_score INT NOT NULL DEFAULT 0,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  recommended_action TEXT,
  sales_email TEXT,
  sales_whatsapp TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brochure_sales_alerts_org ON brochure_sales_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_brochure_sales_alerts_created ON brochure_sales_alerts(created_at DESC);

ALTER TABLE brochure_sales_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_brochure_sales_alerts ON brochure_sales_alerts FOR ALL
  USING (organization_id = auth_user_org_id());
