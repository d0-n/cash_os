import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cashos.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT NOT NULL UNIQUE,
            password_hash   TEXT NOT NULL,
            created_at      TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS envelopes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            name        TEXT NOT NULL,
            balance     REAL DEFAULT 0,
            goal        REAL,
            goal_date   TEXT,
            color       TEXT DEFAULT '#2c6fce',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        );

        CREATE TABLE IF NOT EXISTS rules (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            label       TEXT NOT NULL,
            envelope_id INTEGER NOT NULL,
            type        TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
            value       REAL NOT NULL,
            priority    INTEGER DEFAULT 0,
            active      INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            amount      REAL NOT NULL,
            label       TEXT NOT NULL,
            note        TEXT,
            created_at  TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS allocations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id  INTEGER NOT NULL,
            envelope_id     INTEGER NOT NULL,
            amount          REAL NOT NULL,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
            FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS goals (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            title           TEXT DEFAULT 'Savings Target',
            target_amount   REAL DEFAULT 1000000,
            target_date     TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()


def create_user(username, password_hash):
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        uid = cursor.lastrowid
        conn.commit()
        return uid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def get_user_by_username(username):
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id):
    conn = get_connection()
    row = conn.execute("SELECT id, username, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def seed_defaults(user_id):
    conn = get_connection()
    count = conn.execute("SELECT COUNT(*) FROM envelopes WHERE user_id = ?", (user_id,)).fetchone()[0]
    if count == 0:
        defaults = [
            (user_id, "Emergency",   0, 100000, None, "#0f8a3f"),
            (user_id, "Transport",   0, 30000,  None, "#2c6fce"),
            (user_id, "Phone",       0, 50000,  None, "#7c3aed"),
            (user_id, "Investments", 0, None,   None, "#0891b2"),
            (user_id, "General",     0, None,   None, "#64748b"),
        ]
        conn.executemany(
            "INSERT INTO envelopes (user_id, name, balance, goal, goal_date, color) VALUES (?, ?, ?, ?, ?, ?)",
            defaults,
        )
    
    goal_exists = conn.execute("SELECT COUNT(*) FROM goals WHERE user_id = ?", (user_id,)).fetchone()[0]
    if goal_exists == 0:
        conn.execute(
            "INSERT INTO goals (user_id, title, target_amount) VALUES (?, ?, ?)",
            (user_id, "Savings Target", 1000000),
        )
    conn.commit()
    conn.close()


# Envelope Operations

def get_envelopes(user_id):
    conn = get_connection()
    rows = conn.execute("SELECT * FROM envelopes WHERE user_id = ? ORDER BY id", (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_envelope(user_id, name, goal=None, goal_date=None, color="#2c6fce"):
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO envelopes (user_id, name, goal, goal_date, color) VALUES (?, ?, ?, ?, ?)",
            (user_id, name, goal, goal_date, color),
        )
        eid = cursor.lastrowid
        conn.commit()
        return eid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def update_envelope(user_id, envelope_id, name=None, goal=None, goal_date=None, color=None):
    conn = get_connection()
    row = conn.execute("SELECT * FROM envelopes WHERE id = ? AND user_id = ?", (envelope_id, user_id)).fetchone()
    if not row:
        conn.close()
        return False

    conn.execute(
        "UPDATE envelopes SET name=?, goal=?, goal_date=?, color=? WHERE id=? AND user_id=?",
        (
            name if name is not None else row["name"],
            goal if goal is not None else row["goal"],
            goal_date if goal_date is not None else row["goal_date"],
            color if color is not None else row["color"],
            envelope_id,
            user_id,
        ),
    )
    conn.commit()
    conn.close()
    return True


def delete_envelope(user_id, envelope_id):
    conn = get_connection()
    row = conn.execute("SELECT name FROM envelopes WHERE id = ? AND user_id = ?", (envelope_id, user_id)).fetchone()
    if not row or row["name"] == "General":
        conn.close()
        return False

    conn.execute("DELETE FROM envelopes WHERE id = ? AND user_id = ?", (envelope_id, user_id))
    conn.commit()
    conn.close()
    return True


# Rule Operations

def get_rules(user_id):
    conn = get_connection()
    rows = conn.execute("""
        SELECT r.*, e.name AS envelope_name
        FROM rules r
        JOIN envelopes e ON r.envelope_id = e.id
        WHERE r.user_id = ?
        ORDER BY r.label, r.priority
    """, (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_rule(user_id, label, envelope_id, rule_type, value, priority=0):
    conn = get_connection()
    env = conn.execute("SELECT id FROM envelopes WHERE id = ? AND user_id = ?", (envelope_id, user_id)).fetchone()
    if not env:
        conn.close()
        return None

    cursor = conn.execute(
        "INSERT INTO rules (user_id, label, envelope_id, type, value, priority) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, label, envelope_id, rule_type, value, priority),
    )
    rid = cursor.lastrowid
    conn.commit()
    conn.close()
    return rid


def delete_rule(user_id, rule_id):
    conn = get_connection()
    conn.execute("DELETE FROM rules WHERE id = ? AND user_id = ?", (rule_id, user_id))
    conn.commit()
    conn.close()


# Transaction Operations

def get_transactions(user_id, label=None, sort_by="created_at", sort_order="desc", search=None):
    conn = get_connection()

    query = """
        SELECT t.*,
               GROUP_CONCAT(e.name || ':' || a.amount, '|') AS breakdown
        FROM transactions t
        LEFT JOIN allocations a ON t.id = a.transaction_id
        LEFT JOIN envelopes e ON a.envelope_id = e.id
        WHERE t.user_id = ?
    """
    params = [user_id]

    if label and label != "all":
        query += " AND t.label = ?"
        params.append(label)

    if search:
        query += " AND (t.note LIKE ? OR t.label LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " GROUP BY t.id"

    allowed = {"created_at": "t.created_at", "amount": "t.amount", "label": "t.label"}
    col = allowed.get(sort_by, "t.created_at")
    direction = "DESC" if sort_order.lower() == "desc" else "ASC"
    query += f" ORDER BY {col} {direction}"

    rows = conn.execute(query, params).fetchall()
    conn.close()

    results = []
    for row in rows:
        tx = dict(row)
        if tx["breakdown"]:
            parts = tx["breakdown"].split("|")
            tx["breakdown"] = []
            for part in parts:
                name, amt = part.rsplit(":", 1)
                tx["breakdown"].append({"envelope": name, "amount": float(amt)})
        else:
            tx["breakdown"] = []
        results.append(tx)

    return results


def create_transaction(user_id, amount, label, note=None):
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO transactions (user_id, amount, label, note) VALUES (?, ?, ?, ?)",
        (user_id, amount, label, note),
    )
    tid = cursor.lastrowid
    conn.commit()
    conn.close()
    return tid


def create_allocation(transaction_id, envelope_id, amount):
    conn = get_connection()
    conn.execute(
        "INSERT INTO allocations (transaction_id, envelope_id, amount) VALUES (?, ?, ?)",
        (transaction_id, envelope_id, amount),
    )
    conn.execute("UPDATE envelopes SET balance = balance + ? WHERE id = ?", (amount, envelope_id))
    conn.commit()
    conn.close()

def transfer_between_envelopes(user_id, from_id, to_id, amount, note="Transfer"):
    conn = get_connection()
    try:
        conn.execute("BEGIN TRANSACTION")
        # Check from envelope balance
        env = conn.execute("SELECT balance, name FROM envelopes WHERE id = ? AND user_id = ?", (from_id, user_id)).fetchone()
        if not env or env["balance"] < amount:
            conn.execute("ROLLBACK")
            return False, "Insufficient balance"
            
        # Deduct
        conn.execute("UPDATE envelopes SET balance = balance - ? WHERE id = ?", (amount, from_id))
        # Add
        conn.execute("UPDATE envelopes SET balance = balance + ? WHERE id = ?", (amount, to_id))
        
        # Log as a zero-net transaction so it appears in history breakdown
        cursor = conn.execute(
            "INSERT INTO transactions (user_id, amount, label, note) VALUES (?, 0, 'transfer', ?)",
            (user_id, note)
        )
        tid = cursor.lastrowid
        
        conn.execute("INSERT INTO allocations (transaction_id, envelope_id, amount) VALUES (?, ?, ?)", (tid, from_id, -amount))
        conn.execute("INSERT INTO allocations (transaction_id, envelope_id, amount) VALUES (?, ?, ?)", (tid, to_id, amount))
        
        conn.commit()
        return True, ""
    except Exception as e:
        conn.execute("ROLLBACK")
        return False, str(e)
    finally:
        conn.close()

def withdraw_from_envelope(user_id, envelope_id, amount, note=None):
    conn = get_connection()
    env = conn.execute("SELECT * FROM envelopes WHERE id = ? AND user_id = ?", (envelope_id, user_id)).fetchone()
    if not env:
        conn.close()
        return False, "Envelope not found."

    if env["balance"] < amount:
        conn.close()
        return False, f"Insufficient balance in '{env['name']}' ({env['balance']:,} RWF available)."

    conn.execute("UPDATE envelopes SET balance = balance - ? WHERE id = ?", (amount, envelope_id))
    cursor = conn.execute(
        "INSERT INTO transactions (user_id, amount, label, note) VALUES (?, ?, ?, ?)",
        (user_id, -amount, "withdrawal", note or f"Withdrawal from {env['name']}"),
    )
    tid = cursor.lastrowid
    conn.execute(
        "INSERT INTO allocations (transaction_id, envelope_id, amount) VALUES (?, ?, ?)",
        (tid, envelope_id, -amount),
    )
    conn.commit()
    conn.close()
    return True, "Withdrawal successful."


# Goal Operations

def get_user_goals(user_id):
    conn = get_connection()
    rows = conn.execute("SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC", (user_id,)).fetchall()
    if not rows:
        conn.execute(
            "INSERT INTO goals (user_id, title, target_amount) VALUES (?, ?, ?)",
            (user_id, "Main Savings Target", 1000000),
        )
        conn.commit()
        rows = conn.execute("SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC", (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_user_goal(user_id):
    goals = get_user_goals(user_id)
    return goals[0] if goals else {"title": "Savings Target", "target_amount": 1000000, "target_date": None}


def create_goal(user_id, title, target_amount, target_date=None):
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO goals (user_id, title, target_amount, target_date) VALUES (?, ?, ?, ?)",
        (user_id, title, target_amount, target_date),
    )
    gid = cursor.lastrowid
    conn.commit()
    conn.close()
    return gid


def update_user_goal(user_id, target_amount, title="Savings Target", target_date=None):
    conn = get_connection()
    row = conn.execute("SELECT id FROM goals WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,)).fetchone()
    if row:
        conn.execute(
            "UPDATE goals SET title = ?, target_amount = ?, target_date = ? WHERE id = ? AND user_id = ?",
            (title, target_amount, target_date, row["id"], user_id),
        )
    else:
        conn.execute(
            "INSERT INTO goals (user_id, title, target_amount, target_date) VALUES (?, ?, ?, ?)",
            (user_id, title, target_amount, target_date),
        )
    conn.commit()
    conn.close()
    return True


def update_goal(user_id, goal_id, title, target_amount, target_date=None):
    conn = get_connection()
    conn.execute(
        "UPDATE goals SET title = ?, target_amount = ?, target_date = ? WHERE id = ? AND user_id = ?",
        (title, target_amount, target_date, goal_id, user_id),
    )
    conn.commit()
    conn.close()
    return True



def delete_goal(user_id, goal_id):
    conn = get_connection()
    conn.execute("DELETE FROM goals WHERE id = ? AND user_id = ?", (goal_id, user_id))
    conn.commit()
    conn.close()
    return True


def get_goal_progress(user_id):
    conn = get_connection()

    total = conn.execute(
        "SELECT COALESCE(SUM(balance), 0) AS total FROM envelopes WHERE user_id = ?",
        (user_id,),
    ).fetchone()["total"]

    goals_list = get_user_goals(user_id)
    goal_info = goals_list[0] if goals_list else {"target_amount": 1000000, "title": "Main Target", "target_date": None}

    history_rows = conn.execute("""
        SELECT DATE(created_at) AS date, SUM(amount) AS daily_total
        FROM transactions
        WHERE user_id = ?
        GROUP BY DATE(created_at)
        ORDER BY date
    """, (user_id,)).fetchall()

    conn.close()

    cumulative = []
    running = 0
    for h in history_rows:
        running += h["daily_total"]
        cumulative.append({"date": h["date"], "balance": running})

    return {
        "total": total,
        "target": goal_info["target_amount"],
        "title": goal_info["title"],
        "target_date": goal_info["target_date"],
        "goals": goals_list,
        "history": cumulative,
    }
