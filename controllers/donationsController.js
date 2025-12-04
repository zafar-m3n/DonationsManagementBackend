const { Category, Item, StockMovement, User, sequelize } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");

const parseKgFromVariant = (variantLabel) => {
  if (!variantLabel) return 0;
  const match = String(variantLabel).match(/(\d+)\s*kg/i);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? 0 : num;
};

/* ============================================================
   DASHBOARD SUMMARY
   ============================================================ */

/**
 * @route   GET /api/donations/dashboard
 * @desc    Get high-level dashboard summary:
 *          - total quantities ever received (IN)
 *          - total quantities ever sent out (OUT)
 *          - current quantities
 *          - breakdown by category and item
 */
const getDashboardSummary = async (req, res) => {
  try {
    // 1) Get all items with their categories
    const items = await Item.findAll({
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
    });

    // 2) Aggregate stock movements by item + type (IN / OUT)
    const movementAggregates = await StockMovement.findAll({
      attributes: ["item_id", "type", [sequelize.fn("SUM", sequelize.col("quantity")), "totalQuantity"]],
      group: ["item_id", "type"],
      raw: true,
    });

    // Build map: totalsByItem[item_id] = { IN: x, OUT: y }
    const totalsByItem = {};
    for (const row of movementAggregates) {
      const itemId = row.item_id;
      const type = row.type; // 'IN' or 'OUT'
      const totalQty = Number(row.totalQuantity) || 0;

      if (!totalsByItem[itemId]) {
        totalsByItem[itemId] = { IN: 0, OUT: 0 };
      }
      totalsByItem[itemId][type] = totalQty;
    }

    // 3) Build per-item and per-category summaries
    const categoryMap = {}; // categoryId -> { ...categoryData }

    let overallTotalCurrent = 0;
    let overallTotalIn = 0;
    let overallTotalOut = 0;

    // Extra stats for "things sent"
    const sentBreakdown = {
      rice_kg_sent: 0,
      dhal_kg_sent: 0,
      salt_kg_sent: 0,
      sugar_kg_sent: 0,
      water_bottles_sent: 0,
      other_essentials_sent: 0, // pcs of sanitary napkins, biscuits, medicine
    };

    items.forEach((item) => {
      const itemId = item.id;
      const categoryId = item.category ? item.category.id : null;
      const categoryName = item.category ? item.category.name : "Uncategorized";

      const itemTotals = totalsByItem[itemId] || { IN: 0, OUT: 0 };
      const totalIn = itemTotals.IN;
      const totalOut = itemTotals.OUT;
      const currentQty = item.current_quantity || 0;

      overallTotalCurrent += currentQty;
      overallTotalIn += totalIn;
      overallTotalOut += totalOut;

      if (!categoryMap[categoryId || "uncategorized"]) {
        categoryMap[categoryId || "uncategorized"] = {
          id: categoryId,
          name: categoryName,
          total_quantity_current: 0,
          total_quantity_received: 0,
          total_quantity_sent: 0,
          items: [],
        };
      }

      const catRef = categoryMap[categoryId || "uncategorized"];

      // Update category totals
      catRef.total_quantity_current += currentQty;
      catRef.total_quantity_received += totalIn;
      catRef.total_quantity_sent += totalOut;

      // Push item-level breakdown
      catRef.items.push({
        id: item.id,
        name: item.name,
        variant_label: item.variant_label,
        unit_type: item.unit_type,
        current_quantity: currentQty,
        total_quantity_received: totalIn,
        total_quantity_sent: totalOut,
      });

      // ============================
      // Special "sent" breakdown
      // ============================
      const outQty = totalOut; // total OUT units for this item
      if (outQty > 0) {
        const itemName = (item.name || "").toLowerCase();
        const catName = (categoryName || "").toLowerCase();
        const variantLabel = item.variant_label || "";

        // Dry rations in KG
        if (itemName === "rice") {
          const perBagKg = parseKgFromVariant(variantLabel);
          sentBreakdown.rice_kg_sent += perBagKg * outQty;
        } else if (itemName === "dhal" || itemName === "dal") {
          const perBagKg = parseKgFromVariant(variantLabel);
          sentBreakdown.dhal_kg_sent += perBagKg * outQty;
        } else if (itemName === "salt") {
          const perBagKg = parseKgFromVariant(variantLabel);
          sentBreakdown.salt_kg_sent += perBagKg * outQty;
        } else if (itemName === "sugar") {
          const perBagKg = parseKgFromVariant(variantLabel);
          sentBreakdown.sugar_kg_sent += perBagKg * outQty;
        }
        // Water in bottles
        else if (catName === "water" || itemName.includes("water")) {
          sentBreakdown.water_bottles_sent += outQty;
        }
        // Other essentials (sanitary napkins, biscuits, medicine)
        else {
          const isSanitary = catName.includes("sanitary") || itemName.includes("sanitary");
          const isBiscuits = itemName.includes("biscuit");
          const isMedical = catName === "medical";

          if (isSanitary || isBiscuits || isMedical) {
            // We treat these as "pcs" for summary
            sentBreakdown.other_essentials_sent += outQty;
          }
        }
      }
    });

    // Convert categoryMap to sorted array
    const categories = Object.values(categoryMap).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return resSuccess(res, {
      totals: {
        total_items: items.length,
        total_quantity_current: overallTotalCurrent, // current stock across all items
        total_quantity_received: overallTotalIn, // total IN movements overall
        total_quantity_sent: overallTotalOut, // total OUT movements overall (raw units)
      },
      categories,
      sent_breakdown: sentBreakdown, // 👈 NEW: structured "things sent" summary
    });
  } catch (err) {
    console.error("Error in getDashboardSummary:", err);
    return resError(res, "Failed to fetch dashboard summary.", 500);
  }
};

