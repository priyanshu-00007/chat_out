-- ChatSphere Row Level Security Policies

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can discover profiles" ON public.profiles;
CREATE POLICY "Authenticated users can discover profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group admins can update conversations" ON public.conversations;
CREATE POLICY "Group admins can update conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    type = 'group'
    AND public.is_conversation_admin(id, auth.uid())
  )
  WITH CHECK (
    type = 'group'
    AND public.is_conversation_admin(id, auth.uid())
  );

-- ============================================================================
-- CONVERSATION MEMBERS
-- ============================================================================
DROP POLICY IF EXISTS "Members can view conversation participants" ON public.conversation_members;
CREATE POLICY "Members can view conversation participants"
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Creators or admins can add members" ON public.conversation_members;
CREATE POLICY "Creators or admins can add members"
  ON public.conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.created_by = auth.uid()
    )
    OR public.is_conversation_admin(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own membership preferences" ON public.conversation_members;
CREATE POLICY "Users can update own membership preferences"
  ON public.conversation_members
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON public.conversation_members;
CREATE POLICY "Users can leave or admins can remove members"
  ON public.conversation_members
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_conversation_admin(conversation_id, auth.uid())
  );

-- ============================================================================
-- MESSAGES
-- ============================================================================
DROP POLICY IF EXISTS "Conversation members can read messages" ON public.messages;
CREATE POLICY "Conversation members can read messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can send messages as themselves" ON public.messages;
CREATE POLICY "Members can send messages as themselves"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Senders can update own messages" ON public.messages;
CREATE POLICY "Senders can update own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = sender_id
    AND public.is_conversation_member(conversation_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

-- ============================================================================
-- ATTACHMENTS
-- ============================================================================
DROP POLICY IF EXISTS "Conversation members can read attachments" ON public.attachments;
CREATE POLICY "Conversation members can read attachments"
  ON public.attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = attachments.message_id
        AND m.deleted_at IS NULL
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Senders can attach files to own messages" ON public.attachments;
CREATE POLICY "Senders can attach files to own messages"
  ON public.attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = attachments.message_id
        AND m.sender_id = auth.uid()
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );
