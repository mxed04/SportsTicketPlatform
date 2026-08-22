-- ===========================================================================
-- Database Project: Analytical SQL Queries (Phase 2 - 22 Queries)
-- File: queries.sql
-- Database Engine: PostgreSQL
-- Note: Destructive queries (UPDATE/DELETE) are strictly moved to the end!
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PART 1: ANALYTICAL & INFORMATION QUERIES (SELECT) - Safe to run
-- ---------------------------------------------------------------------------

-- 1. First/last name of users with zero reservations (NOT EXISTS optimized)
SELECT first_name, last_name 
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM reservations r WHERE r.user_id = u.user_id
) AND u.role = 'audience';

-- 2. First and last name of users who purchased at least one ticket
SELECT DISTINCT u.first_name, u.last_name 
FROM users u 
JOIN payments p ON u.user_id = p.user_id 
WHERE p.status = 'successful';

-- 3. Total amount paid by each user in the last month
SELECT u.first_name, u.last_name, SUM(p.amount) AS total_paid 
FROM payments p
JOIN users u ON p.user_id = u.user_id
WHERE p.status = 'successful' 
  AND p.paid_at >= CURRENT_TIMESTAMP - INTERVAL '1 month' 
GROUP BY u.user_id, u.first_name, u.last_name;

-- 4. Users who purchased a ticket exactly once in each city
SELECT u.user_id, u.first_name, u.last_name, t.city 
FROM users u 
JOIN reservations r ON u.user_id = r.user_id 
JOIN tickets t ON r.ticket_id = t.ticket_id 
JOIN payments p ON r.reservation_id = p.reservation_id 
WHERE p.status = 'successful' 
GROUP BY u.user_id, u.first_name, u.last_name, t.city 
HAVING COUNT(r.reservation_id) = 1;

-- 5. Information of user(s) who bought the most recently created ticket
SELECT u.first_name, u.last_name, u.phone_number, 
       (t.home_team || ' vs ' || t.away_team) AS newest_ticket_title, 
       t.created_at
FROM users u 
JOIN reservations r ON u.user_id = r.user_id 
JOIN tickets t ON r.ticket_id = t.ticket_id 
WHERE r.status = 'paid'
ORDER BY t.created_at DESC 
LIMIT 1;

-- 6. Contact info of users spending more than the overall average
SELECT u.phone_number, u.email, SUM(p.amount) AS total_spending
FROM users u 
JOIN payments p ON u.user_id = p.user_id 
WHERE p.status = 'successful' 
GROUP BY u.user_id, u.phone_number, u.email 
HAVING SUM(p.amount) > (
    SELECT AVG(user_total) FROM (
        SELECT SUM(amount) AS user_total 
        FROM payments 
        WHERE status = 'successful' 
        GROUP BY user_id
    ) AS avg_subquery
);

-- 7. Total count of tickets sold categorized by sport type
SELECT t.sport_type, COUNT(r.reservation_id) AS total_sold 
FROM tickets t 
JOIN reservations r ON t.ticket_id = r.ticket_id 
WHERE r.status = 'paid' 
GROUP BY t.sport_type;

-- 8. Top 3 buyers with the highest number of ticket purchases in the last week
SELECT u.first_name, u.last_name, COUNT(r.reservation_id) AS ticket_count 
FROM users u 
JOIN reservations r ON u.user_id = r.user_id 
WHERE r.status = 'paid' 
  AND r.reserved_at >= CURRENT_TIMESTAMP - INTERVAL '1 week' 
GROUP BY u.user_id, u.first_name, u.last_name 
ORDER BY ticket_count DESC 
LIMIT 3;

-- 9. Number of tickets sold in Tehran province categorized by city
SELECT t.city, COUNT(r.reservation_id) AS sold_count 
FROM tickets t 
JOIN reservations r ON t.ticket_id = r.ticket_id 
WHERE t.city IN (
    'Tehran', 'Shahr-e Qods', 'Rey', 'Islamshahr', 
    'Shahriar', 'Malard', 'Varamin', 'Pakdasht', 
    'Damavand', 'Firuzkuh', 'Pardis', 'Robat Karim'
) 
AND r.status = 'paid' 
GROUP BY t.city
ORDER BY sold_count DESC;

-- 10. Distinct cities where the oldest registered user bought tickets
SELECT DISTINCT t.city 
FROM tickets t 
JOIN reservations r ON t.ticket_id = r.ticket_id 
WHERE r.user_id = (
    SELECT user_id FROM users ORDER BY created_at ASC LIMIT 1
) AND r.status = 'paid';

-- 11. Names of support team members who manage the platform
SELECT first_name, last_name 
FROM users 
WHERE role = 'support';

-- 12. Names of users who purchased at least 2 tickets
SELECT u.first_name, u.last_name 
FROM users u 
JOIN reservations r ON u.user_id = r.user_id 
WHERE r.status = 'paid' 
GROUP BY u.user_id, u.first_name, u.last_name 
HAVING COUNT(r.reservation_id) >= 2;

