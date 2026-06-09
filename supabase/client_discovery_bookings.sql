-- Discovery calls booked via Cal.com public page (webhook → backend).
-- Linked to clients.id (works before account activation; user_id may be NULL).

CREATE TABLE IF NOT EXISTS public.client_discovery_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  cal_uid text NOT NULL,
  title text NOT NULL DEFAULT 'Discovery Call',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  meeting_url text,
  guest_name text,
  guest_email text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'rescheduled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_discovery_bookings_cal_uid
  ON public.client_discovery_bookings (cal_uid);

CREATE INDEX IF NOT EXISTS idx_client_discovery_bookings_client_start
  ON public.client_discovery_bookings (client_id, start_at);

ALTER TABLE public.client_discovery_bookings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_discovery_bookings TO service_role;
