import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  CircularProgress,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ReactMarkdown from "react-markdown";
import { postAiChat } from "../api";

export default function ChatInterface({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data } = await postAiChat(userMessage.text);
      const aiMessage = { sender: "ai", text: data.response };
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
    } catch (error) {
      console.error("AI chat failed:", error);
      const errorMessage = {
        sender: "ai",
        text: "Sorry, I ran into an error.",
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        height: "500px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h6" component="div">
          AI Assistant
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>
        {messages.map((msg, index) => (
          <Box
            key={index}
            sx={{ textAlign: msg.sender === "user" ? "right" : "left", my: 1 }}
          >
            <Typography
              variant="body1"
              component="div"
              sx={{
                display: "inline-block",
                p: 1,
                borderRadius: 1,
                bgcolor:
                  msg.sender === "user" ? "primary.main" : "action.hover",
                color:
                  msg.sender === "user"
                    ? "primary.contrastText"
                    : "text.primary",
              }}
            >
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </Typography>
          </Box>
        ))}
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 1 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          p: 2,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <TextField
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about your spending..."
          size="small"
        />
        <Button onClick={handleSend} disabled={isLoading} sx={{ ml: 1 }}>
          Send
        </Button>
      </Box>
    </Paper>
  );
}
