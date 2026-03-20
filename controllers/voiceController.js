const pool = require("../config/db")

/* ─────────────────────────────────────────────
   TIME PARSING
───────────────────────────────────────────── */
const WORD_NUMBERS = {
  zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7,
  eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13,
  fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18,
  nineteen:19, twenty:20, thirty:30, forty:40, fifty:50,
}

function wordToNumber(word) {
  return WORD_NUMBERS[word?.toLowerCase()] ?? null
}

/**
 * FIX: normalise the raw transcript before any regex runs.
 *
 * Speech recognition returns many meridiem variants:
 *   "p.m."  "P.M."  "p. m."  → pm
 *   "a.m."  "A.M."  "a. m."  → am
 *   "in the morning"          → am
 *   "in the afternoon/evening/night" → pm
 *
 * Without this, every pattern that checks (am|pm) fails silently
 * and the fallback word-number path returns the wrong hour.
 */
function normaliseMeridiem(text) {
  return text
    .toLowerCase()
    .replace(/p\.?\s*m\.?/g, "pm")
    .replace(/a\.?\s*m\.?/g, "am")
    .replace(/\bin the morning\b/g, "am")
    .replace(/\bin the afternoon\b|\bin the evening\b|\bat night\b|\btonight\b/g, "pm")
    .replace(/\bo'?clock\b/g, "")   // "5 o'clock" → "5"
}

function parseTime(text) {
  const t = normaliseMeridiem(text.trim())

  if (/\bnoon\b|\bmidday\b/.test(t)) return "12:00"
  if (/\bmidnight\b/.test(t))        return "00:00"

  // "half past X" → X:30
  const halfPast = t.match(/half\s+past\s+(\w+)/)
  if (halfPast) {
    const raw = halfPast[1]
    const h = isNaN(parseInt(raw)) ? wordToNumber(raw) : parseInt(raw)
    if (h != null) return `${String(h % 12 || 12).padStart(2, "0")}:30`
  }

  // "quarter past X" → X:15
  const qPast = t.match(/quarter\s+past\s+(\w+)/)
  if (qPast) {
    const raw = qPast[1]
    const h = isNaN(parseInt(raw)) ? wordToNumber(raw) : parseInt(raw)
    if (h != null) return `${String(h % 12 || 12).padStart(2, "0")}:15`
  }

  // "quarter to X" → (X-1):45
  const qTo = t.match(/quarter\s+to\s+(\w+)/)
  if (qTo) {
    const raw = qTo[1]
    const hRaw = isNaN(parseInt(raw)) ? wordToNumber(raw) : parseInt(raw)
    const h = hRaw - 1
    if (h != null && h >= 0) return `${String(h % 12 || 12).padStart(2, "0")}:45`
  }

  // "HH:MM am/pm" or "HH:MM" (24-hr)
  const colonFmt = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/)
  if (colonFmt) {
    let h = parseInt(colonFmt[1])
    const m = colonFmt[2]
    const meridiem = colonFmt[3]
    if (meridiem === "pm" && h !== 12) h += 12
    if (meridiem === "am" && h === 12) h = 0
    return `${String(h).padStart(2, "0")}:${m}`
  }

  // "5 pm" / "5 am" / "at 5 pm" / "at 5"
  const simpleFmt = t.match(/\bat\s+(\d{1,2})\s*(am|pm)?|\b(\d{1,2})\s*(am|pm)\b/)
  if (simpleFmt) {
    let h = parseInt(simpleFmt[1] ?? simpleFmt[3])
    const meridiem = (simpleFmt[2] ?? simpleFmt[4] ?? "").toLowerCase()
    if (meridiem === "pm" && h !== 12) h += 12
    if (meridiem === "am" && h === 12) h = 0
    return `${String(h).padStart(2, "0")}:00`
  }

  // word numbers with meridiem: "five pm", "six thirty am"
  // run AFTER normaliseMeridiem so "p.m." is already "pm"
  const wordMeridiem = t.match(/\b(am|pm)\b/)
  const parts = t.replace(/\b(am|pm)\b/, "").trim().split(/\s+/)
  const nums  = parts.map(wordToNumber).filter(n => n !== null)

  if (nums.length >= 1) {
    let h = nums[0]
    const m = nums[1] ?? 0
    const meridiem = wordMeridiem?.[1] ?? ""
    if (meridiem === "pm" && h !== 12) h += 12
    if (meridiem === "am" && h === 12) h = 0
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }

  return null
}

