"""Fills the DEMO database with made-up data for screenshots (portfolio, README).

The demo app uses its own identifier (com.phu.daylight2.demo, see src-tauri/tauri.demo.conf.json),
so its data lives in %APPDATA%\\com.phu.daylight2.demo and the installed app is never touched.
Everything is dated relative to today, so the screenshots always look current.

    python demo/seed_demo.py          (close the demo app first; run it once beforehand so migrations exist)
"""
import os
import random
import sqlite3
import sys
from datetime import date, datetime, timedelta

DEMO_ID = "com.phu.daylight2.demo"
db_path = os.path.join(os.environ["APPDATA"], DEMO_ID, "my-dashboard.db")
if not os.path.exists(db_path):
    sys.exit(f"{db_path} does not exist yet - start the demo app once so it creates the database.")

random.seed(7)
today = date.today()


def d(offset: int) -> str:
    return (today + timedelta(days=offset)).isoformat()


def ts(offset_days: int, hour: int = 9, minute: int = 0) -> str:
    moment = datetime.combine(today + timedelta(days=offset_days), datetime.min.time()).replace(hour=hour, minute=minute)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.000Z")


con = sqlite3.connect(db_path)
con.execute("PRAGMA foreign_keys=ON")
versions = [row[0] for row in con.execute("select version from _sqlx_migrations")]
if max(versions, default=0) < 10:
    sys.exit(f"demo database has migrations {versions}; start the demo app once so it applies all 10.")

# Start from a clean slate (keeps the seeded categories / payment methods from the migrations).
for table in [
    "calendar_occurrence_states", "calendar_items", "workout_logs", "workout_exercises", "workouts",
    "expenses", "recurring_expenses", "notes", "habit_logs", "habits", "task_tags", "tags", "tasks",
    "projects", "focus_sessions", "weekly_reflections", "settings",
]:
    con.execute(f"DELETE FROM {table}")
con.execute("DELETE FROM sqlite_sequence WHERE name IN ('projects','tasks','tags','habits','habit_logs','notes','expenses','workouts','workout_exercises','workout_logs','calendar_items','recurring_expenses')")

# ---------------------------------------------------------------- projects & tasks
projects = {}
for name, color, desc in [
    ("Portfolio Website", "#6366f1", "Personal site and case studies"),
    ("University", "#14b8a6", "Courses, labs and group work"),
    ("Fitness", "#f59e0b", "Training goals for the semester"),
    ("Side Project", "#ec4899", "Weekend app ideas"),
]:
    projects[name] = con.execute("INSERT INTO projects (name, color, description, created_at) VALUES (?,?,?,?)", (name, color, desc, ts(-60))).lastrowid

# title, notes, status, priority, due offset, due time, project, completed offset, created offset, tags
tasks = [
    ("Finish case study for Daylight", "Screenshots, tech stack and what I learned", "doing", "high", 2, "18:00", "Portfolio Website", None, -9, ["design"]),
    ("Submit database systems assignment", "ER diagram + SQL queries, PDF format", "todo", "high", 0, "23:59", "University", None, -8, ["study", "urgent"]),
    ("Prepare slides for group presentation", "10 slides, 8 minutes", "todo", "medium", 5, "10:30", "University", None, -6, ["study"]),
    ("Fix dark mode contrast on landing page", "", "doing", "medium", 1, None, "Portfolio Website", None, -4, ["bug", "design"]),
    ("Book dentist appointment", "", "todo", "low", -2, None, None, None, -10, []),
    ("Read chapter 7 - operating systems", "Scheduling algorithms", "todo", "medium", 3, None, "University", None, -3, ["study"]),
    ("Plan 10k run route", "Around the lake, avoid the main road", "todo", "low", 9, None, "Fitness", None, -2, []),
    ("Sketch onboarding screens", "Three screens max", "todo", "medium", 14, None, "Side Project", None, -1, ["design"]),
    ("Renew student transit card", "", "todo", "low", 21, None, None, None, -5, []),
    ("Prepare for midterm exam", "Past papers 2022-2024", "todo", "high", 12, "09:00", "University", None, -14, ["study", "urgent"]),
    ("Set up project repository", "", "done", "medium", None, None, "Side Project", -1, -7, []),
    ("Write README for Daylight", "", "done", "medium", None, None, "Portfolio Website", -2, -6, []),
    ("Upload lab report 4", "", "done", "high", None, None, "University", -3, -8, ["study"]),
    ("Buy running shoes", "", "done", "low", None, None, "Fitness", -4, -9, []),
    ("Email professor about extension", "", "done", "medium", None, None, "University", 0, -2, []),
]
tag_ids = {name: con.execute("INSERT INTO tags (name) VALUES (?)", (name,)).lastrowid for name in ["design", "bug", "study", "urgent"]}
task_ids = {}
for title, notes, status, priority, due, due_time, project, completed, created, tags in tasks:
    tid = con.execute(
        "INSERT INTO tasks (title, notes, status, priority, due_date, due_time, project_id, completed_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (title, notes, status, priority, d(due) if due is not None else None, due_time, projects.get(project),
         ts(completed, 15) if completed is not None else None, ts(created), ts(completed if completed is not None else created)),
    ).lastrowid
    task_ids[title] = tid
    for tag in tags:
        con.execute("INSERT INTO task_tags (task_id, tag_id) VALUES (?,?)", (tid, tag_ids[tag]))

