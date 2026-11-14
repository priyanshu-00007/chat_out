-- ChatSphere Initial Schema
-- Run in Supabase SQL Editor or via Supabase CLI migrations.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  about TEXT NOT NULL DEFAULT 'Hey there! I am using ChatSphere.',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format CHECK (
    char_length(username) BETWEEN 3 AND 24
    AND username ~ '^[a-zA-Z0-9_]+$'
  ),
  CONSTRAINT profiles_full_name_length CHECK (
    char_length(trim(full_name)) >= 2
  ),
  CONSTRAINT profiles_email_format CHECK (
    email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

-- ============================================================================
-- 2. CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  direct_key TEXT UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_direct_key_consistency CHECK (
    (type = 'direct' AND direct_key IS NOT NULL AND name IS NULL)
    OR (type = 'group' AND direct_key IS NULL AND char_length(trim(COALESCE(name, ''))) >= 2)
  )
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON public.conversations (created_by);

-- ============================================================================
-- 3. CONVERSATION MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversation_members_unique_membership UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members (user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON public.conversation_members (conversation_id);

-- ============================================================================
-- 4. MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at ASC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id);

-- ============================================================================
-- 5. ATTACHMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size >= 0 AND file_size <= 26214400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.attachments (message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON public.attachments (uploader_id);

-- ============================================================================
-- 6. TRIGGERS & TIMESTAMP HELPERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_messages_updated_at ON public.messages;
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.bump_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_conversation_on_message ON public.messages;
CREATE TRIGGER trg_bump_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_conversation_on_message();

CREATE OR REPLACE FUNCTION public.prevent_member_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.conversation_id <> OLD.conversation_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Cannot reassign conversation membership identity.';
  END IF;
  IF NEW.role <> OLD.role AND NOT public.is_conversation_admin(OLD.conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only group admins can change member roles.';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7. SECURITY DEFINER MEMBERSHIP & RPC HELPERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = conv_id
      AND cm.user_id = uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(conv_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = conv_id
      AND cm.user_id = uid
      AND cm.role = 'admin'
  );
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_escalation ON public.conversation_members;
CREATE TRIGGER trg_prevent_member_escalation
  BEFORE UPDATE ON public.conversation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_member_privilege_escalation();

CREATE OR REPLACE FUNCTION public.create_or_get_direct_conversation(target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  pair_key TEXT;
  conv_id UUID;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF target_user_id IS NULL OR target_user_id = current_uid THEN
    RAISE EXCEPTION 'Cannot start a direct conversation with yourself.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Target user profile does not exist.';
  END IF;

  pair_key := LEAST(current_uid::text, target_user_id::text) || ':' || GREATEST(current_uid::text, target_user_id::text);

  INSERT INTO public.conversations (type, direct_key, created_by)
  VALUES ('direct', pair_key, current_uid)
  ON CONFLICT (direct_key) DO NOTHING
  RETURNING id INTO conv_id;

  IF conv_id IS NULL THEN
    SELECT id INTO conv_id
    FROM public.conversations
    WHERE direct_key = pair_key;
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES
    (conv_id, current_uid, 'member'),
    (conv_id, target_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  UPDATE public.conversation_members
  SET is_archived = false
  WHERE conversation_id = conv_id
    AND user_id = current_uid;

  RETURN conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_conversation(
  group_name TEXT,
  group_description TEXT DEFAULT NULL,
  group_avatar_url TEXT DEFAULT NULL,
  member_ids UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  conv_id UUID;
  uid UUID;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF char_length(trim(COALESCE(group_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Group name must be at least 2 characters.';
  END IF;

  INSERT INTO public.conversations (type, name, description, avatar_url, created_by)
  VALUES ('group', trim(group_name), NULLIF(trim(COALESCE(group_description, '')), ''), group_avatar_url, current_uid)
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (conv_id, current_uid, 'admin')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  FOREACH uid IN ARRAY COALESCE(member_ids, '{}')
  LOOP
    IF uid <> current_uid AND EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN
      INSERT INTO public.conversation_members (conversation_id, user_id, role)
      VALUES (conv_id, uid, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type)
  VALUES (conv_id, current_uid, 'Group "' || trim(group_name) || '" created', 'system');

  RETURN conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(conv_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  read_ts TIMESTAMPTZ := now();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF NOT public.is_conversation_member(conv_id, current_uid) THEN
    RAISE EXCEPTION 'Not a member of this conversation.';
  END IF;

  UPDATE public.conversation_members
  SET last_read_at = read_ts
  WHERE conversation_id = conv_id
    AND user_id = current_uid;

  RETURN read_ts;
END;
$$;

-- ============================================================================
-- 8. REALTIME PUBLICATION
-- ============================================================================
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
