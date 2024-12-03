// index.js

require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const pdf = require("pdf-parse");
const Anthropic = require("@anthropic-ai/sdk");
const {
  saveBankStatementData,
  getAllBankStatements,
  getBankStatementByAccountId,
  updateBankStatement,
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  getClientByAccessCode,
  findSimilarDescription,
  classifyTransactions,
  formatDate,
} = require("./database/operations");
const {
  Client,
  Classification,
  Transaction,
  AccountInfo,
  ChartOfAccounts,
  DetailType,
} = require("./models/BankStatement");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("./config/config");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const app = express();
const port = process.env.PORT;
const debugLog = false; // Enable detailed logging

// Middleware
app.use(cors());
app.use(express.json());

app.use("/api/pdf", express.static(path.join(__dirname, "uploads")));

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    },
  }),
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed!"), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to determine transaction type
function determineTransactionType(description, amount) {
  description = description.toLowerCase().trim();

  return amount > 0 ? "credit" : "debit";
}

// Helper function to process transaction details
function processTransaction(rawTransaction) {
  const amount =
    typeof rawTransaction.amount === "string"
      ? parseFloat(rawTransaction.amount.replace(/[^0-9.-]/g, ""))
      : rawTransaction.amount;

  return {
    date: rawTransaction.date,
    description: rawTransaction.description,
    amount: amount,
    type: determineTransactionType(rawTransaction.description, amount),
    details: {
      location: extractLocation(rawTransaction.description),
      referenceNumber: extractReferenceNumber(rawTransaction.description),
      checkNumber: extractCheckNumber(rawTransaction.description),
    },
  };
}

// Helper functions for extraction
function extractLocation(description) {
  const locationMatch = description.match(
    /(?:at|in)\s+([A-Za-z\s]+?)(?:\s+\d|$)/i
  );
  return locationMatch ? locationMatch[1].trim() : null;
}

