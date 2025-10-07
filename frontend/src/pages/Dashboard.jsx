// In frontend/src/pages/Dashboard.jsx, replace the entire file content:

import React, { useState, useEffect, useCallback } from "react";
import { getAnalyticsSummary } from "../api";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Typography, Paper, Box, CircularProgress, TextField, Grid } from "@mui/material";
import dayjs from "dayjs";
import ChatInterface from '../components/ChatInterface'; // <-- ADD THIS LINE


const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF"];

// Helper function to format income/expense data
const formatIncomeExpenseData = (data) => {
    const result = { income: 0, expense: 0 };
    data.forEach(item => {
        if (item.type === 'income') result.income = parseFloat(item.totalAmount);
        if (item.type === 'expense') result.expense = parseFloat(item.totalAmount);
    });
    return [
        { name: 'Income', value: result.income, fill: '#00C49F' },
        { name: 'Expense', value: result.expense, fill: '#FF8042' }
    ];
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
      startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
      endDate: dayjs().endOf('month').format('YYYY-MM-DD')
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAnalyticsSummary(dateRange); // Assuming api.js supports params
      const pieData = (response.data.expensesByCategory || []).map((item) => ({
        name: item.category,
        value: parseFloat(item.total),
      }));
      const barData = formatIncomeExpenseData(response.data.incomeVsExpense || []);
      const lineData = (response.data.expensesOverTime || []).map(item => ({
        date: dayjs(item.date).format('MMM D'),
        amount: parseFloat(item.totalAmount)
      }));
      setData({ pieData, barData, lineData });
    } catch (err) {
      setError("Failed to fetch analytics summary.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateChange = (e) => {
      const { name, value } = e.target;
      setDateRange(prev => ({ ...prev, [name]: value }));
  };

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      
      {/* Date Range Filter */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
          <TextField name="startDate" label="Start Date" type="date" value={dateRange.startDate} onChange={handleDateChange} InputLabelProps={{ shrink: true }} />
          <TextField name="endDate" label="End Date" type="date" value={dateRange.endDate} onChange={handleDateChange} InputLabelProps={{ shrink: true }} />
      </Box>

      <Grid container spacing={3}>
        {/* Pie Chart */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6">Expenses by Category</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data?.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} fill="#8884d8" label>
                {data?.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Grid>
        
        {/* Bar Chart */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6">Income vs. Expense</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        </Grid>

        {/* Line Chart */}
        <Grid item xs={12}>
          <Typography variant="h6">Expenses Over Time</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="amount" stroke="#8884d8" name="Expense Amount" />
            </LineChart>
          </ResponsiveContainer>
        </Grid>

        <ChatInterface />
        
      </Grid>
    </Paper>
  );
}

// import React, { useState, useEffect } from "react";
// import { getAnalyticsSummary } from "../api";
// import {
//   PieChart,
//   Pie,
//   Cell,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
// } from "recharts";
// import { Typography, Paper } from "@mui/material";

// const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF"];

// export default function Dashboard() {
//   const [data, setData] = useState([]);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const response = await getAnalyticsSummary();
//         const chartData = response.data.expensesByCategory.map((item) => ({
//           name: item.category,
//           value: parseFloat(item.total),
//         }));
//         setData(chartData);
//       } catch (error) {
//         console.error("Failed to fetch analytics summary", error);
//       }
//     };
//     fetchData();
//   }, []);

//   return (
//     <Paper sx={{ p: 2 }}>
//       <Typography variant="h4" gutterBottom>
//         Expense Summary
//       </Typography>
//       <ResponsiveContainer width="100%" height={400}>
//         <PieChart>
//           <Pie
//             data={data}
//             dataKey="value"
//             nameKey="name"
//             cx="50%"
//             cy="50%"
//             outerRadius={150}
//             fill="#8884d8"
//             label
//           >
//             {data.map((entry, index) => (
//               <Cell
//                 key={`cell-${index}`}
//                 fill={COLORS[index % COLORS.length]}
//               />
//             ))}
//           </Pie>
//           <Tooltip />
//           <Legend />
//         </PieChart>
//       </ResponsiveContainer>
//     </Paper>
//   );
// }
