// Construye parámetros en dos formatos: CSV y repetidos.
// Ej: appendMulti(qs, "category_ids", "category_id", ["1","2"])
// -> ?category_ids=1,2&category_id=1&category_id=2
export function appendMulti(
  qs: URLSearchParams,
  keyCsv: string,
  keyRepeat: string,
  values: string[],
) {
  if (!values || values.length === 0) return;
  qs.set(keyCsv, values.join(","));
  for (const v of values) qs.append(keyRepeat, v);
}
