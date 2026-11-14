-- Contact request workflow for friend/connection requests.

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contact_requests_unique_pair UNIQUE (sender_id, recipient_id),
  CONSTRAINT contact_requests_no_self CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_recipient_status
  ON public.contact_requests (recipient_id, status);

CREATE INDEX IF NOT EXISTS idx_contact_requests_sender_status
  ON public.contact_requests (sender_id, status);

CREATE OR REPLACE FUNCTION public.handle_contact_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_requests_updated_at ON public.contact_requests;
CREATE TRIGGER trg_contact_requests_updated_at
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_contact_request_updated_at();
