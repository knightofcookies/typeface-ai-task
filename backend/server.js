// =================================================================
// 1. IMPORTS & INITIALIZATION
// =================================================================
const express = require("express");
const { Sequelize, DataTypes, Op } = require("sequelize");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Tesseract = require("tesseract.js"); // <-- IMPORT TESSERACT.JS

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = "yuduyhg84478937836rydsegf7fiuydgew3887";

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

// =================================================================
// 5. OCR IMPLEMENTATION AND HELPERS
// =================================================================

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

const upload = multer({ storage: multer.memoryStorage() });

// --- UPDATED OCR Route ---
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
app.get("/api/analytics/summary", authenticateToken, async (req, res) => {
  try {
    const expensesByCategory = await Transaction.findAll({
      attributes: [
        [Sequelize.col("Category.name"), "category"],
        [Sequelize.fn("SUM", Sequelize.col("amount")), "total"],
      ],
      include: [
        {
          model: Category,
          attributes: [],
          where: { type: "expense" },
        },
      ],
      where: { UserId: req.user.id },
      group: ["Category.name"],
      raw: true,
    });

    res.json({ expensesByCategory });
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
