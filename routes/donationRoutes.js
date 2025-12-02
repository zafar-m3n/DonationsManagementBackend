const express = require("express");
const router = express.Router();

const donationController = require("../controllers/donationController");
const authenticate = require("../middlewares/authMiddleware");

// ✅ Public route – anyone can see the dashboard summary
router.get("/summary", donationController.getDashboardSummary);

// ✅ Protected routes – only logged-in users

// Get all categories (fixed list)
router.get("/categories", authenticate, donationController.getCategories);

// Get all items
router.get("/items", authenticate, donationController.getItems);

// Get items by category
router.get("/items/category/:categoryId", authenticate, donationController.getItemsByCategory);

// Create a new donation
router.post("/donations", authenticate, donationController.createDonation);

// Get all donations (latest first handled in controller)
router.get("/donations", authenticate, donationController.getDonations);

module.exports = router;
