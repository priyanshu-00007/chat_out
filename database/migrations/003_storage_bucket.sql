-- ChatSphere Private Storage Bucket & Access Policies
-- Bucket: chat-attachments (private; access mediated via signed URLs + RLS)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  26214400, -- 25 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path conventions inside 'chat-attachments':
--   1. User profile avatars:  avatars/<user_id>/<filename>
--   2. Group avatars:         groups/<conversation_id>/<filename>
--   3. Message attachments:   conversations/<conversation_id>/<uploader_id>/<filename>

DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;
CREATE POLICY "Authenticated users can read avatars"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'avatars'
  );

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Members can read group avatars" ON storage.objects;
CREATE POLICY "Members can read group avatars"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'groups'
    AND public.is_conversation_member(((storage.foldername(name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Group admins can upload group avatars" ON storage.objects;
CREATE POLICY "Group admins can upload group avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'groups'
    AND public.is_conversation_admin(((storage.foldername(name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Conversation members can read message attachments" ON storage.objects;
CREATE POLICY "Conversation members can read message attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'conversations'
    AND public.is_conversation_member(((storage.foldername(name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Conversation members can upload message attachments" ON storage.objects;
CREATE POLICY "Conversation members can upload message attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = 'conversations'
    AND (storage.foldername(name))[3] = auth.uid()::text
    AND public.is_conversation_member(((storage.foldername(name))[2])::uuid, auth.uid())
  );
