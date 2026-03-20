const pool = require("../config/db")

exports.getSlots = async (req, res) => {
  const slots = await pool.query(
    "SELECT * FROM slots WHERE is_booked = FALSE ORDER BY date, time"
  )
  res.json(slots.rows)
}

exports.bookAppointment = async (req, res) => {
  const client = await pool.connect()

  try {
    const { slot_id } = req.body
    const user_id = req.user.id

    await client.query("BEGIN")

    const slot = await client.query(
      "SELECT * FROM slots WHERE id=$1 FOR UPDATE",
      [slot_id]
    )

    if (!slot.rows.length) throw new Error("Slot not found")
    if (slot.rows[0].is_booked) throw new Error("Already booked")

    await client.query(
      "UPDATE slots SET is_booked=TRUE WHERE id=$1",
      [slot_id]
    )

    const appointment = await client.query(
      "INSERT INTO appointments(user_id, slot_id, status) VALUES($1,$2,'booked') RETURNING *",
      [user_id, slot_id]
    )

    await client.query("COMMIT")

    res.json(appointment.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    res.status(400).json({ message: error.message })
  } finally {
    client.release()
  }
}

exports.getMyAppointments = async (req, res) => {
  const data = await pool.query(
    `SELECT 
      appointments.id,
      appointments.status,
      slots.time,
      slots.date
     FROM appointments
     JOIN slots ON appointments.slot_id = slots.id
     WHERE appointments.user_id=$1`,
    [req.user.id]
  )

  res.json(data.rows)
}

exports.cancelAppointment = async (req, res) => {
  const client = await pool.connect()

  try {
    const { id } = req.params
    const user_id = req.user.id

    const appt = await pool.query(
      "SELECT * FROM appointments WHERE id=$1 AND user_id=$2",
      [id, user_id]
    )

    if (!appt.rows.length) {
      return res.status(404).json({ message: "Appointment not found" })
    }

    if (appt.rows[0].status === "cancelled") {
      return res.json({ message: "Already cancelled" })
    }

    // FIX: wrap in transaction, only update status & free the slot — never delete either record
    await client.query("BEGIN")

    await client.query(
      "UPDATE appointments SET status='cancelled' WHERE id=$1",
      [id]
    )

    await client.query(
      "UPDATE slots SET is_booked=FALSE WHERE id=$1",
      [appt.rows[0].slot_id]
    )

    await client.query("COMMIT")

    res.json({ message: "Cancelled successfully" })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    res.status(500).json({ message: error.message })
  } finally {
    client.release()
  }
}

exports.reschedule = async (req, res) => {
  const { id } = req.params
  const { new_slot_id } = req.body
  const user_id = req.user.id

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const appt = await client.query(
      "SELECT * FROM appointments WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [id, user_id]
    )

    if (!appt.rows.length) throw new Error("Appointment not found")

    const newSlot = await client.query(
      "SELECT * FROM slots WHERE id=$1 FOR UPDATE",
      [new_slot_id]
    )

    if (!newSlot.rows.length) throw new Error("Slot not found")
    if (newSlot.rows[0].is_booked) throw new Error("Slot already booked")

    await client.query(
      "UPDATE slots SET is_booked=FALSE WHERE id=$1",
      [appt.rows[0].slot_id]
    )

    await client.query(
      "UPDATE appointments SET slot_id=$1, status='booked' WHERE id=$2",
      [new_slot_id, id]
    )

    await client.query(
      "UPDATE slots SET is_booked=TRUE WHERE id=$1",
      [new_slot_id]
    )

    await client.query("COMMIT")

    res.json({ message: "Rescheduled" })
  } catch (error) {
    await client.query("ROLLBACK")
    res.status(400).json({ message: error.message })
  } finally {
    client.release()
  }
}