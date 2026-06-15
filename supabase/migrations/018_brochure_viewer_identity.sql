-- Identified brochure viewers: name + phone captured at entry
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS viewer_name TEXT;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS viewer_phone TEXT;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS viewer_phone_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_buyer_sessions_viewer_phone_hash ON buyer_sessions(viewer_phone_hash);
CREATE INDEX IF NOT EXISTS idx_buyer_sessions_brochure_started ON buyer_sessions(brochure_id, started_at DESC);

-- Aggregate viewer profile per org (dedupe by phone hash for returning buyers)
CREATE TABLE IF NOT EXISTS brochure_viewer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  viewer_name TEXT NOT NULL,
  viewer_phone TEXT NOT NULL,
  viewer_phone_hash TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_sessions INT NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  UNIQUE (organization_id, viewer_phone_hash)
);

ALTER TABLE brochure_viewer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_brochure_viewer_profiles ON brochure_viewer_profiles;
CREATE POLICY org_brochure_viewer_profiles ON brochure_viewer_profiles FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE INDEX IF NOT EXISTS idx_brochure_viewer_profiles_org ON brochure_viewer_profiles(organization_id);
