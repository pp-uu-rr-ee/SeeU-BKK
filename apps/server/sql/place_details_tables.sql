-- Place details, reviews, and favorites
-- Run after core_tables.sql (Supabase SQL Editor)

-- Contact and visit info shown on the place detail page
ALTER TABLE bangkok_unseen
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS suggested_duration_min INT CHECK (suggested_duration_min > 0),
    ADD COLUMN IF NOT EXISTS best_for TEXT[] DEFAULT '{}'::text[];

-- Weekly opening hours (one row per day; close_time < open_time means it closes after midnight)
CREATE TABLE IF NOT EXISTS place_opening_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID NOT NULL REFERENCES bangkok_unseen(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(place_id, day_of_week),
    CHECK (is_closed OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

-- User reviews (one per user per place)
CREATE TABLE IF NOT EXISTS place_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID NOT NULL REFERENCES bangkok_unseen(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT CHECK (char_length(comment) <= 2000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(place_id, user_id)
);

-- Saved / favorite places
CREATE TABLE IF NOT EXISTS user_favorites (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES bangkok_unseen(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, place_id)
);

-- Aggregated rating per place (security_invoker so RLS of the caller applies)
CREATE OR REPLACE VIEW place_rating_stats
WITH (security_invoker = true) AS
SELECT
    place_id,
    ROUND(AVG(rating)::numeric, 1)::double precision AS avg_rating,
    COUNT(*)::int AS review_count
FROM place_reviews
GROUP BY place_id;

-- updated_at triggers
DROP TRIGGER IF EXISTS update_place_opening_hours_updated_at ON place_opening_hours;
CREATE TRIGGER update_place_opening_hours_updated_at
    BEFORE UPDATE ON place_opening_hours
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_place_reviews_updated_at ON place_reviews;
CREATE TRIGGER update_place_reviews_updated_at
    BEFORE UPDATE ON place_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_place_opening_hours_place_id ON place_opening_hours(place_id);
CREATE INDEX IF NOT EXISTS idx_place_reviews_place_id ON place_reviews(place_id);
CREATE INDEX IF NOT EXISTS idx_place_reviews_user_id ON place_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_place_id ON user_favorites(place_id);

-- Row level security (the API uses the service role; these protect direct client access)
ALTER TABLE place_opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view opening hours" ON place_opening_hours;
CREATE POLICY "Anyone can view opening hours" ON place_opening_hours
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view reviews" ON place_reviews;
CREATE POLICY "Anyone can view reviews" ON place_reviews
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own reviews" ON place_reviews;
CREATE POLICY "Users can manage own reviews" ON place_reviews
    FOR ALL USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own favorites" ON user_favorites;
CREATE POLICY "Users can manage own favorites" ON user_favorites
    FOR ALL USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);
