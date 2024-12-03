const { Sequelize } = require("sequelize");
const dbConfig = require("../config/config.js");
const env = process.env.NODE_ENV;

const sequelize = new Sequelize(
  dbConfig[env].database,
  dbConfig[env].username,
  dbConfig[env].password,
  {
    host: dbConfig[env].host,
    dialect: dbConfig[env].dialect,
  }
);

// Test the connection
sequelize
  .authenticate()
  .then(() => console.log("Database connected successfully."))
  .catch((err) => console.error("Unable to connect to the database:", err));

module.exports = sequelize;
