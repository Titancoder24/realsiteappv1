import { createAdminClient } from "@/lib/supabase/admin";

export async function queueBrochureSalesAlert(params: {
  organizationId: string;
  brochureId: string;
  sessionId: string;
  intentBand: string;
  intentScore: number;
  alertType: "hot_intent" | "brochure_reopened" | "brochure_shared_open";
  message: string;
  recommendedAction?: string;
  salesEmail?: string | null;
  salesWhatsapp?: string | null;
}) {
  const admin = createAdminClient();
  const { data: brochure } = await admin
    .from("property_brochures")
    .select("title, sales_alert_email, sales_whatsapp")
    .eq("id", params.brochureId)
    .single();

  const email = params.salesEmail ?? brochure?.sales_alert_email;
  const whatsapp = params.salesWhatsapp ?? brochure?.sales_whatsapp;

  await admin.from("brochure_sales_alerts").insert({
    organization_id: params.organizationId,
    brochure_id: params.brochureId,
    session_id: params.sessionId,
    intent_band: params.intentBand,
    intent_score: params.intentScore,
    alert_type: params.alertType,
    message: params.message,
    recommended_action: params.recommendedAction,
    sales_email: email,
    sales_whatsapp: whatsapp,
  });

  if (whatsapp && params.intentBand === "hot") {
    const text = encodeURIComponent(`${params.message} ${params.recommendedAction ?? ""}`.trim());
    const waLink = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${text}`;
    return { email, whatsapp, waLink };
  }

  return { email, whatsapp, waLink: null as string | null };
}
