-- Task image support migration
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new
--
-- Tasks reuse the existing `image_url` column (added in image_thoughts migration)
-- for the optional input image attached at capture time. This migration only
-- adds the array column for image URLs Eva returns from research.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result_image_urls text[];
