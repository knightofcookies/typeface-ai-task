// require("dotenv").config();
const express = require("express");
const { Sequelize, DataTypes, Op } = require("sequelize");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const dayjs = require("dayjs");
const { PDFExtract } = require("pdf.js-extract");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // For cloud database connections
    },
  },
  logging: false,
});

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

User.hasMany(Transaction);
Transaction.belongsTo(User);

User.hasMany(Category);
Category.belongsTo(User);

Category.hasMany(Transaction);
Transaction.belongsTo(Category);

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

const upload = multer({ storage: multer.memoryStorage() });

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

app.put("/api/categories/:id", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findOne({
      where: { id: req.params.id, UserId: req.user.id },
    });

    if (!category) {
      return res.status(404).json({
        message: "Category not found or you don't have permission to edit it.",
      });
    }

    const existingCategory = await Category.findOne({
      where: {
        name,
        UserId: req.user.id,
        id: { [Op.ne]: req.params.id },
      },
    });

    if (existingCategory) {
      return res
        .status(409)
        .json({ message: "A category with this name already exists." });
    }

    category.name = name;
    await category.save();
    res.json(category);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating category", error: error.message });
  }
});

app.delete("/api/categories/:id", authenticateToken, async (req, res) => {
  try {
    const category = await Category.findOne({
      where: { id: req.params.id, UserId: req.user.id },
    });

    if (!category) {
      return res.status(404).json({
        message:
          "Category not found or you don't have permission to delete it.",
      });
    }

    const transactionCount = await Transaction.count({
      where: { CategoryId: req.params.id },
    });

    if (transactionCount > 0) {
      return res.status(409).json({
        message: `Cannot delete category. It is associated with ${transactionCount} transaction(s). Please re-assign them first.`,
      });
    }

    await category.destroy();
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting category", error: error.message });
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

app.post(
  "/api/transactions/upload-pdf",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded." });
    }

    try {
      const dataBuffer = req.file.buffer;

      const pdfExtract = new PDFExtract();
      const data = await pdfExtract.extractBuffer(dataBuffer, {});
      const text = data.pages
        .map((page) => page.content.map((item) => item.str).join(" "))
        .join("\n");

      let defaultCategory = await Category.findOne({
        where: { UserId: req.user.id, type: "expense" },
      });

      if (!defaultCategory) {
        defaultCategory = await Category.create({
          name: "Uncategorized",
          type: "expense",
          UserId: req.user.id,
        });
      }
      const defaultCategoryId = defaultCategory.id;

      const lines = text.split("\n");
      const transactionsToCreate = [];
      let importedCount = 0;
      let duplicateCount = 0;

      const transactionRegex =
        /(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s+([\d,]+\.\d{2})/;

      for (const line of lines) {
        const match = line.match(transactionRegex);
        if (match) {
          const [_, dateStr, description, amountStr] = match;

          const customParseFormat = require("dayjs/plugin/customParseFormat");
          dayjs.extend(customParseFormat);
          const date = dayjs(dateStr, "MM/DD/YYYY").format("YYYY-MM-DD");

          const amount = parseFloat(amountStr.replace(/,/g, ""));
          const trimmedDesc = description.trim();

          const existing = await Transaction.findOne({
            where: {
              UserId: req.user.id,
              transactionDate: date,
              amount,
              description: trimmedDesc,
            },
          });

          if (!existing) {
            transactionsToCreate.push({
              transactionDate: date,
              description: trimmedDesc,
              amount,
              CategoryId: defaultCategoryId,
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
        message: "PDF processed successfully.",
        imported: importedCount,
        duplicates: duplicateCount,
      });
    } catch (error) {
      console.error("PDF parsing error:", error);
      res.status(500).json({ error: "Failed to parse PDF." });
    }
  },
);

app.put("/api/transactions/:id", authenticateToken, async (req, res) => {
  try {
    const { description, amount, transactionDate, categoryId } = req.body;
    const transaction = await Transaction.findOne({
      where: { id: req.params.id, UserId: req.user.id },
    });

    if (!transaction) {
      return res.status(404).json({
        message:
          "Transaction not found or you do not have permission to edit it.",
      });
    }

    await transaction.update({
      description,
      amount,
      transactionDate,
      CategoryId: categoryId,
    });

    res.json(transaction);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating transaction", error: error.message });
  }
});

app.delete("/api/transactions/:id", authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      where: { id: req.params.id, UserId: req.user.id },
    });

    if (!transaction) {
      return res.status(404).json({
        message:
          "Transaction not found or you do not have permission to delete it.",
      });
    }

    await transaction.destroy();
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting transaction", error: error.message });
  }
});

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
      order: [["transactionDate", "DESC"]],
      limit: 50,
    });

    if (transactions.length === 0) {
      return res.json({
        response:
          "I don't have any transaction data to analyze yet. Please add some transactions first!",
      });
    }

    const context =
      "User's recent transactions:\n" +
      transactions
        .map((t) => {
          const categoryName = t.Category?.name ?? "Uncategorized";
          const categoryType = t.Category?.type ?? "expense";

          return `- Date: ${t.transactionDate}, Description: ${t.description}, Amount: ${t.amount}, Category: ${categoryName} (${categoryType})`;
        })
        .join("\n");

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

  for (const line of lines) {
    if (line.trim().length > 0) {
      merchant = line.trim();
      break;
    }
  }

  const totalRegex = /(?:total|amount|due|balance)[\s:]*[$€£]?\s*(\d+\.\d{2})/i;
  const totalMatch = text.match(totalRegex);
  if (totalMatch && totalMatch[1]) {
    total = parseFloat(totalMatch[1]);
  } else {
    const numbers = text.match(/\d+\.\d{2}/g) || [];
    const amounts = numbers.map(parseFloat);
    if (amounts.length > 0) {
      total = Math.max(...amounts);
    }
  }

  const dateRegex = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}-\d{2}-\d{2})/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch && (dateMatch[1] || dateMatch[2])) {
    const parsedDate = new Date(dateMatch[1] || dateMatch[2]);
    if (!isNaN(parsedDate)) {
      date = parsedDate.toISOString().slice(0, 10);
    }
  }

  if (!date) {
    date = new Date().toISOString().slice(0, 10);
  }

  return { merchant, total, date };
};

