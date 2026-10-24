import sqlite3
import os
from contextlib import contextmanager
from backend.app.config import DB_PATH

@contextmanager
def get_db_connection():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found at {DB_PATH}. Please run fetch_elexon_data.py first.")
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
