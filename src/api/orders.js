const API_URL = import.meta.env.VITE_API_URL;

export async function createOrder(payload) {
  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error al crear pedido");
  return res.json();
}

export async function getOrders(status) {
  const url = status
    ? `${API_URL}/orders?status=${encodeURIComponent(status)}`
    : `${API_URL}/orders`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Error al obtener pedidos");
  return res.json();
}

// 🔹 aquí cambio PATCH → PUT para que coincida con el backend
export async function updateOrderStatus(id, status) {
  const res = await fetch(`${API_URL}/orders/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Error al actualizar estado");
  return res.json();
}

// 🔹 usar la ruta real del backend: /orders/today/summary
export async function getDailyReport() {
  const res = await fetch(`${API_URL}/orders/today/summary`);
  if (!res.ok) throw new Error("Error al obtener reporte");
  return res.json();
}
