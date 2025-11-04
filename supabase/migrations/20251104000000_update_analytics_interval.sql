-- Update analytics snapshot function to collect data every 12 hours instead of 5 minutes
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

  -- Only insert if 12 hours or more have passed since last entry
  IF last_entry IS NULL OR (now() - last_entry) >= INTERVAL '12 hours' THEN
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
