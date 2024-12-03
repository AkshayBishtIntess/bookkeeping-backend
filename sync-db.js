const { Sequelize } = require("sequelize");
require("dotenv").config();
const {
  AccountInfo,
  Transaction,
  Check,
  Summary,
} = require("./models/BankStatement");

async function syncDatabase() {
  try {
    const sequelize = new Sequelize({
      database: process.env.DB_NAME || "book-keeping-dev",
      username: process.env.DB_USERNAME || "postgres",
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      dialect: "postgres",
      logging: console.log,
    });

    // Test the connection
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Sync all models
    await sequelize.sync({ force: true }); // Be careful with force: true in production!
    console.log("All models were synchronized successfully.");

    // Close the connection
    await sequelize.close();
    console.log("Database connection closed.");
    process.exit(0);
  } catch (error) {
    console.error("Error synchronizing database:", error);
    process.exit(1);
  }
}

syncDatabase();
