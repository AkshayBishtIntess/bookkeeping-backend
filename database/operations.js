// database/operations.js

const {
  AccountInfo,
  Transaction,
  Check,
  Summary,
  Client,
  ChartOfAccounts,
  Classification,
  DetailType
} = require("../models/BankStatement");
const sequelize = require("../config/config");

async function saveBankStatementData(data) {
  const t = await sequelize.transaction();

  try {
    // Verify client exists
    const client = await Client.findOne({
      where: { accessCode: data.clientAccessCode },
      transaction: t,
    });

    if (!client) {
      throw new Error("Client not found");
    }

    // Create AccountInfo record with client association
    const accountInfo = await AccountInfo.create(
      {
        clientId: client.id,
        bankName: data.accountInfo.bankName,
        accountHolder: data.accountInfo.accountHolder,
        accountNumber: data.accountInfo.accountNumber,
        statementFromDate: data.accountInfo.statementPeriod.from,
        statementToDate: data.accountInfo.statementPeriod.to,
        beginningBalance: data.accountInfo.balances.beginning,
        endingBalance: data.accountInfo.balances.ending,
        pdfUrl: data.accountInfo.pdfUrl,
        pdfFileName: data.accountInfo.pdfFileName,
        pdfUploadDate: data.accountInfo.pdfUploadDate,
        pdfFileSize: data.accountInfo.pdfFileSize,
        monthReference: data.accountInfo.monthReference
      },
      { transaction: t }
    );

    await Promise.all(
      data.transactions.map(async (tx) => {
        return Transaction.create(
          {
            accountId: accountInfo.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: tx.type,
            location: tx.details?.location,
            referenceNumber: tx.details?.referenceNumber,
            checkNumber: tx.details?.checkNumber,
          },
          { transaction: t }
        );
      })
    );

    if (data.checks && data.checks.length > 0) {
      await Promise.all(
        data.checks.map(async (check) => {
          return Check.create(
            {
              accountId: accountInfo.id,
              checkNumber: check.checkNumber,
              date: check.date,
              amount: check.amount,
            },
            { transaction: t }
          );
        })
      );
    }

    await Summary.create(
      {
        accountId: accountInfo.id,
        totalDeposits: data.summary.totalDeposits,
        totalWithdrawals: data.summary.totalWithdrawals,
        totalChecks: data.summary.totalChecks,
        totalFees: data.summary.totalFees,
      },
      { transaction: t }
    );

    await t.commit();

    return {
      success: true,
      accountId: accountInfo.id,
      clientId: client.id,
      message: "Bank statement data saved successfully",
    };
  } catch (error) {
    await t.rollback();
    throw {
      success: false,
      error: error.message || "Failed to save bank statement data",
      details: error,
    };
  }
}

async function getAllBankStatements() {
  try {
    const statements = await AccountInfo.findAll({
      include: [
        {
          model: Transaction,
          as: "transactions",
        },
        {
          model: Check,
          as: "checks",
        },
        {
          model: Summary,
          as: "summary",
        },
        {
          model: Client,
          as: "client",
        },
      ],
    });

    return statements.map((statement, index) => ({
      id: index + 1,
      accountId: statement.id,
      clientId: statement.clientId,
      createdAt: statement.createdAt,
      client: {
        clientName: statement.client.clientName,
        accessCode: statement.client.accessCode,
        createdAt: statement.client.createdAt
      },
      accountInfo: {
        bankName: statement.bankName,
        accountHolder: statement.accountHolder,
        accountNumber: statement.accountNumber,
        statementPeriod: {
          from: statement.statementFromDate,
          to: statement.statementToDate,
        },
        monthReference: statement.monthReference,
        balances: {
          beginning: statement.beginningBalance,
          ending: statement.endingBalance,
        },
      },
      transactions: statement.transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        details: {
          location: tx.location,
          referenceNumber: tx.referenceNumber,
          checkNumber: tx.checkNumber,
          classification: tx.split
        },
      })),
      checks: statement.checks.map((check) => ({
        checkNumber: check.checkNumber,
        date: check.date,
        amount: check.amount,
      })),
      summary: statement.summary
        ? {
            totalDeposits: statement.summary.totalDeposits,
            totalWithdrawals: statement.summary.totalWithdrawals,
            totalChecks: statement.summary.totalChecks,
            totalFees: statement.summary.totalFees,
          }
        : null,
    }));
  } catch (error) {
    console.error("Database error:", error);
    throw new Error("Failed to fetch bank statements");
  }
}