# ---------------------------------------------------------------- habits
habits = [
    ("Morning run", "daily", 1, "#f97316", 0.72),
    ("Read 20 minutes", "daily", 1, "#6366f1", 0.85),
    ("Drink 8 glasses of water", "daily", 8, "#06b6d4", 0.9),
    ("Meditate", "daily", 1, "#a855f7", 0.55),
    ("Gym session", "weekly", 3, "#22c55e", 0.75),
]
for order, (name, freq, target, color, rate) in enumerate(habits, start=1):
    hid = con.execute(
        "INSERT INTO habits (name, frequency, target_per_period, color, sort_order, created_at) VALUES (?,?,?,?,?,?)",
        (name, freq, target, color, order, ts(-75)),
    ).lastrowid
    for back in range(0, 70):
        day = today - timedelta(days=back)
        if freq == "daily":
            if back < 12 and rate > 0.8:
                hit = True  # a visible current streak on the best habits
            else:
                hit = random.random() < rate
            if hit:
                count = target if target == 1 else random.choice([target, target, target - 1, target - 2])
                con.execute("INSERT INTO habit_logs (habit_id, date, count) VALUES (?,?,?)", (hid, day.isoformat(), max(1, count)))
        elif day.weekday() in (0, 2, 4) and random.random() < rate + 0.1:
            con.execute("INSERT INTO habit_logs (habit_id, date, count) VALUES (?,?,?)", (hid, day.isoformat(), 1))

# ---------------------------------------------------------------- notes (post-its)
notes = [
    ("Ideas", "- [x] Dark mode\n- [x] Weekly review\n- [ ] Mobile version\n- [ ] CSV export", 0, "#fde68a", 40, 40, 1),
    ("Groceries", "- Eggs\n- Oat milk\n- Bananas\n- Rice\n- Green tea", 0, "#bbf7d0", 350, 60, 2),
    ("Study plan", "1. Databases - normal forms\n2. OS - scheduling\n3. Networks - TCP/IP\n4. Past papers", 1, "#bfdbfe", 660, 40, 3),
    ("Remember", "Library books due Friday.\nCall mom on Sunday evening.", 0, "#fbcfe8", 40, 330, 4),
    ("Portfolio to-do", "- [x] Case study draft\n- [ ] Add screenshots\n- [ ] Write summary\n- [ ] Deploy", 0, "#ddd6fe", 350, 350, 5),
    ("Quote", "\"Small steps every day.\"", 0, "#fed7aa", 660, 350, 6),
]
for title, content, pinned, color, x, y, z in notes:
    con.execute(
        "INSERT INTO notes (title, content, pinned, x, y, width, height, color, z_index, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (title, content, pinned, x, y, 280, 260, color, z, ts(-z), ts(-z)),
    )

