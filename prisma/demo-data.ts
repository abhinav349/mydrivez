
/**
 * Demo data for MyDrivez (used by `npm run db:seed` and by the built-in demo database). Every generated booking, payment and review is flagged isDemo=true
 * and every payment uses provider DEMO, so demo data is always distinguishable from real
 * customer transactions. Credentials here are for local/demo use only — change before launch.
 */
import { PrismaClient, type BookingStatus, type Prisma, type Vehicle, type VehicleCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { computeQuote, type SurgeRule } from "../src/lib/pricing";

let db: PrismaClient;

// Deterministic PRNG so the demo looks the same on every reseed.
let seed = 20261031;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]!;
const between = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = Date.now();
/** A wall-clock hour in IST on the day offset from today. */
function istAt(dayOffset: number, hour: number) {
  const d = new Date(NOW + dayOffset * DAY + 5.5 * HOUR);
  d.setUTCHours(hour, 0, 0, 0);
  return new Date(d.getTime() - 5.5 * HOUR);
}

const SETTINGS = {
  taxRatePct: 18,
  doorstepFee: 499,
  lateFeeMultiplier: 1.5,
  minHours: 4,
  turnaroundMinutes: 60,
  holdMinutes: 15,
  manualApproval: false,
  requireVerifiedDocs: false,
  lateGraceMinutes: 30,
  fuelChargePerPct: 60,
  maxRentalDays: 90,
  minLeadMinutes: 60,
  loyaltyPointsPer100: 1,
  referralBonusPoints: 250,
};

const CITIES = [
  { name: "Bengaluru", slug: "bengaluru", state: "Karnataka", hubs: [
    { name: "Koramangala Hub", address: "80 Feet Rd, 4th Block, Koramangala, Bengaluru 560034", lat: 12.9352, lng: 77.6245 },
    { name: "Indiranagar Hub", address: "100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038", lat: 12.9719, lng: 77.6412 },
    { name: "Kempegowda Airport", address: "Arrival Pickup Zone P4, KIA, Devanahalli, Bengaluru 560300", lat: 13.1989, lng: 77.7068 },
  ] },
  { name: "Mumbai", slug: "mumbai", state: "Maharashtra", hubs: [
    { name: "Andheri West Hub", address: "Link Rd, Andheri West, Mumbai 400053", lat: 19.1363, lng: 72.8277 },
    { name: "Bandra Kurla Complex", address: "G Block, BKC, Bandra East, Mumbai 400051", lat: 19.0662, lng: 72.8679 },
  ] },
  { name: "Delhi NCR", slug: "delhi-ncr", state: "Delhi", hubs: [
    { name: "Aerocity Hub", address: "Asset 2, Aerocity, New Delhi 110037", lat: 28.5507, lng: 77.1196 },
    { name: "Cyber City Gurugram", address: "DLF Cyber City, Phase 2, Gurugram 122002", lat: 28.495, lng: 77.0895 },
  ] },
  { name: "Hyderabad", slug: "hyderabad", state: "Telangana", hubs: [
    { name: "HITEC City Hub", address: "Madhapur Rd, HITEC City, Hyderabad 500081", lat: 17.4435, lng: 78.3772 },
  ] },
  { name: "Pune", slug: "pune", state: "Maharashtra", hubs: [
    { name: "Koregaon Park Hub", address: "North Main Rd, Koregaon Park, Pune 411001", lat: 18.5362, lng: 73.8939 },
  ] },
  { name: "Goa", slug: "goa", state: "Goa", hubs: [
    { name: "Panjim Hub", address: "18th June Rd, Panaji, Goa 403001", lat: 15.4989, lng: 73.8278 },
    { name: "Dabolim Airport", address: "Arrival Pickup Zone, Dabolim Airport, Goa 403801", lat: 15.3808, lng: 73.8314 },
  ] },
];

type VSeed = {
  slug: string; brand: string; model: string; variant: string; reg: string; year: number; category: VehicleCategory;
  fuel: "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID"; trans: "MANUAL" | "AUTOMATIC"; seats: number; engine: string; mileage: string; color: string;
  rates: [number, number, number, number]; deposit: number; km: number; extra: number; hub: string; images: string[]; featured?: boolean;
  features: string[]; description: string;
};

const COMMON = ["Bluetooth audio", "USB-C fast charging", "Rear parking sensors", "Dual airbags", "ABS with EBD", "FASTag enabled"];

