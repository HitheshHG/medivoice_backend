const express = require("express")
const router = express.Router()

const {
  getSlots,
  bookAppointment,
  getMyAppointments,
  cancelAppointment,
  reschedule
} = require("../controllers/appointmentController")

const auth = require("../middleware/authMiddleware")

router.get("/slots", getSlots)
router.post("/book", auth, bookAppointment)
router.get("/my", auth, getMyAppointments)
router.delete("/:id", auth, cancelAppointment)
router.put("/:id/reschedule", auth, reschedule)

module.exports = router