-- 13. Users who bought at most 2 tickets for a specific sport (Active buyers)
SELECT u.first_name, u.last_name, COUNT(r.reservation_id) AS football_tickets
FROM users u 
JOIN reservations r ON u.user_id = r.user_id 
JOIN tickets t ON r.ticket_id = t.ticket_id 
WHERE t.sport_type = 'football' AND r.status = 'paid' 
GROUP BY u.user_id, u.first_name, u.last_name 
HAVING COUNT(r.reservation_id) <= 2;

-- 14. Contact info of users who bought tickets across ALL available sports
SELECT u.first_name, u.last_name, u.phone_number 
FROM users u 
JOIN reservations r ON u.user_id = r.user_id 
JOIN tickets t ON r.ticket_id = t.ticket_id 
WHERE r.status = 'paid' 
GROUP BY u.user_id, u.first_name, u.last_name, u.phone_number 
HAVING COUNT(DISTINCT t.sport_type) = (
    SELECT COUNT(DISTINCT sport_type) FROM tickets
);

-- 15. Today's purchases grouped and ordered by hour
SELECT EXTRACT(HOUR FROM p.paid_at) AS purchase_hour, 
       COUNT(p.payment_id) AS tickets_sold
FROM payments p 
WHERE p.status = 'successful' AND DATE(p.paid_at) = CURRENT_DATE 
GROUP BY EXTRACT(HOUR FROM p.paid_at)
ORDER BY purchase_hour ASC;

-- 16. Second most popular ticket overall (Handled with DENSE_RANK for ties)
WITH RankedTickets AS (
    SELECT t.home_team, t.away_team, 
           COUNT(r.reservation_id) AS sold_count,
           DENSE_RANK() OVER (
               ORDER BY COUNT(r.reservation_id) DESC
           ) AS rank
    FROM tickets t 
    JOIN reservations r ON t.ticket_id = r.ticket_id 
    WHERE r.status = 'paid' 
    GROUP BY t.ticket_id, t.home_team, t.away_team
)
SELECT home_team, away_team, sold_count 
FROM RankedTickets 
WHERE rank = 2;

-- 17. Support staff with highest number of cancellations and their percentage
SELECT 
    s.first_name, s.last_name, 
    COUNT(r.reservation_id) AS cancel_count, 
    ROUND(
        (COUNT(r.reservation_id) * 100.0 / NULLIF(
            (SELECT COUNT(*) FROM reservations 
             WHERE status = 'cancelled' 
               AND cancelled_by_support_id IS NOT NULL), 0
        )), 2
    ) AS cancel_percentage 
FROM users s 
JOIN reservations r ON s.user_id = r.cancelled_by_support_id 
WHERE r.status = 'cancelled' 
GROUP BY s.user_id, s.first_name, s.last_name 
ORDER BY cancel_count DESC 
LIMIT 1;

-- 18. Report categories and counts for the most reported ticket
SELECT (t.home_team || ' vs ' || t.away_team) AS ticket_name, 
       rep.category, COUNT(rep.report_id) AS category_count 
FROM reports rep
JOIN tickets t ON rep.ticket_id = t.ticket_id
WHERE t.ticket_id = (
    SELECT ticket_id 
    FROM reports 
    WHERE ticket_id IS NOT NULL 
    GROUP BY ticket_id 
    ORDER BY COUNT(report_id) DESC 
    LIMIT 1
) 
GROUP BY t.home_team, t.away_team, rep.category;

-- BONUS. Optimized upcoming match lookup leveraging B-Tree index
SELECT * FROM tickets 
WHERE sport_type = 'football' 
  AND city = 'Tehran' 
  AND match_date >= CURRENT_TIMESTAMP 
ORDER BY match_date ASC;

-- ---------------------------------------------------------------------------
-- PART 2: DESTRUCTIVE QUERIES (UPDATE / DELETE) - Executed at the very end
-- ---------------------------------------------------------------------------

-- 19. Change surname of user with highest manual cancellations to "Reddington"
UPDATE users 
SET last_name = 'Reddington'
WHERE user_id = (
    SELECT user_id 
    FROM reservations 
    WHERE status = 'cancelled' AND cancelled_by_support_id IS NULL
    GROUP BY user_id 
    ORDER BY COUNT(reservation_id) DESC 
    LIMIT 1
);

-- 20. Delete all cancelled reservations belonging to user "Reddington"
DELETE FROM payments 
WHERE reservation_id IN (
    SELECT r.reservation_id 
    FROM reservations r
    JOIN users u ON r.user_id = u.user_id
    WHERE r.status = 'cancelled' AND u.last_name ILIKE '%Reddington%'
);

DELETE FROM reservations 
WHERE status = 'cancelled' 
  AND user_id IN (
      SELECT user_id FROM users WHERE last_name ILIKE '%Reddington%'
  );

-- 21. Clear all remaining cancelled reservations in the system
DELETE FROM payments 
WHERE reservation_id IN (
    SELECT reservation_id FROM reservations WHERE status = 'cancelled'
);

DELETE FROM reservations WHERE status = 'cancelled';

-- 22. Discount ticket prices by 10% for Azadi stadium matches created yesterday
UPDATE tickets 
SET price = price * 0.90 
WHERE venue_name ILIKE '%Azadi%' 
  AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day';