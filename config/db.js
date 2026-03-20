const { Pool, types } = require("pg")
require("dotenv").config()

/*
 * ROOT FIX for the "date is one day off" bug:
 *
 * By default, the pg driver converts PostgreSQL `date` columns into
 * JavaScript Date objects using UTC midnight. In India (UTC+5:30),
 * "2026-03-20" becomes new Date("2026-03-20") = "2026-03-19T18:30:00.000Z".
 * When Express serializes this to JSON, it sends "2026-03-19T18:30:00.000Z",
 * and every date in the frontend/voice controller is one day behind.
 *
 * Fix: tell pg to return date (OID 1082) and time (OID 1083) columns
 * as plain strings instead of converting them to Date objects.
 * This means slot.date is always "2026-03-20" — never a Date object.
 */
types.setTypeParser(1082, val => val)   // date  → "YYYY-MM-DD"
types.setTypeParser(1083, val => val)   // time  → "HH:MM:SS"
types.setTypeParser(1114, val => val)   // timestamp (no tz) → string
types.setTypeParser(1184, val => val)   // timestamptz → string

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // required for Neon
})

module.exports = pool