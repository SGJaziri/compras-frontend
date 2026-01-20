// src/services/catalog.ts
import api from "@/lib/api";
import type { ID } from "@/types";
export type Id = number | string;

// ===== Categorías =====
export const listCategories   = () => api.get("/categories/").then(r => r.data);
export const createCategory   = (name: string) => api.post("/categories/", { name }).then(r => r.data);
export const deleteCategory   = (id: Id) => api.delete(`/categories/${id}/`).then(r => r.data);

// ===== Unidades =====
export const listUnits        = () => api.get("/units/").then(r => r.data);
export const createUnit       = (payload: {name:string; kind:string; symbol?:string|null; is_currency?:boolean}) =>
  api.post("/units/", payload).then(r => r.data);
export const deleteUnit       = (id: Id) => api.delete(`/units/${id}/`).then(r => r.data);

// ===== Restaurantes =====
export const listRestaurants  = () => api.get("/restaurants/").then(r => r.data);
export const createRestaurant = (payload: {name:string; code:string; address?:string|null; contact?:string|null}) =>
  api.post("/restaurants/", payload).then(r => r.data);
export const deleteRestaurant = (id: Id) => api.delete(`/restaurants/${id}/`).then(r => r.data);

// ===== Productos =====
export const listProducts     = () => api.get("/products/").then(r => r.data);
export const createProduct    = (payload: {
  name: string;
  category: Id;
  default_unit?: Id|null;
  ref_price?: number|null;
}) => api.post("/products/", payload).then(r => r.data);
export const deleteProduct    = (id: Id) => api.delete(`/products/${id}/`).then(r => r.data);
