"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Check,
  Clock,
  FileCheck2,
  Home,
  Loader2,
  MapPin,
  Star,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createBookingAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { DocumentUploader } from "@/components/account/document-uploader";
import { useQuote } from "@/components/site/use-quote";
import { PaymentPanel } from "./payment-panel";
import { CATEGORY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/constants";
import { cn, formatDateTime, formatDuration, formatINR, toLocalInput } from "@/lib/utils";

type DocState = "VERIFIED" | "PENDING" | "REJECTED" | "MISSING";

type Props = {
  vehicle: {
    id: string;
    slug: string;
    title: string;
    variant: string | null;
    image: string | null;
    category: string;
    transmission: string;
    fuelType: string;
    seats: number;
    hubId: string;
    rating: number;
    ratingCount: number;
  };
  hubs: { id: string; name: string; address: string }[];
  initial: { start?: string; end?: string; drop?: string };
  user: { name: string; email: string; phone: string; emailVerified: boolean; address: string; licenseNumber: string | null };
  docs: { license: DocState; id: DocState };
  requireVerifiedDocs: boolean;
  doorstepFee: number;
  holdMinutes: number;
  coupons: { code: string; title: string; description: string }[];
  payment: { mode: "RAZORPAY" | "DEMO" | "NONE"; test: boolean };
};

const STEPS = ["Trip", "Price", "Details", "Payment"];

function defaults() {
  const ist = new Date(Date.now() + 86_400_000 + 5.5 * 3600_000);
  ist.setUTCHours(10, 0, 0, 0);
  const s = new Date(ist.getTime() - 5.5 * 3600_000);
  return { start: toLocalInput(s), end: toLocalInput(new Date(s.getTime() + 2 * 86_400_000)) };
}

export function Checkout(p: Props) {
  const d = useMemo(defaults, []);
  const [step, setStep] = useState(0);
  const [start, setStart] = useState(p.initial.start ?? d.start);
  const [end, setEnd] = useState(p.initial.end ?? d.end);
  const [pickup, setPickup] = useState(p.vehicle.hubId);
  const [dropoff, setDropoff] = useState(p.hubs.some((h) => h.id === p.initial.drop) ? p.initial.drop! : "");
  const [doorstep, setDoorstep] = useState(false);
  const [address, setAddress] = useState(p.user.address);
  const [note, setNote] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [booking, setBooking] = useState<{ id: string; code: string; holdUntil: number } | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuote({ vehicleId: p.vehicle.id, start, end, doorstep, couponCode: coupon });

  // Surface coupon validation errors and drop invalid codes.
  useEffect(() => {
    if (coupon && q.quote?.couponError) {
      toast.error(q.quote.couponError);
      setCoupon(null);
    } else if (coupon && q.quote?.couponCode === coupon) {
      toast.success(`${coupon} applied — you save ${formatINR(q.quote.discountAmount)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.quote?.couponError, q.quote?.couponCode]);

  const docsOk = p.docs.license !== "MISSING" && p.docs.id !== "MISSING" && p.docs.license !== "REJECTED" && p.docs.id !== "REJECTED";
  const docsVerified = p.docs.license === "VERIFIED" && p.docs.id === "VERIFIED";

  const tripValid = !q.error && q.available !== false && !!q.quote && (!doorstep || address.trim().length > 8);
  // Documents must be uploaded to book; verification can complete after payment unless the admin requires it upfront.
  const detailsValid = agree && docsOk && (!p.requireVerifiedDocs || docsVerified);

  const reserve = async () => {
    setCreating(true);
    const res = await createBookingAction({
      vehicleId: p.vehicle.id,
      start: new Date(`${start}:00+05:30`).toISOString(),
      end: new Date(`${end}:00+05:30`).toISOString(),
      pickupLocationId: pickup,
      dropoffLocationId: dropoff || null,
      doorstep,
      deliveryAddress: doorstep ? address : null,
      couponCode: coupon,
      customerNote: note || null,
    });
    setCreating(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setBooking({ id: res.data.bookingId, code: res.data.code, holdUntil: Date.now() + p.holdMinutes * 60_000 });
    setStep(3);
  };

  const next = () => {
    if (step === 2) return void reserve();
    setStep((s) => Math.min(s + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="container pb-36 pt-8 lg:pb-16">
      <Link href={`/cars/${p.vehicle.slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to car
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Complete your booking</h1>

      {/* Stepper */}
      <ol className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-none" aria-label="Booking steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <button
              disabled={i > step || !!booking}
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold transition-colors",
                i === step ? "bg-ink text-white" : i < step ? "bg-lime-100 text-ink" : "bg-white text-muted",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px]", i === step ? "bg-lime text-ink" : i < step ? "bg-ink text-lime" : "bg-paper")}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" />}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
              {step === 0 && (
                <Panel title="When and where?" subtitle="Pick your dates and how you'd like to collect the car.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Pickup date & time" name="start">
                      <Input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                    </Field>
                    <Field label="Return date & time" name="end">
                      <Input id="end" type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
                    </Field>
                  </div>
                  {q.error && <Alert>{q.error}</Alert>}
                  {q.available === false && <Alert>This car is already booked for part of that window. Try shifting your dates.</Alert>}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <OptionCard active={!doorstep} onClick={() => setDoorstep(false)} icon={MapPin} title="Self pickup" body="Collect from our hub — free" />
                    <OptionCard active={doorstep} onClick={() => setDoorstep(true)} icon={Home} title="Doorstep delivery" body={`Delivered & collected — ${formatINR(p.doorstepFee)}`} />
                  </div>

                  {doorstep ? (
                    <Field label="Delivery address" name="address" hint="Within city limits. Our team will call 30 minutes before arrival." error={address.trim().length > 0 && address.trim().length <= 8 ? "Add a complete address" : undefined}>
                      <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Flat, building, street, area, PIN" className="min-h-[80px]" />
                    </Field>
                  ) : (
                    <Field label="Pickup hub" name="pickup">
                      <Select id="pickup" value={pickup} onChange={(e) => setPickup(e.target.value)}>
                        {p.hubs.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} — {h.address}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Field label="Drop-off hub (optional)" name="dropoff" hint="Return to a different hub in the same city at no extra cost.">
                    <Select id="dropoff" value={dropoff} onChange={(e) => setDropoff(e.target.value)}>
                      <option value="">Same as pickup</option>
                      {p.hubs.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Note for our team (optional)" name="note">
                    <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Need a child seat, arriving on flight 6E 512" />
                  </Field>
                </Panel>
              )}

              {step === 1 && (
                <Panel title="Your price, fully transparent" subtitle="Calculated live on our servers. What you see is what you pay.">
                  <Breakdown q={q} />
                  <div className="rounded-2xl border border-line bg-white p-5">
                    <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                      <BadgePercent className="h-4 w-4" /> Apply a coupon
                    </p>
                    {coupon && q.quote?.couponCode ? (
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-lime-100 px-4 py-3">
                        <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                          <Tag className="h-4 w-4" /> {coupon} · −{formatINR(q.quote.discountAmount)}
                        </span>
                        <button onClick={() => setCoupon(null)} className="text-muted hover:text-ink" aria-label="Remove coupon">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <form
                        className="mt-3 flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (couponInput.trim()) setCoupon(couponInput.trim().toUpperCase());
                        }}
                      >
                        <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Enter code" className="uppercase" aria-label="Coupon code" />
                        <Button type="submit" variant="secondary" loading={q.loading && !!coupon}>
                          Apply
                        </Button>
                      </form>
                    )}
                    {p.coupons.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {p.coupons.map((c) => (
                          <button
                            key={c.code}
                            onClick={() => {
                              setCouponInput(c.code);
                              setCoupon(c.code);
                            }}
                            title={c.description}
                            className="rounded-lg border border-dashed border-ink/25 px-2.5 py-1.5 font-mono text-[12px] font-bold text-ink hover:border-ink hover:bg-paper"
                          >
                            {c.code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>
              )}

              {step === 2 && (
                <Panel title="Confirm your details" subtitle="We need a few things to hand over the keys.">
                  <div className="rounded-2xl border border-line bg-white p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-[14px] font-semibold text-ink">Primary driver</p>
                      <Link href="/dashboard/profile" className="text-[13px] font-semibold text-ink underline underline-offset-4">
                        Edit
                      </Link>
                    </div>
                    <dl className="mt-3 grid gap-3 text-[14px] sm:grid-cols-3">
                      <div>
                        <dt className="text-[12px] text-muted">Name</dt>
                        <dd className="font-medium text-ink">{p.user.name}</dd>
                      </div>
                      <div>
                        <dt className="text-[12px] text-muted">Email</dt>
                        <dd className="truncate font-medium text-ink">{p.user.email}</dd>
                      </div>
                      <div>
                        <dt className="text-[12px] text-muted">Mobile</dt>
                        <dd className="font-medium text-ink">{p.user.phone || "—"}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-line bg-white p-5">
                    <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                      <FileCheck2 className="h-4 w-4" /> Document verification
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <DocRow label="Driving licence" state={p.docs.license} />
                      <DocRow label="Government ID" state={p.docs.id} />
                    </div>
                    {!docsOk ? (
                      <div className="mt-5 border-t border-line pt-5">
                        <p className="mb-4 text-[13px] text-muted">Upload the missing documents to continue. They&apos;re stored privately and only visible to our verification team.</p>
                        <DocumentUploader defaultType={p.docs.license === "MISSING" || p.docs.license === "REJECTED" ? "DRIVING_LICENSE" : "GOVERNMENT_ID"} />
                      </div>
                    ) : !docsVerified ? (
                      <p className="mt-3 text-[13px] text-muted">Your documents are under review. You can book now — we&apos;ll confirm once they&apos;re verified (usually within a few hours).</p>
                    ) : null}
                  </div>

                  <Checkbox
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    label={
                      <>
                        I&apos;m 21+, hold a valid licence for at least a year, and agree to the{" "}
                        <Link href="/legal/rental-agreement" target="_blank" className="font-semibold underline">
                          rental agreement
                        </Link>{" "}
                        and{" "}
                        <Link href="/legal/cancellation" target="_blank" className="font-semibold underline">
                          cancellation policy
                        </Link>
                        .
                      </>
                    }
                  />
                </Panel>
              )}

              {step === 3 && booking && (
                <Panel title="Secure payment" subtitle={`Booking ${booking.code} is held for you. Complete payment to confirm.`}>
                  <HoldTimer until={booking.holdUntil} />
                  <PaymentPanel
                    bookingId={booking.id}
                    amount={q.quote?.totalPayable ?? 0}
                    mode={p.payment.mode}
                    testMode={p.payment.test}
                    prefill={{ name: p.user.name, email: p.user.email, contact: p.user.phone }}
                    description={`${p.vehicle.title} · ${booking.code}`}
                  />
                </Panel>
              )}
            </motion.div>
          </AnimatePresence>

          {step < 3 && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-4 backdrop-blur-xl lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0">
              <div className="flex items-center justify-between gap-3">
                <div className="lg:hidden">
                  <p className="font-display text-lg font-semibold text-ink">{q.quote ? formatINR(q.quote.totalPayable) : "—"}</p>
                  <p className="text-[12px] text-muted">incl. deposit</p>
                </div>
                {step > 0 && (
                  <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="hidden lg:inline-flex">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                <Button size="lg" onClick={next} loading={creating} disabled={step === 0 ? !tripValid : step === 1 ? !q.quote || q.loading : !detailsValid} className="lg:ml-auto">
                  {step === 2 ? "Reserve & continue to payment" : "Continue"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="relative aspect-[16/9] bg-paper">{p.vehicle.image && <Image src={p.vehicle.image} alt={p.vehicle.title} fill sizes="380px" className="object-cover" />}</div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted">{CATEGORY_LABEL[p.vehicle.category as "SUV"]}</p>
                  <p className="text-lg font-semibold text-ink">{p.vehicle.title}</p>
                  <p className="text-[13px] text-muted">
                    {TRANSMISSION_LABEL[p.vehicle.transmission as "MANUAL"]} · {FUEL_LABEL[p.vehicle.fuelType as "PETROL"]} · {p.vehicle.seats} seats
                  </p>
                </div>
                {p.vehicle.ratingCount > 0 && (
                  <span className="flex items-center gap-1 text-[13px] font-semibold">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {p.vehicle.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-2 rounded-xl bg-paper p-3.5 text-[13px]">
                <p className="flex justify-between gap-2">
                  <span className="text-muted">Pickup</span>
                  <span className="font-medium text-ink">{formatDateTime(new Date(`${start}:00+05:30`))}</span>
                </p>
                <p className="flex justify-between gap-2">
                  <span className="text-muted">Return</span>
                  <span className="font-medium text-ink">{formatDateTime(new Date(`${end}:00+05:30`))}</span>
                </p>
                <p className="flex justify-between gap-2">
                  <span className="text-muted">{doorstep ? "Delivery" : "Hub"}</span>
                  <span className="truncate text-right font-medium text-ink">{doorstep ? "Doorstep" : p.hubs.find((h) => h.id === pickup)?.name}</span>
                </p>
              </div>
              <div className="mt-4">
                <Breakdown q={q} compact />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
        {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] font-medium text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {children}
    </p>
  );
}

function OptionCard({ active, onClick, icon: Icon, title, body }: { active: boolean; onClick: () => void; icon: React.ElementType; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex items-start gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-all", active ? "border-ink shadow-card" : "border-line hover:border-ink/25")}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-ink text-lime" : "bg-paper text-ink")}>
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-[14.5px] font-semibold text-ink">{title}</span>
        <span className="block text-[13px] text-muted">{body}</span>
      </span>
    </button>
  );
}

function DocRow({ label, state }: { label: string; state: DocState }) {
  const map = { VERIFIED: ["success", "Verified"], PENDING: ["warning", "Under review"], REJECTED: ["danger", "Rejected — re-upload"], MISSING: ["neutral", "Not uploaded"] } as const;
  const [tone, text] = map[state];
  return (
    <div className="flex items-center justify-between rounded-xl bg-paper px-3.5 py-3 text-[13.5px]">
      <span className="font-medium text-ink">{label}</span>
      <Badge tone={tone} dot>
        {text}
      </Badge>
    </div>
  );
}

function Breakdown({ q, compact }: { q: ReturnType<typeof useQuote>; compact?: boolean }) {
  if (q.loading && !q.quote)
    return (
      <div className="flex h-24 items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  if (!q.quote) return q.error ? <Alert>{q.error}</Alert> : null;
  const quote = q.quote;
  return (
    <div className={cn("space-y-2.5 text-[13.5px] transition-opacity", q.loading && "opacity-50", !compact && "rounded-2xl border border-line bg-white p-5")}>
      {!compact && <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{formatDuration(quote.durationHours)} trip</p>}
      {quote.lineItems
        .filter((l) => l.kind !== "deposit")
        .map((l) => (
          <div key={l.label} className="flex justify-between gap-3">
            <span className="text-muted">{l.label}</span>
            <span className={cn("font-medium", l.amount < 0 ? "text-success" : "text-ink")}>{l.amount < 0 ? `−${formatINR(-l.amount)}` : formatINR(l.amount)}</span>
          </div>
        ))}
      <div className="flex justify-between border-t border-line pt-2.5 font-semibold text-ink">
        <span>Rental total</span>
        <span>{formatINR(quote.rentalTotal)}</span>
      </div>
      <div className="flex justify-between text-muted">
        <span>Refundable security deposit</span>
        <span>{formatINR(quote.securityDeposit)}</span>
      </div>
      <div className="flex justify-between rounded-xl bg-ink px-4 py-3 font-semibold text-white">
        <span>Pay now</span>
        <span className="text-lime">{formatINR(quote.totalPayable)}</span>
      </div>
      {!compact && (
        <ul className="space-y-1 pt-1 text-[12.5px] text-muted">
          <li>• Includes {quote.includedKm} km · extra {formatINR(quote.extraKmRate)}/km</li>
          <li>• Late return: {formatINR(quote.lateFeePerHour)}/hour after the grace period</li>
          <li>• Deposit refunded within 5–7 business days of return, minus any trip charges</li>
        </ul>
      )}
    </div>
  );
}

function HoldTimer({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, until - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-[13.5px] font-medium", left > 120_000 ? "bg-info-soft text-info" : "bg-warning-soft text-warning")}>
      <Clock className="h-4 w-4" />
      {left > 0 ? (
        <>
          Car reserved for{" "}
          <span className="font-mono font-bold">
            {m}:{String(s).padStart(2, "0")}
          </span>
        </>
      ) : (
        "Your hold has expired. Go back and start again to re-check availability."
      )}
    </div>
  );
}