function extractReferenceNumber(description) {
  const refMatch = description.match(/(?:ref|conf)[#:\s]+([A-Za-z0-9]+)/i);
  return refMatch ? refMatch[1] : null;
}

function extractCheckNumber(description) {
  const checkMatch = description.match(/check\s*#?\s*(\d+)/i);
  return checkMatch ? checkMatch[1] : null;
}

// Main function to extract data from bank statement
async function extractBankStatementData(textContent) {
  const systemPrompt = `Extract information from the bank statement and return ONLY a JSON object with this exact structure, nothing else before or after:
{
    "accountInfo": {
        "bankName": "string",
        "accountHolder": "string",
        "accountNumber": "string",
        "statementPeriod": {
            "from": "YYYY-MM-DD",
            "to": "YYYY-MM-DD"
        },
        "balances": {
            "beginning": number,
            "ending": number
        }
    },
    "transactions": [
        {
            "date": "YYYY-MM-DD",
            "description": "string",
            "amount": number,
            "type": "string"
        }
    ],
    "checks": [
        {
            "checkNumber": "string",
            "date": "YYYY-MM-DD",
            "amount": number
        }
    ]
}`;

  try {
    if (debugLog) console.log("Sending request to Claude API...");

    const message = await client.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Parse this bank statement and return ONLY the JSON object, with no additional text or formatting: ${textContent}`,
        },
      ],
    });

    if (debugLog) console.log("Received response from Claude API");

    let responseText = message.content[0].text.trim();
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "");

    if (debugLog) {
      console.log("Cleaned response text:", responseText);
    }

    try {
      const parsedData = JSON.parse(responseText);
      if (debugLog) console.log("Successfully parsed JSON:", parsedData);
      return parsedData;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);

      // Attempt to extract JSON if it's wrapped in other text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const extractedJson = JSON.parse(jsonMatch[0]);
          if (debugLog)
            console.log(
              "Successfully extracted and parsed JSON:",
              extractedJson
            );
          return extractedJson;
        } catch (e) {
          throw new Error("Could not parse JSON from response");
        }
      }
      throw new Error("Invalid JSON format in response");
    }
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// API Endpoint for processing bank statement
app.post(
  "/api/process-statement",
  upload.single("pdfFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      // Extract client information from request body
      const { clientName, accessCode, id, monthReference } = req.body;

      // Validate client information and monthReference
      if (!clientName || !accessCode || !id || !monthReference) {
        return res.status(400).json({
          error:
            "Missing required information. Please provide clientName, accessCode, monthReference and id",
        });
      }

      // Verify client exists
      const client = await Client.findOne({
        where: {
          id: id,
          clientName: clientName,
          accessCode: accessCode,
        },
      });

      if (!client) {
        return res.status(404).json({
          error: "Client not found or credentials don't match",
        });
      }

      if (debugLog) console.log("Processing PDF file:", req.file.filename);

      const pdfUrl = `${req.protocol}://${req.get("host")}/api/pdf/${
        req.file.filename
      }`;
      const pdfFileSize = req.file.size;

      // Read and parse PDF
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdf(dataBuffer);

      if (debugLog) console.log("PDF text extracted successfully");

      // Extract data using Claude
      const extractedData = await extractBankStatementData(pdfData.text);

      // Process transactions and checks
      if (extractedData.transactions) {
        extractedData.transactions =
          extractedData.transactions.map(processTransaction);
      }

      if (extractedData.checks) {
        extractedData.checks = extractedData.checks.map((check) => ({
          ...check,
          amount: Number(check.amount),
        }));
      }

      // Calculate summary
      const summary = {
        totalDeposits: extractedData.transactions
          .filter((tx) => tx.amount > 0)
          .reduce((sum, tx) => sum + tx.amount, 0),
        totalWithdrawals: Math.abs(
          extractedData.transactions
            .filter((tx) => tx.amount < 0)
            .reduce((sum, tx) => sum + tx.amount, 0)
        ),
        totalChecks: extractedData.checks
          ? extractedData.checks.reduce(
              (sum, check) => sum + Math.abs(check.amount),
              0
            )
          : 0,
        totalFees: Math.abs(
          extractedData.transactions
            .filter((tx) => tx.type === "fee")
            .reduce((sum, tx) => sum + tx.amount, 0)
        ),
      };

      // Create the account info object with monthReference
      const accountInfo = {
        ...extractedData.accountInfo,
        monthReference: monthReference, // Ensure monthReference is included
        clientId: client.id,
        pdfUrl: pdfUrl,
        pdfFileName: req.file.filename,
        pdfUploadDate: new Date(),
        pdfFileSize: pdfFileSize,
      };

      const response = {
        accountInfo: accountInfo,
        transactions: extractedData.transactions,
        checks: extractedData.checks,
        summary: summary,
      };

      // Save to database with client information - explicitly include monthReference
      const dbResult = await saveBankStatementData({
        ...response,
        accountInfo: {
          ...response.accountInfo,
          monthReference: monthReference, // Ensure it's passed to the save function
        },
        clientId: client.id,
        clientAccessCode: accessCode,
      });

      // Send response with database result and client information
      res.json({
        ...response,
        databaseOperation: dbResult,
        client: {
          id: client.id,
          name: client.clientName,
        },
      });
    } catch (error) {
      console.error("Error processing statement:", error);

      res.status(500).json({
        error: "Failed to process statement",
        details: error.message,
      });
    }
  }
);

// Add endpoint to serve PDFs
app.get("/api/pdf/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "uploads", filename);

    // Basic security check
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "PDF not found" });
    }

    // Set headers for PDF viewing
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error serving PDF:", error);
    res.status(500).json({ error: "Failed to serve PDF" });
  }
});

// GET: Fetch all bank statements
app.get("/api/bank-statements", async (req, res) => {
  try {
    // Assuming you add this function to your database/operations.js
    const statements = await getAllBankStatements();

    if (!statements || statements.length === 0) {
      return res.status(404).json({
        message: "No bank statements found",
        data: [],
      });
    }

    res.json({
      message: "Successfully retrieved all bank statements",
      data: statements,
    });
  } catch (error) {
    console.error("Error fetching bank statements:", error);
    res.status(500).json({
      error: "Failed to retrieve bank statements",
      details: error.message,
    });
  }
});

// GET: Fetch bank statement by account ID
app.get("/api/bank-statements/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;

    // Assuming you add this function to your database/operations.js
    const statement = await getBankStatementByAccountId(accountId);

    if (!statement) {
      return res.status(404).json({
        message: `No bank statement found for account ID: ${accountId}`,
        data: null,
      });
    }

    res.json({
      message: "Successfully retrieved bank statement",
      data: statement,
    });
  } catch (error) {
    console.error("Error fetching bank statement:", error);
    res.status(500).json({
      error: "Failed to retrieve bank statement",
      details: error.message,
    });
  }
});

app.put("/api/bank-statements/:accountId", async (req, res) => {
  const { accountId } = req.params;
  const updates = req.body;

  try {
    // Input validation
    if (!accountId || isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid account ID provided",
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Update data is required",
      });
    }

    // Validate required data structures
    if (updates.accountInfo && typeof updates.accountInfo !== 'object') {
      return res.status(400).json({
        success: false,
        error: "Invalid account info format",
      });
    }

    if (updates.transactions && !Array.isArray(updates.transactions)) {
      return res.status(400).json({
        success: false,
        error: "Transactions must be an array",
      });
    }

    // Set timeout for the request
    req.setTimeout(120000); // 2 minute timeout for the entire request

    // Attempt update with progress logging
    const updatedStatement = await updateBankStatement(accountId, updates);

    if (!updatedStatement) {
      return res.status(404).json({
        success: false,
        error: `No bank statement found for account ID: ${accountId}`,
      });
    }

    // Success response
    res.json({
      success: true,
      message: "Successfully updated bank statement",
      data: updatedStatement,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error in bank statement update:", {
      accountId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Determine appropriate error status
    let statusCode = 500;
    if (error.message.includes("not found")) {
      statusCode = 404;
    } else if (error.message.includes("validation") || error.message.includes("invalid")) {
      statusCode = 400;
    } else if (error.message.includes("timeout")) {
      statusCode = 504;
    }

    res.status(statusCode).json({
      success: false,
      error: "Failed to update bank statement",
      details: error.message,
      code: statusCode,
      timestamp: new Date().toISOString()
    });
  }
});

// Create a new client
app.post("/api/add-client", async (req, res) => {
  try {
    const { clientName, accessCode, contactName, contactPhone, clientType } =
      req.body;

    // Check if the accessCode already exists in the database
    const existingClient = await getClientByAccessCode(accessCode);

    if (existingClient) {
      // If a client with the same accessCode already exists, return an error
      return res.status(400).json({ error: "Access code already exists" });
    }

    const clients = await getAllClients();

    for (const item of clients) {
      if (item.clientName === clientName) {
        return res.status(400).json({ error: "Client name already exists!" });
      }
    }

    const result = await createClient({
      clientName,
      accessCode,
      contactName,
      contactPhone,
      clientType,
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all clients
app.get("/api/client", async (req, res) => {
  try {
    const clients = await getAllClients();
    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a client by ID
app.get("/api/client/:id", async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await getClientById(clientId);
    res.status(200).json(client);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Update a client by ID
app.put("/api/update-client/:id", async (req, res) => {
  try {
    const clientId = req.params.id;
    const updates = req.body;

    // Fetch the existing client by ID to compare accessCode if it is being updated
    const currentClient = await Client.findByPk(clientId);
    if (!currentClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    // If accessCode is being updated, ensure it is unique
    if (updates.accessCode && updates.accessCode !== currentClient.accessCode) {
      // Check if any other client already has the new accessCode
      const existingClient = await Client.findOne({
        where: { accessCode: updates.accessCode },
      });

      if (existingClient) {
        return res.status(400).json({
          error: `Access code ${updates.accessCode} already exists. Please use a unique access code.`,
        });
      }
    }

    // Proceed with updating the client data
    const result = await updateClient(clientId, updates);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a client by ID
app.delete("/api/delete/:id", async (req, res) => {
  try {
    const clientId = req.params.id;
    const result = await deleteClient(clientId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// app.post('/api/classify-transactions', async (req, res) => {
//   let t;
//   try {
//     t = await sequelize.transaction();

//     // Fetch all unclassified transactions
//     const transactions = await Transaction.findAll({
//       where: {
//         split: null  // Only get unclassified transactions
//       },
//       attributes: ['id', 'date', 'description', 'amount', 'type', 'split', 'account_code', 'detail_type_id', 'subtype_id'],
//       include: [
//         { model: AccountInfo },
//         {
//           model: ChartOfAccounts,
//           attributes: ['account_name', 'account_code', 'detail_type_id', 'subtype_id']
//         }
//       ],
//       order: [['date', 'DESC']]
//     });

//     console.log(`Processing ${transactions.length} transactions`);

//     const classificationResult = await classifyTransactions(transactions);

//     // Fetch ALL transactions after classification (including previously classified ones)
//     const updatedTransactions = await Transaction.findAll({
//       attributes: ['id', 'date', 'description', 'amount', 'type', 'split', 'account_code', 'detail_type_id', 'subtype_id'],
//       include: [
//         { model: AccountInfo },
//         {
//           model: ChartOfAccounts,
//           attributes: ['account_name', 'account_code']
//         }
//       ],
//       order: [['date', 'DESC']]
//     });

//     res.json({
//       success: true,
//       message: `Classification completed. ${classificationResult.classified} out of ${transactions.length} transactions classified.`,
//       statistics: classificationResult,
//       accountInfo: updatedTransactions[0]?.AccountInfo,
//       transactions: updatedTransactions.map(transaction => ({
//         id: transaction.id,
//         date: transaction.date,
//         description: transaction.description,
//         amount: transaction.amount,
//         type: transaction.type,
//         split: transaction.split,
//         account_code: transaction.account_code,
//         detail_type_id: transaction.detail_type_id,
//         subtype_id: transaction.subtype_id,
//         chartOfAccount: transaction.ChartOfAccount
//       }))
//     });

//   } catch (error) {
//     if (t && !t.finished) {
//       await t.rollback();
//     }
//     console.error('Classification Error:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// Endpoint to manually update classification

app.get("/api/classify-transactions", async (req, res) => {
  let t;
  try {
    t = await sequelize.transaction();

    // Fetch all unclassified transactions
    const transactions = await Transaction.findAll({
      where: {
        split: null, // Only get unclassified transactions
      },
      attributes: [
        "id",
        "date",
        "description",
        "amount",
        "type",
        "split",
        "account_code",
        "detail_type_id",
        "subtype_id",
      ],
      include: [
        { model: AccountInfo },
        {
          model: ChartOfAccounts,
          attributes: [
            "account_name",
            "account_code",
            "detail_type_id",
            "subtype_id",
          ],
        },
      ],
      order: [["date", "DESC"]],
    });

    const classificationResult = await classifyTransactions(
      transactions,
      transactions.length > 0 ? transactions[0].AccountInfo : null
    );

    // Fetch ALL transactions after classification (including previously classified ones)
    const updatedTransactions = await Transaction.findAll({
      attributes: [
        "id",
        "date",
        "description",
        "amount",
        "type",
        "split",
        "account_code",
        "detail_type_id",
        "subtype_id",
      ],
      include: [
        { model: AccountInfo },
        {
          model: ChartOfAccounts,
          attributes: ["account_name", "account_code"],
        },
      ],
      order: [["date", "DESC"]],
    });

    res.json({
      success: true,
      message: `Classification completed. ${classificationResult.classified} out of ${transactions.length} transactions classified.`,
      statistics: classificationResult,
      accountInfo:
        updatedTransactions.length > 0
          ? updatedTransactions[0].AccountInfo
          : null,
      transactions: updatedTransactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        split: transaction.split,
        account_code: transaction.account_code,
        detail_type_id: transaction.detail_type_id,
        subtype_id: transaction.subtype_id,
        chartOfAccount: transaction.ChartOfAccount,
      })),
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error("Classification Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.put("/api/update-classification", async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { transactionId, classificationCode, account, split } = req.body;

    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    await transaction.update(
      {
        classification_code: classificationCode,
        classification_account: account,
        classification_split: split,
      },
      { transaction: t }
    );

    // Update classification knowledge
    await Classification.create(
      {
        type: classificationCode,
        name: transaction.description,
        memo: transaction.description,
        account: account,
        split: split,
        debit: transaction.amount < 0 ? Math.abs(transaction.amount) : null,
        credit: transaction.amount > 0 ? transaction.amount : null,
      },
      { transaction: t }
    );

    await t.commit();

    res.json({
      success: true,
      transaction,
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: `File upload error: ${err.message}`,
    });
  }

  res.status(500).json({
    error: "Internal server error",
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
