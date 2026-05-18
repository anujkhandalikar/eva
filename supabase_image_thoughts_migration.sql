-- Image thought capture migration
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_url text;

-- Storage bucket for thought images. Public read so dashboard <img> tags work
-- without signed URLs. Personal build only.
INSERT INTO storage.buckets (id, name, public)
VALUES ('thought-images', 'thought-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anon role to insert (overlay → /api/tasks → supabase-js anon client).
-- Read is already public via bucket flag.
DROP POLICY IF EXISTS "anon insert thought-images" ON storage.objects;
CREATE POLICY "anon insert thought-images"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'thought-images');
