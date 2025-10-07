import axios from "axios";

const api = axios.create({
  baseURL: "",
});

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

export const register = (userData) => api.post("/auth/register", userData);
export const login = (credentials) => api.post("/auth/login", credentials);

export const getCategories = () => api.get("/categories");
export const createCategory = (categoryData) =>
  api.post("/categories", categoryData);
export const updateCategory = (id, categoryData) =>
  api.put(`/categories/${id}`, categoryData);
export const deleteCategory = (id) => api.delete(`/categories/${id}`);

export const getTransactions = (params) => api.get("/transactions", { params });
export const createTransaction = (transactionData) =>
  api.post("/transactions", transactionData);
export const uploadReceipt = (formData) =>
  api.post("/upload/receipt", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const uploadPdf = (formData) =>
  api.post("/transactions/upload-pdf", formData);

export const updateTransaction = (id, transactionData) =>
  api.put(`/transactions/${id}`, transactionData);
export const deleteTransaction = (id) => api.delete(`/transactions/${id}`);

export const postAiChat = (query) => api.post("/ai/chat", { query });

export const getAnalyticsSummary = (params) =>
  api.get("/analytics/summary", { params });

export default api;