/* ============================================================
   CATEGORY CONTROLLERS
   ============================================================ */

/**
 * @route   POST /api/donations/categories
 * @desc    Create a new category
 */
const createCategory = async (req, res) => {
  const { name } = req.body;

  try {
    if (!name || !name.trim()) {
      return resError(res, "Category name is required.", 400);
    }

    const existing = await Category.findOne({ where: { name: name.trim() } });
    if (existing) {
      return resError(res, "Category with this name already exists.", 400);
    }

    const category = await Category.create({ name: name.trim() });

    return resSuccess(
      res,
      {
        message: "Category created successfully.",
        category,
      },
      201
    );
  } catch (err) {
    console.error("Error in createCategory:", err);
    return resError(res, "Failed to create category.", 500);
  }
};

/**
 * @route   GET /api/donations/categories
 * @desc    Get all categories
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [["name", "ASC"]],
    });

    return resSuccess(res, { categories });
  } catch (err) {
    console.error("Error in getCategories:", err);
    return resError(res, "Failed to fetch categories.", 500);
  }
};

/* ============================================================
   ITEM CONTROLLERS
   ============================================================ */

/**
 * @route   POST /api/donations/items
 * @desc    Create a new item (optionally with initial quantity)
 */
const createItem = async (req, res) => {
  const { name, variant_label, description, unit_type, category_id, initial_quantity } = req.body;

  const qty = Number(initial_quantity) || 0;

  if (!name || !name.trim()) {
    return resError(res, "Item name is required.", 400);
  }

  try {
    await sequelize.transaction(async (t) => {
      const item = await Item.create(
        {
          name: name.trim(),
          variant_label: variant_label || null,
          description: description || null,
          unit_type: unit_type || "pcs",
          category_id: category_id || null,
          current_quantity: qty >= 0 ? qty : 0,
        },
        { transaction: t }
      );

      // If initial quantity is provided and > 0, log a stock movement
      if (qty > 0) {
        await StockMovement.create(
          {
            item_id: item.id,
            type: "IN",
            quantity: qty,
            reason: "Initial stock",
            source: "MANUAL",
            created_by: req.user?.id || null,
          },
          { transaction: t }
        );
      }

      return resSuccess(
        res,
        {
          message: "Item created successfully.",
          item,
        },
        201
      );
    });
  } catch (err) {
    console.error("Error in createItem:", err);
    return resError(res, "Failed to create item.", 500);
  }
};

/**
 * @route   GET /api/donations/items
 * @desc    Get all items with category
 */
