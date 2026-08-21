-- ===========================================================================
-- Database Project: PL/pgSQL Stored Procedures & Functions
-- File: procedures.sql
-- Database Engine: PostgreSQL
-- Description: Core logical functions adhering to strict character limits.
-- ===========================================================================

-- 1. Get user's purchased tickets by phone number or email
DROP FUNCTION IF EXISTS get_user_paid_tickets(VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION get_user_paid_tickets(p_contact VARCHAR)
RETURNS TABLE(
    ticket_id INT, title TEXT, match_date TIMESTAMP, price NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.ticket_id, 
           (t.home_team || ' vs ' || t.away_team) AS title, 
           t.match_date, t.price
    FROM tickets t
    JOIN reservations r ON t.ticket_id = r.ticket_id
    JOIN users u ON r.user_id = u.user_id
    WHERE (u.phone_number = p_contact OR u.email = p_contact) 
      AND r.status = 'paid';
END;
$$ LANGUAGE plpgsql;

-- 2. Get list of cancelled reservations handled by a SPECIFIC SUPPORT STAFF
DROP FUNCTION IF EXISTS get_cancelled_reservations_by_support(VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION get_cancelled_reservations_by_support(
    p_support_contact VARCHAR
)
RETURNS TABLE(
    reservation_id INT, ticket_title TEXT, user_name TEXT, reserved_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.reservation_id, 
        (t.home_team || ' vs ' || t.away_team) AS ticket_title, 
        (u.first_name || ' ' || u.last_name) AS user_name,
        r.reserved_at
    FROM reservations r
    JOIN tickets t ON r.ticket_id = t.ticket_id
    JOIN users u ON r.user_id = u.user_id
    JOIN users sup ON r.cancelled_by_support_id = sup.user_id
    WHERE (sup.phone_number = p_support_contact 
           OR sup.email = p_support_contact) 
      AND r.status = 'cancelled';
END;
$$ LANGUAGE plpgsql;

-- 3. Get all purchased tickets in a SPECIFIC CITY
DROP FUNCTION IF EXISTS get_tickets_by_city(VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION get_tickets_by_city(p_city VARCHAR)
RETURNS TABLE(
    ticket_id INT, match_title TEXT, venue_name VARCHAR, match_date TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.ticket_id, 
           (t.home_team || ' vs ' || t.away_team) AS match_title, 
           t.venue_name, t.match_date
    FROM tickets t
    JOIN reservations r ON t.ticket_id = r.ticket_id
    WHERE t.city = p_city AND r.status = 'paid';
END;
$$ LANGUAGE plpgsql;

-- 4. Full-text search across teams, venues, user names, and ticket tier
DROP FUNCTION IF EXISTS search_tickets_and_users(VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION search_tickets_and_users(p_keyword VARCHAR)
RETURNS TABLE(source_type TEXT, item_id INT, description TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Ticket'::TEXT AS source_type, ticket_id AS item_id, 
           (home_team || ' vs ' || away_team || ' at ' || 
            venue_name || ' (' || ticket_tier || ')') AS description
    FROM tickets
    WHERE home_team ILIKE '%' || p_keyword || '%' 
       OR away_team ILIKE '%' || p_keyword || '%' 
       OR venue_name ILIKE '%' || p_keyword || '%'
       OR ticket_tier ILIKE '%' || p_keyword || '%'
    UNION ALL
    SELECT 'User'::TEXT AS source_type, user_id AS item_id, 
           (first_name || ' ' || last_name || ' - ' || email) AS description
    FROM users
    WHERE first_name ILIKE '%' || p_keyword || '%' 
       OR last_name ILIKE '%' || p_keyword || '%'
       OR email ILIKE '%' || p_keyword || '%';
END;
$$ LANGUAGE plpgsql;

-- 5. Find fellow citizens (users in the same city) for a given user
DROP FUNCTION IF EXISTS get_user_city_neighbors(INT) CASCADE;
CREATE OR REPLACE FUNCTION get_user_city_neighbors(p_user_id INT)
RETURNS TABLE(
    neighbor_id INT, neighbor_name TEXT, email VARCHAR, city VARCHAR
) AS $$
DECLARE
    v_user_city VARCHAR;
BEGIN
    SELECT u.city INTO v_user_city FROM users u WHERE u.user_id = p_user_id;
    
    RETURN QUERY
    SELECT u.user_id, 
           (u.first_name || ' ' || u.last_name) AS neighbor_name, 
           u.email, u.city
    FROM users u
    WHERE u.city = v_user_city AND u.user_id <> p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Get Top N Buyers Since a Specific Date
DROP FUNCTION IF EXISTS get_top_buyers_since_date(TIMESTAMP, INT) CASCADE;
CREATE OR REPLACE FUNCTION get_top_buyers_since_date(
    p_since_date TIMESTAMP, p_top_n INT
)
RETURNS TABLE(user_id INT, full_name TEXT, total_spent NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, 
           (u.first_name || ' ' || u.last_name) AS full_name, 
           SUM(p.amount) AS total_spent
    FROM users u
    JOIN payments p ON u.user_id = p.user_id
    WHERE p.status = 'successful' AND p.paid_at >= p_since_date
    GROUP BY u.user_id, u.first_name, u.last_name
    ORDER BY total_spent DESC
    LIMIT p_top_n;
END;
$$ LANGUAGE plpgsql;

-- 7. Get Cancelled Reservations Filtered by Sport Type
DROP FUNCTION IF EXISTS get_cancelled_reservations_by_sport(sport_type_enum) 
    CASCADE;

CREATE OR REPLACE FUNCTION get_cancelled_reservations_by_sport(
    p_sport_type sport_type_enum
)
RETURNS TABLE(
    reservation_id INT, ticket_title TEXT, cancelled_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT r.reservation_id, 
           (t.home_team || ' vs ' || t.away_team) AS ticket_title, 
           r.reserved_at
    FROM reservations r
    JOIN tickets t ON r.ticket_id = t.ticket_id
    WHERE t.sport_type = p_sport_type AND r.status = 'cancelled'
    ORDER BY r.reserved_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. Get users with the highest number of reports in a specific category
DROP FUNCTION IF EXISTS get_users_with_most_reports_by_category(VARCHAR) 
    CASCADE;

CREATE OR REPLACE FUNCTION get_users_with_most_reports_by_category(
    p_category VARCHAR
)
RETURNS TABLE(full_name TEXT, report_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT (u.first_name || ' ' || u.last_name) AS full_name, 
           COUNT(rep.report_id) AS r_count
    FROM users u
    JOIN reports rep ON u.user_id = rep.user_id
    WHERE rep.category = p_category
    GROUP BY u.user_id, u.first_name, u.last_name
    ORDER BY r_count DESC;
END;
$$ LANGUAGE plpgsql;

-- 9. Calculate Cancellation Penalty & Refund (Anti-Infinite-Money-Glitch)
DROP FUNCTION IF EXISTS calculate_cancellation_penalty(INT) CASCADE;
CREATE OR REPLACE FUNCTION calculate_cancellation_penalty(p_reservation_id INT)
RETURNS TABLE (
    refund_amount DECIMAL(15,2),
    penalty_amount DECIMAL(15,2)
) AS $$
DECLARE
    v_match_date TIMESTAMP;
    v_paid_amount DECIMAL(15,2);
    v_status VARCHAR;
    v_hours_diff NUMERIC;
    v_penalty_rate DECIMAL(3,2);
BEGIN
    -- 1. Fetch exact paid amount from payments table (Not dynamic price)
    SELECT t.match_date, p.amount, r.status::VARCHAR
    INTO v_match_date, v_paid_amount, v_status
    FROM reservations r
    JOIN tickets t ON r.ticket_id = t.ticket_id
    LEFT JOIN payments p ON p.reservation_id = r.reservation_id 
        AND p.status = 'successful'
    WHERE r.reservation_id = p_reservation_id;

    -- 2. If unpaid (pending), no money exchanged
    IF v_status = 'pending' OR v_paid_amount IS NULL THEN
        RETURN QUERY SELECT 0.00::DECIMAL(15,2), 0.00::DECIMAL(15,2);
        RETURN;
    END IF;

    -- 3. Calculate hours remaining until match
    v_hours_diff := EXTRACT(EPOCH FROM (v_match_date - CURRENT_TIMESTAMP))/3600;

    -- 4. Determine penalty tier based on time remaining
    IF v_hours_diff > 72 THEN
        v_penalty_rate := 0.10; -- 10% penalty
    ELSIF v_hours_diff > 24 THEN
        v_penalty_rate := 0.20; -- 20% penalty
    ELSE
        v_penalty_rate := 0.50; -- 50% penalty
    END IF;

    -- 5. Calculate refund based on ACTUAL paid amount
    RETURN QUERY SELECT
        (v_paid_amount * (1 - v_penalty_rate))::DECIMAL(15,2),
        (v_paid_amount * v_penalty_rate)::DECIMAL(15,2);
END;
$$ LANGUAGE plpgsql;