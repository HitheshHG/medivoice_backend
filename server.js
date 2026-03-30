const express = require("express")
const cors = require("cors")
require("dotenv").config()

const app = express()

const allowedOrigins = [
  "https://medivoice-frontend-mu.vercel.app",
  "https://medivoice-hg.vercel.app",
  "http://localhost:5173"
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin} is not allowed`))
    }
  },
  credentials: true
}))

app.use(express.json())

app.use("/api/auth", require("./routes/authRoutes"))
app.use("/api/appointments", require("./routes/appointmentRoutes"))
app.use("/api/voice", require("./routes/voiceRoutes"))
app.use("/api/admin", require("./routes/adminRoutes"))

app.get("/", (req, res) => {
  res.send("API Running 🚀")
})

const errorHandler = require("./middleware/errorMiddleware")
app.use(errorHandler)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on ${PORT}`))