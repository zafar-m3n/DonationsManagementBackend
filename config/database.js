const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");
const colors = require("colors");

dotenv.config();

const sequelize = new Sequelize(
  process.env.NODE_DONATION_MYSQL_DATABASE,
  process.env.NODE_DONATION_MYSQL_USER,
  process.env.NODE_DONATION_MYSQL_PASSWORD,
  {
    host: process.env.NODE_DONATION_MYSQL_HOST,
    dialect: "mysql",
    logging: false,
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`MySQL Connected: ${sequelize.config.host}`.bgGreen.white);
  } catch (err) {
    console.error(`Error: ${err.message}`.bgRed.white);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
