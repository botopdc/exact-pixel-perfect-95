-- RLS policies for proposal-files bucket in storage.objects

-- 1) Allow authenticated users to INSERT (upload) files to proposal-files bucket
CREATE POLICY "Allow authenticated users to insert into proposal-files bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proposal-files');

-- 2) Allow authenticated users to SELECT (read/download) files from proposal-files bucket
CREATE POLICY "Allow authenticated users to select from proposal-files bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'proposal-files');

-- 3) Allow authenticated users to UPDATE (overwrite) files in proposal-files bucket
CREATE POLICY "Allow authenticated users to update proposal-files bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'proposal-files')
WITH CHECK (bucket_id = 'proposal-files');

-- 4) Allow authenticated users to DELETE files from proposal-files bucket
CREATE POLICY "Allow authenticated users to delete from proposal-files bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'proposal-files');