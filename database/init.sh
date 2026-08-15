#!/bin/sh
set -e

echo "===================================================="
echo "Starting Automated Database Initialization in Docker"
echo "===================================================="

# 1. Execute Schema (DDL)
echo "[1/5] Creating Tables and ENUM Types..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /scripts/schema.sql

# 2. Execute Seed Data (DML)
echo "[2/5] Inserting Seed Data..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /scripts/seed.sql

# 3. Create Indexes
echo "[3/5] Building B-Tree and GIN Trigram Indexes..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /scripts/indexes.sql

# 4. Compile Procedures & Functions
echo "[4/5] Compiling Stored Procedures & Functions..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /scripts/procedures.sql

# 5. Run Analytical Queries
echo "[5/5] Executing Analytical Queries..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /scripts/queries.sql

echo "===================================================="
echo "Database Initialization Completed Successfully!"
echo "===================================================="