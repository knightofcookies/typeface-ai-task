import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3001/api", // Your backend URL
});

// Interceptor to add the token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Auth
export const register = (userData) => api.post("/auth/register", userData);
export const login = (credentials) => api.post("/auth/login", credentials);

// Categories
export const getCategories = () => api.get("/categories");
export const createCategory = (categoryData) =>
  api.post("/categories", categoryData);

// Transactions
export const getTransactions = (params) => api.get("/transactions", { params });
export const createTransaction = (transactionData) =>
  api.post("/transactions", transactionData);
export const uploadReceipt = (formData) =>
  api.post("/upload/receipt", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// Analytics
export const getAnalyticsSummary = () => api.get("/analytics/summary");

export default api;
