// =================================================================
// 1. IMPORTS & INITIALIZATION
// =================================================================
require('dotenv').config();
const express = require("express");
const { Sequelize, DataTypes, Op } = require("sequelize");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Tesseract = require("tesseract.js"); // <-- IMPORT TESSERACT.JS
const dayjs = require('dayjs');
const pdf = require('pdf-parse'); // Add this import at the top of server.js
const { GoogleGenerativeAI } = require("@google/generative-ai"); // <-- ADD THIS

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = "yuduyhg84478937836rydsegf7fiuydgew3887";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // <-- ADD THIS

// Middleware setup
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// =================================================================
// 2. DATABASE (SEQUELIZE) SETUP
// =================================================================
const sequelize = new Sequelize("sqlite://money.db");

// --- Define Models ---

const User = sequelize.define("User", {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
});

const Category = sequelize.define(
  "Category",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("income", "expense"),
      allowNull: false,
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["name", "UserId"],
      },
    ],
  },
);

const Transaction = sequelize.define("Transaction", {
  description: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  transactionDate: { type: DataTypes.DATEONLY, allowNull: false },
});

// --- Define Associations ---
User.hasMany(Transaction);
Transaction.belongsTo(User);

User.hasMany(Category);
Category.belongsTo(User);

Category.hasMany(Transaction);
Transaction.belongsTo(Category);

// =================================================================
// 3. AUTHENTICATION MIDDLEWARE
// =================================================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    return res
      .status(401)
      .json({ message: "Authentication token is required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token is invalid or expired" });
    }
    req.user = user;
    next();
  });
};

// =================================================================
// 4. API ROUTES
// =================================================================

const upload = multer({ storage: multer.memoryStorage() });

// --- Auth Routes (unchanged) ---
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ email, passwordHash });
    res.status(201).json({ id: newUser.id, email: newUser.email });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "8h",
    });
    res.json({ accessToken: token });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

// --- Category and Transaction Routes (unchanged) ---
app.post("/api/categories", authenticateToken, async (req, res) => {
  try {
    const { name, type } = req.body;
    const category = await Category.create({ name, type, UserId: req.user.id });
    res.status(201).json(category);
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return res
        .status(409)
        .json({ message: "A category with this name already exists." });
    }
    res
      .status(500)
      .json({ message: "Error creating category", error: error.message });
  }
});

app.get("/api/categories", authenticateToken, async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { UserId: req.user.id },
    });
    res.json(categories);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching categories", error: error.message });
  }
});

app.post("/api/transactions", authenticateToken, async (req, res) => {
  try {
    const { description, amount, transactionDate, categoryId } = req.body;
    const transaction = await Transaction.create({
      description,
      amount,
      transactionDate,
      CategoryId: categoryId,
      UserId: req.user.id,
    });
    res.status(201).json(transaction);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating transaction", error: error.message });
  }
});

app.get("/api/transactions", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.transactionDate = { [Op.between]: [startDate, endDate] };
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Transaction.findAndCountAll({
      where: {
        UserId: req.user.id,
        ...dateFilter,
      },
      include: Category,
      order: [["transactionDate", "DESC"]],
      limit,
      offset,
    });

    res.json({
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      transactions: rows,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching transactions", error: error.message });
  }
});

// In server.js, add this code block in section #4 (API ROUTES),
// perhaps near your other transaction routes.

// app.post("/api/transactions/upload-pdf", authenticateToken, upload.single('file'), async (req, res) => {
//     if (!req.file) {
//         return res.status(400).json({ error: 'No PDF file uploaded.' });
//     }

//     try {
//         const dataBuffer = req.file.buffer;
//         const pdfData = await pdf(dataBuffer);
//         const text = pdfData.text;

//         const lines = text.split('\n');
//         const transactionsToCreate = [];
//         let importedCount = 0;
//         let duplicateCount = 0;
        
//         // This regex is an EXAMPLE for a bank statement. You may need to adjust it.
//         // It looks for a date, a description, and a withdrawal/debit amount.
//         const transactionRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s+([\d,]+\.\d{2})/;

//         for (const line of lines) {
//             const match = line.match(transactionRegex);
//             if (match) {
//                 const [_, dateStr, description, amountStr] = match;
                
//                 const date = dayjs(dateStr, 'MM/DD/YYYY').format('YYYY-MM-DD');
//                 const amount = parseFloat(amountStr.replace(/,/g, ''));
//                 const trimmedDesc = description.trim();

//                 // Simple duplicate check
//                 const existing = await Transaction.findOne({
//                     where: { UserId: req.user.id, transactionDate: date, amount, description: trimmedDesc }
//                 });