async function getBankStatementByAccountId(id) {
  try {
    const statement = await AccountInfo.findOne({
      where: { id },
      include: [
        {
          model: Transaction,
          as: "transactions",
        },
        {
          model: Check,
          as: "checks",
        },
        {
          model: Summary,
          as: "summary",
        },
      ],
    });

    if (!statement) {
      throw new Error("Bank statement not found");
    }

    // Format the response
    return {
      accountId: statement.id,
      accountInfo: {
        bankName: statement.bankName,
        accountHolder: statement.accountHolder,
        accountNumber: statement.accountNumber,
        statementPeriod: {
          from: statement.statementFromDate,
          to: statement.statementToDate,
        },
        balances: {
          beginning: statement.beginningBalance,
          ending: statement.endingBalance,
        },
      },
      transactions: statement.transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        details: {
          location: tx.location,
          referenceNumber: tx.referenceNumber,
          checkNumber: tx.checkNumber,
          classification: tx.split
        },
      })),
      checks: statement.checks.map((check) => ({
        checkNumber: check.checkNumber,
        date: check.date,
        amount: check.amount,
      })),
      summary: statement.summary
        ? {
            totalDeposits: statement.summary.totalDeposits,
            totalWithdrawals: statement.summary.totalWithdrawals,
            totalChecks: statement.summary.totalChecks,
            totalFees: statement.summary.totalFees,
          }
        : null,
    };
  } catch (error) {
    console.error("Database error:", error);
    throw new Error("Failed to fetch bank statement");
  }
}
// CLIENT CRUD OPERATIONS

// Create a new client
async function updateBankStatement(accountId, updates) {
  let t = null;
  try {
    t = await sequelize.transaction({
      timeout: 60000
    });

    const statement = await AccountInfo.findOne({
      where: { id: accountId },
      transaction: t,
      lock: true
    });

    if (!statement) {
      if (t) await t.rollback();
      throw new Error("Bank statement not found");
    }

    // Update AccountInfo if needed
    if (updates.accountInfo) {
      const accountInfoUpdates = {
        bankName: updates.accountInfo.bankName || statement.bankName,
        accountNumber: updates.accountInfo.accountNumber || statement.accountNumber,
        accountHolder: updates.accountInfo.accountHolder || statement.accountHolder,
        beginningBalance: updates.accountInfo.balances?.beginning !== undefined 
          ? updates.accountInfo.balances.beginning 
          : statement.beginningBalance,
        endingBalance: updates.accountInfo.balances?.ending !== undefined 
          ? updates.accountInfo.balances.ending 
          : statement.endingBalance,
      };

      await statement.update(accountInfoUpdates, { transaction: t });
    }

    // Handle transactions update
    if (updates.transactions && Array.isArray(updates.transactions)) {
      const transactionUpdates = updates.transactions.map(tx => ({
        id: tx.id,
        accountId: statement.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        location: tx.details?.location,
        referenceNumber: tx.details?.referenceNumber,
        checkNumber: tx.details?.checkNumber,
        split: tx.details?.classification  // Changed from classification to split
      }));

      // Update existing transactions
      await Promise.all(transactionUpdates.map(async (tx) => {
        if (tx.id) {
          await Transaction.update(tx, {
            where: { id: tx.id, accountId: statement.id },
            transaction: t
          });
        }
      }));
    }

    // Calculate new summary
    const summaryResult = await Transaction.findOne({
      attributes: [
        [sequelize.fn('SUM', 
          sequelize.literal('CASE WHEN type = \'credit\' THEN ABS(CAST(amount AS DECIMAL(10,2))) ELSE 0 END')
        ), 'totalDeposits'],
        [sequelize.fn('SUM', 
          sequelize.literal('CASE WHEN type = \'debit\' THEN ABS(CAST(amount AS DECIMAL(10,2))) ELSE 0 END')
        ), 'totalWithdrawals'],
        [sequelize.fn('SUM', 
          sequelize.literal('CASE WHEN type = \'check\' THEN ABS(CAST(amount AS DECIMAL(10,2))) ELSE 0 END')
        ), 'totalChecks'],
        [sequelize.fn('SUM', 
          sequelize.literal('CASE WHEN type = \'fee\' THEN ABS(CAST(amount AS DECIMAL(10,2))) ELSE 0 END')
        ), 'totalFees']
      ],
      where: { accountId: statement.id },
      transaction: t
    });

    const newSummary = {
      totalDeposits: summaryResult?.getDataValue('totalDeposits') || 0,
      totalWithdrawals: summaryResult?.getDataValue('totalWithdrawals') || 0,
      totalChecks: summaryResult?.getDataValue('totalChecks') || 0,
      totalFees: summaryResult?.getDataValue('totalFees') || 0,
      accountId: statement.id
    };

    // Update summary
    if (statement.summary) {
      await Summary.update(newSummary, {
        where: { accountId: statement.id },
        transaction: t
      });
    } else {
      await Summary.create(newSummary, { transaction: t });
    }

    await t.commit();
    t = null;

    // Fetch final statement
    const finalStatement = await AccountInfo.findOne({
      where: { id: accountId },
      include: [
        {
          model: Transaction,
          as: "transactions",
          attributes: ['id', 'date', 'description', 'amount', 'type', 'location', 'referenceNumber', 'checkNumber', 'split'],  // Changed from classification to split
          order: [["date", "DESC"]],
        },
        {
          model: Summary,
          as: "summary",
          attributes: ['totalDeposits', 'totalWithdrawals', 'totalChecks', 'totalFees']
        },
      ]
    });

    return finalStatement;
  } catch (error) {
    if (t) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }
    throw new Error(`Failed to update bank statement: ${error.message}`);
  }
}

