import sqlite3

conn = sqlite3.connect("tincture.db")
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]
print("Tables:", tables)

c.execute("SELECT id, full_name, email FROM users")
users = c.fetchall()
print(f"\nUsers ({len(users)}):")
for u in users:
    print(f"  id={u[0]}, name={u[1]}, email={u[2]}")

c.execute("SELECT id, user_id, title, created_at FROM summaries ORDER BY created_at DESC")
summaries = c.fetchall()
print(f"\nSummaries ({len(summaries)}):")
for s in summaries:
    print(f"  id={s[0]}, user_id={s[1]}, title={s[2][:50] if s[2] else 'N/A'}, created={s[3]}")

try:
    c.execute("SELECT id, summary_id, user_id FROM chats")
    chats = c.fetchall()
    print(f"\nChats ({len(chats)}):")
    for ch in chats:
        print(f"  id={ch[0]}, summary_id={ch[1]}, user_id={ch[2]}")
except Exception:
    print("\nChats table: not found or empty")

conn.close()
