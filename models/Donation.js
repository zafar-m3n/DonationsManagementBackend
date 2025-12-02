// models/Donation.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Donation = sequelize.define(
  "Donation",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    donor_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    donated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "donations",
    timestamps: false,
  }
);

module.exports = Donation;
