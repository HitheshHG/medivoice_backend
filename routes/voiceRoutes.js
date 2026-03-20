const express = require("express")
const router = express.Router()

const { processVoice } = require("../controllers/voiceController")
const auth = require("../middleware/authMiddleware")

router.post("/", auth, processVoice)

module.exports = router