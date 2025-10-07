import React, { useState, useEffect, useCallback } from "react";
import { getTransactions, deleteTransaction } from "../api";
import { Box, Typography, Button, Paper, IconButton } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CategoryIcon from "@mui/icons-material/Category";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TransactionForm from "../components/TransactionForm";
import CategoryManagerModal from "../components/CategoryManagerModal";
import PdfUploadModal from "../components/PdfUploadModal";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTransactions({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      setTransactions(response.data.transactions || []);
      setRowCount(response.data.totalItems || 0);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
      setTransactions([]);
    }
    setLoading(false);
  }, [paginationModel]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await deleteTransaction(id);
        fetchTransactions();
      } catch (error) {
        console.error("Failed to delete transaction", error);
        alert("Failed to delete transaction.");
      }
    }
  };

  const columns = [
    { field: "transactionDate", headerName: "Date", width: 150 },
    { field: "description", headerName: "Description", width: 250 },
    { field: "amount", headerName: "Amount", width: 150, type: "number" },
    {
      field: "categoryName",
      headerName: "Category",
      width: 200,
      valueGetter: (value, row) => row.Category?.name || "N/A",
    },
    {
      field: "categoryType",
      headerName: "Type",
      width: 150,
      valueGetter: (value, row) => row.Category?.type || "N/A",
    },
    {
      field: "actions",
      headerName: "Actions",
      sortable: false,
      width: 120,
      renderCell: (params) => (
        <Box>
          <IconButton onClick={() => handleEdit(params.row)}>
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => handleDelete(params.row.id)}>
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Paper
      sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%" }}
    >
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
            startIcon={<PictureAsPdfIcon />}
            onClick={() => setIsPdfModalOpen(true)}
            sx={{ mr: 2 }}
          >
            Import PDF
          </Button>
          <Button
            variant="outlined"
            startIcon={<CategoryIcon />}
            onClick={() => setIsCategoryManagerOpen(true)}
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

      <Box sx={{ flexGrow: 1, width: "100%" }}>
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
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingTransaction(null);
        }}
        onSuccess={fetchTransactions}
        transactionToEdit={editingTransaction}
      />

      <CategoryManagerModal
        open={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
      />

      <PdfUploadModal
        open={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onSuccess={fetchTransactions}
      />
    </Paper>
  );
}
