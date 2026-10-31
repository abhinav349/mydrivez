# MyDrivez API reference

MyDrivez uses two kinds of server endpoints:

1. **Route handlers** (`/api/*`): plain HTTP endpoints for things that aren't form posts (quotes, files, PDFs, webhooks, cron, exports).
2. **Server actions** (`src/app/actions/*`): typed RPCs called from React forms and buttons. Next.js exposes them as POST requests with an action ID. They're listed here because they are the app's write API.

Every endpoint re-checks the session and role **on the server**. The edge middleware only adds convenient redirects; it is never the only check.

Money is always in **whole rupees (INR)**. The Razorpay boundary converts to paise.

---

## Authentication model

| Item | Detail |
|---|---|
| Session | `mdz_session` cookie: an HS256 JWT `{ sid, uid, role }`, `httpOnly`, `secure` in production, `SameSite=Lax` |
| Revocation | Every request loads the `Session` row and `User`. Logout, password reset and suspension take effect immediately |
| Lifetime | 1 day by default; 30 days with "Remember me" |
| Roles | `CUSTOMER`, `STAFF` (granular permissions), `ADMIN` (all permissions) |
| Staff permissions | `dashboard:view`, `fleet:write`, `bookings:write`, `handover:write`, `customers:write`, `pricing:write`, `reviews:moderate`, `support:write`, `reports:export` |
| Passwords | bcrypt, cost 12. Unknown accounts still run a dummy compare, so response timing doesn't reveal which emails exist |
| Rate limits | Postgres-backed fixed window: login 8/15 min per identifier and 20/15 min per IP; register 8/h per IP; OTP resend 3/10 min; quotes 120/min per IP; bookings 10/10 min per user |

---

## Route handlers

### `POST /api/quote`
Server-authoritative price and live availability. Public; works signed in or out (coupon per-user rules apply when signed in).

**Body**
```json
{ "vehicleId": "cuid", "start": "2026-12-01T04:30:00.000Z", "end": "2026-12-03T07:30:00.000Z", "doorstep": true, "couponCode": "WEEKEND15" }
```
**200**
```json
{
  "available": true,
  "quote": {
    "durationHours": 51, "billedDays": 2, "billedHours": 3, "rateTier": "daily",
    "baseAmount": 7778, "surgeAmount": 618, "surgeLabel": "Weekend pricing",
    "deliveryFee": 499, "discountAmount": 1259, "couponCode": "WEEKEND15", "couponError": null,
    "taxRate": 18, "taxAmount": 1374, "rentalTotal": 9010,
    "securityDeposit": 7500, "totalPayable": 16510,
    "includedKm": 750, "extraKmRate": 14, "lateFeePerHour": 390,
    "lineItems": [{ "label": "Daily rate · 2 days + 3 hrs", "amount": 7778, "kind": "charge" }, "…"]
  }
}
```
**400**: `{ "error": "Return time must be after pickup time." }` · **429**: rate limited.

### `GET /api/bookings/:id/pdf?type=invoice|confirmation`
Streams a PDF (tax invoice or booking confirmation). Allowed for the booking's customer or any staff member, and only once a payment has been captured. Returns **401** (not signed in), **404** (not yours), or **409** (unpaid).

### `GET /api/files/:id`
Streams a stored file. Public media (vehicle, avatar, inspection) is cached. **Customer documents are private**: only the owner or staff with `customers:write` can read them. Everyone else gets **404**, so the endpoint doesn't reveal whether a file exists.

### `GET /api/admin/export/bookings?from&to&status&data=live|all`
CSV export that opens directly in Excel (UTF-8 BOM, formula-injection safe). Requires `reports:export`. Each export is written to the audit log.

### `POST /api/payments/razorpay/webhook`
Verifies `X-Razorpay-Signature` (HMAC-SHA256 of the raw body using `RAZORPAY_WEBHOOK_SECRET`) before processing anything. Handles `payment.captured` (idempotent capture and booking confirmation), `payment.failed` and `refund.processed`.

### `GET /api/cron/reminders`
Requires `Authorization: Bearer $CRON_SECRET`. Vercel Cron calls it daily (see `vercel.json`). It does the following:
- releases expired payment holds
- sends pickup reminders (in-app, email, SMS and WhatsApp when configured) and return reminders
- alerts admins about overdue returns, vehicle documents expiring within 15 days, and maintenance due within 2 days
- prunes old rate-limit rows and expired sessions

---

## Server actions

All actions return `{ ok: true, data }` / `{ ok: false, error }`, or, for forms, an `ActionState` (`{ ok?, error?, fieldErrors?, message? }`).