//                 if (!existing) {
//                     transactionsToCreate.push({
//                         transactionDate: date,
//                         description: trimmedDesc,
//                         amount,
//                         // You'll need a way to assign categories. Defaulting is simplest.
//                         CategoryId: 1, // You MUST have a category with ID 1, or handle this better.
//                         UserId: req.user.id,
//                     });
//                     importedCount++;
//                 } else {
//                     duplicateCount++;
//                 }
//             }
//         }
        
//         if (transactionsToCreate.length > 0) {
//             await Transaction.bulkCreate(transactionsToCreate);
//         }

//         res.status(201).json({ 
//             message: 'PDF processed.',
//             imported: importedCount,
//             duplicates: duplicateCount 
//         });

//     } catch (error) {
//         console.error('PDF parsing error:', error);
//         res.status(500).json({ error: 'Failed to parse PDF.' });
//     }
// });

// =================================================================
// 5. OCR IMPLEMENTATION AND HELPERS
// =================================================================


// In server.js, REPLACE your entire app.post("/api/transactions/upload-pdf", ...) route with this:

app.post("/api/transactions/upload-pdf", authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    try {
        const dataBuffer = req.file.buffer;
        const pdfData = await pdf(dataBuffer);
        const text = pdfData.text;

        // --- FIX #2: ROBUST CATEGORY HANDLING ---
        // Find the user's first expense category, or create a default one.
        let defaultCategory = await Category.findOne({
            where: { UserId: req.user.id, type: 'expense' }
        });
        
        if (!defaultCategory) {
            defaultCategory = await Category.create({
                name: 'Uncategorized',
                type: 'expense',
                UserId: req.user.id
            });
        }
        const defaultCategoryId = defaultCategory.id;
        // ----------------------------------------

        const lines = text.split('\n');
        const transactionsToCreate = [];
        let importedCount = 0;
        let duplicateCount = 0;
        
        const transactionRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s+([\d,]+\.\d{2})/;

        for (const line of lines) {
            const match = line.match(transactionRegex);
            if (match) {
                const [_, dateStr, description, amountStr] = match;
                
                // --- FIX #1: DAYJS IS NOW AVAILABLE ---
                // Custom parsing is needed because dayjs needs a hint for MM/DD/YYYY
                const customParseFormat = require('dayjs/plugin/customParseFormat');
                dayjs.extend(customParseFormat);
                const date = dayjs(dateStr, 'MM/DD/YYYY').format('YYYY-MM-DD');
                // ----------------------------------------

                const amount = parseFloat(amountStr.replace(/,/g, ''));
                const trimmedDesc = description.trim();

                const existing = await Transaction.findOne({
                    where: { UserId: req.user.id, transactionDate: date, amount, description: trimmedDesc }
                });

                if (!existing) {
                    transactionsToCreate.push({
                        transactionDate: date,
                        description: trimmedDesc,
                        amount,
                        CategoryId: defaultCategoryId, // Use the safe, robust category ID
                        UserId: req.user.id,
                    });
                    importedCount++;
                } else {
                    duplicateCount++;
                }
            }
        }
        
        if (transactionsToCreate.length > 0) {
            await Transaction.bulkCreate(transactionsToCreate);
        }

        res.status(201).json({ 
            message: 'PDF processed successfully.',
            imported: importedCount,
            duplicates: duplicateCount 
        });

    } catch (error) {
        console.error('PDF parsing error:', error);
        res.status(500).json({ error: 'Failed to parse PDF.' });
    }
});

// Add these two new routes to your API ROUTES section in server.js

// In backend/server.js
// Find your PUT and DELETE routes and REPLACE them with these.

// UPDATE a transaction
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const { description, amount, transactionDate, categoryId } = req.body;
        // Ensure you're finding by the PRIMARY KEY and also the USER ID for security
        const transaction = await Transaction.findOne({
            where: { id: req.params.id, UserId: req.user.id }
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or you do not have permission to edit it.' });
        }

        // Use the .update() method for clarity
        await transaction.update({
            description,
            amount,
            transactionDate,
            CategoryId: categoryId,
        });

        res.json(transaction);
    } catch (error) {
        res.status(500).json({ message: 'Error updating transaction', error: error.message });
    }
});

// DELETE a transaction
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            where: { id: req.params.id, UserId: req.user.id }
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found or you do not have permission to delete it.' });
        }

        await transaction.destroy();
        res.status(204).send(); // Send a 204 No Content response
    } catch (error) {
        res.status(500).json({ message: 'Error deleting transaction', error: error.message });
    }
});

// --- NEW: AI Financial Coach Route ---
// app.post("/api/ai/chat", authenticateToken, async (req, res) => {
//     const { query } = req.body;
//     if (!query) {
//         return res.status(400).json({ error: "Query is required." });
//     }
//     const userId = req.user.id;

