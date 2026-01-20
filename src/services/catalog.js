// src/services/catalog.ts
import api from "@/lib/api";
// ===== Categorías =====
export const listCategories = () => api.get("/categories/").then(r => r.data);
export const createCategory = (name) => api.post("/categories/", { name }).then(r => r.data);
export const deleteCategory = (id) => api.delete(`/categories/${id}/`).then(r => r.data);
// ===== Unidades =====
export const listUnits = () => api.get("/units/").then(r => r.data);
export const createUnit = (payload) => api.post("/units/", payload).then(r => r.data);
export const deleteUnit = (id) => api.delete(`/units/${id}/`).then(r => r.data);
// ===== Restaurantes =====
export const listRestaurants = () => api.get("/restaurants/").then(r => r.data);
export const createRestaurant = (payload) => api.post("/restaurants/", payload).then(r => r.data);
export const deleteRestaurant = (id) => api.delete(`/restaurants/${id}/`).then(r => r.data);
// ===== Productos =====
export const listProducts = () => api.get("/products/").then(r => r.data);
export const createProduct = (payload) => api.post("/products/", payload).then(r => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}/`).then(r => r.data);
