import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from app.config import settings

# Creating a Connection Pool for Database Connection Management Without an ORM
try:
    db_pool = psycopg2.pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=20,
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
    )
    print("✅ PostgreSQL Connection Pool created successfully (No ORM).")
except Exception as e:
    print(f"❌ Error connecting to PostgreSQL: {e}")
    db_pool = None


@contextmanager
def get_db_cursor():
    """
    Context Manager for retrieving a database cursor.
    After the operation is complete, changes are committed.
    The connection is then returned to the pool.
    """
    if db_pool is None:
        raise Exception("Database connection pool is not initialized.")

    conn = db_pool.getconn()
    try:
        # RealDictCursor causes the output to be in dict format
        # with column names.
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        db_pool.putconn(conn)
