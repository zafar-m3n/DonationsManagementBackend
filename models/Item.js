// models/Item.js
module.exports = (sequelize, DataTypes) => {
  const Item = sequelize.define(
    "Item",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      variant_label: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      unit_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "pcs",
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "categories",
          key: "id",
        },
      },
      current_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // created_at, updated_at via timestamps
    },
    {
      tableName: "items",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Item;
};
