const API_URL = import.meta.env.VITE_API_URL;

export async function getProducts() {
  const res = await fetch(`${API_URL}/products`);
  if (!res.ok) throw new Error("Error al obtener productos");
  return res.json();
}
