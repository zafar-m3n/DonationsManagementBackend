// models/index.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// Import model definers
const UserModel = require("./User");
const CategoryModel = require("./Category");
const ItemModel = require("./Item");
const StockMovementModel = require("./StockMovement");

// Initialize models
const User = UserModel(sequelize, DataTypes);
const Category = CategoryModel(sequelize, DataTypes);
const Item = ItemModel(sequelize, DataTypes);
const StockMovement = StockMovementModel(sequelize, DataTypes);

// =========================
// Define Associations
// =========================

// Category 1 - M Item
Category.hasMany(Item, {
  foreignKey: "category_id",
  as: "items",
});

Item.belongsTo(Category, {
  foreignKey: "category_id",
  as: "category",
});

// Item 1 - M StockMovement
Item.hasMany(StockMovement, {
  foreignKey: "item_id",
  as: "movements",
});

StockMovement.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

// User 1 - M StockMovement (created_by)
User.hasMany(StockMovement, {
  foreignKey: "created_by",
  as: "stockMovements",
});

StockMovement.belongsTo(User, {
  foreignKey: "created_by",
  as: "createdBy",
});

// Export models + sequelize
module.exports = {
  sequelize,
  User,
  Category,
  Item,
  StockMovement,
};