/* ─────────────────────────────────────────────
   DATE PARSING
───────────────────────────────────────────── */
const DAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]
const MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
}

function localDateStr(d) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function parseDate(text) {
  const t   = text.toLowerCase()
  const now = new Date()

  if (/\btoday\b/.test(t)) return localDateStr(now)

  if (/\btomorrow\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate() + 1)
    return localDateStr(d)
  }

  if (/\bday after tomorrow\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate() + 2)
    return localDateStr(d)
  }

  // "next Monday" / "on Friday" / "this Friday"
  for (let i = 0; i < DAYS.length; i++) {
    if (t.includes(DAYS[i])) {
      const isNext = t.includes("next")
      const target = new Date(now)
      const diff   = (i - now.getDay() + 7) % 7 || 7
      target.setDate(now.getDate() + (isNext ? diff + 7 : diff))
      return localDateStr(target)
    }
  }

  // Specific date: "20th", "the 20th", "March 20", "20 March", "20th March"
  let day   = null
  let month = now.getMonth() + 1

  const dayMatch = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/)
  if (dayMatch) day = parseInt(dayMatch[1])

  for (const [name, num] of Object.entries(MONTHS)) {
    if (t.includes(name)) { month = num; break }
  }

  if (day && day >= 1 && day <= 31) {
    const year      = now.getFullYear()
    const candidate = new Date(year, month - 1, day)
    if (candidate < now && candidate.getDate() === day) {
      candidate.setFullYear(year + 1)
    }
    if (candidate.getDate() === day) return localDateStr(candidate)
  }

  return localDateStr(now)
}

