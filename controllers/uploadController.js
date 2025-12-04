const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const { Category, Item, StockMovement, sequelize } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");

/**
 * Expected CSV columns (header row):
 * - category_name      (required)  -> categories.name
 * - item_name          (required)  -> items.name
 * - unit_type          (required)  -> items.unit_type (e.g., "kg", "packet", "pcs")
 * - quantity           (required)  -> stock_movements.quantity
 * - variant_label      (optional)  -> items.variant_label
 * - description        (optional)  -> items.description
 * - reason             (optional)  -> stock_movements.reason
 * - movement_type      (optional)  -> "IN" or "OUT" (default: "IN")
 *
 * For each row:
 * - Category is found or created.
 * - Item is found or created (name + variant_label + category_id).
 * - Stock movement is created with source = "IMPORT".
 * - items.current_quantity is updated (+= IN, -= OUT).
 *
 * IMPORTANT:
 * - For OUT movements:
 *    - If unit_type is in [pcs, pieces, packs, pack, boxes, box, cards, card, tablets, tablet, bottles, bottle]
 *      AND item is NOT tea powder
 *      AND item is NOT panadol
 *      AND item is NOT milk powder
 *      AND category is NOT "Sanitary and Diapers"
 *      => check available quantity (cannot go below zero).
 *    - Otherwise (e.g., kg variants, tea powder, panadol, milk powder,
 *      and anything under "Sanitary and Diapers") => do NOT enforce stock check.
 */
const importDonationsFromCsv = async (req, res) => {
  if (!req.file) {
    return resError(res, "No file uploaded.", 400);
  }

  const filePath = req.file.path;

  try {
    // 1) Read all CSV rows into memory
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => {
          rows.push(data);
        })
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    if (rows.length === 0) {
      fs.unlink(filePath, () => {});
      return resError(res, "CSV file is empty.", 400);
    }

    // 2) Process rows inside a single DB transaction
    await sequelize.transaction(async (t) => {
      const categoryCache = {};
      const itemCache = {};

      const getCategory = async (name) => {
        const trimmed = name.trim();
        const key = trimmed.toLowerCase();

        if (categoryCache[key]) return categoryCache[key];

        let category = await Category.findOne({
          where: { name: trimmed },
          transaction: t,
        });

        if (!category) {
          category = await Category.create({ name: trimmed }, { transaction: t });
        }

        categoryCache[key] = category;
        return category;
      };

      const getItem = async ({ name, variant_label, unit_type, description, category_id }) => {
        const baseName = name.trim();
        const variantKey = (variant_label || "").trim().toLowerCase();
        const catKey = category_id || "null";
        const cacheKey = `${baseName.toLowerCase()}||${variantKey}||${catKey}`;

        if (itemCache[cacheKey]) return itemCache[cacheKey];

        let item = await Item.findOne({
          where: {
            name: baseName,
            variant_label: variant_label || null,
            category_id: category_id || null,
          },
          transaction: t,
        });

        if (!item) {
          item = await Item.create(
            {
              name: baseName,
              variant_label: variant_label || null,
              description: description || null,
              unit_type: unit_type || "pcs",
              category_id: category_id || null,
              current_quantity: 0,
            },
            { transaction: t }
          );
        }

        itemCache[cacheKey] = item;
        return item;
      };

      // Discrete unit types where we normally enforce stock check
      const discreteUnitTypes = [
        "pcs",
        "pieces",
        "packs",
        "pack",
        "boxes",
        "box",
        "cards",
        "card",
        "tablets",
        "tablet",
        "bottles",
        "bottle",
      ];

      for (const rawRow of rows) {
        // Normalize keys: trim + lowercase to avoid issues like "Quantity " / "CATEGORY_NAME"
        const row = {};
        for (const [key, val] of Object.entries(rawRow)) {
          const normalizedKey = key.trim().toLowerCase();
          row[normalizedKey] = val;
        }

        const categoryName = (row.category_name || "").trim();
        const itemName = (row.item_name || "").trim();
        const unitType = (row.unit_type || "pcs").trim();
        const variantLabel = row.variant_label ? row.variant_label.trim() : null;
        const description = row.description ? row.description.trim() : null;
        const reason = (row.reason && row.reason.trim()) || "Imported from CSV";

        const movementTypeRaw = (row.movement_type || "IN").trim().toUpperCase();
        const movementType = movementTypeRaw === "OUT" ? "OUT" : "IN";

        // Quantity: be tolerant of formatting, whitespace, etc.
        const rawQuantity = row.quantity ?? row.qty ?? row["quantity"];
        const quantity = parseInt(String(rawQuantity || "").trim(), 10);

        // Basic validation: skip invalid rows
        if (!categoryName || !itemName || isNaN(quantity) || quantity <= 0) {
          console.warn("Skipping invalid row:", rawRow);
          continue;
        }

        // Find or create category
        const category = await getCategory(categoryName);

        // Find or create item
        const item = await getItem({
          name: itemName,
          variant_label: variantLabel,
          unit_type: unitType,
          description,
          category_id: category.id,
        });

        const unitTypeLower = unitType.toLowerCase();
        const itemNameLower = (item.name || "").toLowerCase();
        const categoryNameLower = (category.name || "").toLowerCase();

        // Tea powder detection (covers "Tea Powder", "tea powder", etc.)
        const isTeaPowder = itemNameLower.includes("tea powder") || itemNameLower === "tea";
        const isPanadol = itemNameLower.includes("panadol");
        const isMilkPowder = itemNameLower.includes("milk powder");
        const isSanitaryCategory =
          categoryNameLower === "sanitary and diapers" || categoryNameLower.includes("sanitary and diapers");

        // Only check stock if:
        // - unit type is a discrete one AND
        // - this is NOT tea powder
        // - this is NOT panadol
        // - this is NOT milk powder
        // - category is NOT "Sanitary and Diapers"
        const shouldCheckStock =
          discreteUnitTypes.includes(unitTypeLower) &&
          !isTeaPowder &&
          !isPanadol &&
          !isMilkPowder &&
          !isSanitaryCategory;

        // For OUT movements, optionally ensure enough stock depending on unit_type & item type
        if (movementType === "OUT" && shouldCheckStock && item.current_quantity < quantity) {
          throw new Error(
            `Not enough stock for item "${item.name}" to remove ${quantity}. Current: ${item.current_quantity}`
          );
        }

        // Create stock movement
        await StockMovement.create(
          {
            item_id: item.id,
            type: movementType,
            quantity,
            reason,
            source: "IMPORT",
            created_by: req.user?.id || null, // if this route is protected
          },
          { transaction: t }
        );

        // Update item stock
        if (movementType === "IN") {
          item.current_quantity += quantity;
        } else {
          item.current_quantity -= quantity;
        }

        await item.save({ transaction: t });
      }
    });

    // 3) Remove uploaded file
    fs.unlink(filePath, () => {});

    return resSuccess(res, { message: "CSV imported successfully." }, 201);
  } catch (err) {
    console.error("Error in importDonationsFromCsv:", err);

    // Try removing file even if error
    fs.unlink(filePath, () => {});
    return resError(res, "Failed to import CSV file.", 500);
  }
};

module.exports = {
  importDonationsFromCsv,
};
