# AGS integrated into locked Prime UI

The source retains Prime navy-white-black public layout, CSS structure and pages. It adds AGS fleet models, Nellore/Ongole pickup, date-wise Supabase availability, WhatsApp first pending enquiries and separate /admin dashboard.

## Production prerequisites
1. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local or Vercel settings (public keys only).
2. Run the appropriate AGS Supabase SQL schema and then supabase-FINAL-MIGRATION.sql after reviewing/backup. Do not run the Prime car-based supabase.sql.
3. Create authorized admins in admin_users with matching auth.users IDs.
4. Deploy supabase/functions/booking-request/index.ts with JWT verification disabled only for this public endpoint, and set AGS_ALLOWED_ORIGINS to the actual public origin and AGS_RATE_LIMIT_SALT to a secure random value. Keep other table RLS.
5. Create the vehicle-photos storage bucket and policies via AGS migration, check photo upload.
6. Register actual physical bike counts for each model/branch. Without inventory, bookings cannot be verified.
7. Confirm the WhatsApp number in src/data.js is really the AGS number before launch.
8. Full end-to-end test: create enquiry, press Send, dashboard pending, confirm, booked ribbon with dates, overlaps, cancellation, return, password reset, uploads, mobile and Vercel refresh.

No customer enquiry should be advertised as booked until the owner confirms. A WhatsApp link opening does not prove the message was sent. Exact model photos are absent; the website displays a clear placeholder until admin uploads accurate photos.
