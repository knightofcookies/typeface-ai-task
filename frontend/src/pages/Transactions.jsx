// src/pages/Transactions.jsx

import React, { useState, useEffect, useCallback } from "react";
import { getTransactions } from "../api";
import { Box, Typography, Button, Paper } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CategoryIcon from "@mui/icons-material/Category";
import TransactionForm from "../components/TransactionForm";
import CategoryForm from "../components/CategoryForm";

const columns = [
  { field: "transactionDate", headerName: "Date", width: 150 },
  { field: "description", headerName: "Description", width: 250 },
  { field: "amount", headerName: "Amount", width: 150, type: "number" },
  {
    // A unique field is still required for the column ID.
    field: "categoryName",
    headerName: "Category",
    width: 200,
    // Define the function to capture the arguments correctly.
    // The first is 'value', the second is 'row'. We only need 'row'.
    valueGetter: (value, row) => {
      return row.Category?.name || "N/A";
    },
  },
  {
    field: "categoryType",
    headerName: "Type",
    width: 150,
    // Same signature here.
    valueGetter: (value, row) => {
      return row.Category?.type || "N/A";
    },
  },
];

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Use useCallback to memoize the fetch function.
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTransactions({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      // Ensure the data being set is always an array.
      setTransactions(response.data.transactions || []);
      setRowCount(response.data.totalItems || 0);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
      setTransactions([]); // Set to empty array on error to prevent crashes
    }
    setLoading(false);
  }, [paginationModel]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCategorySuccess = () => {
    alert("Category created successfully!");
  };

  // Log the data to the console for final debugging.
  console.log("Current rows passed to DataGrid:", transactions);

  return (
    <Paper sx={{ p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h4">Transactions</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<CategoryIcon />}
            onClick={() => setIsCategoryModalOpen(true)}
            sx={{ mr: 2 }}
          >
            Manage Categories
          </Button>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setIsTransactionModalOpen(true)}
          >
            Add Transaction
          </Button>
        </Box>
      </Box>
      <Box sx={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={transactions}
          columns={columns}
          rowCount={rowCount}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[5, 10, 20]}
        />
      </Box>

      <TransactionForm
        open={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSuccess={fetchTransactions}
      />

      <CategoryForm
        open={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={handleCategorySuccess}
      />
    </Paper>
  );
}
