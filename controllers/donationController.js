// controllers/donationController.js
const { Category, Item, Donation, User } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");

/* =========================
   Get all categories
   ========================= */
const getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      attributes: ["id", "name"],
      order: [["id", "ASC"]],
    });

    return resSuccess(res, { categories });
  } catch (err) {
    console.error("Error in getCategories:", err);
    return resError(res, "Failed to fetch categories.");
  }
};

/* =========================
   Get all items (with category)
   ========================= */
const getItems = async (req, res) => {
  try {
    const items = await Item.findAll({
      attributes: ["id", "name", "category_id"],
      include: [
        {
          model: Category,
          as: "category", // alias from association
          attributes: ["id", "name"],
        },
      ],
      order: [
        ["category_id", "ASC"],
        ["name", "ASC"],
      ],
    });

    return resSuccess(res, { items });
  } catch (err) {
    console.error("Error in getItems:", err);
    return resError(res, "Failed to fetch items.");
  }
};

/* =========================
   Get items by category
   URL: /api/v1/donations/categories/:categoryId/items
   ========================= */
const getItemsByCategory = async (req, res) => {
  const { categoryId } = req.params;

  if (!categoryId) {
    return resError(res, "Category ID is required.", 400);
  }

  try {
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return resError(res, "Category not found.", 404);
    }

    const items = await Item.findAll({
      where: { category_id: categoryId },
      attributes: ["id", "name", "category_id"],
      order: [["name", "ASC"]],
    });

    return resSuccess(res, {
      category: {
        id: category.id,
        name: category.name,
      },
      items,
    });
  } catch (err) {
    console.error("Error in getItemsByCategory:", err);
    return resError(res, "Failed to fetch items for this category.");
  }
};

/* =========================
   Create a donation (protected)
   ========================= */
// controllers/donationController.js
const createDonation = async (req, res) => {
  const { donor_name, item_id, quantity, notes, donated_at } = req.body;

  if (!donor_name || !item_id || !quantity) {
    return resError(res, "donor_name, item_id and quantity are required.", 400);
  }

  try {
    // 1. Make sure the item exists
    const item = await Item.findByPk(item_id);
    if (!item) {
      return resError(res, "Item not found.", 404);
    }

    // 2. Get user from token
    const createdByUserId = req.user?.id;
    if (!createdByUserId) {
      return resError(res, "User information missing from token.", 401);
    }

    // 3. Handle donated_at (use provided date if valid, otherwise now)
    let donatedAtValue = new Date(); // fallback = current date/time

    if (donated_at) {
      const parsed = new Date(donated_at);

      // Check if date is valid
      if (isNaN(parsed.getTime())) {
        return resError(res, "Invalid donated_at value. Please provide a valid date-time.", 400);
      }

      donatedAtValue = parsed;
    }

    // 4. Create donation with explicit donated_at
    const donation = await Donation.create({
      donor_name,
      item_id,
      quantity,
      notes: notes || null,
      donated_at: donatedAtValue,
      created_by: createdByUserId,
    });

    return resSuccess(
      res,
      {
        message: "Donation recorded successfully.",
        donation,
      },
      201
    );
  } catch (err) {
    console.error("Error in createDonation:", err);
    return resError(res, "Failed to create donation.");
  }
};

/* =========================
   Get all donations (protected)
   ========================= */
const getDonations = async (req, res) => {
  try {
    const donations = await Donation.findAll({
      order: [["donated_at", "DESC"]],
      include: [
        {
          model: Item,
          as: "item",
          attributes: ["id", "name", "category_id"],
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    return resSuccess(res, { donations });
  } catch (err) {
    console.error("Error in getDonations:", err);
    return resError(res, "Failed to fetch donations.");
  }
};

/* =========================
   Dashboard summary (public)
   - Per-category totals
   - Per-item totals (inside each category)
   - Latest donations
   ========================= */
const getDashboardSummary = async (req, res) => {
  try {
    // 1. All categories
    const categories = await Category.findAll({
      attributes: ["id", "name"],
      order: [["id", "ASC"]],
    });

    const perCategory = [];

    // 2. For each category, compute item-level totals and category total
    for (const category of categories) {
      // All items in this category
      const items = await Item.findAll({
        where: { category_id: category.id },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      });

      // Sum per item
      const itemsWithTotals = [];
      for (const item of items) {
        const totalQuantityForItem = await Donation.sum("quantity", {
          where: { item_id: item.id },
        });

        itemsWithTotals.push({
          itemId: item.id,
          itemName: item.name,
          totalQuantity: totalQuantityForItem || 0,
        });
      }

      // Category total is sum of its items' totals
      const categoryTotalQuantity = itemsWithTotals.reduce((sum, i) => sum + (Number(i.totalQuantity) || 0), 0);

      perCategory.push({
        categoryId: category.id,
        categoryName: category.name,
        totalQuantity: categoryTotalQuantity,
        items: itemsWithTotals,
      });
    }

    // 3. Overall totals
    const totalDonations = await Donation.count();
    const totalItemsQuantity = perCategory.reduce((sum, c) => sum + (Number(c.totalQuantity) || 0), 0);

    // 4. Latest few donations
    const latestDonations = await Donation.findAll({
      limit: 5,
      order: [["donated_at", "DESC"]],
      include: [
        {
          model: Item,
          as: "item",
          attributes: ["id", "name"],
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
    });

    return resSuccess(res, {
      totals: {
        totalDonations,
        totalItemsQuantity,
      },
      perCategory,
      latestDonations,
    });
  } catch (err) {
    console.error("Error in getDashboardSummary:", err);
    return resError(res, "Failed to fetch dashboard summary.");
  }
};

module.exports = {
  getCategories,
  getItems,
  getItemsByCategory,
  createDonation,
  getDonations,
  getDashboardSummary,
};
