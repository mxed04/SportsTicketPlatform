-- =============================================================================
-- Database Project: Schema Definition (DDL)
-- File: schema.sql
-- Database Engine: PostgreSQL
-- Description: Creates custom ENUM types, core tables, and relational constraints.
-- =============================================================================

-- Drop existing tables and custom types for a clean setup
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS basketball_details CASCADE;
DROP TABLE IF EXISTS volleyball_details CASCADE;
DROP TABLE IF EXISTS football_details CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS reservation_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS sport_type_enum CASCADE;

-- Define custom ENUM types
CREATE TYPE user_role AS ENUM ('audience', 'support', 'admin');
CREATE TYPE reservation_status AS ENUM ('pending', 'paid', 'cancelled');
CREATE TYPE payment_status AS ENUM ('successful', 'failed', 'pending');
CREATE TYPE sport_type_enum AS ENUM ('football', 'volleyball', 'basketball');

-- 1. Users Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'audience',
    city VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tickets Table
CREATE TABLE tickets (
    ticket_id SERIAL PRIMARY KEY,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    sport_type sport_type_enum NOT NULL,
    ticket_tier VARCHAR(50) NOT NULL,
    organizer VARCHAR(100) NOT NULL,
    venue_name VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL,
    match_date TIMESTAMP NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    remaining_capacity INT NOT NULL CHECK (remaining_capacity >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Football Specific Details (3NF)
CREATE TABLE football_details (
    ticket_id INT PRIMARY KEY REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    league_name VARCHAR(100) NOT NULL,
    stadium_name VARCHAR(100) NOT NULL,
    stand_section VARCHAR(50) NOT NULL,
    row_number INT NOT NULL,
    seat_number INT NOT NULL,
    ticket_type VARCHAR(50) NOT NULL,
    amenities TEXT
);

-- 4. Volleyball Specific Details (3NF)
CREATE TABLE volleyball_details (
    ticket_id INT PRIMARY KEY REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    league_name VARCHAR(100) NOT NULL,
    hall_name VARCHAR(100) NOT NULL,
    seat_section VARCHAR(50) NOT NULL,
    row_number INT NOT NULL,
    seat_number INT NOT NULL,
    ticket_tier VARCHAR(50) NOT NULL,
    amenities TEXT
);

-- 5. Basketball Specific Details (3NF)
CREATE TABLE basketball_details (
    ticket_id INT PRIMARY KEY REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    league_name VARCHAR(100) NOT NULL,
    hall_name VARCHAR(100) NOT NULL,
    seat_section VARCHAR(50) NOT NULL,
    row_number INT NOT NULL,
    seat_number INT NOT NULL,
    ticket_tier VARCHAR(50) NOT NULL,
    amenities TEXT
);

-- 6. Reservations Table
CREATE TABLE reservations (
    reservation_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ticket_id INT NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    status reservation_status DEFAULT 'pending',
    reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    cancelled_by_support_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT check_reservation_dates CHECK (reserved_at < expires_at)
);

-- 7. Financial Transactions & Payments Table
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    reservation_id INT UNIQUE NOT NULL REFERENCES reservations(reservation_id) ON DELETE RESTRICT,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    status payment_status DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'online_gateway',
    paid_at TIMESTAMP
);

-- 8. Support Reports Table
CREATE TABLE reports (
    report_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ticket_id INT REFERENCES tickets(ticket_id) ON DELETE SET NULL,
    reservation_id INT REFERENCES reservations(reservation_id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    report_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'under_review',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);