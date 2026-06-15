-- Brochure PDF signed uploads need UPDATE on storage objects
DROP POLICY IF EXISTS media_update ON storage.objects;
CREATE POLICY media_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'media' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
