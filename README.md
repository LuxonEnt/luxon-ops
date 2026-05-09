# Luxon Ops App

A starter Progressive Web App for managing contractors, events, schedules, time tracking, payroll approvals, and invoice drafts.

## What this includes

- Admin dashboard
- Contractor mobile portal
- Event and assignment model
- Clock-in / clock-out logic
- Pay calculation for hourly and day-rate contractors
- Invoice draft generator
- Supabase database schema
- PWA manifest for Add to Home Screen

## Recommended stack

- Next.js
- Supabase
- Vercel
- Tailwind CSS

## Setup

1. Install Node.js.
2. Create a Supabase project.
3. Run the SQL in `supabase/schema.sql` inside Supabase SQL Editor.
4. Copy `.env.example` to `.env.local`.
5. Add your Supabase URL and anon key.
6. Run:

```bash
npm install
npm run dev
```

## Deploy

Deploy to Vercel and connect the environment variables.

## Phone app setup

Once deployed, contractors open the URL on their phone and choose:

- iPhone: Share > Add to Home Screen
- Android: Chrome menu > Add to Home Screen

## Important next steps before real production use

- Add Supabase Row Level Security policies specific to your company
- Add GPS verification for clock-in/out
- Add SMS/email notifications through Twilio or SendGrid
- Add QuickBooks integration
- Add PDF invoice generation
- Add contractor agreement and W9 upload
