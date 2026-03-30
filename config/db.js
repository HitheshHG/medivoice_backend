const { Pool, types } = require("pg")
require("dotenv").config()

types.setTypeParser(1082, val => val)   
types.setTypeParser(1083, val => val)   
types.setTypeParser(1114, val => val)   
types.setTypeParser(1184, val => val)   

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  
})

module.exports = pool