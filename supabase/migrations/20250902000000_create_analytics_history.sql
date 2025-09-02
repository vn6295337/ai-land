-- Create table for storing historical analytics data
CREATE TABLE public.analytics_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_models INTEGER NOT NULL,
  inference_provider_counts JSONB NOT NULL,
  model_provider_counts JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on timestamp for efficient time-range queries
CREATE INDEX idx_analytics_history_timestamp ON public.analytics_history(timestamp);

-- Enable Row Level Security
ALTER TABLE public.analytics_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Public read access for analytics history" 
ON public.analytics_history 
FOR SELECT 
USING (true);

-- Create policy to allow public insert (for data collection)
CREATE POLICY "Public insert access for analytics history" 
ON public.analytics_history 
FOR INSERT
WITH CHECK (true);

-- Function to insert analytics snapshot (prevents duplicates within 5 minutes)
CREATE OR REPLACE FUNCTION public.insert_analytics_snapshot(
  p_total_models INTEGER,
  p_inference_provider_counts JSONB,
  p_model_provider_counts JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  last_entry TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the timestamp of the most recent entry
  SELECT timestamp INTO last_entry 
  FROM public.analytics_history 
  ORDER BY timestamp DESC 
  LIMIT 1;
  
  -- Only insert if more than 5 minutes have passed since last entry
  IF last_entry IS NULL OR (now() - last_entry) > INTERVAL '5 minutes' THEN
    INSERT INTO public.analytics_history (
      total_models, 
      inference_provider_counts, 
      model_provider_counts
    ) VALUES (
      p_total_models, 
      p_inference_provider_counts, 
      p_model_provider_counts
    );
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;