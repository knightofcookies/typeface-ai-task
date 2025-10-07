// components/ChatInterface.jsx
import { useState } from 'react';
import { Box, TextField, Button, Paper, Typography, CircularProgress } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import { postAiChat } from '../api'; 


export default function ChatInterface() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // In components/ChatInterface.jsx
    const handleSend = async () => {
        if (!input.trim()) return;

        const messageToSend = input;
        const userMessage = { sender: 'user', text: messageToSend };

        // Update the UI optimistically with the user's message
        setMessages(prevMessages => [...prevMessages, userMessage]); 
        setInput('');
        setIsLoading(true);

        try {
            const { data } = await postAiChat(messageToSend);
            const aiMessage = { sender: 'ai', text: data.response };
            // Now, append the AI's message to the list
            setMessages(prevMessages => [...prevMessages, aiMessage]);
        } catch (error) {
            console.error("AI chat failed:", error);
            const errorMessage = { sender: 'ai', text: 'Sorry, I ran into an error.' };
            // Append an error message instead of the AI response
            setMessages(prevMessages => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 2, height: '400px', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
                {messages.map((msg, index) => (
                    <Box key={index} sx={{ textAlign: msg.sender === 'user' ? 'right' : 'left', my: 1 }}>
                        <Typography variant="body1" component="div" sx={{ display: 'inline-block', p: 1, borderRadius: 1, bgcolor: msg.sender === 'user' ? 'primary.main' : 'grey.300', color: msg.sender === 'user' ? 'white' : 'black' }}>
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </Typography>
                    </Box>
                ))}
                {isLoading && <CircularProgress size={24} />}
            </Box>
            <Box sx={{ display: 'flex' }}>
                <TextField fullWidth value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask about your spending..." />
                <Button onClick={handleSend} disabled={isLoading}>Send</Button>
            </Box>
        </Paper>
    );
}