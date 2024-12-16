const { DataTypes } = require("sequelize");
const sequelize = require("../config/config.js");

// Client Model
const Client = sequelize.define("Client", {
  clientName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  accessCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  contactName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contactPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  clientType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// AccountInfo Model
const AccountInfo = sequelize.define("AccountInfo", {
  bankName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  accountHolder: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  statementFromDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  statementToDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  beginningBalance: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  endingBalance: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "Clients",
      key: "id",
    },
  },
  pdfUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pdfFileName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pdfUploadDate: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  pdfFileSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "File size in bytes",
  },
  monthReference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// Transaction Model
const Transaction = sequelize.define("Transactions", {
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referenceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  checkNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  split: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});


// Check Model
const Check = sequelize.define("Check", {
  checkNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
});

// Summary Model
const Summary = sequelize.define("Summary", {
  totalDeposits: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  totalWithdrawals: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  totalChecks: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  totalFees: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
});

const Classification = sequelize.define(
  "classification_knowledge",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    memo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    split: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    account: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    debit: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    credit: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
);

// Define Associations
Client.hasMany(AccountInfo, {
  foreignKey: "clientId",
  as: "accounts",
});

AccountInfo.belongsTo(Client, {
  foreignKey: "clientId",
  as: "client",
});

AccountInfo.hasMany(Transaction, {
  foreignKey: "accountId",
  as: "transactions",
});

AccountInfo.hasMany(Check, {
  foreignKey: "accountId",
  as: "checks",
});

AccountInfo.hasOne(Summary, {
  foreignKey: "accountId",
  as: "summary",
});

Transaction.belongsTo(AccountInfo, {
  foreignKey: "accountId",
});

Check.belongsTo(AccountInfo, {
  foreignKey: "accountId",
});

Summary.belongsTo(AccountInfo, {
  foreignKey: "accountId",
});

module.exports = {
  AccountInfo,
  Transaction,
  Check,
  Summary,
  Client,
  Classification
};
