
CREATE TABLE public.property_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  parcel_id text not null,
  url text,
  asking_price_cents integer,
  agent text,
  agency text,
  notes text,
  found_at date default current_date,
  status text not null default 'Watching',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_listings TO authenticated;
GRANT ALL ON public.property_listings TO service_role;
ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own listings" ON public.property_listings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_property_listings_updated_at
  BEFORE UPDATE ON public.property_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.property_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  parcel_id text not null,
  personal text,
  pros text,
  cons text,
  questions text,
  agent_contact text,
  municipality text,
  renovation text,
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  UNIQUE (user_id, parcel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_notes TO authenticated;
GRANT ALL ON public.property_notes TO service_role;
ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own notes" ON public.property_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_property_notes_updated_at
  BEFORE UPDATE ON public.property_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.saved_properties
  ADD COLUMN IF NOT EXISTS research_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS external_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_price_cents integer,
  ADD COLUMN IF NOT EXISTS manual_value_cents integer,
  ADD COLUMN IF NOT EXISTS user_data jsonb NOT NULL DEFAULT '{}'::jsonb;
