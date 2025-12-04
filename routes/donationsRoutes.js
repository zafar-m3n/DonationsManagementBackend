const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const donationsController = require("../controllers/donationsController");

/* ============================================================
   PUBLIC ROUTES (NO AUTH)
   ============================================================ */

// Dashboard summary (public)
router.get("/dashboard", donationsController.getDashboardSummary);

/* ============================================================
   AUTHENTICATED ROUTES (NEED LOGIN)
   ============================================================ */

router.use(authenticate);

/* ---------- Categories ---------- */
router.post("/categories", donationsController.createCategory);
router.get("/categories", donationsController.getCategories);

/* ---------- Items ---------- */
router.post("/items", donationsController.createItem);
router.get("/items", donationsController.getItems);
router.get("/items/by-category", donationsController.getItemsByCategory);

/* ---------- Stock Movements ---------- */
router.post("/stock/in", donationsController.stockIn);
router.post("/stock/out", donationsController.stockOut);
router.get("/stock/history/:itemId", donationsController.getItemHistory);

module.exports = router;
