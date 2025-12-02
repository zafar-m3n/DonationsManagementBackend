const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");
require("dotenv").config();

/* ---------- Register ---------- */
const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return resError(res, "Email already in use.", 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      name,
      email,
      hashed_password,
    });

    return resSuccess(
      res,
      {
        message: "Registration successful!",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      201
    );
  } catch (err) {
    console.error("Error in register:", err);
    return resError(res, err.message);
  }
};

/* ---------- Login ---------- */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return resError(res, "Invalid email or password.", 400);
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.hashed_password);
    if (!isMatch) {
      return resError(res, "Invalid email or password.", 400);
    }

    // Create JWT payload
    const payload = {
      id: user.id,
      email: user.email,
    };

    const token = jwt.sign(payload, process.env.NODE_DONATION_JWT_SECRET, {
      expiresIn: "1d",
    });

    return resSuccess(res, {
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Error in login:", err);
    return resError(res, err.message);
  }
};

/* ---------- Export all functions ---------- */
module.exports = {
  register,
  login,
};