const getItems = async (req, res) => {
  try {
    const items = await Item.findAll({
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
      order: [
        ["name", "ASC"],
        ["variant_label", "ASC"],
      ],
    });

    return resSuccess(res, { items });
  } catch (err) {
    console.error("Error in getItems:", err);
    return resError(res, "Failed to fetch items.", 500);
  }
};

/**
 * @route   GET /api/donations/items/by-category
 * @desc    Get items grouped by category for other views (if needed)
 */
const getItemsByCategory = async (req, res) => {
  try {
    const categories = await Category.findAll({
      include: [
        {
          model: Item,
          as: "items",
          order: [["name", "ASC"]],
        },
      ],
      order: [["name", "ASC"]],
    });

    const data = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      created_at: cat.created_at,
      items: cat.items || [],
    }));

    return resSuccess(res, { categories: data });
  } catch (err) {
    console.error("Error in getItemsByCategory:", err);
    return resError(res, "Failed to fetch items by category.", 500);
  }
};

/* ============================================================
   STOCK MOVEMENTS (IN / OUT)
   ============================================================ */

/**
 * @route   POST /api/donations/stock/in
 * @desc    Manually add stock for an item
 */
const stockIn = async (req, res) => {
  const { item_id, quantity, reason } = req.body;

  const qty = Number(quantity);

  if (!item_id || !qty || qty <= 0) {
    return resError(res, "Item ID and positive quantity are required.", 400);
  }

  try {
    await sequelize.transaction(async (t) => {
      const item = await Item.findByPk(item_id, { transaction: t });

      if (!item) {
        return resError(res, "Item not found.", 404);
      }

      const movement = await StockMovement.create(
        {
          item_id,
          type: "IN",
          quantity: qty,
          reason: reason || null,
          source: "MANUAL",
          created_by: req.user?.id || null,
        },
        { transaction: t }
      );

      item.current_quantity += qty;
      await item.save({ transaction: t });

      return resSuccess(res, {
        message: "Stock added successfully.",
        item,
        movement,
      });
    });
  } catch (err) {
    console.error("Error in stockIn:", err);
    return resError(res, "Failed to add stock.", 500);
  }
};

/**
 * @route   POST /api/donations/stock/out
 * @desc    Manually remove stock for an item
 */
const stockOut = async (req, res) => {
  const { item_id, quantity, reason } = req.body;

  const qty = Number(quantity);

  if (!item_id || !qty || qty <= 0) {
    return resError(res, "Item ID and positive quantity are required.", 400);
  }

  try {
    await sequelize.transaction(async (t) => {
      const item = await Item.findByPk(item_id, { transaction: t });

      if (!item) {
        return resError(res, "Item not found.", 404);
      }

      if (item.current_quantity < qty) {
        return resError(res, "Not enough stock to remove the requested quantity.", 400);
      }

      const movement = await StockMovement.create(
        {
          item_id,
          type: "OUT",
          quantity: qty,
          reason: reason || null,
          source: "MANUAL",
          created_by: req.user?.id || null,
        },
        { transaction: t }
      );

      item.current_quantity -= qty;
      await item.save({ transaction: t });

      return resSuccess(res, {
        message: "Stock removed successfully.",
        item,
        movement,
      });
    });
  } catch (err) {
    console.error("Error in stockOut:", err);
    return resError(res, "Failed to remove stock.", 500);
  }
};

/**
 * @route   GET /api/donations/stock/history/:itemId
 * @desc    Get stock movement history for a single item
 */
const getItemHistory = async (req, res) => {
  const { itemId } = req.params;

  try {
    const item = await Item.findByPk(itemId);

    if (!item) {
      return resError(res, "Item not found.", 404);
    }

    const movements = await StockMovement.findAll({
      where: { item_id: itemId },
      include: [
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "full_name", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return resSuccess(res, {
      item,
      movements,
    });
  } catch (err) {
    console.error("Error in getItemHistory:", err);
    return resError(res, "Failed to fetch item history.", 500);
  }
};

/* ============================================================
   EXPORT ALL CONTROLLERS
   ============================================================ */

module.exports = {
  // Dashboard
  getDashboardSummary,

  // Categories
  createCategory,
  getCategories,

  // Items
  createItem,
  getItems,
  getItemsByCategory,

  // Stock movements
  stockIn,
  stockOut,
  getItemHistory,
};
