const express = require("express");
const morgan = require("morgan");
const colors = require("colors");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectDB } = require("./config/database");

// Load env variables
dotenv.config();

// Connect to database
connectDB();

// Create express app
const app = express();

// Middleware
app.use(express.json());
app.use(morgan("dev"));

app.use(
  cors({
    origin: [process.env.NODE_DONATION_FRONTEND_URL, "http://localhost:5173"],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  })
);

// Static uploads folder (if needed)
app.use("/uploads", express.static("uploads"));

// Import routes
const authRoutes = require("./routes/authRoutes");
const donationRoutes = require("./routes/donationsRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

// Use routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/donations", donationRoutes);
app.use("/api/v1/uploads", uploadRoutes);

// Root route
app.get("/", (req, res) => {
  res.status(200).json({ message: "API is running..." });
});

// Port
const PORT = process.env.NODE_DONATION_PORT || 8080;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_DONATION_MODE} mode`.bgCyan.white);
});
