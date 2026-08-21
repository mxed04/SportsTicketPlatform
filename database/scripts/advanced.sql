-- ===========================================================================
-- Database Project: Advanced Features (Triggers & Materialized Views)
-- File: advanced.sql
-- Database Engine: PostgreSQL
-- Description: Audit logging triggers and performance materialized views.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. AUDIT LOGGING SYSTEM (TABLE & TRIGGER)
-- ---------------------------------------------------------------------------

-- Create table to store historical changes of reservations
CREATE TABLE IF NOT EXISTS reservation_audit_logs (
    log_id SERIAL PRIMARY KEY,
    reservation_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the trigger function to log status changes automatically
CREATE OR REPLACE FUNCTION log_reservation_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO reservation_audit_logs 
            (reservation_id, old_status, new_status, changed_at)
        VALUES 
            (NEW.reservation_id, OLD.status::VARCHAR, NEW.status::VARCHAR, 
             CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the reservations table
DROP TRIGGER IF EXISTS trg_reservation_status_change ON reservations;
CREATE TRIGGER trg_reservation_status_change
AFTER UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION log_reservation_status_change();

-- ---------------------------------------------------------------------------
-- 2. PERFORMANCE OPTIMIZATION (MATERIALIZED VIEW)
-- ---------------------------------------------------------------------------

-- Create a Materialized View for instant Admin Dashboard analytics
DROP MATERIALIZED VIEW IF EXISTS admin_dashboard_mview CASCADE;

CREATE MATERIALIZED VIEW admin_dashboard_mview AS
SELECT 
    (SELECT COALESCE(SUM(amount), 0) 
     FROM payments WHERE status = 'successful') AS total_revenue,
     
    (SELECT COUNT(*) 
     FROM reservations WHERE status = 'paid') AS total_tickets_sold,
     
    (SELECT COUNT(*) 
     FROM reservations WHERE status = 'cancelled') AS total_cancellations,
     
    (SELECT COUNT(*) 
     FROM reports WHERE status IN ('under_review', 'pending')) 
     AS pending_reports;

-- Create a unique index to allow CONCURRENTLY refreshing without locking
CREATE UNIQUE INDEX idx_admin_mview_revenue 
    ON admin_dashboard_mview(total_revenue);

-- Function to easily refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_admin_dashboard_mview()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY admin_dashboard_mview;
END;
$$ LANGUAGE plpgsql;