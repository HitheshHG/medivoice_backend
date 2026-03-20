const express = require("express")
const router = express.Router()
const { createSlot, deleteSlot } = require("../controllers/adminController")
const pool = require("../config/db")
const auth = require("../middleware/authMiddleware")
const admin = require("../middleware/adminMiddleware")

router.post("/slots", auth, admin, createSlot)
router.delete("/slots/:id", auth, admin, deleteSlot)

router.get("/users", auth, admin, async (req, res) => {
  const users = await pool.query("SELECT id,name,email,role FROM users")
  res.json({
    success: true,
    data: users.rows
  })
})

router.get("/appointments", auth, admin, async (req, res) => {
  const data = await pool.query(`
    SELECT a.id, u.name, s.time, a.status
    FROM appointments a
    JOIN users u ON a.user_id = u.id
    JOIN slots s ON a.slot_id = s.id
  `)
  res.json({
    success: true,
    data: data.rows
  })
})

module.exports = router