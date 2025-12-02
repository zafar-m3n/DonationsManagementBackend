// models/index.js
const User = require("./User");
const Category = require("./Category");
const Item = require("./Item");
const Donation = require("./Donation");

/**
 * Associations
 * ------------
 * Category 1 - M Item
 * Item     1 - M Donation
 * User     1 - M Donation (created_by)
 */

Category.hasMany(Item, {
  foreignKey: "category_id",
  as: "items",
});

Item.belongsTo(Category, {
  foreignKey: "category_id",
  as: "category",
});

Item.hasMany(Donation, {
  foreignKey: "item_id",
  as: "donations",
});

Donation.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

User.hasMany(Donation, {
  foreignKey: "created_by",
  as: "donations",
});

Donation.belongsTo(User, {
  foreignKey: "created_by",
  as: "createdBy",
});

module.exports = {
  User,
  Category,
  Item,
  Donation,
};
