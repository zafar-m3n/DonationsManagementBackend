// routes/uploadRoutes.js
const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const { getMulterUpload } = require("../config/multerConfig");
const uploadController = require("../controllers/uploadController");

const upload = getMulterUpload("uploads/csv");

// Protect this route (so created_by is set)
router.post(
  "/import",
  authenticate,
  upload.single("file"), // field name in form-data
  uploadController.importDonationsFromCsv
);

module.exports = router;
