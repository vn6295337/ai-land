-- Remove duplicate analytics entries, keeping only the LATEST entry per day

-- Option 1: Remove duplicates for a SPECIFIC date (e.g., Nov 3, 2025)
DELETE FROM analytics_history
WHERE id NOT IN (
  SELECT DISTINCT ON (DATE(timestamp))
    id
  FROM analytics_history
  WHERE DATE(timestamp) = '2025-11-03'  -- Change this date as needed
  ORDER BY DATE(timestamp), timestamp DESC
);

-- Option 2: Remove duplicates for ALL dates (keeps latest entry per day)
DELETE FROM analytics_history
WHERE id NOT IN (
  SELECT DISTINCT ON (DATE(timestamp))
    id
  FROM analytics_history
  ORDER BY DATE(timestamp), timestamp DESC
);

-- Option 3: Preview what will be deleted (run this first to verify)
SELECT
  DATE(timestamp) as date,
  COUNT(*) as total_entries,
  COUNT(*) - 1 as entries_to_delete,
  MIN(timestamp) as earliest,
  MAX(timestamp) as latest
FROM analytics_history
GROUP BY DATE(timestamp)
HAVING COUNT(*) > 1
ORDER BY DATE(timestamp) DESC;

-- Option 4: See which specific records will be KEPT
SELECT * FROM analytics_history
WHERE id IN (
  SELECT DISTINCT ON (DATE(timestamp))
    id
  FROM analytics_history
  ORDER BY DATE(timestamp), timestamp DESC
)
ORDER BY timestamp DESC
LIMIT 30;

-- Option 5: Count before and after
SELECT
  'Before cleanup' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT DATE(timestamp)) as unique_days
FROM analytics_history

UNION ALL

SELECT
  'Records to keep' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT DATE(timestamp)) as unique_days
FROM (
  SELECT DISTINCT ON (DATE(timestamp))
    *
  FROM analytics_history
  ORDER BY DATE(timestamp), timestamp DESC
) as kept_records;
