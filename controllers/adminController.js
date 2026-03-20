const pool = require("../config/db")

const createSlot = async (req, res) => {
  try {
    const { time, date } = req.body

    if (!time || !date) {
      return res.status(400).json({ message: "Time and date required" })
    }

    const exists = await pool.query(
      "SELECT 1 FROM slots WHERE time=$1 AND date=$2",
      [time, date]
    )

    if (exists.rows.length > 0) {
      return res.status(400).json({ message: "Slot already exists" })
    }

    const newSlot = await pool.query(
      "INSERT INTO slots (time, date, is_booked) VALUES ($1, $2, false) RETURNING *",
      [time, date]
    )

    res.json(newSlot.rows[0])
  } catch (err) {
    res.status(500).json({ message: "Error creating slot" })
  }
}

const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params

    const slot = await pool.query(
      "SELECT * FROM slots WHERE id=$1",
      [id]
    )

    if (!slot.rows.length) {
      return res.status(404).json({ message: "Slot not found" })
    }

    const activeAppointments = await pool.query(
      "SELECT * FROM appointments WHERE slot_id=$1 AND status='booked'",
      [id]
    )

    if (activeAppointments.rows.length > 0) {
      return res.status(400).json({
        message: "Slot has active bookings"
      })
    }

    await pool.query("DELETE FROM slots WHERE id=$1", [id])

    res.json({ message: "Slot deleted" })

  } catch (err) {
    console.error("DELETE ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
module.exports = { createSlot, deleteSlot }