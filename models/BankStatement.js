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
  // Add classification fields that match your structure
  account_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  detail_type_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  subtype_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  split: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const AccountType = sequelize.define(
  "account_types",
  {
    type_id: {
      type: DataTypes.STRING(10),
      primaryKey: true,
    },
    type_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    normal_balance: {
      type: DataTypes.CHAR(1),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "account_types",
    freezeTableName: true,
    timestamps: true,
  }
);

// Account Subtypes Model
const AccountSubtype = sequelize.define(
  "account_subtypes",
  {
    subtype_id: {
      type: DataTypes.STRING(10),
      primaryKey: true,
    },
    type_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    subtype_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "account_subtypes",
    freezeTableName: true,
    timestamps: true,
  }
);

// Detail Types Model
const DetailType = sequelize.define(
  "detail_types",
  {
    detail_type_id: {
      type: DataTypes.STRING(10),
      primaryKey: true,
    },
    subtype_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    detail_type_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "detail_types",
    freezeTableName: true,
    timestamps: true,
  }
);

// Chart of Accounts Model
const ChartOfAccounts = sequelize.define(
  "chart_of_accounts",
  {
    account_code: {
      type: DataTypes.STRING(10),
      primaryKey: true,
    },
    account_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    type_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    subtype_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    detail_type_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    parent_account_id: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    balance_sheet_sequence: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "chart_of_accounts",
    freezeTableName: true,
    timestamps: false,
    
  }
);

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
  {
    tableName: "classification_knowledge",
    freezeTableName: true,
    timestamps: false,
  }
);

// Add association between Transaction and Classification
Transaction.belongsTo(ChartOfAccounts, {
  foreignKey: "account_code",
  targetKey: "account_code",
});

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

AccountType.hasMany(AccountSubtype, {
  foreignKey: "type_id",
  sourceKey: "type_id",
});

AccountSubtype.belongsTo(AccountType, {
  foreignKey: "type_id",
  targetKey: "type_id",
});

AccountSubtype.hasMany(DetailType, {
  foreignKey: "subtype_id",
  sourceKey: "subtype_id",
});

DetailType.belongsTo(AccountSubtype, {
  foreignKey: "subtype_id",
  targetKey: "subtype_id",
});

ChartOfAccounts.belongsTo(AccountType, {
  foreignKey: "type_id",
  targetKey: "type_id",
});

ChartOfAccounts.belongsTo(AccountSubtype, {
  foreignKey: "subtype_id",
  targetKey: "subtype_id",
});

ChartOfAccounts.belongsTo(DetailType, {
  foreignKey: "detail_type_id",
  targetKey: "detail_type_id",
});

// Fix the Transaction association to use ChartOfAccounts
Transaction.belongsTo(ChartOfAccounts, {
  foreignKey: "account_code",
  targetKey: "account_code",
});

ChartOfAccounts.hasMany(Transaction, {
  foreignKey: "account_code",
  sourceKey: "account_code",
});

module.exports = {
  AccountInfo,
  Transaction,
  Check,
  Summary,
  Client,
  Classification,
  AccountType,
  AccountSubtype,
  DetailType,
  ChartOfAccounts,
};
