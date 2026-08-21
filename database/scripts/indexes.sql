-- ===========================================================================
-- Database Project: Indexes and Query Optimization
-- File: indexes.sql
-- Database Engine: PostgreSQL
-- Description: B-Tree and GIN indexes for query performance optimization.
-- ===========================================================================

-- Performance B-Tree Indexes for frequent filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tickets_sport_city 
    ON tickets(sport_type, city);

CREATE INDEX IF NOT EXISTS idx_tickets_match_date 
    ON tickets(match_date ASC);

CREATE INDEX IF NOT EXISTS idx_reservations_user_status 
    ON reservations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_status 
    ON reservations(status);

-- Indexes for frequent JOIN operations and financial aggregations
CREATE INDEX IF NOT EXISTS idx_payments_user_id 
    ON payments(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at 
    ON payments(paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_category 
    ON reports(category);

-- Enable Trigram Extension for fast wildcard ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN Trigram Indexes for text search optimization
CREATE INDEX IF NOT EXISTS idx_tickets_venue_trgm 
    ON tickets USING GIN (venue_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_home_team_trgm 
    ON tickets USING GIN (home_team gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_away_team_trgm 
    ON tickets USING GIN (away_team gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_names_trgm 
    ON users USING GIN (first_name gin_trgm_ops, last_name gin_trgm_ops);