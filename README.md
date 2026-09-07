# WRAPSTORE POS — Stage 1

## Store Front Management System — Admin Panel

Built with React + Vite + Supabase + PostgreSQL.

---

## Quick Start

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** from Settings → API

### 2. Run Database Schema
1. Go to **Supabase Dashboard → SQL Editor**
2. Open `database/schema.sql` from this repo
3. Run the entire file (it creates all tables, triggers, RLS policies, and seed data)

### 3. Create Supabase Storage Bucket
1. Go to **Supabase Dashboard → Storage**
2. Create a new bucket named: `product-images`
3. Set it to **Public**

### 4. Create Admin Users
1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **Add User** and create your first admin
3. To make someone a **Super Admin**, run this SQL:
```sql
UPDATE profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';
```

### 5. Configure Environment
```bash
cp .env.example .env
```
Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 6. Install & Run
```bash
npm install
npm run dev
```

App will be available at `http://localhost:5173`

---

## Stage 1 Features

| Module | Features |
|---|---|
| 🔐 Authentication | Login/Logout, session persistence, protected routes, role-based access |
| 📁 Categories | Add/Edit/Delete categories and subcategories, expandable tree view |
| 📦 Products | Add/Edit products, auto ID (WS-000001), 3 product types, image upload |
| ✅ Approval | PENDING → APPROVED/REJECTED flow, rejection reasons, resubmission |
| 📊 Inventory | Stock management, 5 movement types, full audit trail, search/filter |
| 📈 Dashboard | Real-time stats, product breakdown chart, recent activity |
| ⚙️ Settings | Store info, GSTIN, logo upload, invoice settings |

---

## Product Types (WrapStore Specific)

1. **iPhone Cases** — Requires iPhone model selection
2. **Samsung Premium Cases** — Requires Samsung model selection
3. **Mobile Stickers** — Universal or model-specific

---

## User Roles

| Role | Permissions |
|---|---|
| `store_manager` | Add/Edit products, manage inventory, view dashboard |
| `super_admin` | All of the above + Approve/Reject products, manage settings |

---

## Stage 2 Preview (Billing)
When building Stage 2, simply uncomment the Stage 2 tables at the bottom of `database/schema.sql`.
No Stage 1 tables need to be rebuilt or modified.

---

## Store Information (Default)
- **Name:** WRAPSTORE
- **Address:** Railway Station Rd, Dharmapuri, Tamil Nadu, India - 636701
- **Phone:** +91 81227 47947

All settings are editable from the Settings page.