# ---------------------------------------------------------------- expenses
cat = {name: cid for cid, name in con.execute("SELECT id, name FROM categories")}
pay = {name: pid for pid, name in con.execute("SELECT id, name FROM payment_methods")}
con.execute("UPDATE categories SET monthly_budget_satang = ? WHERE name = 'Food & Drinks'", (600000,))
con.execute("UPDATE categories SET monthly_budget_satang = ? WHERE name = 'Entertainment'", (150000,))
con.execute("UPDATE categories SET monthly_budget_satang = ? WHERE name = 'Shopping'", (200000,))
con.execute("INSERT INTO settings (key, value) VALUES ('monthly_budget_satang', ?)", (2500000,))

# Recurring bills. The "Gym membership" one is due but not generated yet, so the app creates it as pending.
due_day = max(1, today.day - 2)
recurring = [
    ("Netflix", 41900, "Subscriptions", "Credit card", 5, True),
    ("Spotify", 12900, "Subscriptions", "Credit card", 12, True),
    ("Phone plan", 59900, "Bills & Utilities", "PromptPay/QR", 20, True),
    ("Gym membership", 89000, "Other", "Debit card", due_day, False),
]
month_start = today.replace(day=1)
prev_month_end = month_start - timedelta(days=1)
for note, amount, category, method, day_of_month, generated in recurring:
    start = (month_start - timedelta(days=75)).replace(day=1)
    through = today if generated else prev_month_end
    rid = con.execute(
        "INSERT INTO recurring_expenses (amount_satang, category_id, payment_method_id, note, frequency, day_of_month, start_date, generated_through, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (amount, cat[category], pay[method], note, "monthly", day_of_month, start.isoformat(), through.isoformat(), ts(-80)),
    ).lastrowid
    cursor = start
    while cursor <= through:
        due = cursor.replace(day=min(day_of_month, 28))
        if start <= due <= through:
            con.execute(
                "INSERT INTO expenses (amount_satang, category_id, payment_method_id, note, date, status, recurring_id, created_at) VALUES (?,?,?,?,?,'confirmed',?,?)",
                (amount, cat[category], pay[method], note, due.isoformat(), rid, due.isoformat() + "T08:00:00.000Z"),
            )
        cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)

# Everyday spending for the last ~75 days.
everyday = [
    ("Food & Drinks", ["Pad kra pao", "Iced latte", "Lunch with friends", "Boba tea", "Mala hotpot", "Street noodles", "Breakfast sandwich", "Campus canteen"], (45, 320), 0.75, ["Cash", "PromptPay/QR", "e-Wallet"]),
    ("Transport", ["BTS ride", "Grab to campus", "MRT top-up", "Motorbike taxi"], (25, 180), 0.35, ["e-Wallet", "Cash"]),
    ("Education", ["Textbook", "Printing lab report", "Online course", "Stationery"], (60, 950), 0.06, ["Debit card", "PromptPay/QR"]),
    ("Shopping", ["T-shirt", "Phone case", "Headphones", "Backpack", "Sneakers"], (199, 1890), 0.07, ["Credit card", "Debit card"]),
    ("Entertainment", ["Movie night", "Concert ticket", "Board game cafe", "Steam game"], (150, 900), 0.08, ["Credit card", "PromptPay/QR"]),
    ("Bills & Utilities", ["Electricity", "Water bill", "Dorm internet"], (180, 1200), 0.03, ["PromptPay/QR"]),
]
for back in range(0, 75):
    day = today - timedelta(days=back)
    for category, notes_, (low, high), chance, methods in everyday:
        times = 2 if category == "Food & Drinks" and random.random() < 0.55 else 1
        for _ in range(times):
            if random.random() < chance:
                amount = round(random.uniform(low, high) / 5) * 5 * 100
                con.execute(
                    "INSERT INTO expenses (amount_satang, category_id, payment_method_id, note, date, status, created_at) VALUES (?,?,?,?,?,'confirmed',?)",
                    (amount, cat[category], pay[random.choice(methods)], random.choice(notes_), day.isoformat(), day.isoformat() + "T12:00:00.000Z"),
                )

