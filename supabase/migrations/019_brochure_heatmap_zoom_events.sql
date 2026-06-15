-- Allow zoom_in and zoom_out heatmap event types
ALTER TABLE brochure_heatmap_points DROP CONSTRAINT IF EXISTS brochure_heatmap_points_event_type_check;
ALTER TABLE brochure_heatmap_points ADD CONSTRAINT brochure_heatmap_points_event_type_check
  CHECK (event_type IN ('tap', 'click', 'zoom_focus', 'zoom_in', 'zoom_out', 'hover'));
