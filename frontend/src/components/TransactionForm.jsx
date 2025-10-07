import React, { useState, useEffect } from "react";
import {
  Modal,
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Input,
} from "@mui/material";
import { getCategories, createTransaction, uploadReceipt } from "../api";
import dayjs from "dayjs";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

export default function TransactionForm({ open, onClose, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    dayjs().format("YYYY-MM-DD"),
  );
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (open) {
      const fetchCategories = async () => {
        try {
          const response = await getCategories();
          setCategories(response.data);
        } catch (error) {
          console.error("Failed to fetch categories", error);
        }
      };
      fetchCategories();
    }
  }, [open]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    const formData = new FormData();
    formData.append("receipt", file);
    try {
      const response = await uploadReceipt(formData);
      const { extractedData } = response.data;
      setDescription(extractedData.merchant || "");
      setAmount(extractedData.total || "");
      setTransactionDate(dayjs(extractedData.date).format("YYYY-MM-DD"));
      alert("Receipt data extracted!");
    } catch (error) {
      console.error("Failed to upload and process receipt", error);
      alert("Failed to process receipt.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!categoryId) {
      alert("Please select a category.");
      return; // Stop the submission
    }
    try {
      await createTransaction({
        description,
        amount,
        transactionDate,
        categoryId,
      });
      onSuccess(); // Callback to refresh data on parent component
      onClose(); // Close modal
      // Reset form state
      setDescription("");
      setAmount("");
      setCategoryId("");
    } catch (error) {
      console.error("Failed to create transaction", error);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style} component="form" onSubmit={handleSubmit}>
        <Typography variant="h6" component="h2">
          Add New Transaction
        </Typography>

        <Box sx={{ my: 2 }}>
          <Button variant="contained" component="label">
            Upload Receipt (and auto-fill)
            <input type="file" hidden onChange={handleFileChange} />
          </Button>
          {selectedFile && (
            <Typography sx={{ mt: 1 }} variant="body2">
              {selectedFile.name}
            </Typography>
          )}
        </Box>

        <TextField
          margin="normal"
          required
          fullWidth
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          label="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          label="Date"
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryId}
            label="Category"
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button type="submit" fullWidth variant="contained" sx={{ mt: 2 }}>
          Save Transaction
        </Button>
      </Box>
    </Modal>
  );
}
