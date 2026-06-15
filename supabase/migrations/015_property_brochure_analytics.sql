-- Buyer Intent Analytics for Property Brochures

CREATE TABLE property_brochures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  page_count INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tracking_enabled BOOLEAN NOT NULL DEFAULT true,
  consent_notice TEXT DEFAULT 'This brochure uses engagement analytics to help your sales team assist you better.',
  sales_alert_email TEXT,
  sales_whatsapp TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE brochure_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brochure_id UUID NOT NULL REFERENCES property_brochures(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  title TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'overview', 'pricing', 'floor_plan', 'amenities', 'location', 'payment_plan',
    'gallery', 'legal', 'specifications', 'contact', 'general'
  )),
  section_labels JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brochure_id, page_number)
);

ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS brochure_id UUID REFERENCES property_brochures(id) ON DELETE SET NULL;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS screen_width INT;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS screen_height INT;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT false;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE TABLE brochure_page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES buyer_sessions(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES property_brochures(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  page_category TEXT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  dwell_seconds INT NOT NULL DEFAULT 0,
  scroll_depth_max NUMERIC DEFAULT 0,
  zoom_level_max NUMERIC DEFAULT 1,
  visible_sections JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brochure_heatmap_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES buyer_sessions(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES property_brochures(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  x NUMERIC NOT NULL CHECK (x >= 0 AND x <= 1),
  y NUMERIC NOT NULL CHECK (y >= 0 AND y <= 1),
  event_type TEXT NOT NULL DEFAULT 'tap' CHECK (event_type IN ('tap', 'click', 'zoom_focus', 'hover')),
  dwell_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brochure_viewer_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES buyer_sessions(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES property_brochures(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  page_number INT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brochure_intent_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES buyer_sessions(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES property_brochures(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  intent_score INT NOT NULL DEFAULT 20,
  intent_band TEXT NOT NULL DEFAULT 'cold' CHECK (intent_band IN ('hot', 'warm', 'cold')),
  top_pages JSONB DEFAULT '[]',
  summary_text TEXT,
  recommended_action TEXT,
  visit_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, brochure_id)
);

ALTER TABLE campaign_links ADD COLUMN IF NOT EXISTS brochure_id UUID REFERENCES property_brochures(id) ON DELETE SET NULL;

CREATE INDEX idx_property_brochures_org ON property_brochures(organization_id);
CREATE INDEX idx_property_brochures_property ON property_brochures(property_id);
CREATE INDEX idx_property_brochures_slug ON property_brochures(slug);
CREATE INDEX idx_brochure_page_views_session ON brochure_page_views(session_id);
CREATE INDEX idx_brochure_page_views_brochure ON brochure_page_views(brochure_id);
CREATE INDEX idx_brochure_heatmap_brochure_page ON brochure_heatmap_points(brochure_id, page_number);
CREATE INDEX idx_brochure_viewer_events_session ON brochure_viewer_events(session_id);
CREATE INDEX idx_brochure_intent_summaries_org ON brochure_intent_summaries(organization_id);

ALTER TABLE property_brochures ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_heatmap_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_viewer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_intent_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_property_brochures ON property_brochures FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY org_brochure_pages ON brochure_pages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM property_brochures b
    WHERE b.id = brochure_pages.brochure_id AND b.organization_id = auth_user_org_id()
  ));

CREATE POLICY org_brochure_page_views ON brochure_page_views FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY org_brochure_heatmap ON brochure_heatmap_points FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY org_brochure_viewer_events ON brochure_viewer_events FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY org_brochure_intent ON brochure_intent_summaries FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY public_published_brochures ON property_brochures FOR SELECT
  USING (status = 'published');

CREATE POLICY public_brochure_pages ON brochure_pages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM property_brochures b
    WHERE b.id = brochure_pages.brochure_id AND b.status = 'published'
  ));
