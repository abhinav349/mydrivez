/* eslint-disable no-console */
// `npm run db:seed` — wipes and reloads demo data into the database at DATABASE_URL.
import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "./demo-data";

const db = new PrismaClient();

seedDemoData(db)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
