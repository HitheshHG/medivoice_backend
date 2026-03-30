const express = require("express")
const cors = require("cors")
require("dotenv").config()

const app = express()

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
    credentials: true
  })
)

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

const allowedOrigins = [
  "https://medivoice-frontend-mu.vercel.app",
  "https://medivoice-hg.vercel.app",
  // add more as needed
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin} is not allowed`))
    }
  },
  credentials: true
}))