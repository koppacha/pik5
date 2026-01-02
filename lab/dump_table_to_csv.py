import os
import csv
from pathlib import Path
import pymysql


def load_dotenv(path: str = ".env") -> None:
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        # 既に環境変数にある場合は上書きしない（CIやシェル優先）
        os.environ.setdefault(k, v)


load_dotenv()

DB_HOST = "127.0.0.1"
DB_PORT = 3307
DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = os.environ["DB_NAME"]
TABLE = "totals"
OUT = f"{DB_NAME}.{TABLE}.csv"

conn = pymysql.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASS,
    database=DB_NAME,
    charset="utf8mb4",
    cursorclass=pymysql.cursors.SSCursor,  # サーバーサイドカーソル（大量データ向け）
)

with conn.cursor() as cur:
    cur.execute(f"SELECT * FROM `{TABLE}`")

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        # ヘッダ
        w.writerow([col[0] for col in cur.description])

        for row in cur:
            w.writerow(row)

conn.close()
print("written:", OUT)