//     try {
//         // Step 1: Retrieve relevant transactions from YOUR database (The "R" in RAG).
//         const transactions = await Transaction.findAll({
//             where: { UserId: userId },
//             include: Category, // Include category details for better context
//             order: [['transactionDate', 'DESC']],
//             limit: 50 // Limit context to recent transactions to avoid overly long prompts
//         });

//         if (transactions.length === 0) {
//             return res.json({ response: "I don't have any transaction data to analyze yet. Please add some transactions first!" });
//         }

//         // Step 2: Augment the data into a clean text context for the LLM.
//         const context = "User's recent transactions:\n" + transactions.map(t => 
//             `- Date: ${t.transactionDate}, Description: ${t.description}, Amount: ${t.amount}, Category: ${t.Category.name} (${t.Category.type})`
//         ).join('\n');

//         // Step 3: Generate a response with a carefully engineered prompt.
//         const model = genAI.getGenerativeModel({ model: "gemini-pro" });
//         const prompt = `You are a helpful and concise personal finance assistant. Analyze the following user transaction data to answer their question. Provide actionable insights but do not give financial advice. Base your answer ONLY on the data provided.

//         --- TRANSACTION DATA ---
//         ${context}
//         ------------------------

//         USER QUESTION: "${query}"

//         YOUR ANALYSIS:`;

//         const result = await model.generateContent(prompt);
//         const response = await result.response;
//         const text = response.text();

//         res.json({ response: text });
//     } catch (error) {
//         console.error("AI chat error:", error);
//         res.status(500).json({ error: "Failed to get AI response." });
//     }
// });

// In backend/server.js, REPLACE your entire AI Chat route with this one:

// --- AI Financial Coach Route (CORRECTED) ---
// In backend/server.js, REPLACE your entire AI Chat route with this one:

