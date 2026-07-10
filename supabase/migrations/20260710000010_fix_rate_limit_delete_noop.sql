-- Fix: enforce_rate_limit() silently cancels every DELETE.
--
-- The trigger from 20260601000003_rate_limiting.sql is attached
-- BEFORE INSERT OR UPDATE OR DELETE on bills, payments, farmers, inventory,
-- cash_book and expenses, but both exit paths end with RETURN NEW. For a
-- DELETE row NEW is NULL, and a BEFORE trigger that returns NULL cancels the
-- row operation — so every hard delete on those six tables has been a silent
-- no-op (zero rows affected, no error) for every role, service role included.
--
-- Return the row being processed instead: NEW for INSERT/UPDATE, OLD for DELETE.
--
-- Also fixes the RAISE: 'too_many_requests' is not a recognized PostgreSQL
-- condition name, so tripping the limit raised
-- `unrecognized exception condition "too_many_requests"` instead of the
-- intended message. Plain RAISE EXCEPTION (default P0001) keeps the message.

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
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_current_minute := date_trunc('minute', now());

  -- Upsert the action count for this user in the current minute
  INSERT INTO user_activity_limits (user_id, minute_window, action_count)
  VALUES (v_user_id, v_current_minute, 1)
  ON CONFLICT (user_id, minute_window)
  DO UPDATE SET action_count = user_activity_limits.action_count + 1
  RETURNING action_count INTO v_count;

  IF v_count > v_max_actions THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only perform % actions per minute.', v_max_actions;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
