-- =============================================================================
-- BRANCH THEME COLORS
-- Each branch can pick a theme color. The app re-themes its primary color
-- (headers, buttons, accents) to the active branch's color so dealers always
-- know which shop they are working in. NULL = default AquaDealers blue.
-- =============================================================================

ALTER TABLE branches ADD COLUMN IF NOT EXISTS color TEXT;
