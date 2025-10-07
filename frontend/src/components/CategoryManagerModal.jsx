import React, { useState, useEffect, useCallback } from "react";
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
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../api";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 500,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
  maxHeight: "90vh",
  overflowY: "auto",
};

export default function CategoryManagerModal({ open, onClose }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("expense");

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const fetchUserCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getCategories();
      setCategories(response.data);
    } catch (err) {
      console.error("Failed to fetch categories", err);
      setError("Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchUserCategories();
    }
  }, [open, fetchUserCategories]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await createCategory({ name: newName, type: newType });
      setNewName("");
      setNewType("expense");
      fetchUserCategories();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create category.");
    }
  };

  const handleDelete = async (id) => {
    if (
      window.confirm(
        "Are you sure you want to delete this category? This cannot be undone.",
      )
    ) {
      setError("");
      try {
        await deleteCategory(id);
        fetchUserCategories();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to delete category.");
      }
    }
  };

  const handleStartEdit = (category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setError("");
  };

  const handleSaveEdit = async () => {
    setError("");
    try {
      await updateCategory(editingId, { name: editingName });
      setEditingId(null);
      setEditingName("");
      fetchUserCategories();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update category.");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Manage Categories
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="h6">Add New Category</Typography>
        <Box
          component="form"
          onSubmit={handleCreate}
          sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center" }}
        >
          <TextField
            label="Category Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            size="small"
            sx={{ flexGrow: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={newType}
              label="Type"
              onChange={(e) => setNewType(e.target.value)}
            >
              <MenuItem value="expense">Expense</MenuItem>
              <MenuItem value="income">Income</MenuItem>
            </Select>
          </FormControl>
          <Button type="submit" variant="contained">
            Add
          </Button>
        </Box>

        <Divider />

        <Typography variant="h6" sx={{ mt: 2 }}>
          Existing Categories
        </Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", my: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {categories.map((category) => (
              <ListItem
                key={category.id}
                disablePadding
                secondaryAction={
                  editingId === category.id ? (
                    <>
                      <IconButton onClick={handleSaveEdit} color="primary">
                        <SaveIcon />
                      </IconButton>
                      <IconButton onClick={handleCancelEdit}>
                        <CancelIcon />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton onClick={() => handleStartEdit(category)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDelete(category.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )
                }
              >
                {editingId === category.id ? (
                  <TextField
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    size="small"
                    variant="outlined"
                    sx={{ flexGrow: 1, mr: 1 }}
                  />
                ) : (
                  <ListItemText
                    primary={category.name}
                    secondary={
                      category.type.charAt(0).toUpperCase() +
                      category.type.slice(1)
                    }
                  />
                )}
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Modal>
  );
}
