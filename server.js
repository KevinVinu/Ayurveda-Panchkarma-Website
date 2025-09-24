const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files (so Express can find your dashboard.html)
app.use(express.static(path.join(__dirname, "public"))); 
// put dashboard.html inside a "public" folder

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",      // change if needed
  password: "kingkevin@205",      // your MySQL password
  database: "ayursutra"
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL Connected...");
});

// Login route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM doctors WHERE email = ? AND password_hash = ?";
  db.query(sql, [email, password], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      // ✅ Redirect to dashboard.html
      res.redirect("/dashboard.html");  
    } else {
      res.send("Invalid Email or Password");
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