# ---------------------------------------------------------------- training (weekday 0 = Sunday)
workouts = [
    ("Push day", 1, "18:00", 60, "strength", [("Bench press", 4, "8", 60), ("Overhead press", 3, "10", 35), ("Incline dumbbell", 3, "10", 22), ("Triceps dips", 3, "12", None)]),
    ("Pull day", 3, "18:00", 60, "strength", [("Deadlift", 4, "5", 90), ("Lat pulldown", 3, "10", 50), ("Barbell row", 3, "8", 55), ("Biceps curl", 3, "12", 14)]),
    ("Leg day", 5, "17:30", 70, "strength", [("Squat", 4, "6", 80), ("Romanian deadlift", 3, "8", 70), ("Lunges", 3, "12", 16), ("Calf raises", 4, "15", None)]),
    ("Long run", 6, "07:00", 50, "cardio", [("Easy pace run", 1, "8 km", None)]),
    ("Yoga & stretching", 0, "09:00", 30, "mobility", [("Sun salutations", 3, "5", None), ("Hip openers", 2, "60s", None)]),
]
workout_ids = []
for title, dow, start, minutes, category, exercises in workouts:
    wid = con.execute(
        "INSERT INTO workouts (title, day_of_week, start_time, duration_minutes, category, created_at) VALUES (?,?,?,?,?,?)",
        (title, dow, start, minutes, category, ts(-70)),
    ).lastrowid
    workout_ids.append((wid, dow))
    for position, (name, sets, reps, weight) in enumerate(exercises):
        con.execute("INSERT INTO workout_exercises (workout_id, name, sets, reps, weight, position) VALUES (?,?,?,?,?,?)", (wid, name, sets, reps, weight, position))

this_sunday = today - timedelta(days=(today.weekday() + 1) % 7)
for weeks_back in range(0, 8):
    week_start = this_sunday - timedelta(weeks=weeks_back)
    for wid, dow in workout_ids:
        done = week_start + timedelta(days=dow)
        if done <= today and (weeks_back == 0 or random.random() < 0.8):
            con.execute("INSERT INTO workout_logs (workout_id, week_start, done_date) VALUES (?,?,?)", (wid, week_start.isoformat(), done.isoformat()))

# ---------------------------------------------------------------- calendar (weekday 0 = Sunday)
items = [
    ("event", "Database Systems lecture", "Room 4-301", d(-60), "09:00", "10:30", "#3b82f6", "weekly", "1,3", None),
    ("event", "Operating Systems lab", "", d(-60), "13:00", "15:00", "#14b8a6", "weekly", "2", None),
    ("event", "Group project meeting", "Library, 2nd floor", d(1), "16:00", "17:30", "#a855f7", "none", "", None),
    ("event", "Dinner with family", "", d(3), "19:00", "21:00", "#f59e0b", "none", "", None),
    ("event", "Hackathon", "Whole day", d(6), None, None, "#ec4899", "none", "", None),
    ("reminder", "Pay rent", "", d(-90), "09:00", None, "#ef4444", "monthly", "", None),
    ("reminder", "Weekly review", "Check tasks, habits and spending", d(-60), "20:00", None, "#6366f1", "weekly", "0", None),
    ("reminder", "Mom's birthday", "", date(today.year, 11, 14).isoformat(), None, None, "#f43f5e", "yearly", "", None),
]
for kind, title, notes_, start, st, et, color, rule, weekdays, until in items:
    con.execute(
        "INSERT INTO calendar_items (kind, title, notes, start_date, start_time, end_time, color, repeat_rule, repeat_weekdays, repeat_until, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (kind, title, notes_, start, st, et, color, rule, weekdays, until, ts(-60)),
    )

# ---------------------------------------------------------------- settings: countdown on the Home page
countdown = ["Submit database systems assignment", "Prepare for midterm exam", "Finish case study for Daylight"]
con.execute("INSERT INTO settings (key, value) VALUES ('countdown_task_ids', ?)", (",".join(str(task_ids[t]) for t in countdown),))

con.commit()
for table in ["tasks", "habits", "habit_logs", "notes", "expenses", "workouts", "calendar_items"]:
    print(f"{table:15}", con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
print("integrity:", con.execute("PRAGMA integrity_check").fetchone()[0], "| fk:", con.execute("PRAGMA foreign_key_check").fetchall())
con.close()
print("demo data written to", db_path)
