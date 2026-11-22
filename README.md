# AGS Self Drive Wheels — Prime locked UI + AGS functionality

This is **Prime-Bike-Rentals-Navy-White-Black(1).zip** with the public page templates and base CSS retained. The AGS integrations modify the booking/search components where necessary, and add a separate protected /admin portal.

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
npm run build
```

Fill `.env.local` with the Supabase **project URL** and **public publishable/anon key**. Never place a secret/service-role key in VITE_ variables. The current installation will not accept booking enquiries until a compatible live Supabase project, deployed Edge Function and actual physical vehicle inventory are present.

## Files

- `src/main.jsx`: Prime page layouts with AGS content, availability, location/time booking controls
- `src/style.css`: original Prime navy/white/black CSS, appended styling only for AGS functional elements and owner portal
- `src/data.js`: AGS 17 model names and pricing, WhatsApp configuration
- `src/cloud.js`: Supabase CRUD, booking, RLS-backed admin functionality and public availability
- `src/CloudAdmin.jsx`: standalone owner portal, login, password management, inventory quantities, bookings, pricing & photo upload
- `supabase.sql`: AGS database schema (NOT Prime's older car schema)
- `supabase-FINAL-MIGRATION.sql`: additional functions/storage support; review and back up database before running
- `supabase/functions/booking-request/index.ts`: deployment-only public Edge Function

## Known pre-launch requirements

1. Verify business WhatsApp number and exact Google Maps branch coordinates/links (current map is area-level, not store-level).
2. Populate actual physical inventory by model/location in owner dashboard.
3. Owner-upload authentic vehicle photos to Supabase storage, or mark generated photos as illustrative. This source intentionally uses placeholders instead of inventing photos.
4. Configure Supabase database/RLS, owner Auth and admin_users; apply database migration; configure photo storage bucket and storage policies.
5. Deploy `booking-request` Edge Function with correct CORS origin, rate-limit secret, and appropriate public JWT setting.
6. Add Supabase password recovery allowed redirect URLs, including deployed `/reset-password`.
7. Test new booking, WhatsApp send, pending dashboard entry, confirm, per-unit overlap, BOOKED ribbon, cancellation, late return, date expiry, location filtering, price change, photo upload and mobile layout.
8. Validate `npm run build` and Vercel preview on your machine. Build verification here could not run because npm dependencies were unavailable offline.

**Important:** Opening a WhatsApp chat does not send a message. The live booking Edge Function must successfully create a pending request before WhatsApp opens. No bike is reserved until owner confirmation. A confirmed time interval blocks only a specific physical unit; the model is fully BOOKED only when no units remain for the selected dates.
