import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "elexon_wind_jan2026.db")

# UK Day-Ahead Market default parameters
DEFAULT_GATE_CLOSURE_HOUR = 11  # 11:00 UTC on D-1 (EPEX SPOT GB Day-Ahead gate closure)
TARGET_MONTH = "2026-01"