const VEHICLES: VSeed[] = [
  { slug: "maruti-swift-zxi-amt", brand: "Maruti Suzuki", model: "Swift", variant: "ZXi+ AMT", reg: "KA01MZ2417", year: 2024, category: "HATCHBACK", fuel: "PETROL", trans: "AUTOMATIC", seats: 5, engine: "1.2L Z-Series 3-cyl, 82 PS", mileage: "25.7 km/l", color: "Pearl Arctic White", rates: [140, 1899, 11499, 39999], deposit: 3000, km: 240, extra: 10, hub: "Koramangala Hub", images: ["/cars/swift-1.jpg", "/cars/swift-2.jpg"], features: [...COMMON, "Apple CarPlay & Android Auto", "Automatic climate control", "Cruise control"], description: "The all-new Swift is the city's favourite for a reason: light steering, a feather-touch AMT and frugal 25+ km/l efficiency. Slips into tight parking spots and still has room for a weekend bag in the back." },
  { slug: "hyundai-i20-asta", brand: "Hyundai", model: "i20", variant: "Asta (O)", reg: "MH02HY8831", year: 2023, category: "HATCHBACK", fuel: "PETROL", trans: "MANUAL", seats: 5, engine: "1.2L Kappa, 83 PS", mileage: "20.3 km/l", color: "Typhoon Silver", rates: [160, 2199, 13499, 45999], deposit: 3000, km: 240, extra: 11, hub: "Andheri West Hub", images: ["/cars/i20-1.jpg", "/cars/i20-2.jpg"], features: [...COMMON, "Electric sunroof", "Bose 7-speaker audio", "10.25\" touchscreen"], description: "A premium hatchback that feels a size bigger. The i20's sunroof, Bose audio and roomy rear seat make Mumbai's coastal roads and Lonavala getaways a pleasure." },
  { slug: "tata-nexon-creative-plus", brand: "Tata", model: "Nexon", variant: "Creative+ Diesel", reg: "MH12TN5520", year: 2024, category: "SUV", fuel: "DIESEL", trans: "MANUAL", seats: 5, engine: "1.5L Revotorq, 115 PS", mileage: "23.2 km/l", color: "Pure Grey", rates: [190, 2599, 15999, 54999], deposit: 5000, km: 250, extra: 12, hub: "Koregaon Park Hub", images: ["/cars/nexon-1.jpg", "/cars/nexon-2.jpg"], featured: true, features: [...COMMON, "5-star Global NCAP safety", "360° camera", "Ventilated front seats"], description: "Five-star safety, a punchy diesel and 208 mm of ground clearance — the Nexon is built for the Sahyadris as much as for Pune traffic." },
  { slug: "tata-nexon-ev-empowered", brand: "Tata", model: "Nexon EV", variant: "Empowered+ LR", reg: "KA03EV1180", year: 2023, category: "ELECTRIC", fuel: "ELECTRIC", trans: "AUTOMATIC", seats: 5, engine: "Permanent magnet synchronous, 145 PS", mileage: "465 km (ARAI)", color: "Intensi-Teal", rates: [210, 2899, 17499, 59999], deposit: 5000, km: 250, extra: 10, hub: "Indiranagar Hub", images: ["/cars/nexon-ev-1.jpg"], featured: true, features: [...COMMON, "Regenerative braking paddles", "Connected car app", "DC fast charging"], description: "Silent, swift and zero tailpipe emissions. Handed over with 80%+ charge and access to 1,500+ fast chargers along the Bengaluru–Mysuru expressway." },
  { slug: "hyundai-creta-sxo", brand: "Hyundai", model: "Creta", variant: "SX(O) Diesel AT", reg: "TS09HC7742", year: 2024, category: "SUV", fuel: "DIESEL", trans: "AUTOMATIC", seats: 5, engine: "1.5L CRDi, 116 PS", mileage: "19.1 km/l", color: "Titan Grey", rates: [260, 3499, 20999, 72999], deposit: 7500, km: 250, extra: 14, hub: "HITEC City Hub", images: ["/cars/creta-1.jpg", "/cars/creta-2.jpg"], featured: true, features: [...COMMON, "Level 2 ADAS", "Panoramic sunroof", "Dual-zone climate control", "Ventilated seats"], description: "India's best-selling SUV in its sharpest form. Level 2 ADAS, a panoramic sunroof and a smooth 6-speed automatic make long highway runs effortless." },
  { slug: "kia-seltos-gtx-plus", brand: "Kia", model: "Seltos", variant: "GTX+ Turbo DCT", reg: "DL8CK4402", year: 2023, category: "SUV", fuel: "PETROL", trans: "AUTOMATIC", seats: 5, engine: "1.5L T-GDi, 160 PS", mileage: "17.9 km/l", color: "Glacier White Pearl", rates: [270, 3599, 21999, 74999], deposit: 7500, km: 250, extra: 14, hub: "Aerocity Hub", images: ["/cars/seltos-1.jpg", "/cars/seltos-2.jpg"], features: [...COMMON, "Bose premium audio", "Heads-up display", "Level 2 ADAS"], description: "160 PS of turbo-petrol punch with a quick-shifting DCT. The Seltos GTX+ turns the Delhi–Jaipur expressway into a grand tour." },
  { slug: "mahindra-thar-lx-4x4", brand: "Mahindra", model: "Thar", variant: "LX Hard Top 4×4", reg: "GA07MT3090", year: 2024, category: "SUV", fuel: "DIESEL", trans: "MANUAL", seats: 4, engine: "2.2L mHawk, 132 PS", mileage: "15.2 km/l", color: "Napoli Black", rates: [290, 3899, 23499, 79999], deposit: 10000, km: 250, extra: 15, hub: "Panjim Hub", images: ["/cars/thar-1.jpg", "/cars/thar-2.jpg"], featured: true, features: ["Shift-on-the-fly 4×4", "Washable interior", "Roll cage", "Touchscreen infotainment", "Cruise control", "Dual airbags"], description: "The icon. True 4×4 with low-range transfer case, ready for Goa's hidden beaches, Western Ghats trails and everything between. Top-down weather guaranteed." },
  { slug: "honda-city-zx-cvt", brand: "Honda", model: "City", variant: "ZX CVT", reg: "MH01HC6610", year: 2023, category: "SEDAN", fuel: "PETROL", trans: "AUTOMATIC", seats: 5, engine: "1.5L i-VTEC, 121 PS", mileage: "18.4 km/l", color: "Platinum White Pearl", rates: [220, 2999, 17999, 62999], deposit: 5000, km: 250, extra: 12, hub: "Bandra Kurla Complex", images: ["/cars/city-1.jpg", "/cars/city-2.jpg"], features: [...COMMON, "Honda SENSING ADAS", "Electric sunroof", "Leather upholstery"], description: "Refined, roomy and whisper-quiet. The City's silky CVT and limousine rear legroom make it a favourite for business trips and airport runs." },
  { slug: "hyundai-verna-sxo-turbo", brand: "Hyundai", model: "Verna", variant: "SX(O) Turbo DCT", reg: "HR26HV2208", year: 2024, category: "SEDAN", fuel: "PETROL", trans: "AUTOMATIC", seats: 5, engine: "1.5L T-GDi, 160 PS", mileage: "20.6 km/l", color: "Fiery Red", rates: [230, 3099, 18499, 64999], deposit: 5000, km: 250, extra: 12, hub: "Cyber City Gurugram", images: ["/cars/verna-1.jpg", "/cars/verna-2.jpg"], features: [...COMMON, "Heated & ventilated seats", "Level 2 ADAS", "Dual 10.25\" screens"], description: "The fastest sedan in its class with heated and ventilated seats and a full digital cockpit. Effortless on NH48 and a head-turner in Cyber City." },
  { slug: "toyota-innova-hycross-zx", brand: "Toyota", model: "Innova Hycross", variant: "ZX (O) Hybrid", reg: "KA05TH9001", year: 2024, category: "PREMIUM", fuel: "HYBRID", trans: "AUTOMATIC", seats: 7, engine: "2.0L Strong Hybrid, 186 PS", mileage: "23.2 km/l", color: "Silver Metallic", rates: [380, 4999, 29999, 99999], deposit: 10000, km: 300, extra: 16, hub: "Kempegowda Airport", images: ["/cars/innova-1.jpg"], featured: true, features: [...COMMON, "Captain seats with ottoman", "Panoramic sunroof", "JBL 9-speaker audio", "Powered tailgate"], description: "Seven seats, captain-chair luxury and hybrid efficiency of 23 km/l. The definitive family road-tripper — airport pickup available." },
  { slug: "mahindra-xuv700-ax7l", brand: "Mahindra", model: "XUV700", variant: "AX7 L Diesel AT", reg: "TS08MX7007", year: 2024, category: "SUV", fuel: "DIESEL", trans: "AUTOMATIC", seats: 7, engine: "2.2L mHawk, 185 PS", mileage: "16.5 km/l", color: "Electric Blue", rates: [330, 4499, 26999, 89999], deposit: 10000, km: 300, extra: 15, hub: "HITEC City Hub", images: ["/cars/xuv700-1.jpg", "/cars/xuv700-2.jpg"], features: [...COMMON, "AdrenoX with Alexa", "Sony 3D sound", "Skyroof", "Level 2 ADAS"], description: "185 PS, seven seats and a cockpit straight from a luxury car. The XUV700 is equally at home on Srisailam ghats and Hyderabad's ORR." },
  { slug: "bmw-330li-m-sport", brand: "BMW", model: "3 Series Gran Limousine", variant: "330Li M Sport", reg: "KA51BM3300", year: 2023, category: "LUXURY", fuel: "PETROL", trans: "AUTOMATIC", seats: 5, engine: "2.0L TwinPower Turbo, 258 PS", mileage: "15.4 km/l", color: "Mineral Grey", rates: [850, 10999, 65999, 219999], deposit: 25000, km: 200, extra: 35, hub: "Indiranagar Hub", images: ["/cars/bmw3-1.jpg", "/cars/bmw3-2.jpg"], featured: true, features: ["M Sport package", "Harman Kardon surround", "Ambient lighting", "Gesture control", "Wireless charging", "Panoramic sunroof"], description: "The long-wheelbase 3 Series pairs a 258 PS turbo with chauffeur-grade rear legroom. Drive it yourself — that's rather the point." },
  { slug: "mercedes-c300d-amg-line", brand: "Mercedes-Benz", model: "C-Class", variant: "C 300d AMG Line", reg: "MH01MB0300", year: 2024, category: "LUXURY", fuel: "DIESEL", trans: "AUTOMATIC", seats: 5, engine: "2.0L OM654 + EQ Boost, 265 PS", mileage: "18.5 km/l", color: "Polar White", rates: [900, 11999, 71999, 239999], deposit: 25000, km: 200, extra: 38, hub: "Bandra Kurla Complex", images: ["/cars/cclass-1.jpg", "/cars/cclass-2.jpg"], featured: true, features: ["MBUX with 11.9\" portrait display", "Burmester 3D sound", "64-colour ambient lighting", "Augmented-reality navigation", "Panoramic sunroof", "Wireless charging"], description: "The 'baby S-Class' with mild-hybrid torque and a cabin that redefines its segment. Make the Marine Drive moment yours." },
  { slug: "mg-zs-ev-exclusive", brand: "MG", model: "ZS EV", variant: "Exclusive Pro", reg: "MH14MG4040", year: 2024, category: "ELECTRIC", fuel: "ELECTRIC", trans: "AUTOMATIC", seats: 5, engine: "50.3 kWh, 177 PS", mileage: "461 km (ARAI)", color: "Starry Black", rates: [240, 3299, 19999, 68999], deposit: 7500, km: 250, extra: 12, hub: "Koregaon Park Hub", images: ["/cars/zsev-1.jpg"], features: [...COMMON, "Panoramic sunroof", "Level 2 ADAS", "360° camera", "i-SMART connected tech"], description: "A full-size electric SUV with 461 km of range — Pune to Mahabaleshwar and back on one charge, in total silence." },
  { slug: "toyota-fortuner-legender", brand: "Toyota", model: "Fortuner", variant: "Legender 4×2 AT", reg: "DL3CF2025", year: 2023, category: "PREMIUM", fuel: "DIESEL", trans: "AUTOMATIC", seats: 7, engine: "2.8L GD, 204 PS", mileage: "14.4 km/l", color: "Attitude Black", rates: [480, 6499, 38999, 129999], deposit: 15000, km: 300, extra: 20, hub: "Aerocity Hub", images: ["/cars/fortuner-1.jpg", "/cars/fortuner-2.jpg"], features: [...COMMON, "Ventilated seats", "Wireless charging", "Kick-sensor power tailgate", "JBL 11-speaker audio"], description: "Commanding presence, bulletproof reliability and 500 Nm of torque. The Fortuner Legender is how you arrive at a Himalayan wedding." },
];

