# MyDrivez: premium self-drive car rentals

A full-stack, production-oriented car rental platform with three parts: a public site, a customer dashboard and an admin console. It's built with Next.js 15, TypeScript, Tailwind CSS, Prisma and PostgreSQL.

> **Status: client demo.** Payments run in a clearly labelled **demo sandbox** until you add Razorpay keys. All seeded data is flagged `isDemo` and marked with a **DEMO** badge in the admin console. Read [What's real vs. demo](#whats-real-vs-demo) before showing it to anyone.

---

## Contents
1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Quick start (local)](#quick-start-local)
4. [Demo logins](#demo-logins)
5. [Deploy to Vercel](#deploy-to-vercel)
6. [Environment variables](#environment-variables)
7. [Database](#database)
8. [What's real vs. demo](#whats-real-vs-demo)
9. [Project structure](#project-structure)
10. [Security](#security)
11. [Testing](#testing)
12. [Extending](#extending)

---

## Features

**Public site**
- Cinematic homepage: hero search widget, trust indicators, featured cars, categories, how-it-works, why-us, live offers, testimonials from real (seeded) reviews, FAQ, newsletter
- Car search with city, date-aware **live availability**, price, type, brand, fuel, transmission, seats and rating filters, plus 5 sort orders. Filters live in the URL so results are shareable, and a filter sheet slides in on mobile
- Car detail page: gallery with lightbox, specs, the full rate card (hourly, daily, weekly, monthly, deposit, included km, extra km, late fee), features, availability calendar, pickup hub with a Google Maps link, rental conditions, rating breakdown and reviews, a sticky booking widget with an **instant server-side quote**, and a mobile booking bar
- How It Works, About, Contact (form plus hub list), Offers, legal pages, custom 404, sitemap, robots, JSON-LD

**Customer**
- Register (with referral code), email OTP verification, login by email **or** mobile, remember me, forgot/reset password
- Four-step checkout: trip (dates, hub or doorstep delivery, drop-off), transparent price and coupon, details and **document upload**, then payment. The car is held during payment with a countdown
- Dashboard: profile completion %, upcoming and active trips, stats, notifications, a pending-payment banner, and a bottom tab bar on mobile
- Bookings (upcoming / active / history), booking detail with timeline, invoice and confirmation **PDFs**, directions, self-serve **cancellation with policy-based refunds**, handover records, reviews (completed trips only)
- Documents (licence and ID with Pending / Verified / Rejected status), payments, refunds and deposits, wishlist plus recently viewed, offers, **loyalty points, tiers and referrals**, notification centre, support tickets with threaded chat, and a profile page (avatar, address, licence, emergency contact, password)

**Admin console** (separate dark layout and login portal)
- Dashboard with 8 KPIs, revenue and booking-trend charts, recent bookings and upcoming handovers; date ranges (7d / 30d / 90d / 12m) and an **include-demo / live-only** toggle
- Analytics: daily, weekly or monthly revenue, booking trends, customer growth, most-rented and most-profitable cars, per-car **utilisation %**, cancellation rate, revenue by category, a table view of each chart, and CSV export
- Bookings table with search, status, vehicle, payment and date filters, sortable columns, pagination, a quick-view side panel and a late-returns filter. Booking detail lets staff approve, cancel with or without a full refund, and retry refunds
- **Vehicle handover**: pickup and return with condition photos, damages, odometer, fuel level and customer sign-off. On return, late, extra-km, fuel and damage charges are calculated automatically and the deposit is settled
- Fleet: add, edit, retire and delete cars, manage photos (cover and order), status, compliance documents (insurance, PUC, RC with expiry alerts), maintenance, booking history and availability calendar
- Pricing: inline rate editor for every car, plus weekend, seasonal and holiday **surge or discount rules** by category. Coupons support percent or fixed discounts, a max cap, a minimum amount, expiry, total and per-user limits, first-booking-only and private codes
- Customers (segments, spend, documents, suspend/reactivate), a document **verification queue**, review moderation, support tickets (assign, prioritise, reply) and website enquiries
- Notification centre, **staff accounts with granular permissions**, an immutable **activity log**, and settings (tax, fees, buffers, hold time, manual approval, require-verified-docs, hubs and cities, integration status)

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS with custom design tokens, Framer Motion, Lucide icons, Sonner toasts, hand-built accessible components (no Bootstrap look) |
| Charts | Recharts |
| Data | PostgreSQL + Prisma 6 |
| Auth | Custom DB-backed sessions (signed JWT cookie + `Session` table), bcrypt, role- and permission-based access |
| Payments | Razorpay (orders, signature verification, webhooks, refunds) with a demo sandbox fallback |
| Files | DB storage driver (zero config) or Cloudinary for public media; identity documents always private |
| PDFs | pdf-lib (works on serverless; no headless browser needed) |
| Email / SMS | Resend; Twilio SMS and WhatsApp adapters |
| Hosting | Vercel + Neon (or any Postgres) |

---

## Quick start (local)

Requires **Node 20+** and a PostgreSQL 14+ database.

```bash
npm install
cp .env.example .env          # fill DATABASE_URL and AUTH_SECRET at minimum
npx prisma migrate deploy     # creates tables + the double-booking exclusion constraint
npm run db:seed               # demo fleet, customers, 6 months of bookings
npm run dev                   # http://localhost:3000
```

No local Postgres? Create a free database at [neon.tech](https://neon.tech) and paste its connection string into `DATABASE_URL`.

---

## Demo logins

> ⚠️ Non-production credentials for demos only. **Change or delete these accounts before going live** (re-seeding resets them).

| Role | Where | Email / mobile | Password |
|---|---|---|---|
| Admin (full access) | `/admin/login` | `admin@mydrivez.in` | `Admin@12345` |
| Staff (ops: limited permissions) | `/admin/login` | `ops@mydrivez.in` | `Staff@12345` |
| Customer (verified docs, active and upcoming trips, loyalty points) | `/login` | `priya@example.com` or `9876543210` | `Customer@123` |
| Customer (new, docs pending, booking awaiting approval) | `/login` | `arjun@example.com` | `Customer@123` |

Useful demo coupons: `FIRSTDRIVE` (₹500 off first trip), `WEEKEND15`, `LONGDRIVE20` (7+ days), `FESTIVE1000`, `CORP12` (private).

**Suggested demo script:** sign in as Priya → book a Swift with doorstep delivery and `WEEKEND15` → simulate a successful payment → download the invoice. Then sign in as admin → approve Arjun's booking → record a pickup and a return on a confirmed booking → verify a document → open Analytics.

---

## Deploy to Vercel

### Option A: instant demo (no database, no settings)

Import the repo in Vercel and deploy. That's all.

With **no `DATABASE_URL`**, the app starts a built-in in-memory PostgreSQL (PGlite). It runs the real migrations and loads the full demo data (fleet, customers, six months of bookings) automatically. Defaults that are fine for a demo are hardcoded: a demo `AUTH_SECRET`, demo mode on, and the site URL taken from Vercel.

Trade-offs, all fine for showing a client:
- The first visit after a cold start takes about 4–5 seconds while the demo data loads; after that pages are fast.
- Data resets to the demo state whenever Vercel restarts the server (usually after some idle time), so bookings made during a demo don't persist.
- If Vercel runs several server instances at once, each has its own copy of the data.

### Option B: real database (for launch)

1. **Push this folder to GitHub** (`git init && git add . && git commit -m "MyDrivez" && git push`).
2. **Create the database.** In Vercel, go to *Storage → Create → Neon Postgres* (or use Neon directly) and connect it to the project. Copy the **pooled** connection string into `DATABASE_URL`.
3. **Import the repo** in Vercel (framework preset: Next.js). The build command (`prisma generate && next build`) is already in `package.json`.
4. **Add environment variables** (see below). At minimum: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `DEMO_MODE=true`, `CRON_SECRET`.
5. **Run the migration and seed once** from your machine against the production database:
   ```bash
   DATABASE_URL="postgres://…neon…" npx prisma migrate deploy
   DATABASE_URL="postgres://…neon…" npm run db:seed
   ```
   (On Windows PowerShell: `$env:DATABASE_URL="…"; npx prisma migrate deploy; npm run db:seed`.)
6. **Deploy.** `vercel.json` registers a daily cron job for reminders and housekeeping.
7. **Before taking real bookings:** add Razorpay keys, configure the webhook, set `DEMO_MODE=false`, and remove the demo data (re-seed is only for demos; for launch, run just `migrate deploy` on a fresh database and create your own admin account).

Vercel limits request bodies to 4.5 MB, so uploads are capped at 4 MB per file. To add many vehicle photos, upload them in batches (or configure Cloudinary).

---

## Environment variables

See [`.env.example`](.env.example) for the full annotated list.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | for launch | Postgres connection string. **Leave unset for the zero-setup demo database** |
| `AUTH_SECRET` | with a real DB | 32+ random chars for signing sessions. Required once `DATABASE_URL` is set; the demo falls back to a hardcoded demo secret |
| `APP_URL` | ✅ | Public URL for emails, invoices and the sitemap |
| `DEMO_MODE` | — | `true` enables the payment sandbox and on-screen OTPs **only where no real provider is configured** |
| `CRON_SECRET` | recommended | Protects `/api/cron/reminders` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | for payments | Use `rzp_test_…` keys for sandbox |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Without them, emails are logged to the server console |
| `CLOUDINARY_*` | optional | Public media CDN |
| `TWILIO_*` | optional | SMS and WhatsApp notifications |
| `STRIPE_SECRET_KEY` | future | Placeholder; Stripe isn't wired into checkout yet |

The admin **Settings → Integrations** panel shows which integrations are live.

---

## Database

- Schema: [`prisma/schema.prisma`](prisma/schema.prisma). It has 30 models covering users, roles, profiles, sessions, tokens, cities, locations, vehicles, images, features, compliance documents, maintenance, pricing rules, coupons, settings, bookings, pricing snapshots, payments, refunds, handovers, inspections, documents, files, reviews, wishlist, loyalty, notifications, tickets, messages, enquiries, newsletter and the activity log.
- Migration: [`prisma/migrations/…_init/migration.sql`](prisma/migrations). Besides tables, indexes, foreign keys and unique constraints, it adds:
  - **`booking_no_overlap`**: a PostgreSQL `EXCLUDE USING gist` constraint (needs `btree_gist`, which Neon, Supabase and RDS all support). A car can never hold two live bookings with overlapping `[startAt, endAt + turnaround buffer)`, **even when two customers check out at the same millisecond**. The booking service also checks first, so customers get a friendly message
  - Check constraints: end after start, ratings 1–5, fuel 0–100, positive rates
- Prices are **snapshotted** in `BookingPricing` when the booking is made, so later rate changes never alter existing bookings.

```bash
npm run db:migrate   # create a new migration after editing the schema (dev)
npm run db:deploy    # apply migrations (prod)
npm run db:seed      # wipe + reseed demo data  ⚠️ destructive
npm run db:reset     # drop, migrate, seed      ⚠️ destructive
```

---

## What's real vs. demo

| Area | Status |
|---|---|
| Auth, roles, permissions, sessions, rate limits | ✅ Real |
| Search, availability, pricing engine, coupons, surge rules | ✅ Real (server-computed) |
| Double-booking prevention | ✅ Real (DB constraint, tested under concurrency) |
| Booking lifecycle, cancellations, refunds policy, handovers, deposits | ✅ Real |
| Admin console, analytics, CSV export, audit log | ✅ Real |
| Invoices and confirmations (PDF) | ✅ Real (demo records are stamped "DEMO RECORD") |
| **Payments** | ⚠️ **Demo sandbox** until Razorpay keys are set. The Razorpay integration (orders, signature plus API verification, webhooks, refunds) is complete and needs only keys. Demo payments are stored with provider `DEMO` and never count as real transactions |
| Email | ⚠️ Logged to the console until `RESEND_API_KEY` is set. In demo mode, OTP codes and reset links appear on screen |
| SMS / WhatsApp | ⚠️ Adapter ready; needs Twilio credentials |
| Seeded data | ⚠️ All demo customers, bookings, payments and reviews are `isDemo=true` and badged; analytics has a **Live only** toggle |
| Marketing copy (e.g. "12,000+ happy drivers", the testimonial on the login page) | ⚠️ Placeholder. Replace with real figures before launch |
| Car photos | Real model photos from Wikimedia Commons (CC licences) plus Unsplash lifestyle images. Credits are in [`public/CREDITS.md`](public/CREDITS.md); swap in your own fleet photos before launch |
| Legal pages | ⚠️ Template text; have them reviewed |

---

## Project structure

```
prisma/
  schema.prisma            data model
  migrations/              SQL incl. exclusion constraint
  seed.ts                  demo data (deterministic)
public/
  cars/  photos/           vehicle & lifestyle images
src/
  middleware.ts            edge redirects (UX only; real checks are server-side)
  app/
    (site)/                public pages: home, cars, car detail, about, contact, offers, legal
    (auth)/                login, register, verify-email, forgot/reset password
    book/                  checkout, resume payment, confirmation
    dashboard/             customer area
    admin/login            staff portal
    admin/(console)/       admin console (dashboard, analytics, bookings, handovers, fleet,
                           maintenance, customers, verifications, reviews, support, pricing,
                           coupons, notifications, staff, activity, settings)
    api/                   quote, files, PDFs, CSV export, Razorpay webhook, cron
    actions/               server actions (auth, booking, customer, admin-*)
  components/
    ui/                    design system: buttons, fields, badges, dialogs, sheets, skeletons
    site/ booking/ account/ support/ admin/ auth/
  lib/
    pricing.ts             pure pricing engine (unit-tested)
    booking/               availability, create, payment hooks, lifecycle
    payments/              Razorpay client + payment service
    auth/                  sessions, JWT, passwords, tokens, permissions
    queries/               read models for public & admin pages
    invoice.ts storage.ts notify.ts email.ts rate-limit.ts audit.ts settings.ts env.ts
tests/pricing.test.ts      pricing / charges / refund policy tests
docs/API.md                endpoint & server-action reference
```

---

## Security

- Role and permission checks happen **on the server in every page, action and route**. The middleware is a convenience layer only.
- Customers can't reach admin routes or actions, and staff can't use the customer portal.
- Passwords use bcrypt (cost 12). Sessions are DB-backed and revocable (logout, reset and suspension apply instantly). OTPs and reset tokens are stored hashed, single-use and time-limited.
- Prices, availability, coupons and payment amounts are **always recomputed on the server**. Client numbers are display-only.
- Payments are verified by HMAC signature **and** a Razorpay API lookup (order, amount and status must match). Webhooks are signature-verified on the raw body.
- Uploads are validated by magic bytes (not file extension), size-capped, and stored privately. Private files return 404 to anyone who isn't allowed to see them.
- Zod validation on every input, Postgres-backed rate limits, a contact-form honeypot, CSV formula-injection escaping, `<` escaping in JSON-LD, and security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- Every important admin action is written to the audit log with actor and IP.

---

## Testing

```bash
npm test            # pricing engine, return charges, cancellation policy (node:test)
npm run typecheck
npm run build
```

Verified for this demo build:
- 12/12 pricing unit tests
- DB constraint tests: overlap rejected, turnaround buffer enforced, cancelled bookings don't block, and when two overlapping inserts race, exactly one wins
- 33 HTTP smoke checks: every public route, guest redirects, API authorisation, webhook signature, quote maths, security headers
- Browser end-to-end runs with Playwright: customer login → checkout → demo payment → confirmation → invoice PDF; double-booking blocked in the UI; admin approve → pickup → return with charges → document verification → coupon creation; staff permission limits; registration → OTP → dashboard; form validation; desktop and mobile screenshots

---

## Extending

- **Live payments:** add the Razorpay keys and webhook. Nothing else changes.
- **Stripe:** implement `startCheckout`/`verify` for `provider: "STRIPE"` in `src/lib/payments/service.ts`.
- **Private document bucket:** swap the DB driver in `src/lib/storage.ts` for Supabase Storage or S3 with signed URLs.
- **More channels:** add adapters in `src/lib/notify.ts`.
- **Google Maps embed:** hubs already store lat/lng; add a Maps JS key and render them on the contact page.
