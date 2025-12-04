// models/StockMovement.js
module.exports = (sequelize, DataTypes) => {
  const StockMovement = sequelize.define(
    "StockMovement",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "items",
          key: "id",
        },
      },
      type: {
        type: DataTypes.ENUM("IN", "OUT"),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      source: {
        type: DataTypes.ENUM("MANUAL", "IMPORT"),
        allowNull: false,
        defaultValue: "MANUAL",
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      // created_at, updated_at via timestamps
    },
    {
      tableName: "stock_movements",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return StockMovement;
};