module.exports = { updateBankStatement };
async function createClient(data) {
  try {
    const client = await Client.create({
      clientName: data.clientName,
      accessCode: data.accessCode,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      clientType: data.clientType,
    });
    return {
      success: true,
      client,
      message: "Client created successfully",
    };
  } catch (error) {
    console.error("Database error:", error);
    throw {
      success: false,
      error: error.message || "Failed to create client",
    };
  }
}

// Function to check if a client exists by accessCode
async function getClientByAccessCode(accessCode) {
  try {
    return await Client.findOne({ where: { accessCode } });
  } catch (error) {
    throw new Error("Error checking for existing access code");
  }
}

// Get all clients
async function getAllClients() {
  try {
    const clients = await Client.findAll();
    return clients.map((client) => ({
      id: client.id,
      accessCode: client.accessCode,
      clientName: client.clientName,
      contactName: client.contactName,
      contactPhone: client.contactPhone,
      clientType: client.clientType,
    }));
  } catch (error) {
    console.error("Database error:", error);
    throw new Error("Failed to fetch clients");
  }
}

// Get a client by ID
async function getClientById(id) {
  try {
    const client = await Client.findByPk(id);
    if (!client) {
      throw new Error("Client not found");
    }
    return {
      id: client.id,
      clientName: client.clientName,
      accessCode: client.accessCode,
      contactName: client.contactName,
      contactPhone: client.contactPhone,
      clientType: client.clientType,
    };
  } catch (error) {
    console.error("Database error:", error);
    throw new Error("Failed to fetch client");
  }
}

// Update a client by ID
async function updateClient(id, updates) {
  try {
    const client = await Client.findByPk(id);
    if (!client) {
      throw new Error("Client not found");
    }

    await client.update(updates);

    return {
      success: true,
      client,
      message: "Client updated successfully",
    };
  } catch (error) {
    console.error("Database error:", error);
    throw {
      success: false,
      error: error.message || "Failed to update client",
    };
  }
}

// Delete a client by ID
async function deleteClient(id) {
  try {
    const client = await Client.findByPk(id);
    if (!client) {
      throw new Error("Client not found");
    }

    await client.destroy();

    return {
      success: true,
      message: "Client deleted successfully",
    };
  } catch (error) {
    console.error("Database error:", error);
    throw {
      success: false,
      error: error.message || "Failed to delete client",
    };
  }
}


async function findSimilarDescription(description) {
  try {
    const normalizedDesc = description.toLowerCase().trim();

    // Get all patterns from classification_knowledge
    const knownClassifications = await Classification.findAll();

    for (const pattern of knownClassifications) {
      const regex = new RegExp(pattern.memo.toLowerCase().trim(), 'i');
      if (regex.test(normalizedDesc)) {
        console.log(`Matched transaction "${description}" to split category "${pattern.split}"`);
        return pattern.split;
      }
    }

    // No match found
    console.log(`No split category found for transaction "${description}"`);
    return null;
  } catch (error) {
    console.error('Classification error:', error);
    return null;
  }
}

function calculateSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  
  const commonWords = words1.filter(word => 
    words2.includes(word)
  );

  return commonWords.length / Math.max(words1.length, words2.length);
}

// CLIENT CRUD OPERATIONS ENDS




async function formatDate(date) {
  return date instanceof Date 
    ? date.toISOString().split('T')[0] // Convert to YYYY-MM-DD format
    : null;
}





// async function findSimilarDescription(transaction, accountInfo) {
//   try {
//     // Get accounts from chart of accounts
//     const chartAccounts = await ChartOfAccounts.findAll({
//       include: [{
//         model: DetailType,
//         attributes: ['detail_type_name']
//       }]
//     });

//     // For BKOFAMERICA transactions, use bank name + last 4 digits
//     if (transaction.description.toLowerCase().includes('bkofamerica')) {
//       const lastFourDigits = accountInfo.accountNumber.slice(-4);
//       return {
//         split: `Bank of America ${lastFourDigits}`,
//         account_code: '1000', // Cash and Cash Equivalents
//         detail_type_id: '1011',
//         subtype_id: '101'
//       };
//     }

//     // For all other bank transfers
//     if (transaction.description.toLowerCase().includes('zelle') || 
//         transaction.description.toLowerCase().includes('transfer') ||
//         transaction.description.toLowerCase().includes('deposit') ||
//         transaction.description.toLowerCase().includes('counter credit') ||
//         transaction.description.toLowerCase().includes('p2p') ||
//         transaction.description.toLowerCase().includes('a2a.tranfr')) {
        
//         const cashAccount = chartAccounts.find(acc => acc.account_code === '1000');
//         if (cashAccount) {
//           return {
//             split: cashAccount.account_name,
//             account_code: cashAccount.account_code,
//             detail_type_id: cashAccount.detail_type_id,
//             subtype_id: cashAccount.subtype_id
//           };
//         }
//     }

//     // For software expenses
//     if (transaction.description.toLowerCase().includes('qbooks') ||
//         transaction.description.toLowerCase().includes('intuit')) {
//         const softwareAccount = chartAccounts.find(acc => acc.account_code === '7300');
//         if (softwareAccount) {
//           return {
//             split: softwareAccount.account_name,
//             account_code: softwareAccount.account_code,
//             detail_type_id: softwareAccount.detail_type_id,
//             subtype_id: softwareAccount.subtype_id
//           };
//         }
//     }

//     return null;
//   } catch (error) {
//     console.error('Classification error:', error);
//     return null;
//   }
// }

// // Update the classifyTransactions function to pass accountInfo
// async function classifyTransactions(transactions, accountInfo) {
//   const t = await sequelize.transaction();
  
//   try {
//     let classifiedCount = 0;
//     const results = [];

//     for (const transaction of transactions) {
//       const classification = await findSimilarDescription(transaction, accountInfo);
      
//       if (classification) {
//         await Transaction.update({
//           split: classification.split,
//           account_code: classification.account_code,
//           detail_type_id: classification.detail_type_id,
//           subtype_id: classification.subtype_id
//         }, {
//           where: { id: transaction.id },
//           transaction: t
//         });

//         classifiedCount++;
//         results.push({
//           id: transaction.id,
//           description: transaction.description,
//           classification,
//           status: 'classified'
//         });
//       } else {
//         results.push({
//           id: transaction.id,
//           description: transaction.description,
//           status: 'unclassified'
//         });
//       }
//     }

//     await t.commit();
//     return {
//       totalProcessed: transactions.length,
//       classified: classifiedCount,
//       unclassified: transactions.length - classifiedCount,
//       results
//     };

//   } catch (error) {
//     await t.rollback();
//     throw error;
//   }
// }