// --- AI Financial Coach Route (CORRECTED) ---
app.post("/api/ai/chat", authenticateToken, async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required." });
    }
    const userId = req.user.id;

    try {
        const transactions = await Transaction.findAll({
            where: { UserId: userId },
            include: Category,
            order: [['transactionDate', 'DESC']],
            limit: 50
        });

        if (transactions.length === 0) {
            return res.json({ response: "I don't have any transaction data to analyze yet. Please add some transactions first!" });
        }

        // --- THIS IS THE FIX ---
        // This makes the code robust by safely handling transactions that might not have a category.
        const context = "User's recent transactions:\n" + transactions.map(t => {
            // Use optional chaining (?.) to safely access category properties.
            // Use the nullish coalescing operator (??) to provide a default fallback value.
            const categoryName = t.Category?.name ?? 'Uncategorized';
            const categoryType = t.Category?.type ?? 'expense';
            
            return `- Date: ${t.transactionDate}, Description: ${t.description}, Amount: ${t.amount}, Category: ${categoryName} (${categoryType})`;
        }).join('\n');
        // --- END OF FIX ---

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const prompt = `You are a helpful and concise personal finance assistant. Analyze the following user transaction data to answer their question. Provide actionable insights but do not give financial advice. Base your answer ONLY on the data provided.

        --- TRANSACTION DATA ---
        ${context}
        ------------------------

        USER QUESTION: "${query}"

        YOUR ANALYSIS:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ response: text });
    } catch (error) {
        console.error("AI chat error:", error);
        res.status(500).json({ error: "Failed to get AI response." });
    }
});

/**
 * Parses raw text from a receipt to find key information.
 * This is a simplified parser and may need to be more robust for production.
 * @param {string} text The raw text extracted by OCR.
 * @returns {object} An object containing the extracted merchant, total, and date.
 */
const parseReceiptText = (text) => {
  let merchant = "Unknown Merchant";
  let total = null;
  let date = null;

  const lines = text.split("\n");

  // 1. Find Merchant (heuristic: usually one of the first few non-empty lines)
  for (const line of lines) {
    if (line.trim().length > 0) {
      merchant = line.trim();
      break;
    }
  }

  // 2. Find Total (using regex to find common patterns like "Total", "TOTAL", etc.)
  const totalRegex = /(?:total|amount|due|balance)[\s:]*[$€£]?\s*(\d+\.\d{2})/i;
  const totalMatch = text.match(totalRegex);
  if (totalMatch && totalMatch[1]) {
    total = parseFloat(totalMatch[1]);
  } else {
    // Fallback: Find the largest number with a decimal, assuming it's the total.
    const numbers = text.match(/\d+\.\d{2}/g) || [];
    const amounts = numbers.map(parseFloat);
    if (amounts.length > 0) {
      total = Math.max(...amounts);
    }
  }

  // 3. Find Date (using regex for common formats like MM/DD/YYYY, YYYY-MM-DD)
  const dateRegex = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}-\d{2}-\d{2})/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch && (dateMatch[1] || dateMatch[2])) {
    // Attempt to create a valid date object to standardize the format
    const parsedDate = new Date(dateMatch[1] || dateMatch[2]);
    if (!isNaN(parsedDate)) {
      date = parsedDate.toISOString().slice(0, 10);
    }
  }

  // If no date was found, default to today's date
  if (!date) {
    date = new Date().toISOString().slice(0, 10);
  }

  return { merchant, total, date };
};


// --- UPDATED OCR Route ---
app.post(
  "/api/upload/receipt",
  authenticateToken,
  upload.single("receipt"),
  async (req, res) => {
    req.setTimeout(300000); // Keep the 5-minute timeout

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    let worker; // Define worker here to access it in the finally block

    try {
      console.log(
        `Processing file: ${req.file.originalname} with Tesseract.js...`,
      );

      // *** THIS IS THE FIX ***
      // The new API combines worker creation, language loading, and initialization.
      // Replace the old three lines with this single line.
      worker = await Tesseract.createWorker("eng");

      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      });

      const {
        data: { text },
      } = await worker.recognize(req.file.buffer);

      console.log("OCR Raw Output:\n", text);

      const extractedData = parseReceiptText(text);

      res.json({
        message: "Receipt processed successfully",
        extractedData,
      });
    } catch (error) {
      console.error("OCR Processing Error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          message: "Failed to process receipt.",
          error: error.message,
        });
      }
    } finally {
      // Terminate the worker if it was created
      if (worker) {
        await worker.terminate();
      }
    }
  },
);

// --- Analytics Route (unchanged) ---
// app.get("/api/analytics/summary", authenticateToken, async (req, res) => {
//   try {
//     const expensesByCategory = await Transaction.findAll({
//       attributes: [
//         [Sequelize.col("Category.name"), "category"],
//         [Sequelize.fn("SUM", Sequelize.col("amount")), "total"],
//       ],
//       include: [
//         {
//           model: Category,
//           attributes: [],
//           where: { type: "expense" },
//         },
//       ],
//       where: { UserId: req.user.id },
//       group: ["Category.name"],
//       raw: true,
//     });

//     res.json({ expensesByCategory });
//   } catch (error) {
//     res.status(500).json({
//       message: "Error fetching analytics summary",
//       error: error.message,
//     });
//   }
// });

// and REPLACE it with this more powerful version:

app.get("/api/analytics/summary", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;

    // Build the date filter if dates are provided
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.transactionDate = { [Op.between]: [startDate, endDate] };
    }

    // 1. Expenses by Category (Your existing query, now with date filtering)
    const expensesByCategory = await Transaction.findAll({
      attributes: [
        [Sequelize.col("Category.name"), "category"],
        [Sequelize.fn("SUM", Sequelize.col("amount")), "total"],
      ],
      include: [{ model: Category, attributes: [], where: { type: "expense" } }],
      where: { UserId: userId, ...dateFilter },
      group: ["Category.name"],
      raw: true,
    });

    // 2. NEW: Income vs Expense data (for a Bar Chart)
    const incomeVsExpense = await Transaction.findAll({
        where: { UserId: userId, ...dateFilter },
        attributes: [
            // We need to get the 'type' from the associated Category
            [Sequelize.col("Category.type"), "type"],
            [Sequelize.fn("SUM", Sequelize.col("amount")), "totalAmount"],
        ],
        include: [{ model: Category, attributes: [] }],
        group: [Sequelize.col("Category.type")],
        raw: true
    });

    // 3. NEW: Expenses Over Time (for a Line Chart)
    const expensesOverTime = await Transaction.findAll({
      where: { UserId: userId, ...dateFilter },
      include: [{ model: Category, attributes: [], where: { type: 'expense' } }],
      attributes: [
        // Use DATE for SQLite compatibility to group by day
        [Sequelize.fn("DATE", Sequelize.col("transactionDate")), "date"],
        [Sequelize.fn("SUM", Sequelize.col("amount")), "totalAmount"],
      ],
      group: [Sequelize.fn("DATE", Sequelize.col("transactionDate"))],
      order: [[Sequelize.fn("DATE", Sequelize.col("transactionDate")), "ASC"]],
      raw: true,
    });

    res.json({ expensesByCategory, incomeVsExpense, expensesOverTime });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching analytics summary",
      error: error.message,
    });
  }
});

// =================================================================
// 6. SERVER STARTUP
// =================================================================
const startServer = async () => {
  try {
    await sequelize.sync();
    console.log("Database synchronized successfully.");

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

startServer();
