# LMS SLA Issue Tracker

A premium, high-performance operational management dashboard for tracking system availability, response windows, and resolution metrics under SLA (Service Level Agreement) terms.

---

## 🚀 Key Features

- **Local-First Sync**: Operates offline using browser LocalStorage for instant loads, with background sync to Supabase Cloud Database.
- **Automatic SMTP Email Alerts**: Automatically triggers background email notifications on ticket updates/creation using SmtpJS and a private Google App Password configured via Settings (falls back to local `mailto:` if credentials are not configured).
- **Server Tasks Tracker**: Dedicated view for Devendra Soni to log/validate infrastructure tasks. Stores task data dynamically inside the unified `dev_tasks` table under the `"Server Side"` category to minimize database complexity.
- **Dynamic Users & Escalations**: Contacts, roles, emails, and phone numbers are loaded dynamically from the Supabase `users` database table. Any update in the database instantly updates assignees and support pages!
- **SLA Countdown Trackers**: Real-time business-hour countdown timers for Critical (P1), Medium (P2), and Low (P3) support windows.
- **Excel Report Generator**: One-click multi-sheet report downloads containing issues, uptime statistics, and penalty breakdowns powered by SheetJS.

---

## 🛠️ Database Setup (Supabase)

To enable cloud synchronization, run these SQL scripts inside your **Supabase SQL Editor**:

### 1. Create `users` Table
```sql
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    level INT,
    designation TEXT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    team TEXT
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous all" ON public.users FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- Seed default team contacts
INSERT INTO public.users (id, level, designation, name, email, phone, team) VALUES
(1, 1, 'Helpdesk / Resident Engineer', 'Arif', 'arifansari@reospark.com', '9871264243', 'support'),
(2, 1, 'Helpdesk / Resident Engineer', 'Harvinder', 'harvinder.anan@gmail.com', '9801298785', 'support'),
(3, 2, 'Specialist Engineer', 'Pradeep', 'pradeep@reospark.com', '9386292565', 'support'),
(4, 3, 'LMS Administration', 'Krishankant Yadav', 'krishankant.yadav@literacyindia.org', '8743080876', 'client'),
(5, 4, 'Project Manager', 'OP Meenu', 'opmeenu@gmail.com', '9999644218', 'management'),
(6, 4, 'Project Manager', 'Priyesh Tiwari', 'priyesh.cbtech@gmail.com', '7217766185', 'management'),
(7, 5, 'Project Director', 'Sunil Kumar Singh', 'sunilkumarsingh@literacyindia.org', '9811820027', 'client'),
(8, NULL, 'Server / Infrastructure Engineer', 'Devendra Kumar Soni', 'devsoni@hotmail.com', '', 'server')
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', COALESCE((SELECT MAX(id)+1 FROM public.users), 1), false);
```

### 2. Create `dev_tasks` Table
```sql
CREATE TABLE IF NOT EXISTS public.dev_tasks (
    id TEXT PRIMARY KEY,
    work_type TEXT,
    title TEXT,
    description TEXT,
    phase INT DEFAULT 1,
    stage INT DEFAULT 1,
    start_date DATE,
    end_date DATE,
    implementation_date DATE,
    testing_status TEXT DEFAULT 'Pending',
    assigned_to TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.dev_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous all" ON public.dev_tasks FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.dev_tasks;
```

---

## ⚙️ Configuration & Deployment

1. Set your Supabase URL and Key in `js/config.js`.
2. Configure your sender email details (username and app password) inside the web application's **Settings Panel** (saved securely in your settings table on Supabase).
3. Pushing the project to the `main` branch on GitHub automatically deploys it via GitHub Pages if enabled.
