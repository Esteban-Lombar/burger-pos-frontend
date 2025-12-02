const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// 🔹 Obtener productos del menú
export async function fetchProducts() {
  const res = await fetch(`${API_URL}/products`);
  if (!res.ok) {
    throw new Error("Error obteniendo productos");
  }
  return res.json();
}

// 🔹 Crear pedido
export async function createOrder(orderData) {
  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderData),
  });

  if (!res.ok) {
    throw new Error("Error creando la orden");
  }

  return res.json();
}

// 🔹 Obtener pedidos por estado (puede seguir usándose en Admin, etc.)
export async function fetchOrdersByStatus(status) {
  const url = `${API_URL}/orders?status=${encodeURIComponent(status)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Error obteniendo pedidos");
  }

  return res.json();
}

// 🔹 Pendientes para cocina (usa la ruta /pending y sin caché)
export async function fetchPendingOrders() {
  const res = await fetch(`${API_URL}/orders/pending`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Error obteniendo pedidos pendientes");
  }

  return res.json();
}



// 🔹 Cambiar estado de una orden
export async function updateOrderStatus(id, status) {
  const res = await fetch(`${API_URL}/orders/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    throw new Error("Error actualizando estado");
  }

  return res.json();
}

// 🔹 Resumen de hoy
// 🔹 Resumen de hoy / por fecha para cierre de caja (Admin)
// Si pasas dateString = "YYYY-MM-DD" trae ese día; si no, trae hoy
export async function fetchTodaySummary(dateString) {
  const url = dateString
    ? `${API_URL}/orders/today/summary?date=${encodeURIComponent(
        dateString
      )}`
    : `${API_URL}/orders/today/summary`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Error obteniendo resumen de hoy");
  }

  return res.json();
}

