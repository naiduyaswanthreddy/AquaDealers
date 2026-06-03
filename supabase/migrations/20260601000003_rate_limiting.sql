-- Rate Limiting using Postgres Triggers
-- Limits staff members (users interacting with app) to a certain number of writes per minute.

-- Create table to track action counts
CREATE TABLE IF NOT EXISTS user_activity_limits (
  user_id UUID NOT NULL,
  minute_window TIMESTAMP NOT NULL,
  action_count INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, minute_window)
);

-- Enable RLS but since it's an internal tracking table we deny all standard access
ALTER TABLE user_activity_limits ENABLE ROW LEVEL SECURITY;

-- The trigger function
CREATE OR REPLACE FUNCTION enforce_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_current_minute TIMESTAMP;
  v_count INTEGER;
  v_max_actions INTEGER := 30; -- Strict 30 actions/minute
BEGIN
  -- Get the current authenticated user id
  v_user_id := auth.uid();
  
  -- If not triggered by a web user (e.g. service role), allow it
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_current_minute := date_trunc('minute', now());

  -- Upsert the action count for this user in the current minute
  INSERT INTO user_activity_limits (user_id, minute_window, action_count)
  VALUES (v_user_id, v_current_minute, 1)
  ON CONFLICT (user_id, minute_window) 
  DO UPDATE SET action_count = user_activity_limits.action_count + 1
  RETURNING action_count INTO v_count;

  IF v_count > v_max_actions THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only perform % actions per minute.', v_max_actions
      USING ERRCODE = 'too_many_requests';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function to prevent user_activity_limits from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM user_activity_limits WHERE minute_window < now() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to critical tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['bills', 'payments', 'farmers', 'inventory', 'cash_book', 'expenses'])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_rate_limit_%I ON %I;
      CREATE TRIGGER trg_rate_limit_%I
      BEFORE INSERT OR UPDATE OR DELETE ON %I
      FOR EACH ROW EXECUTE FUNCTION enforce_rate_limit();
    ', t, t, t, t);
  END LOOP;
END;
$$;
