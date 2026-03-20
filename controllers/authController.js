const pool = require("../config/db")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body

    const exists = await pool.query(
      "SELECT 1 FROM users WHERE email=$1",
      [email]
    )

    if (exists.rows.length) {
      return res.status(400).json({ message: "Email already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await pool.query(
      "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,'user') RETURNING id,name,email,role",
      [name, email, hashedPassword]
    )

    res.json(user.rows[0])
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    )

    if (!result.rows.length) {
      return res.status(400).json({ message: "User not found" })
    }

    const user = result.rows[0]

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return res.status(400).json({ message: "Invalid password" })
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    )

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.getMe = async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT id,name,email,role FROM users WHERE id=$1",
      [req.user.id]
    )
    res.json(user.rows[0])
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.deleteUser = async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=$1", [req.user.id])
    res.json({ message: "User deleted" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}