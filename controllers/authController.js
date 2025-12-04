const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");
require("dotenv").config();

/* ---------- Register ---------- */
const register = async (req, res) => {
  const { full_name, email, password } = req.body;

  try {
    // Basic validation
    if (!full_name || !email || !password) {
      return resError(res, "Full name, email, and password are required.", 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return resError(res, "Email already in use.", 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      full_name,
      email,
      password: hashedPassword,
    });

    return resSuccess(
      res,
      {
        message: "Registration successful!",
        user: {
          id: newUser.id,
          full_name: newUser.full_name,
          email: newUser.email,
        },
      },
      201
    );
  } catch (err) {
    console.error("Error in register:", err);
    return resError(res, "Failed to register user.", 500);
  }
};

/* ---------- Login ---------- */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Basic validation
    if (!email || !password) {
      return resError(res, "Email and password are required.", 400);
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return resError(res, "Invalid email or password.", 400);
    }

    // Compare password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return resError(res, "Invalid email or password.", 400);
    }

    // Create JWT payload
    const payload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
    };

    const token = jwt.sign(payload, process.env.NODE_DONATION_JWT_SECRET, {
      expiresIn: "1d",
    });

    return resSuccess(res, {
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Error in login:", err);
    return resError(res, "Failed to login.", 500);
  }
};

/* ---------- Export all functions ---------- */
module.exports = {
  register,
  login,
};