const FIRST = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Arjun", "Reyansh", "Ananya", "Diya", "Saanvi", "Ira", "Myra", "Kavya", "Meera", "Rohan", "Nikhil", "Sneha", "Pooja", "Karan", "Neha", "Siddharth", "Tanvi", "Varun", "Aisha", "Dev", "Riya", "Yash", "Zoya"];
const LAST = ["Sharma", "Iyer", "Reddy", "Nair", "Mehta", "Kapoor", "Gupta", "Rao", "Menon", "Joshi", "Shah", "Banerjee", "Kulkarni", "Pillai", "Desai", "Chopra", "Bhat", "Verma"];

const REVIEW_LINES: [number, string, string][] = [
  [5, "Spotless and smooth", "Car was spotless and the pickup took under 10 minutes. The fuel and odometer were recorded with photos — super transparent."],
  [5, "Perfect weekend getaway", "Took it to Coorg for the weekend. Drove beautifully on the ghats and support called to check in on day 2. Will book again."],
  [5, "Better than owning", "Honestly better maintained than my own car. Deposit came back in 3 days without me having to chase anyone."],
  [4, "Great car, minor delay", "Lovely car and fair price. Delivery was 15 minutes late but the team kept me updated throughout."],
  [5, "Airport pickup was seamless", "Landed, walked to the pickup zone and the car was waiting. Return at the airport was equally painless."],
  [4, "Solid experience", "Clean car, clear pricing breakdown before payment. Would love more EV options in my city."],
  [5, "Family trip sorted", "Seven of us, one road trip, zero complaints. Kids loved the sunroof. Booking took 3 minutes."],
  [3, "Okay overall", "Car was fine but the AC took a while to cool down in the afternoon heat. Support was responsive though."],
  [5, "Felt premium end to end", "From the app to the handover, everything felt premium. Easily the best self-drive rental I've used in India."],
  [4, "Would recommend", "Good value for a weekly rental — the weekly rate kicked in automatically which was a nice surprise."],
];

async function demoPdf(title: string, holder: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 260]);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: 0, width: 420, height: 260, color: rgb(0.96, 0.97, 0.98) });
  page.drawRectangle({ x: 0, y: 210, width: 420, height: 50, color: rgb(0.063, 0.094, 0.125) });
  page.drawText(title.toUpperCase(), { x: 20, y: 230, size: 14, font, color: rgb(0.776, 0.953, 0.42) });
  page.drawText(holder, { x: 20, y: 160, size: 18, font });
  page.drawText("SAMPLE DOCUMENT - DEMO DATA ONLY", { x: 20, y: 120, size: 11, font: reg, color: rgb(0.8, 0.2, 0.2) });
  page.drawText("Not a real identity document.", { x: 20, y: 100, size: 10, font: reg, color: rgb(0.4, 0.4, 0.4) });
  return Buffer.from(await pdf.save());
}