app.post(
  "/api/upload/receipt",
  authenticateToken,
  upload.single("receipt"),
  async (req, res) => {
    req.setTimeout(300000);

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    let worker;

    try {
      console.log(
        `Processing file: ${req.file.originalname} with Tesseract.js...`,
      );

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
      if (worker) {
        await worker.terminate();
      }
    }
  },
);

app.get("/api/analytics/summary", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.transactionDate = { [Op.between]: [startDate, endDate] };
    }

    const expensesByCategory = await Transaction.findAll({
      attributes: [
        [Sequelize.col("Category.name"), "category"],
        [Sequelize.fn("SUM", Sequelize.col("amount")), "total"],
      ],
      include: [
        { model: Category, attributes: [], where: { type: "expense" } },
      ],
      where: { UserId: userId, ...dateFilter },
      group: ["Category.name"],
      raw: true,
    });

    const incomeVsExpense = await Transaction.findAll({
      where: { UserId: userId, ...dateFilter },
      attributes: [
        [Sequelize.col("Category.type"), "type"],
        [Sequelize.fn("SUM", Sequelize.col("amount")), "totalAmount"],
      ],
      include: [{ model: Category, attributes: [] }],
      group: [Sequelize.col("Category.type")],
      raw: true,
    });

    const expensesOverTime = await Transaction.findAll({
      where: { UserId: userId, ...dateFilter },
      include: [
        { model: Category, attributes: [], where: { type: "expense" } },
      ],
      attributes: [
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

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
});

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
