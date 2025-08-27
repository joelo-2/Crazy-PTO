# PTO Portal — Lite (Minimal)
Single-page Next.js app with built-in dashboard, request form, and admin screens. Optional ICS route for calendars.

## Deploy
1) Create Supabase project. In Vercel env vars set:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - (optional) NEXT_PUBLIC_APP_NAME
2) In Supabase → SQL Editor, paste `supabase/schema.sql` and run.
3) Deploy on Vercel. Subscribe to calendars:
   - /api/ics/CompanyA, /api/ics/CompanyB, /api/ics/CompanyC
