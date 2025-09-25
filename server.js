const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 5000;

// Set EJS as template engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "kingkevin@205",
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
      // Redirect to dashboard with doctor data
      res.redirect(`/dashboard?doctor_id=${results[0].doctor_id}`);
    } else {
      res.send("Invalid Email or Password");
    }
  });
});


// Dashboard route// Appointments route
app.get("/appointments", (req, res) => {
    const doctorId = req.query.doctor_id;

    if (!doctorId) {
        return res.redirect("/login.html");
    }

    // Get doctor info
    const doctorSql = "SELECT * FROM doctors WHERE doctor_id = ?";
    
    // Get today's appointments with patient details
    const appointmentsSql = `
        SELECT a.*, p.name as patient_name, p.disease, p.email, p.phone, p.age, p.weight, p.gender, d.name as doctor_name 
        FROM appointments a 
        JOIN patients p ON a.patient_id = p.patient_id 
        JOIN doctors d ON a.doctor_id = d.doctor_id 
        WHERE a.doctor_id = ? AND DATE(a.appointment_date) = CURDATE() 
        ORDER BY a.appointment_date
    `;

    db.query(doctorSql, [doctorId], (err, doctorResults) => {
        if (err) throw err;

        if (doctorResults.length === 0) {
            return res.redirect("/login.html");
        }

        const doctor = doctorResults[0];

        db.query(appointmentsSql, [doctorId], (err, appointmentResults) => {
            if (err) throw err;

            res.render("appointment", {
                doctor: doctor,
                appointments: appointmentResults
            });
        });
    });
});
// Patients route
app.get("/patients", (req, res) => {
    const doctorId = req.query.doctor_id;

    if (!doctorId) {
        return res.redirect("/login.html");
    }

    // Get doctor info
    const doctorSql = "SELECT * FROM doctors WHERE doctor_id = ?";
    
    // Get patients with their latest appointment status and date
    const patientsSql = `
        SELECT 
            p.*, 
            d.name as doctor_name,
            a.appointment_date,
            a.status as appointment_status,
            a.therapy_type
        FROM patients p
        JOIN appointments a ON p.patient_id = a.patient_id
        JOIN doctors d ON a.doctor_id = d.doctor_id
        WHERE a.doctor_id = ? 
        AND a.status IN ('confirmed', 'completed')
        AND a.appointment_id IN (
            SELECT MAX(appointment_id) 
            FROM appointments 
            WHERE patient_id = p.patient_id 
            AND doctor_id = ?
        )
        ORDER BY a.appointment_date DESC
    `;

    db.query(doctorSql, [doctorId], (err, doctorResults) => {
        if (err) throw err;

        if (doctorResults.length === 0) {
            return res.redirect("/login.html");
        }

        const doctor = doctorResults[0];

        db.query(patientsSql, [doctorId, doctorId], (err, patientResults) => {
            if (err) throw err;

            // Process patients to determine status based on appointment time
            const processedPatients = patientResults.map(patient => {
                const appointmentDate = new Date(patient.appointment_date);
                const now = new Date();
                
                // If appointment is in past and status is confirmed, mark as completed
                if (appointmentDate < now && patient.appointment_status === 'confirmed') {
                    patient.appointment_status = 'completed';
                }
                
                return patient;
            });

            res.render("patient", {
                doctor: doctor,
                patients: processedPatients
            });
        });
    });
});

// Update appointment status route
app.post("/update-appointment", (req, res) => {
    const { appointment_id, status } = req.body;

    const sql = "UPDATE appointments SET status = ? WHERE appointment_id = ?";
    
    db.query(sql, [status, appointment_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: err.message });
        }

        // Log activity
        const activitySql = `
            INSERT INTO activities (doctor_id, patient_id, activity_type) 
            SELECT doctor_id, patient_id, ? 
            FROM appointments 
            WHERE appointment_id = ?
        `;
        
        const activityType = status === 'confirmed' ? 'Appointment confirmed' : 'Appointment cancelled';
        
        db.query(activitySql, [`${activityType} for appointment #${appointment_id}`, appointment_id], (err) => {
            if (err) console.error('Error logging activity:', err);
            
            res.json({ success: true, message: `Appointment ${status} successfully` });
        });
    });
});
app.get("/dashboard", (req, res) => {
  const doctorId = req.query.doctor_id;

  if (!doctorId) {
    return res.redirect("/login.html");
  }

  // Get doctor info
  const doctorSql = "SELECT * FROM doctors WHERE doctor_id = ?";
  
  // Get today's appointments count
  const appointmentsSql = `
    SELECT COUNT(*) as count FROM appointments 
    WHERE doctor_id = ? AND DATE(appointment_date) = CURDATE()
  `;

  // Get active patients count (patients with appointments in last 30 days)
  const patientsSql = `
    SELECT COUNT(DISTINCT patient_id) as count FROM appointments 
    WHERE doctor_id = ? AND appointment_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  `;

  // Get ongoing therapies count (appointments with status 'confirmed' for today)
  const therapiesSql = `
    SELECT COUNT(*) as count FROM appointments 
    WHERE doctor_id = ? AND status = 'confirmed' AND DATE(appointment_date) = CURDATE()
  `;

  // Get success rate (average rating from feedback)
  const successRateSql = `
    SELECT AVG(rating) * 20 as rate FROM feedback 
    WHERE doctor_id = ?
  `;

  // Get today's schedule
  const scheduleSql = `
    SELECT a.*, p.name as patient_name, d.name as doctor_name 
    FROM appointments a 
    JOIN patients p ON a.patient_id = p.patient_id 
    JOIN doctors d ON a.doctor_id = d.doctor_id 
    WHERE a.doctor_id = ? AND DATE(a.appointment_date) = CURDATE() 
    ORDER BY a.appointment_date
  `;

  // Get recent activities
  const activitiesSql = `
    SELECT a.*, p.name as patient_name 
    FROM activities a 
    JOIN patients p ON a.patient_id = p.patient_id 
    WHERE a.doctor_id = ? 
    ORDER BY a.created_at DESC 
    LIMIT 4
  `;

  db.query(doctorSql, [doctorId], (err, doctorResults) => {
    if (err) throw err;

    if (doctorResults.length === 0) {
      return res.redirect("/login.html");
    }

    const doctor = doctorResults[0];

    // Execute all queries in parallel
    Promise.all([
      new Promise((resolve, reject) => {
        db.query(appointmentsSql, [doctorId], (err, results) => {
          if (err) reject(err);
          else resolve(results[0].count);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(patientsSql, [doctorId], (err, results) => {
          if (err) reject(err);
          else resolve(results[0].count);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(therapiesSql, [doctorId], (err, results) => {
          if (err) reject(err);
          else resolve(results[0].count);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(successRateSql, [doctorId], (err, results) => {
          if (err) reject(err);
          else resolve(Math.round(results[0].rate || 0));
        });
      }),
      new Promise((resolve, reject) => {
        db.query(scheduleSql, [doctorId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(activitiesSql, [doctorId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      })
    ]).then(([appointmentsCount, patientsCount, therapiesCount, successRate, schedule, activities]) => {
      res.render("dashboard", {
        doctor: doctor,
        stats: {
          appointments: appointmentsCount,
          patients: patientsCount,
          therapies: therapiesCount,
          successRate: successRate
        },
        schedule: schedule,
        activities: activities
      });
    }).catch(error => {
      throw error;
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}/login.html`);
});
