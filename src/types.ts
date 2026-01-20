export type ID = number;

export interface Unit { id:ID; name:string; kind:string; symbol:string|null; is_currency:boolean; }
export interface Category { id:ID; name:string }
export interface Product {
  id:ID; name:string; category:ID; category_name?:string|null;
  ref_price?:string|null; default_unit?:ID|null; allowed_units?:ID[];
}
export interface Restaurant { id:ID; name:string; code:string }

export interface PublicConfig {
  restaurants:Restaurant[]; categories:Category[]; products:Product[]; units:Unit[];
}

export interface PurchaseList { id:ID; restaurant:ID; status:"draft"|"final"; series_code?:string|null }
export interface PurchaseListItem { id:ID; purchase_list:ID; product:ID; unit:ID; qty:number; price_soles?:number|null }
