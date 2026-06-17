
CREATE TABLE public.property_research_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_research_links TO authenticated;
GRANT ALL ON public.property_research_links TO service_role;

ALTER TABLE public.property_research_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own research links"
ON public.property_research_links FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX property_research_links_user_parcel_idx
ON public.property_research_links (user_id, parcel_id);

CREATE TRIGGER property_research_links_set_updated_at
BEFORE UPDATE ON public.property_research_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
