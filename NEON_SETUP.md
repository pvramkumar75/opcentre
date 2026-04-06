# Neon + Supabase Setup Guide

## What was done:
✅ Created PostgreSQL tables in Neon database
✅ Populated default machine, routing, and work order data

## Next Steps:

### 1. Create Supabase Project with Neon Backend

1. Go to **[supabase.com](https://supabase.com)** and sign up/login
2. Click **"New Project"**
3. Choose **"Connect external database"** option
4. Fill in the connection details from your Neon database:
   - **Host**: `ep-purple-feather-a1xwczh8-pooler.ap-southeast-1.aws.neon.tech`
   - **Database**: `neondb`
   - **User**: `neondb_owner`
   - **Password**: `npg_GL0VvYlcCH3i`
   - **Port**: `5432`

5. Click **"Create Project"** and wait for initialization

### 2. Get Your Supabase Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (starts with `https://...`)
   - **Anon Public Key** (under "Project API keys")

### 3. Update .env File

Replace in `.env`:
```
VITE_SUPABASE_URL=<paste-your-project-url>
VITE_SUPABASE_ANON_KEY=<paste-your-anon-key>
```

Example:
```
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Restart the App

```bash
npm run dev
```

Your app will now sync with the Neon database via Supabase!

## Important Security Notes:
- Never commit `.env` to Git
- The connection string is already in `.env` - add this to `.gitignore` if not present
- Supabase anon key can be shared (it's public), but keep the database password private