/* ─────────────────────────────────────────────
   INTENT DETECTION
───────────────────────────────────────────── */
function detectIntent(text) {
  const t = text.toLowerCase()

  const patterns = {
    cancel:     [/\bcancel\b/, /\bremove\b/, /\bdelete my appointment\b/, /\bcall off\b/, /\bcancel my booking\b/],
    reschedule: [/\breschedule\b/, /\bchange.+appointment\b/, /\bmove.+appointment\b/, /\bshift.+appointment\b/, /\bchange.+time\b/, /\bchange.+date\b/],
    available:  [/\bwhat slots\b/, /\bshow slots\b/, /\bavailable slots\b/, /\bwhat.*available\b/, /\bany slots\b/, /\bopen slots\b/, /\bfree slots\b/, /\bcheck.*slot\b/],
    next:       [/\bmy next appointment\b/, /\bnext appointment\b/, /\bupcoming appointment\b/, /\bwhen.*appointment\b/],
    list:       [/\bmy appointment\b/, /\bshow.+appointment\b/, /\bcheck.+appointment\b/, /\bwhat.+appointment\b/, /\ball appointment\b/, /\blist appointment\b/],
    book:       [/\bbook\b/, /\bschedule\b/, /\bneed a slot\b/, /\bget a slot\b/, /\bmake.+appointment\b/, /\bset.+appointment\b/, /\bfix.+appointment\b/, /\bbooking\b/],
    help:       [/\bhelp\b/, /\bwhat can you do\b/, /\bcommands\b/, /\bwhat.*say\b/, /\bhow.*use\b/],
  }

  for (const [intent, rules] of Object.entries(patterns)) {
    if (rules.some(r => r.test(t))) return intent
  }
  return "unknown"
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function friendlyTime(timeStr) {
  return new Date(`1970-01-01T${timeStr}`)
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
}

function friendlyDate(dateStr) {
  return new Date(`${String(dateStr).slice(0, 10)}T00:00:00`)
    .toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
}

/* ─────────────────────────────────────────────
   CONTROLLER
───────────────────────────────────────────── */
exports.processVoice = async (req, res) => {
  const client = await pool.connect()

  try {
    const { text } = req.body
    if (!text?.trim()) {
      return res.status(400).json({ message: "No voice text provided." })
    }

    const user_id = req.user.id
    const intent  = detectIntent(text)
    console.log(`[voice] text="${text}" intent=${intent} time=${parseTime(text)} date=${parseDate(text)}`)

    /* ── HELP ── */
    if (intent === "help") {
      return res.json({
        message:
          "Here's what you can say: " +
          '"Book an appointment tomorrow at 5 PM" · ' +
          '"Book on the 20th at 10 AM" · ' +
          '"Book on Friday at 3 PM" · ' +
          '"Cancel my appointment" · ' +
          '"Reschedule to Monday at 2 PM" · ' +
          '"What slots are available today?" · ' +
          '"Show my appointments" · ' +
          '"When is my next appointment?"',
      })
    }

    /* ── AVAILABLE SLOTS ── */
    if (intent === "available") {
      const dateStr = parseDate(text)

      const slots = await client.query(
        `SELECT * FROM slots WHERE date = $1 AND is_booked = FALSE ORDER BY time ASC`,
        [dateStr]
      )

      if (!slots.rows.length) {
        const suggestions = await client.query(
          `SELECT date, time FROM slots
           WHERE date >= $1 AND is_booked = FALSE
           ORDER BY date ASC, time ASC LIMIT 3`,
          [dateStr]
        )
        if (!suggestions.rows.length) {
          return res.json({ message: `No available slots on ${friendlyDate(dateStr)} or coming days.` })
        }
        const lines = suggestions.rows.map(r => `${friendlyDate(r.date)} at ${friendlyTime(r.time)}`)
        return res.json({
          message: `No slots on ${friendlyDate(dateStr)}, but these are available: ${lines.join(" · ")}.`,
        })
      }

      const timeList = slots.rows.map(r => friendlyTime(r.time)).join(", ")
      return res.json({
        message: `Available on ${friendlyDate(dateStr)}: ${timeList}.`,
        slots: slots.rows,
      })
    }

    /* ── NEXT APPOINTMENT ── */
    if (intent === "next") {
      const appt = await client.query(
        `SELECT a.*, s.date, s.time FROM appointments a
         JOIN slots s ON s.id = a.slot_id
         WHERE a.user_id = $1 AND a.status = 'booked'
           AND s.date >= $2
         ORDER BY s.date ASC, s.time ASC LIMIT 1`,
        [user_id, localDateStr(new Date())]
      )
      if (!appt.rows.length) {
        return res.json({ message: "You have no upcoming appointments. Say 'book an appointment' to schedule one." })
      }
      const r = appt.rows[0]
      return res.json({
        message: `Your next appointment is on ${friendlyDate(r.date)} at ${friendlyTime(r.time)}.`,
      })
    }

    /* ── LIST ── */
    if (intent === "list") {
      const appts = await client.query(
        `SELECT a.*, s.date, s.time FROM appointments a
         JOIN slots s ON s.id = a.slot_id
         WHERE a.user_id = $1 AND a.status = 'booked'
         ORDER BY s.date ASC, s.time ASC LIMIT 5`,
        [user_id]
      )
      if (!appts.rows.length) {
        return res.json({ message: "You have no upcoming appointments. Say 'book an appointment' to schedule one." })
      }
      const lines = appts.rows.map(r => `${friendlyDate(r.date)} at ${friendlyTime(r.time)}`)
      return res.json({ message: `Your appointments: ${lines.join(" · ")}.` })
    }

    /* ── CANCEL ── */
    if (intent === "cancel") {
      await client.query("BEGIN")

      const appt = await client.query(
        `SELECT a.*, s.date, s.time FROM appointments a
         JOIN slots s ON s.id = a.slot_id
         WHERE a.user_id = $1 AND a.status = 'booked'
         ORDER BY s.date ASC, s.time ASC LIMIT 1 FOR UPDATE`,
        [user_id]
      )

      if (!appt.rows.length) {
        await client.query("ROLLBACK")
        return res.json({ message: "You have no active appointments to cancel." })
      }

      const r = appt.rows[0]
      await client.query("UPDATE appointments SET status = 'cancelled' WHERE id = $1", [r.id])
      await client.query("UPDATE slots SET is_booked = FALSE WHERE id = $1", [r.slot_id])
      await client.query("COMMIT")

      return res.json({
        message: `Your appointment on ${friendlyDate(r.date)} at ${friendlyTime(r.time)} has been cancelled.`,
      })
    }

    /* ── RESCHEDULE ── */
    if (intent === "reschedule") {
      const newTimeStr = parseTime(text)
      const newDateStr = parseDate(text)

      if (!newTimeStr) {
        return res.json({
          message: "Please say the new time. For example: 'Reschedule to Friday at 3 PM'.",
        })
      }

      await client.query("BEGIN")

      const appt = await client.query(
        `SELECT * FROM appointments
         WHERE user_id = $1 AND status = 'booked'
         ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
        [user_id]
      )

      if (!appt.rows.length) {
        await client.query("ROLLBACK")
        return res.json({ message: "You have no active appointments to reschedule." })
      }

      const newSlot = await client.query(
        `SELECT * FROM slots
         WHERE date = $1 AND time::time = $2::time AND is_booked = FALSE
         ORDER BY time ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [newDateStr, newTimeStr]
      )

      if (!newSlot.rows.length) {
        await client.query("ROLLBACK")
        return res.json({
          message: `No available slot on ${friendlyDate(newDateStr)} at ${friendlyTime(newTimeStr + ":00")}. Try a different time.`,
        })
      }

      await client.query("UPDATE slots SET is_booked = FALSE WHERE id = $1", [appt.rows[0].slot_id])
      await client.query("UPDATE slots SET is_booked = TRUE  WHERE id = $1", [newSlot.rows[0].id])
      await client.query(
        "UPDATE appointments SET slot_id = $1, status = 'booked' WHERE id = $2",
        [newSlot.rows[0].id, appt.rows[0].id]
      )
      await client.query("COMMIT")

      return res.json({
        message: `Rescheduled to ${friendlyDate(newDateStr)} at ${friendlyTime(newSlot.rows[0].time)}.`,
      })
    }

    /* ── BOOK ── */
    if (intent === "book") {
      const timeStr = parseTime(text)
      const dateStr = parseDate(text)

      if (!timeStr) {
        return res.json({
          message: "I couldn't catch the time. Try: 'Book tomorrow at 5 PM' or 'Book on the 20th at 10 AM'.",
        })
      }

      await client.query("BEGIN")

      const slot = await client.query(
        `SELECT * FROM slots
         WHERE date = $1 AND time::time = $2::time AND is_booked = FALSE
         ORDER BY time ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [dateStr, timeStr]
      )

      if (!slot.rows.length) {
        await client.query("ROLLBACK")

        // Suggest nearby available slots
        const nearby = await client.query(
          `SELECT date, time FROM slots
           WHERE is_booked = FALSE
             AND (date > $1 OR (date = $1 AND time::time > $2::time))
           ORDER BY date ASC, time ASC LIMIT 3`,
          [dateStr, timeStr]
        )

        if (nearby.rows.length) {
          const suggestions = nearby.rows
            .map(r => `${friendlyDate(r.date)} at ${friendlyTime(r.time)}`)
            .join(" · ")
          return res.json({
            message: `No slot on ${friendlyDate(dateStr)} at ${friendlyTime(timeStr + ":00")}. `
              + `Nearest available: ${suggestions}.`,
          })
        }

        return res.json({
          message: `No available slot on ${friendlyDate(dateStr)} at ${friendlyTime(timeStr + ":00")}. `
            + `Say "what slots are available" to see open times.`,
        })
      }

      const appointment = await client.query(
        `INSERT INTO appointments (user_id, slot_id, status) VALUES ($1, $2, 'booked') RETURNING *`,
        [user_id, slot.rows[0].id]
      )
      await client.query("UPDATE slots SET is_booked = TRUE WHERE id = $1", [slot.rows[0].id])
      await client.query("COMMIT")

      return res.json({
        message: `Appointment booked for ${friendlyDate(slot.rows[0].date)} at ${friendlyTime(slot.rows[0].time)}.`,
        appointment: appointment.rows[0],
      })
    }

    /* ── UNKNOWN ── */
    return res.json({
      message: "I didn't understand that. Say 'help' to hear what commands are available.",
    })

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("[voiceController]", err)
    res.status(500).json({ message: "Something went wrong. Please try again." })
  } finally {
    client.release()
  }
}