import "dotenv/config";
import { defineConfig } from "prisma/config";

// 🔴 CRITICAL: Explicitly pass your local .env values to the process environment 
// so that Prisma's internal validation engine can see them during schema parsing.
if (process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] = process.env["DATABASE_URL"];
}
if (process.env["DIRECT_URL"]) {
  process.env["DIRECT_URL"] = process.env["DIRECT_URL"];
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // The CLI should always use the direct connection string for schema migrations
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "",
  },
});