### Public / auth: `actions/auth.ts`, `actions/public.ts`
| Action | Who | Purpose |
|---|---|---|
| `registerAction` | guest | Create customer + profile, apply referral code, send email OTP, start session |
| `loginAction` / `adminLoginAction` | guest | Separate customer and staff portals; each rejects the other role |
| `logoutAction` | any | Delete session row + cookie |
| `verifyOtpAction` / `resendOtpAction` | signed in | 6-digit email OTP (hashed, 15 min, 5 attempts) |
| `forgotPasswordAction` / `resetPasswordAction` | guest | 30-min single-use reset link; resetting signs out all sessions |
| `subscribeNewsletter`, `submitContact` | guest | Rate-limited; contact form has a honeypot field |
| `toggleWishlist` | customer | Save / unsave a car |

### Booking & payment: `actions/booking.ts`
| Action | Purpose |
|---|---|
| `createBookingAction(input)` | Validates input, **recomputes price on the server**, validates the coupon, checks for conflicts and inserts the booking. The DB exclusion constraint guards against races. Status `AWAITING_PAYMENT` with a hold (default 15 min) |
| `startPaymentAction(bookingId)` | Creates a Razorpay order for the stored `totalPayable`, or a DEMO payment record when no gateway is configured and `DEMO_MODE=true` |
| `verifyRazorpayAction({orderId, paymentId, signature})` | Verifies the checkout signature **and** fetches the payment from Razorpay (order, amount and status must match) before marking it paid |
| `demoPaymentAction(paymentId, "success"\|"failure")` | Sandbox only. Disabled when Razorpay keys exist or `DEMO_MODE` is off |
| `cancelBookingAction(bookingId, reason)` | Customer cancellation using the refund policy (≥24h: 100%; 6–24h: 50%; <6h: 0% of the rental; the deposit is always refunded) |
| `submitReviewAction` | Only the renter of a **COMPLETED** booking, once per booking. Reviews enter moderation and the customer earns 50 points |

### Customer account: `actions/customer.ts`
`uploadDocumentAction` (magic-byte validation, 4 MB max, private storage), `updateProfileAction`, `uploadAvatarAction`, `changePasswordAction`, `markNotificationsReadAction`, `createTicketAction`, `replyTicketAction`.

### Admin: `actions/admin-*.ts`
| Area | Actions | Permission |
|---|---|---|
| Bookings | `adminConfirmBooking`, `adminCancelBooking(id, reason, fullRefund)`, `adminRetryRefund`, `adminUpdateNote` | `bookings:write` |
| Handover | `uploadInspectionPhoto`, `adminRecordPickup`, `adminPreviewReturn`, `adminRecordReturn` (computes late, extra-km, fuel and damage charges, settles the deposit, awards loyalty and referral points) | `handover:write` |
| Fleet | `saveVehicleAction`, `setVehicleStatus`, `deleteVehicle` (cars with history are retired, not deleted), `deleteVehicleImage`, `makePrimaryImage`, `upsertVehicleDocument`, `addMaintenanceAction`, `updateMaintenanceStatus` | `fleet:write` |
| Pricing | `updateVehicleRates`, `createPricingRuleAction`, `togglePricingRule`, `deletePricingRule`, `saveCouponAction`, `toggleCoupon`, `deleteCoupon` | `pricing:write` |
| Customers | `reviewDocument(id, VERIFIED\|REJECTED, reason)`, `setCustomerStatus` | `customers:write` |
| Reviews | `moderateReview` (recomputes the car's rating) | `reviews:moderate` |
| Support | `staffReplyAction`, `updateTicket`, `markEnquiryHandled` | `support:write` |
| Admin only | `createStaffAction`, `updateStaffPermissions`, `setStaffStatus`, `saveSettingsAction`, `addLocationAction`, `toggleLocation` | `ADMIN` role |

Every admin write is recorded in `AdminActivityLog` (actor, action, entity, summary, metadata, IP).

---

## Booking state machine

```
AWAITING_PAYMENT ──pay──▶ CONFIRMED ──pickup──▶ ACTIVE ──return──▶ COMPLETED
       │                    ▲   (shown as "Upcoming" until the start time)
       │        pay (manual approval / docs required)
       │                    │
       ├──────▶ PAYMENT_COMPLETED ──admin confirm──┘
       │
       └─ hold expires / cancel ─▶ CANCELLED ──(full refund processed)──▶ REFUNDED
```
`PENDING` is reserved for bookings created offline by staff.
