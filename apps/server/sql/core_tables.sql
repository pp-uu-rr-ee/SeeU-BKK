-- Core tables required by the application
-- Run with: bun run db:push

CREATE EXTENSION IF NOT EXISTS vector;

-- User profile table for additional Supabase auth user metadata
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nick_name TEXT,
    avatar_url TEXT,
    birth_year INT,
    travel_style TEXT[] DEFAULT '{}'::text[],
    mobility TEXT,
    budget_per_day INT,
    languages TEXT[] DEFAULT '{}'::text[],
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_completed_at TIMESTAMPTZ,
    onboarding_skipped_at TIMESTAMPTZ,
    onboarding_preferences JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Place catalog table used by maps, search, admin, and itineraries
CREATE TABLE IF NOT EXISTS bangkok_unseen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    area TEXT,
    description TEXT,
    name_th TEXT,
    description_th TEXT,
    tags TEXT[] DEFAULT '{}'::text[],
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    address TEXT,
    price INT,
    image_url TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved itineraries table
CREATE TABLE IF NOT EXISTS itineraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    total_minutes INT,
    total_distance_km DOUBLE PRECISION,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itinerary stops for ordered place visits in each saved itinerary
CREATE TABLE IF NOT EXISTS itinerary_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    position INT NOT NULL,
    place_id UUID NOT NULL REFERENCES bangkok_unseen(id) ON DELETE RESTRICT,
    suggested_time_min INT,
    distance_from_prev_km DOUBLE PRECISION,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMPTZ WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(itinerary_id, position)
);

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bangkok_unseen_updated_at ON bangkok_unseen;
CREATE TRIGGER update_bangkok_unseen_updated_at
    BEFORE UPDATE ON bangkok_unseen
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_itineraries_updated_at ON itineraries;
CREATE TRIGGER update_itineraries_updated_at
    BEFORE UPDATE ON itineraries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_itinerary_stops_updated_at ON itinerary_stops;
CREATE TRIGGER update_itinerary_stops_updated_at
    BEFORE UPDATE ON itinerary_stops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for common foreign keys
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_user_id ON itineraries(user_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_stops_itinerary_id ON itinerary_stops(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_stops_place_id ON itinerary_stops(place_id);

-- Optional security policies for Supabase auth
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile" ON user_profiles
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own itineraries" ON itineraries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can modify own itineraries" ON itineraries
    FOR INSERT, UPDATE, DELETE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view itinerary stops for own itineraries" ON itinerary_stops
    FOR SELECT USING (
        itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can modify itinerary stops for own itineraries" ON itinerary_stops
    FOR INSERT, UPDATE, DELETE USING (
        itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid())
    )
    WITH CHECK (
        itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid())
    );
