import React, { useState } from "react";
import {
  Modal,
  Box,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import { uploadPdf } from "../api";

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

export default function PdfUploadModal({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await uploadPdf(formData);
      setResult(response.data);
      onSuccess();
    } catch (err) {
      console.error("PDF upload failed", err);
      setResult({ error: "Failed to process PDF." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Typography variant="h6">Import Transactions from PDF</Typography>
        <Button variant="contained" component="label" sx={{ my: 2 }}>
          Select PDF Bank Statement
          <input type="file" hidden accept=".pdf" onChange={handleFileChange} />
        </Button>
        {file && <Typography>{file.name}</Typography>}
        <Button
          onClick={handleSubmit}
          disabled={!file || loading}
          fullWidth
          variant="contained"
        >
          {loading ? <CircularProgress size={24} /> : "Upload and Import"}
        </Button>
        {result && (
          <Box sx={{ mt: 2 }}>
            <Typography>{result.message || result.error}</Typography>
            {result.imported !== undefined && (
              <Typography>Imported: {result.imported}</Typography>
            )}
            {result.duplicates !== undefined && (
              <Typography>Duplicates Found: {result.duplicates}</Typography>
            )}
          </Box>
        )}
      </Box>
    </Modal>
  );
}
