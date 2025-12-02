// models/Item.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Item = sequelize.define(
  "Item",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "items",
    timestamps: false,
  }
);

module.exports = Item;
