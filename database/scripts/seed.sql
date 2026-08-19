-- =============================================================================
-- Database Project: Seed Data Script (DML) - Premium International Dataset
-- File: seed.sql
-- Database Engine: PostgreSQL
-- =============================================================================

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
INSERT INTO tickets (home_team, away_team, match_date, sport_type, price, remaining_capacity, is_active, venue_name) VALUES
('Real Madrid', 'Barcelona', CURRENT_TIMESTAMP + INTERVAL '5 days', 'football', 1500000.00, 150, true, 'Santiago Bernabeu'),
('Manchester City', 'Arsenal', CURRENT_TIMESTAMP + INTERVAL '7 days', 'football', 1200000.00, 200, true, 'Etihad Stadium'),
('Bayern Munich', 'Borussia Dortmund', CURRENT_TIMESTAMP + INTERVAL '10 days', 'football', 1000000.00, 500, true, 'Allianz Arena'),
('Los Angeles Lakers', 'Chicago Bulls', CURRENT_TIMESTAMP + INTERVAL '3 days', 'basketball', 2500000.00, 50, true, 'Crypto.com Arena'),
('Golden State Warriors', 'Boston Celtics', CURRENT_TIMESTAMP + INTERVAL '4 days', 'basketball', 2200000.00, 300, true, 'Chase Center'),
('Miami Heat', 'New York Knicks', CURRENT_TIMESTAMP + INTERVAL '8 days', 'basketball', 1800000.00, 450, true, 'Kaseya Center'),
('Brazil', 'Italy', CURRENT_TIMESTAMP + INTERVAL '2 days', 'volleyball', 900000.00, 100, true, 'Maracanãzinho Arena'),
('Poland', 'USA', CURRENT_TIMESTAMP + INTERVAL '6 days', 'volleyball', 850000.00, 600, true, 'Spodek Arena'),
('Japan', 'France', CURRENT_TIMESTAMP + INTERVAL '12 days', 'volleyball', 800000.00, 800, true, 'Yoyogi National Gymnasium'),
('Liverpool', 'Chelsea', CURRENT_TIMESTAMP + INTERVAL '14 days', 'football', 1300000.00, 1000, true, 'Anfield Stadium');

-- 3. Insert Specific Details
-- Football (Ticket IDs 1, 2, 3, 10)
INSERT INTO football_details (ticket_id, stadium_name, ticket_type, gate_number, has_parking, amenities) VALUES
(1, 'Santiago Bernabeu', 'VIP', 'Gate A', true, '{"lounge_access": true, "food_included": true}'),
(2, 'Etihad Stadium', 'Standard', 'Gate C', false, '{"lounge_access": false}'),
(3, 'Allianz Arena', 'Premium', 'Gate B', true, '{"lounge_access": true}'),
(10, 'Anfield Stadium', 'Standard', 'Gate D', false, '{"lounge_access": false}');

-- Basketball (Ticket IDs 4, 5, 6)
INSERT INTO basketball_details (ticket_id, arena_name, ticket_tier, court_side, has_parking, amenities) VALUES
(4, 'Crypto.com Arena', 'Courtside', 'Row 1', true, '{"meet_and_greet": true}'),
(5, 'Chase Center', 'Lower Bowl', 'Row 10', true, '{"meet_and_greet": false}'),
(6, 'Kaseya Center', 'Upper Bowl', 'Row 30', false, '{}');

-- Volleyball (Ticket IDs 7, 8, 9)
INSERT INTO volleyball_details (ticket_id, stadium_name, ticket_tier, court_side, has_parking, amenities) VALUES
(7, 'Maracanãzinho Arena', 'VIP', 'Zone A', true, '{"snack_bar": true}'),
(8, 'Spodek Arena', 'Standard', 'Zone C', false, '{"snack_bar": false}'),
(9, 'Yoyogi National Gymnasium', 'Premium', 'Zone B', true, '{"snack_bar": true}');

-- 4. Insert Reservations
INSERT INTO reservations (user_id, ticket_id, reservation_status, expires_at) VALUES
(1, 1, 'confirmed', CURRENT_TIMESTAMP + INTERVAL '2 days'),
(2, 4, 'confirmed', CURRENT_TIMESTAMP + INTERVAL '1 days'),
(3, 7, 'confirmed', CURRENT_TIMESTAMP + INTERVAL '3 days'),
(4, 2, 'pending', CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
(5, 5, 'pending', CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
(6, 8, 'cancelled', CURRENT_TIMESTAMP - INTERVAL '1 days'),
(7, 3, 'cancelled', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- 5. Insert Payments
INSERT INTO payments (reservation_id, user_id, amount, status, payment_method, transaction_date) VALUES
(1, 1, 1500000.00, 'successful', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '1 days'),
(2, 2, 2500000.00, 'successful', 'paypal', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 3, 900000.00, 'successful', 'credit_card', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
(6, 6, 850000.00, 'failed', 'crypto', CURRENT_TIMESTAMP - INTERVAL '1 days');

-- 6. Insert Reports
INSERT INTO reports (user_id, ticket_id, reservation_id, category, report_text, status) VALUES
(4, 2, 4, 'Payment Issue', 'Payment gateway timed out during checkout.', 'under_review'),
(6, 8, 6, 'Cancellation Issue', 'My ticket was cancelled automatically but I was paying.', 'resolved');