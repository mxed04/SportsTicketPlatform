-- =============================================================================
-- Database Project: Seed Data Script (DML) - Premium International Dataset
-- File: seed.sql
-- Database Engine: PostgreSQL
-- =============================================================================

-- پاکسازی ایمن جداول برای جلوگیری از خطای Duplicate Key
TRUNCATE TABLE users, tickets, reservations, payments, reports, football_details, basketball_details, volleyball_details RESTART IDENTITY CASCADE;

-- 1. Insert Premium Users
INSERT INTO users (first_name, last_name, phone_number, email, password_hash, role, city) VALUES
('John', 'Doe', '09121111111', 'john@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'London'),
('Jane', 'Smith', '09122222222', 'jane@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'New York'),
('Michael', 'Johnson', '09123333333', 'michael@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'Paris'),
('Emily', 'Davis', '09124444444', 'emily@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'Berlin'),
('David', 'Wilson', '09125555555', 'david@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'Toronto'),
('Sarah', 'Brown', '09126666666', 'sarah@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'Sydney'),
('Chris', 'Taylor', '09127777777', 'chris@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'Los Angeles'),
('Jessica', 'Anderson', '09128888888', 'jessica@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'Chicago'),
('James', 'Thomas', '09129999999', 'james@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'audience', 'Miami'),
('Admin', 'System', '09120000000', 'admin@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'admin', 'London'),
('Mohammad', 'Afra', '09120000002', 'moadm@example.com', '$2b$12$eW8P62.WjJ17z9iP83k.2u30RjF.vE62HjL7NqZ9H/F0Y.i1eZ24a', 'admin', 'Seattle');

-- 2. Insert International Premium Tickets
INSERT INTO tickets (home_team, away_team, match_date, sport_type, price, remaining_capacity, is_active, venue_name, ticket_tier, organizer, city) VALUES
('Real Madrid', 'Barcelona', CURRENT_TIMESTAMP + INTERVAL '5 days', 'football', 1500000.00, 150, true, 'Santiago Bernabeu', 'VIP', 'La Liga', 'Madrid'),
('Manchester City', 'Arsenal', CURRENT_TIMESTAMP + INTERVAL '7 days', 'football', 1200000.00, 200, true, 'Etihad Stadium', 'Standard', 'Premier League', 'Manchester'),
('Bayern Munich', 'Borussia Dortmund', CURRENT_TIMESTAMP + INTERVAL '10 days', 'football', 1000000.00, 500, true, 'Allianz Arena', 'Premium', 'Bundesliga', 'Munich'),
('Los Angeles Lakers', 'Chicago Bulls', CURRENT_TIMESTAMP + INTERVAL '3 days', 'basketball', 2500000.00, 50, true, 'Crypto.com Arena', 'VIP', 'NBA', 'Los Angeles'),
('Golden State Warriors', 'Boston Celtics', CURRENT_TIMESTAMP + INTERVAL '4 days', 'basketball', 2200000.00, 300, true, 'Chase Center', 'Standard', 'NBA', 'San Francisco'),
('Miami Heat', 'New York Knicks', CURRENT_TIMESTAMP + INTERVAL '8 days', 'basketball', 1800000.00, 450, true, 'Kaseya Center', 'Standard', 'NBA', 'Miami'),
('Brazil', 'Italy', CURRENT_TIMESTAMP + INTERVAL '2 days', 'volleyball', 900000.00, 100, true, 'Maracanãzinho Arena', 'VIP', 'FIVB', 'Rio de Janeiro'),
('Poland', 'USA', CURRENT_TIMESTAMP + INTERVAL '6 days', 'volleyball', 850000.00, 600, true, 'Spodek Arena', 'Standard', 'FIVB', 'Katowice'),
('Japan', 'France', CURRENT_TIMESTAMP + INTERVAL '12 days', 'volleyball', 800000.00, 800, true, 'Yoyogi National Gymnasium', 'Premium', 'FIVB', 'Tokyo'),
('Liverpool', 'Chelsea', CURRENT_TIMESTAMP + INTERVAL '14 days', 'football', 1300000.00, 1000, true, 'Anfield Stadium', 'Standard', 'Premier League', 'Liverpool');

-- 3. Insert Specific Details (Fixed: added ticket_type and ticket_tier)
INSERT INTO football_details (ticket_id, league_name, stadium_name, stand_section, row_number, seat_number, ticket_type) VALUES 
(1, 'La Liga', 'Santiago Bernabeu', 'North Stand', 5, 12, 'VIP'), 
(2, 'Premier League', 'Etihad Stadium', 'South Stand', 12, 45, 'Standard'), 
(3, 'Bundesliga', 'Allianz Arena', 'Main Stand', 8, 33, 'Premium'), 
(10, 'Premier League', 'Anfield Stadium', 'The Kop', 22, 110, 'Standard');

INSERT INTO basketball_details (ticket_id, league_name, hall_name, seat_section, row_number, seat_number, ticket_tier) VALUES 
(4, 'NBA', 'Crypto.com Arena', 'Courtside A', 1, 4, 'VIP'), 
(5, 'NBA', 'Chase Center', 'Lower Bowl B', 15, 88, 'Standard'), 
(6, 'NBA', 'Kaseya Center', 'Upper Level C', 30, 210, 'Standard');

INSERT INTO volleyball_details (ticket_id, league_name, hall_name, seat_section, row_number, seat_number, ticket_tier) VALUES 
(7, 'FIVB Nations', 'Maracanãzinho Arena', 'VIP Zone', 2, 10, 'VIP'), 
(8, 'FIVB Nations', 'Spodek Arena', 'Zone A', 10, 55, 'Standard'), 
(9, 'FIVB Nations', 'Yoyogi National Gymnasium', 'Zone B', 14, 102, 'Premium');

-- 4. Insert Reservations
INSERT INTO reservations (user_id, ticket_id, status, reserved_at, expires_at) VALUES
(1, 1, 'paid', CURRENT_TIMESTAMP - INTERVAL '1 days', CURRENT_TIMESTAMP + INTERVAL '2 days'),
(2, 4, 'paid', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '1 days'),
(3, 7, 'paid', CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP + INTERVAL '3 days'),
(4, 2, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
(5, 5, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
(6, 8, 'cancelled', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 days'),
(7, 3, 'cancelled', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- 5. Insert Payments
INSERT INTO payments (reservation_id, user_id, amount, status, payment_method, paid_at) VALUES
(1, 1, 1500000.00, 'successful', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '1 days'),
(2, 2, 2500000.00, 'successful', 'paypal', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 3, 900000.00, 'successful', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
(6, 6, 850000.00, 'failed', 'crypto', CURRENT_TIMESTAMP - INTERVAL '1 days');

-- 6. Insert Reports
INSERT INTO reports (user_id, ticket_id, reservation_id, category, report_text, status) VALUES
(4, 2, 4, 'Payment Issue', 'Payment gateway timed out during checkout.', 'under_review'),
(6, 8, 6, 'Cancellation Issue', 'My ticket was cancelled automatically but I was paying.', 'resolved');