async function findSimilarDescription(transaction, accountInfo) {
  try {
    // Fetch all accounts from the chart of accounts
    const chartAccounts = await ChartOfAccounts.findAll({
      include: [{
        model: DetailType,
        attributes: ['detail_type_name']
      }]
    });

    // Check for BKOFAMERICA transactions
    if (transaction.description.toLowerCase().includes('bkofamerica')) {
      const lastFourDigits = accountInfo.accountNumber.slice(-4);
      const bankAccountAccount = chartAccounts.find(acc => acc.account_code === '1000');
      if (bankAccountAccount) {
        return {
          split: `Bank of America ${lastFourDigits}`,
          account_code: bankAccountAccount.account_code,
          detail_type_id: bankAccountAccount.detail_type_id,
          subtype_id: bankAccountAccount.subtype_id
        };
      }
    }

    // Check for Online Banking Transfers
    if (transaction.description.toLowerCase().includes('online banking transfer')) {
      const onlineSalesAccount = chartAccounts.find(acc => acc.account_code === '4200');
      if (onlineSalesAccount) {
        return {
          split: onlineSalesAccount.account_name,
          account_code: onlineSalesAccount.account_code,
          detail_type_id: onlineSalesAccount.detail_type_id,
          subtype_id: onlineSalesAccount.subtype_id
        };
      }
    }

    // Check for Zelle payments
    if (transaction.description.toLowerCase().includes('zelle')) {
      const otherExpensesAccount = chartAccounts.find(acc => acc.account_code === '7400');
      if (otherExpensesAccount) {
        return {
          split: otherExpensesAccount.account_name,
          account_code: otherExpensesAccount.account_code,
          detail_type_id: otherExpensesAccount.detail_type_id,
          subtype_id: otherExpensesAccount.subtype_id
        };
      }
    }

    // Check for "WORKERS CU" transactions as Wages
    if (transaction.description.toLowerCase().includes('workers cu')) {
      const wagesAccount = chartAccounts.find(acc => acc.account_code === '6500');
      if (wagesAccount) {
        return {
          split: wagesAccount.account_name,
          account_code: wagesAccount.account_code,
          detail_type_id: wagesAccount.detail_type_id,
          subtype_id: wagesAccount.subtype_id
        };
      }
    }

    // Check for "Counter Credit" transactions as Accounts Receivable
    if (transaction.description.toLowerCase().includes('counter credit')) {
      const accountsReceivableAccount = chartAccounts.find(acc => acc.account_code === '1100');
      if (accountsReceivableAccount) {
        return {
          split: accountsReceivableAccount.account_name,
          account_code: accountsReceivableAccount.account_code,
          detail_type_id: accountsReceivableAccount.detail_type_id,
          subtype_id: accountsReceivableAccount.subtype_id
        };
      }
    }

    // Check for "Digital Federal DES:P2P PYMTS" transactions as Sales
    if (transaction.description.toLowerCase().includes('digital federal  des:p2p pymts')) {
      const salesAccount = chartAccounts.find(acc => acc.account_code === '4000');
      if (salesAccount) {
        return {
          split: salesAccount.account_name,
          account_code: salesAccount.account_code,
          detail_type_id: salesAccount.detail_type_id,
          subtype_id: salesAccount.subtype_id
        };
      }
    }

    // Check for software expenses
    if (transaction.description.toLowerCase().includes('qbooks') ||
        transaction.description.toLowerCase().includes('intuit')) {
      const softwareAccount = chartAccounts.find(acc => acc.account_code === '7300');
      if (softwareAccount) {
        return {
          split: softwareAccount.account_name,
          account_code: softwareAccount.account_code,
          detail_type_id: softwareAccount.detail_type_id,
          subtype_id: softwareAccount.subtype_id
        };
      }
    }

    // If no match is found, return null
    return null;
  } catch (error) {
    console.error('Classification error:', error);
    return null;
  }
}

async function classifyTransactions(transactions, accountInfo) {
  const t = await sequelize.transaction();
  
  try {
    let classifiedCount = 0;
    const results = [];

    for (const transaction of transactions) {
      const classification = await findSimilarDescription(transaction, accountInfo);
      
      if (classification) {
        await Transaction.update({
          split: classification.split,
          account_code: classification.account_code,
          detail_type_id: classification.detail_type_id,
          subtype_id: classification.subtype_id
        }, {
          where: { id: transaction.id },
          transaction: t
        });

        classifiedCount++;
        results.push({
          id: transaction.id,
          description: transaction.description,
          classification,
          status: 'classified'
        });
      } else {
        results.push({
          id: transaction.id,
          description: transaction.description,
          status: 'unclassified'
        });
      }
    }

    await t.commit();
    return {
      totalProcessed: transactions.length,
      classified: classifiedCount,
      unclassified: transactions.length - classifiedCount,
      results
    };

  } catch (error) {
    await t.rollback();
    throw error;
  }
}



module.exports = {
  saveBankStatementData,
  getAllBankStatements,
  getBankStatementByAccountId,
  updateBankStatement,
  createClient,
  getAllClients,
  getClientById,
  deleteClient,
  updateClient,
  getClientByAccessCode,
  findSimilarDescription,
  classifyTransactions,
  formatDate
};
