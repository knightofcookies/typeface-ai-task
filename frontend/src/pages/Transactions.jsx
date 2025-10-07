// src/pages/Transactions.jsx

import React, { useState, useEffect, useCallback } from "react";
import { getTransactions } from "../api";
import { Box, Typography, Button, Paper } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CategoryIcon from "@mui/icons-material/Category";
import TransactionForm from "../components/TransactionForm";
import CategoryForm from "../components/CategoryForm";
import PdfUploadModal from '../components/PdfUploadModal'; // Import the new component
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'; // Import an icon
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { deleteTransaction } from '../api'; // Import the delete function

// const columns = [
//   { field: "transactionDate", headerName: "Date", width: 150 },
//   { field: "description", headerName: "Description", width: 250 },
//   { field: "amount", headerName: "Amount", width: 150, type: "number" },
//   {
//     // A unique field is still required for the column ID.
//     field: "categoryName",
//     headerName: "Category",
//     width: 200,
//     // Define the function to capture the arguments correctly.
//     // The first is 'value', the second is 'row'. We only need 'row'.
//     valueGetter: (value, row) => {
//       return row.Category?.name || "N/A";
//     },
//   },
//   {
//     field: "categoryType",
//     headerName: "Type",
//     width: 150,
//     // Same signature here.
//     valueGetter: (value, row) => {
//       return row.Category?.type || "N/A";
//     },
//   },
//   {
//     field: 'actions',
//     headerName: 'Actions',
//     sortable: false,
//     width: 100,
//     renderCell: (params) => (
//       <>
//         <IconButton 
//           onClick={() => { /* Logic to open edit modal will go here */ }}
//         >
//           <EditIcon />
//         </IconButton>
//         <IconButton onClick={() => handleDelete(params.row.id)}>
//           <DeleteIcon />
//         </IconButton>
//       </>
//     ),
//   },
// ];

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
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

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

  // const handleDelete = async (id) => {
  //   if (window.confirm('Are you sure you want to delete this transaction?')) {
  //       try {
  //           await deleteTransaction(id);
  //           fetchTransactions(); // Re-fetch data to update the grid
  //       } catch (error) {
  //           console.error('Failed to delete transaction', error);
  //           alert('Failed to delete transaction.');
  //       }
  //   }
  // };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction); // Store the transaction to be edited
    setIsTransactionModalOpen(true);    // Open the modal
  };

  const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            try {
                await deleteTransaction(id);
                fetchTransactions(); // Re-fetch data to update the grid
            } catch (error) {
                console.error('Failed to delete transaction', error);
                alert('Failed to delete transaction.');
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
            field: 'actions',
            headerName: 'Actions',
            sortable: false,
            width: 120,
            renderCell: (params) => (
              <Box>
                <IconButton 
                  onClick={() => handleEdit(params.row)} // <-- We will implement handleEdit next
                >
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => handleDelete(params.row.id)}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            ),
        },
    ];

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
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={() => setIsPdfModalOpen(true)}
            sx={{ mr: 2 }}
        >
            Import PDF
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

      <PdfUploadModal
        open={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onSuccess={fetchTransactions}
      />

      <TransactionForm
        open={isTransactionModalOpen}
        onClose={() => {
            setIsTransactionModalOpen(false);
            setEditingTransaction(null); // Clear the editing state when modal closes
        }}
        onSuccess={fetchTransactions}
        // Pass the transaction to be edited to the form
        transactionToEdit={editingTransaction} 
    />
    </Paper>
  );
}
