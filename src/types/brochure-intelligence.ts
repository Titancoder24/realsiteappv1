export type BrochurePageCategory =
  | "overview"
  | "pricing"
  | "floor_plan"
  | "amenities"
  | "location"
  | "payment_plan"
  | "gallery"
  | "legal"
  | "specifications"
  | "contact"
  | "general";

export type BrochureStatus = "draft" | "published" | "archived";

export interface PropertyBrochure {
  id: string;
  organization_id: string;
  property_id: string;
  project_id?: string | null;
  title: string;
  slug: string;
  file_url: string;
  thumbnail_url?: string | null;
  page_count: number;
  status: BrochureStatus;
  tracking_enabled: boolean;
  consent_notice?: string | null;
  sales_alert_email?: string | null;
  sales_whatsapp?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  brochure_pages?: BrochurePage[];
  properties?: { name: string; projects?: { name: string } };
}

export interface BrochurePage {
  id: string;
  brochure_id: string;
  page_number: number;
  title?: string | null;
  category: BrochurePageCategory;
  section_labels?: { id: string; label: string; y_start: number; y_end: number }[];
}

export interface BrochurePageView {
  page_number: number;
  page_category?: string | null;
  dwell_seconds: number;
  scroll_depth_max?: number;
}

export interface BrochureIntentSummary {
  id: string;
  session_id: string;
  brochure_id: string;
  intent_score: number;
  intent_band: "hot" | "warm" | "cold";
  top_pages: { page_number: number; category?: string; dwell_seconds: number }[];
  summary_text?: string | null;
  recommended_action?: string | null;
  visit_count: number;
}

export const BROCHURE_PAGE_CATEGORIES: { value: BrochurePageCategory; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "pricing", label: "Pricing" },
  { value: "floor_plan", label: "Floor plan" },
  { value: "amenities", label: "Amenities" },
  { value: "location", label: "Location map" },
  { value: "payment_plan", label: "Payment plan" },
  { value: "gallery", label: "Gallery" },
  { value: "legal", label: "Legal / RERA" },
  { value: "specifications", label: "Specifications" },
  { value: "contact", label: "Contact" },
  { value: "general", label: "General" },
];