export async function seedDemoData(client: PrismaClient, log: (msg: string) => void = console.log) {
  db = client;
  seed = 20261031; // deterministic demo data on every run
  log("Clearing existing data…");
  // Order matters for FK constraints.
  await db.$transaction([
    db.vehicleInspection.deleteMany(), db.handoverRecord.deleteMany(), db.refund.deleteMany(), db.payment.deleteMany(),
    db.review.deleteMany(), db.loyaltyTransaction.deleteMany(), db.supportMessage.deleteMany(), db.supportTicket.deleteMany(),
    db.bookingPricing.deleteMany(), db.booking.deleteMany(), db.customerDocument.deleteMany(), db.storedFile.deleteMany(),
    db.wishlist.deleteMany(), db.notification.deleteMany(), db.adminActivityLog.deleteMany(), db.maintenanceRecord.deleteMany(),
    db.vehicleDocument.deleteMany(), db.pricingRule.deleteMany(), db.vehicleFeature.deleteMany(), db.vehicleImage.deleteMany(),
    db.vehicle.deleteMany(), db.vehicleLocation.deleteMany(), db.city.deleteMany(), db.coupon.deleteMany(), db.setting.deleteMany(),
    db.session.deleteMany(), db.verificationToken.deleteMany(), db.customerProfile.deleteMany(), db.adminProfile.deleteMany(),
    db.contactMessage.deleteMany(), db.newsletterSubscriber.deleteMany(), db.rateLimit.deleteMany(), db.user.deleteMany(),
  ]);

  await db.setting.create({ data: { key: "app", value: SETTINGS } });

  log("Cities & hubs…");
  const hubIds = new Map<string, string>();
  for (const c of CITIES) {
    const city = await db.city.create({ data: { name: c.name, slug: c.slug, state: c.state } });
    for (const h of c.hubs) {
      const loc = await db.vehicleLocation.create({ data: { cityId: city.id, name: h.name, address: h.address, latitude: h.lat, longitude: h.lng } });
      hubIds.set(h.name, loc.id);
    }
  }

  log("Users…");
  const [adminHash, staffHash, custHash] = await Promise.all([bcrypt.hash("Admin@12345", 12), bcrypt.hash("Staff@12345", 12), bcrypt.hash("Customer@123", 12)]);
  const admin = await db.user.create({
    data: { name: "Ananya Krishnan", email: "admin@mydrivez.in", phone: "+919000000001", passwordHash: adminHash, role: "ADMIN", referralCode: "ADMIN001", emailVerifiedAt: new Date(), isDemo: true, adminProfile: { create: { title: "Founder & CEO", permissions: [] } } },
  });
  await db.user.create({
    data: { name: "Rahul Fernandes", email: "ops@mydrivez.in", phone: "+919000000002", passwordHash: staffHash, role: "STAFF", referralCode: "STAFF001", emailVerifiedAt: new Date(), isDemo: true,
      adminProfile: { create: { title: "Fleet Operations Lead", permissions: ["dashboard:view", "bookings:write", "handover:write", "customers:write", "support:write", "fleet:write"] } } },
  });

  const priya = await db.user.create({
    data: { name: "Priya Sharma", email: "priya@example.com", phone: "+919876543210", passwordHash: custHash, referralCode: "PRIYA482", emailVerifiedAt: new Date(), isDemo: true, createdAt: new Date(NOW - 160 * DAY),
      customerProfile: { create: { dateOfBirth: new Date("1994-06-12"), addressLine1: "12, 5th Cross, HSR Layout Sector 2", city: "Bengaluru", state: "Karnataka", pincode: "560102", licenseNumber: "KA0120190012345", licenseExpiry: new Date("2039-06-11"), licenseState: "Karnataka", emergencyName: "Arjun Sharma", emergencyPhone: "+919876500000", segment: "loyal" } } },
  });
  const arjun = await db.user.create({
    data: { name: "Arjun Mehta", email: "arjun@example.com", phone: "+919811122233", passwordHash: custHash, referralCode: "ARJUN317", emailVerifiedAt: new Date(), isDemo: true, referredById: priya.id, createdAt: new Date(NOW - 20 * DAY),
      customerProfile: { create: { city: "Mumbai", state: "Maharashtra", segment: "new" } } },
  });

  const customers = [priya, arjun];
  for (let i = 0; i < 34; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}${i}@example.com`;
    customers.push(
      await db.user.create({
        data: { name, email, phone: `+9198${String(10000000 + i * 7919).slice(0, 8)}`, passwordHash: custHash, referralCode: `DEMO${1000 + i}`, emailVerifiedAt: new Date(), isDemo: true,
          createdAt: new Date(NOW - between(5, 180) * DAY), customerProfile: { create: { city: pick(CITIES).name, segment: pick(["new", "regular", "loyal", "corporate"]) } } },
      }),
    );
  }

  log("Documents…");
  const docPdf = await demoPdf("Driving licence", "Sample Holder");
  const idPdf = await demoPdf("Government ID", "Sample Holder");
  for (const [idx, c] of customers.entries()) {
    const status = c.id === arjun.id ? "PENDING" : idx % 9 === 4 ? "REJECTED" : idx % 7 === 3 ? "PENDING" : "VERIFIED";
    for (const [type, bytes] of [["DRIVING_LICENSE", docPdf], ["GOVERNMENT_ID", idPdf]] as const) {
      const file = await db.storedFile.create({ data: { ownerId: c.id, kind: "DOCUMENT", mimeType: "application/pdf", size: bytes.length, name: `${type.toLowerCase()}-sample.pdf`, data: bytes } });
      await db.customerDocument.create({
        data: { userId: c.id, type, fileId: file.id, documentNumber: type === "DRIVING_LICENSE" ? `KA01${2015 + (idx % 8)}00${String(10000 + idx * 37).slice(0, 5)}` : `XXXX-XXXX-${String(1000 + idx * 13).slice(0, 4)}`,
          status, rejectionReason: status === "REJECTED" ? "Image is blurry — please upload a clearer scan." : null,
          reviewedById: status === "PENDING" ? null : admin.id, reviewedAt: status === "PENDING" ? null : new Date(c.createdAt.getTime() + 3 * HOUR) },
      });
    }
  }

  log("Fleet…");
  const vehicles: Vehicle[] = [];
  for (const v of VEHICLES) {
    vehicles.push(
      await db.vehicle.create({
        data: {
          slug: v.slug, brand: v.brand, model: v.model, variant: v.variant, registrationNumber: v.reg, year: v.year, category: v.category, fuelType: v.fuel, transmission: v.trans,
          seats: v.seats, engine: v.engine, mileage: v.mileage, color: v.color, description: v.description, hourlyRate: v.rates[0], dailyRate: v.rates[1], weeklyRate: v.rates[2],
          monthlyRate: v.rates[3], securityDeposit: v.deposit, includedKmPerDay: v.km, extraKmCharge: v.extra, isFeatured: Boolean(v.featured), locationId: hubIds.get(v.hub)!, isDemo: true,
          fuelPolicy: v.fuel === "ELECTRIC" ? "Handed over with 80%+ charge; return with at least 50% or a ₹15/% recharge fee applies." : "Same-to-same: return with the fuel level you received.",
          images: { create: v.images.map((url, i) => ({ url, alt: `${v.brand} ${v.model}`, sortOrder: i })) },
          features: { create: [...new Set(v.features)].map((name) => ({ name })) },
          documents: { create: [
            { type: "INSURANCE", number: `POL/${v.reg}/26`, expiresAt: new Date(NOW + between(10, 300) * DAY) },
            { type: "PUC", number: `PUC${v.reg.slice(-4)}`, expiresAt: new Date(NOW + between(5, 170) * DAY) },
            { type: "REGISTRATION", number: v.reg, expiresAt: new Date(NOW + 3000 * DAY) },
          ] },
        },
      }),
    );
  }
  // One car in the workshop for realism.
  const workshop = vehicles.find((v) => v.slug === "hyundai-i20-asta")!;
  await db.vehicle.update({ where: { id: workshop.id }, data: { status: "MAINTENANCE" } });
  await db.maintenanceRecord.createMany({
    data: [
      { vehicleId: workshop.id, title: "Clutch plate replacement", description: "Slipping reported at 38,200 km.", status: "IN_PROGRESS", scheduledFor: new Date(NOW - DAY), cost: 14500, odometer: 38214 },
      { vehicleId: vehicles[4]!.id, title: "20,000 km periodic service", status: "SCHEDULED", scheduledFor: new Date(NOW + 9 * DAY), odometer: 19870 },
      { vehicleId: vehicles[11]!.id, title: "Brake pad replacement", status: "SCHEDULED", scheduledFor: new Date(NOW + 4 * DAY) },
      { vehicleId: vehicles[6]!.id, title: "Underbody wash & anti-rust", status: "COMPLETED", scheduledFor: new Date(NOW - 30 * DAY), completedAt: new Date(NOW - 29 * DAY), cost: 3200 },
      { vehicleId: vehicles[0]!.id, title: "10,000 km service", status: "COMPLETED", scheduledFor: new Date(NOW - 60 * DAY), completedAt: new Date(NOW - 60 * DAY), cost: 4800 },
    ],
  });

  log("Pricing rules & coupons…");
  const diwali = new Date("2026-11-07T00:00:00+05:30");
  const rules = await Promise.all([
    db.pricingRule.create({ data: { name: "Weekend pricing", type: "WEEKEND", adjustmentPct: 15, daysOfWeek: [0, 6] } }),
    db.pricingRule.create({ data: { name: "Diwali holiday pricing", type: "HOLIDAY", adjustmentPct: 25, daysOfWeek: [], startDate: diwali, endDate: new Date(diwali.getTime() + 4 * DAY) } }),
    db.pricingRule.create({ data: { name: "Year-end season", type: "SEASONAL", adjustmentPct: 20, daysOfWeek: [], startDate: new Date("2026-12-20T00:00:00+05:30"), endDate: new Date("2027-01-02T00:00:00+05:30") } }),
    db.pricingRule.create({ data: { name: "Monsoon EV saver", type: "SEASONAL", adjustmentPct: -10, daysOfWeek: [], category: "ELECTRIC", startDate: new Date("2026-06-15T00:00:00+05:30"), endDate: new Date("2026-09-15T00:00:00+05:30"), isActive: false } }),
  ]);
  const surge: SurgeRule[] = rules.map((r) => ({ ...r, category: r.category ?? null }));

  const coupons = await Promise.all([
    db.coupon.create({ data: { code: "FIRSTDRIVE", title: "First booking discount", description: "₹500 off your very first trip with MyDrivez.", discountType: "FIXED", value: 500, minBookingAmount: 1500, validFrom: new Date(NOW - 200 * DAY), validUntil: new Date(NOW + 365 * DAY), perUserLimit: 1, firstBookingOnly: true } }),
    db.coupon.create({ data: { code: "WEEKEND15", title: "Weekend deal", description: "15% off Friday–Sunday trips, up to ₹1,500.", discountType: "PERCENT", value: 15, maxDiscount: 1500, minBookingAmount: 2500, validFrom: new Date(NOW - 90 * DAY), validUntil: new Date(NOW + 90 * DAY), perUserLimit: 3 } }),
    db.coupon.create({ data: { code: "LONGDRIVE20", title: "Long-term rental discount", description: "20% off rentals of 7 days or more, up to ₹6,000.", discountType: "PERCENT", value: 20, maxDiscount: 6000, minBookingAmount: 15000, validFrom: new Date(NOW - 120 * DAY), validUntil: new Date(NOW + 180 * DAY), perUserLimit: 5 } }),
    db.coupon.create({ data: { code: "FESTIVE1000", title: "Festive season special", description: "Flat ₹1,000 off this festive season on trips above ₹6,000.", discountType: "FIXED", value: 1000, minBookingAmount: 6000, validFrom: new Date(NOW - 10 * DAY), validUntil: new Date(NOW + 45 * DAY), usageLimit: 500, perUserLimit: 1 } }),
    db.coupon.create({ data: { code: "CORP12", title: "Corporate partner rate", description: "Private code for corporate partners.", discountType: "PERCENT", value: 12, maxDiscount: 4000, validFrom: new Date(NOW - 60 * DAY), validUntil: new Date(NOW + 300 * DAY), perUserLimit: 20, isPublic: false } }),
  ]);

  log("Booking history…");
  const bookings: Prisma.BookingCreateManyInput[] = [];
  const pricings: Prisma.BookingPricingCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const refunds: Prisma.RefundCreateManyInput[] = [];
  const handovers: Prisma.HandoverRecordCreateManyInput[] = [];
  const reviews: Prisma.ReviewCreateManyInput[] = [];
  const loyalty: Prisma.LoyaltyTransactionCreateManyInput[] = [];
  const bookingByCustomer = new Map<string, { id: string; status: BookingStatus; vehicleId: string; code: string; startAt: Date }[]>();
  let codeN = 1000;

  const addBooking = (vehicle: (typeof vehicles)[number], customer: (typeof customers)[number], start: Date, end: Date, status: BookingStatus, opts: { doorstep?: boolean; coupon?: (typeof coupons)[number] } = {}) => {
    const id = randomUUID();
    const quote = computeQuote({ rate: vehicle, start, end, rules: surge, settings: SETTINGS, doorstep: Boolean(opts.doorstep), coupon: opts.coupon ?? null });
    const createdAt = new Date(Math.min(start.getTime() - between(1, 12) * DAY, NOW - HOUR));
    const code = `MDZ-D${(codeN++).toString(36).toUpperCase()}${between(10, 99)}`;
    bookings.push({
      id, code, userId: customer.id, vehicleId: vehicle.id, pickupLocationId: vehicle.locationId, startAt: start, endAt: end,
      blockedUntil: new Date(end.getTime() + SETTINGS.turnaroundMinutes * 60_000), status, deliveryType: opts.doorstep ? "DOORSTEP" : "SELF_PICKUP",
      deliveryAddress: opts.doorstep ? "Demo address, HSR Layout, Bengaluru" : null, couponId: quote.couponCode ? opts.coupon!.id : null, isDemo: true, createdAt,
      confirmedAt: ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(status) ? createdAt : null,
      actualPickupAt: ["ACTIVE", "COMPLETED"].includes(status) ? start : null,
      actualReturnAt: status === "COMPLETED" ? new Date(end.getTime() + between(-60, 50) * 60_000) : null,
      cancelledAt: status === "CANCELLED" || status === "REFUNDED" ? new Date(createdAt.getTime() + DAY) : null,
      cancelReason: status === "CANCELLED" || status === "REFUNDED" ? pick(["Change of plans", "Flight cancelled", "Found a ride with friends", "Trip postponed"]) : null,
      cancelledBy: status === "CANCELLED" || status === "REFUNDED" ? "customer" : null,
      holdExpiresAt: status === "AWAITING_PAYMENT" ? new Date(NOW + 12 * 60_000) : null,
    });
    const late = status === "COMPLETED" && rand() < 0.15 ? quote.lateFeePerHour * between(1, 3) : 0;
    const extraKm = status === "COMPLETED" && rand() < 0.25 ? between(20, 140) : 0;
    pricings.push({
      bookingId: id, durationHours: quote.durationHours, billedDays: quote.billedDays, billedHours: quote.billedHours, rateTier: quote.rateTier, baseAmount: quote.baseAmount,
      surgeAmount: quote.surgeAmount, deliveryFee: quote.deliveryFee, discountAmount: quote.discountAmount, couponCode: quote.couponCode, taxRate: quote.taxRate, taxAmount: quote.taxAmount,
      rentalTotal: quote.rentalTotal, securityDeposit: quote.securityDeposit, totalPayable: quote.totalPayable, includedKm: quote.includedKm, extraKmRate: quote.extraKmRate,
      lateFeePerHour: quote.lateFeePerHour, lateReturnCharges: late, extraKmCharges: extraKm * quote.extraKmRate, lineItems: quote.lineItems as unknown as Prisma.InputJsonValue,
    });
    if (status !== "AWAITING_PAYMENT") {
      const pid = randomUUID();
      const refundedFull = status === "REFUNDED";
      payments.push({
        id: pid, bookingId: id, userId: customer.id, provider: "DEMO", amount: quote.totalPayable, status: refundedFull ? "REFUNDED" : status === "COMPLETED" || status === "CANCELLED" ? "PARTIALLY_REFUNDED" : "CAPTURED",
        providerOrderId: `demo_order_${code}`, providerPaymentId: `demo_pay_${code}`, method: pick(["upi", "card", "netbanking", "upi", "upi"]), isTest: true, paidAt: createdAt, createdAt,
      });
      if (status === "COMPLETED") {
        const charges = late + extraKm * quote.extraKmRate;
        refunds.push({ bookingId: id, paymentId: pid, type: "DEPOSIT", amount: Math.max(0, quote.securityDeposit - charges), status: "PROCESSED", providerRefundId: `demo_rfnd_${code}_d`, reason: charges ? `Deposit less ₹${charges} trip charges` : "Full security deposit", processedAt: new Date(end.getTime() + 2 * DAY), createdAt: end });
        const odo = between(8000, 42000);
        const driven = quote.includedKm + extraKm - between(0, Math.floor(quote.includedKm * 0.6));
        handovers.push({ bookingId: id, type: "PICKUP", odometer: odo, fuelLevel: 100, customerConfirmed: true, customerSignature: customer.name, recordedById: admin.id, recordedAt: start, photoUrls: [] });
        handovers.push({ bookingId: id, type: "RETURN", odometer: odo + Math.max(driven, 40), fuelLevel: 100, customerConfirmed: true, customerSignature: customer.name, recordedById: admin.id, recordedAt: end, lateMinutes: late ? between(40, 170) : 0, extraKm, chargesAssessed: charges, photoUrls: [] });
        loyalty.push({ userId: customer.id, points: Math.floor(quote.rentalTotal / 100), reason: "Trip completed", bookingId: id, createdAt: end });
      }
      if (status === "CANCELLED" || status === "REFUNDED") {
        const amt = refundedFull ? quote.totalPayable : quote.securityDeposit + Math.round(quote.rentalTotal / 2);
        refunds.push({ bookingId: id, paymentId: pid, type: "CANCELLATION", amount: amt, status: "PROCESSED", providerRefundId: `demo_rfnd_${code}_c`, reason: refundedFull ? "Full refund — cancelled 24+ hours before pickup" : "50% refund — cancelled 6–24 hours before pickup", processedAt: new Date(createdAt.getTime() + 2 * DAY), createdAt: new Date(createdAt.getTime() + DAY) });
      }
      if (status === "ACTIVE") {
        handovers.push({ bookingId: id, type: "PICKUP", odometer: between(8000, 42000), fuelLevel: 100, customerConfirmed: true, customerSignature: customer.name, recordedById: admin.id, recordedAt: start, photoUrls: [] });
      }
    }
    const list = bookingByCustomer.get(customer.id) ?? [];
    list.push({ id, status, vehicleId: vehicle.id, code, startAt: start });
    bookingByCustomer.set(customer.id, list);
    return id;
  };

  const others = customers.filter((c) => c.id !== priya.id && c.id !== arjun.id);
  // Calendar cursor per vehicle so generated bookings never overlap.
  for (const v of vehicles) {
    let day = -between(170, 180);
    const isLux = v.category === "LUXURY";
    while (day < -3) {
      const len = between(1, rand() < 0.12 ? 9 : 4);
      const startDay = day + between(1, isLux ? 7 : 4);
      if (startDay + len >= -1) break;
      const start = istAt(startDay, pick([8, 9, 10, 11, 14, 18]));
      const end = new Date(start.getTime() + len * DAY + pick([0, 0, 2, 4]) * HOUR);
      const r = rand();
      const status: BookingStatus = r < 0.07 ? "CANCELLED" : r < 0.1 ? "REFUNDED" : "COMPLETED";
      const coupon = rand() < 0.18 ? pick([coupons[1]!, coupons[2]!, coupons[3]!]) : undefined;
      addBooking(v, pick(others), start, end, status, { coupon, doorstep: rand() < 0.2 });
      day = startDay + len + 1;
    }
  }

  // Present & near future.
  const byslug = (s: string) => vehicles.find((v) => v.slug === s)!;
  addBooking(byslug("hyundai-creta-sxo"), pick(others), istAt(-1, 9), istAt(2, 9), "ACTIVE");
  addBooking(byslug("mahindra-thar-lx-4x4"), pick(others), istAt(-2, 10), istAt(1, 18), "ACTIVE", { doorstep: true });
  addBooking(byslug("mercedes-c300d-amg-line"), pick(others), istAt(-3, 11), istAt(0, 8), "ACTIVE"); // due back today — late return demo
  addBooking(byslug("toyota-fortuner-legender"), pick(others), istAt(1, 9), istAt(4, 9), "CONFIRMED");
  addBooking(byslug("bmw-330li-m-sport"), pick(others), istAt(3, 10), istAt(5, 20), "CONFIRMED");
  addBooking(byslug("kia-seltos-gtx-plus"), pick(others), istAt(6, 8), istAt(9, 8), "CONFIRMED");
  addBooking(byslug("toyota-innova-hycross-zx"), pick(others), istAt(2, 7), istAt(9, 7), "CONFIRMED", { coupon: coupons[2] });
  addBooking(byslug("mg-zs-ev-exclusive"), pick(others), istAt(5, 9), istAt(7, 9), "PAYMENT_COMPLETED");

  // Priya — the hero demo customer.
  const priyaCars = ["maruti-swift-zxi-amt", "tata-nexon-ev-empowered", "honda-city-zx-cvt"].map(byslug);
  // Use dates far enough apart from generated history by placing them in fresh windows (overlaps are checked below).
  addBooking(byslug("bmw-330li-m-sport"), priya, istAt(10, 9), istAt(12, 21), "CONFIRMED", { doorstep: true });
  addBooking(byslug("tata-nexon-ev-empowered"), priya, istAt(-1, 10), istAt(1, 10), "ACTIVE");
  for (const [i, v] of priyaCars.entries()) {
    addBooking(v, priya, istAt(-178 + i * 40, 9), istAt(-176 + i * 40, 9), "COMPLETED");
  }
  addBooking(byslug("mahindra-xuv700-ax7l"), priya, istAt(-182, 8), istAt(-181, 8), "CANCELLED");
  // Arjun — referred new customer with a booking awaiting confirmation.
  addBooking(byslug("tata-nexon-creative-plus"), arjun, istAt(4, 10), istAt(6, 10), "PAYMENT_COMPLETED", { coupon: coupons[0] });

  // Drop any generated booking that would overlap a hand-placed one (keeps the exclusion constraint happy).
  const keep = new Set<string>();
  const byVehicle = new Map<string, Prisma.BookingCreateManyInput[]>();
  for (const b of bookings) byVehicle.set(b.vehicleId, [...(byVehicle.get(b.vehicleId) ?? []), b]);
  for (const list of byVehicle.values()) {
    // Hand-placed (later in the array) win: walk from the end.
    const accepted: Prisma.BookingCreateManyInput[] = [];
    for (const b of [...list].reverse()) {
      const s = new Date(b.startAt).getTime();
      const e = new Date(b.blockedUntil).getTime();
      const clash = accepted.some((a) => s < new Date(a.blockedUntil).getTime() && new Date(a.startAt).getTime() < e);
      if (!clash) {
        accepted.push(b);
        keep.add(b.id!);
      }
    }
  }
  const fb = <T extends { bookingId: string }>(rows: T[]) => rows.filter((r) => keep.has(r.bookingId));

  await db.booking.createMany({ data: bookings.filter((b) => keep.has(b.id!)) });
  await db.bookingPricing.createMany({ data: fb(pricings) });
  await db.payment.createMany({ data: fb(payments) });
  await db.refund.createMany({ data: fb(refunds) });
  await db.handoverRecord.createMany({ data: fb(handovers) });
  await db.loyaltyTransaction.createMany({ data: loyalty.filter((l) => keep.has(l.bookingId!)) });

  for (const v of ["hyundai-creta-sxo", "mahindra-thar-lx-4x4", "mercedes-c300d-amg-line", "tata-nexon-ev-empowered"]) {
    await db.vehicle.update({ where: { id: byslug(v).id }, data: { status: "RENTED" } });
  }

  log("Reviews…");
  const completed = await db.booking.findMany({ where: { status: "COMPLETED" }, select: { id: true, userId: true, vehicleId: true, endAt: true } });
  for (const b of completed) {
    if (rand() < 0.62) {
      const [rating, title, comment] = pick(REVIEW_LINES);
      reviews.push({ bookingId: b.id, userId: b.userId, vehicleId: b.vehicleId, rating, title, comment, status: rand() < 0.93 ? "APPROVED" : "PENDING", isDemo: true, createdAt: new Date(b.endAt.getTime() + DAY), photoUrls: [] });
    }
  }
  await db.review.createMany({ data: reviews });
  for (const v of vehicles) {
    const agg = await db.review.aggregate({ where: { vehicleId: v.id, status: "APPROVED" }, _avg: { rating: true }, _count: true });
    const trips = await db.booking.count({ where: { vehicleId: v.id, status: "COMPLETED" } });
    await db.vehicle.update({ where: { id: v.id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count, tripCount: trips } });
  }

  log("Loyalty totals, wishlist, tickets, notifications…");
  const pts = await db.loyaltyTransaction.groupBy({ by: ["userId"], _sum: { points: true } });
  for (const p of pts) await db.user.update({ where: { id: p.userId }, data: { loyaltyPoints: p._sum.points ?? 0 } });

  await db.wishlist.createMany({ data: ["mercedes-c300d-amg-line", "mahindra-thar-lx-4x4", "toyota-innova-hycross-zx"].map((s) => ({ userId: priya.id, vehicleId: byslug(s).id })) });

  const priyaBooking = (await db.booking.findFirst({ where: { userId: priya.id, status: "CONFIRMED" } }))!;
  const t1 = await db.supportTicket.create({
    data: { code: "TKT-D1042", userId: priya.id, subject: "Can I add a second driver for my BMW trip?", category: "BOOKING", priority: "MEDIUM", status: "AWAITING_CUSTOMER", bookingId: priyaBooking.id, assignedToId: admin.id, createdAt: new Date(NOW - 2 * DAY) },
  });
  await db.supportMessage.createMany({
    data: [
      { ticketId: t1.id, authorId: priya.id, body: "Hi! My husband will share the driving on our Mysuru trip. Can I add him as a second driver?", createdAt: new Date(NOW - 2 * DAY) },
      { ticketId: t1.id, authorId: admin.id, isStaff: true, body: "Absolutely, Priya. Please ask him to create a MyDrivez account and upload his licence — we'll link him to booking " + priyaBooking.code + " once verified. No extra charge.", createdAt: new Date(NOW - 2 * DAY + 3 * HOUR) },
    ],
  });
  const t2 = await db.supportTicket.create({ data: { code: "TKT-D1043", userId: arjun.id, subject: "When will my booking be confirmed?", category: "BOOKING", priority: "HIGH", status: "OPEN", createdAt: new Date(NOW - 5 * HOUR) } });
  await db.supportMessage.create({ data: { ticketId: t2.id, authorId: arjun.id, body: "I paid for the Nexon an hour ago but the status still says payment completed. Is something wrong?", createdAt: new Date(NOW - 5 * HOUR) } });
  const t3 = await db.supportTicket.create({ data: { code: "TKT-D1044", userId: others[3]!.id, subject: "Deposit refund not received", category: "PAYMENT", priority: "URGENT", status: "IN_PROGRESS", assignedToId: admin.id, createdAt: new Date(NOW - DAY) } });
  await db.supportMessage.create({ data: { ticketId: t3.id, authorId: others[3]!.id, body: "It's been 8 days since I returned the car and the deposit hasn't reached my account yet.", createdAt: new Date(NOW - DAY) } });

  await db.notification.createMany({
    data: [
      { userId: priya.id, type: "BOOKING_CONFIRMED", title: "Booking confirmed 🎉", body: `Your BMW 3 Series Gran Limousine is reserved. Booking ${priyaBooking.code}.`, link: `/dashboard/bookings/${priyaBooking.id}`, createdAt: new Date(NOW - 3 * DAY) },
      { userId: priya.id, type: "SUPPORT_REPLY", title: "New reply on your ticket", body: "Our team replied to “Can I add a second driver for my BMW trip?”", link: `/dashboard/support/${t1.id}`, createdAt: new Date(NOW - 2 * DAY + 3 * HOUR) },
      { userId: priya.id, type: "OFFER", title: "Festive offer unlocked", body: "Use FESTIVE1000 for flat ₹1,000 off trips above ₹6,000 this season.", link: "/dashboard/offers", createdAt: new Date(NOW - 6 * HOUR) },
      { userId: priya.id, type: "RETURN_REMINDER", title: "Return due tomorrow", body: "Your Tata Nexon EV is due back at Indiranagar Hub tomorrow at 10:00 AM.", link: "/dashboard/bookings?tab=active", createdAt: new Date(NOW - HOUR) },
      { userId: arjun.id, type: "WELCOME", title: "Welcome to MyDrivez 👋", body: "Your account is ready. Upload your licence to book faster.", link: "/dashboard/documents", createdAt: new Date(NOW - 20 * DAY) },
      { userId: arjun.id, type: "BOOKING_UNDER_REVIEW", title: "Booking under review", body: "Your booking is paid. We'll confirm it once your documents are verified.", link: "/dashboard/bookings", createdAt: new Date(NOW - 6 * HOUR) },
      { userId: admin.id, type: "NEW_BOOKING", title: "New booking needs review", body: "Arjun Mehta booked Tata Nexon — documents pending verification.", link: "/admin/bookings?status=PAYMENT_COMPLETED", createdAt: new Date(NOW - 6 * HOUR) },
      { userId: admin.id, type: "DOCUMENT_UPLOADED", title: "Documents awaiting verification", body: "Arjun Mehta uploaded a driving licence and government ID.", link: "/admin/verifications", createdAt: new Date(NOW - 7 * HOUR) },
      { userId: admin.id, type: "MAINTENANCE_ALERT", title: "Maintenance due", body: "BMW 330Li brake pad replacement scheduled in 4 days.", link: "/admin/maintenance", createdAt: new Date(NOW - 10 * HOUR) },
      { userId: admin.id, type: "RETURN_DUE", title: "Vehicle return overdue", body: "Mercedes-Benz C-Class was due back at 8:00 AM today.", link: "/admin/handovers", createdAt: new Date(NOW - 2 * HOUR) },
    ],
  });

  await db.contactMessage.createMany({
    data: [
      { name: "Vikram Joshi", email: "vikram@acme-corp.example", phone: "+919820011223", subject: "Corporate fleet partnership", message: "We'd like 12 sedans on a monthly plan for our Pune office. Can someone from sales reach out?" },
      { name: "Shreya Nair", email: "shreya.n@example.com", subject: "Do you allow Goa to Gokarna trips?", message: "Planning a road trip from Goa to Gokarna in December. Are inter-state trips allowed from the Goa hub?" },
    ],
  });

  await db.adminActivityLog.createMany({
    data: [
      { actorId: admin.id, action: "coupon.create", entityType: "Coupon", entityId: coupons[3]!.id, summary: "Created coupon FESTIVE1000", createdAt: new Date(NOW - 10 * DAY) },
      { actorId: admin.id, action: "vehicle.status", entityType: "Vehicle", entityId: workshop.id, summary: "Marked Hyundai i20 as under maintenance", createdAt: new Date(NOW - DAY) },
      { actorId: admin.id, action: "pricing.rule", entityType: "PricingRule", entityId: rules[1]!.id, summary: "Created Diwali holiday pricing (+25%)", createdAt: new Date(NOW - 14 * DAY) },
    ],
  });

  const counts = { users: await db.user.count(), vehicles: await db.vehicle.count(), bookings: await db.booking.count(), reviews: await db.review.count(), payments: await db.payment.count() };
  log(`✔ Seed complete ${JSON.stringify(counts)}`);
  return counts;
}

