import React, { useState, useEffect, useCallback } from "react";
import { getAnalyticsSummary } from "../api";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Typography,
  Paper,
  Box,
  CircularProgress,
  TextField,
  Grid,
  Fab,
} from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import dayjs from "dayjs";
import ChatInterface from "../components/ChatInterface";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF"];

const formatIncomeExpenseData = (data) => {
  const result = { income: 0, expense: 0 };
  data.forEach((item) => {
    if (item.type === "income") result.income = parseFloat(item.totalAmount);
    if (item.type === "expense") result.expense = parseFloat(item.totalAmount);
  });
  return [
    { name: "Income", value: result.income, fill: "#00C49F" },
    { name: "Expense", value: result.expense, fill: "#FF8042" },
  ];
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const NoDataDisplay = ({ message = "No data for selected period" }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: 300,
      width: "100%",
      color: "text.secondary",
      backgroundColor: (theme) =>
        theme.palette.mode === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.02)",
      borderRadius: 2,
    }}
  >
    <Typography variant="body1">{message}</Typography>
  </Box>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().startOf("month").format("YYYY-MM-DD"),
    endDate: dayjs().endOf("month").format("YYYY-MM-DD"),
  });
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAnalyticsSummary(dateRange);
      const pieData = (response.data.expensesByCategory || []).map((item) => ({
        name: item.category,
        value: parseFloat(item.total),
      }));
      const barData = formatIncomeExpenseData(
        response.data.incomeVsExpense || [],
      );
      const lineData = (response.data.expensesOverTime || []).map((item) => ({
        date: dayjs(item.date).format("MMM D"),
        amount: parseFloat(item.totalAmount),
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
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  const toggleChat = () => setIsChatOpen((prev) => !prev);

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!data) return <Typography>No data available for this period.</Typography>;

  return (
    <>
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Paper sx={{ p: 2, width: "100%", maxWidth: "1200px" }}>
          <Typography variant="h4" gutterBottom>
            Dashboard
          </Typography>
          <Box sx={{ mb: 4, display: "flex", gap: 2 }}>
            <TextField
              name="startDate"
              label="Start Date"
              type="date"
              value={dateRange.startDate}
              onChange={handleDateChange}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="endDate"
              label="End Date"
              type="date"
              value={dateRange.endDate}
              onChange={handleDateChange}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h6" align="center">
                Expenses by Category
              </Typography>
              {data.pieData && data.pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                    >
                      {data.pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <NoDataDisplay />
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" align="center">
                Income vs. Expense
              </Typography>
              {data.barData &&
              !data.barData.every((item) => item.value === 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.barData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" barSize={50}>
                      {data.barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <NoDataDisplay />
              )}
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" align="center">
                Expenses Over Time
              </Typography>
              {data.lineData && data.lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={data.lineData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <NoDataDisplay />
              )}
            </Grid>
          </Grid>
        </Paper>
      </Box>
      <Fab
        color="primary"
        aria-label="chat"
        sx={{ position: "fixed", bottom: 32, right: 32 }}
        onClick={toggleChat}
      >
        <ChatIcon />
      </Fab>
      {isChatOpen && (
        <Box
          sx={{
            position: "fixed",
            bottom: 112,
            right: 32,
            width: { xs: "85vw", sm: 350, md: 400 },
            zIndex: 1300,
            boxShadow: "0px 5px 15px rgba(0,0,0,0.3)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <ChatInterface onClose={toggleChat} />
        </Box>
      )}
    </>
  );
}
