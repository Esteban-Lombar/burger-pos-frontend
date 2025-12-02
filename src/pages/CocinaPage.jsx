import { useEffect, useState } from "react";
import { fetchPendingOrders, updateOrderStatus } from "../api/client";

function formatCOP(value) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function CocinaPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadOrders(showSpinner = true) {
    try {
      if (showSpinner) setLoading(true);
      setMessage("");

      const data = await fetchPendingOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
      setMessage("Error cargando pedidos");
    } finally {
      if (showSpinner) setLoading(false);
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    loadOrders(true);
  }, []);

  const handleSetStatus = async (orderId, status) => {
    try {
      setUpdatingId(orderId);
      await updateOrderStatus(orderId, status);
      await loadOrders(false);
      if (status === "preparando") {
        setMessage("✅ Pedido marcado como preparando");
      } else if (status === "listo") {
        setMessage("✅ Pedido marcado como listo");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error actualizando estado del pedido");
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header interno */}
      <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Cocina – Pedidos pendientes
          </h1>
          <p className="text-sm text-slate-500">
            Marca los pedidos como preparando o listos
          </p>
        </div>
        <button
          onClick={() => loadOrders(true)}
          className="px-3 py-1 rounded-full bg-slate-800 text-slate-50 text-sm font-semibold"
        >
          Actualizar
        </button>
      </header>

      {/* Contenido */}
      <main className="flex-1 p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            Cargando pedidos...
          </div>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-600">
            No hay pedidos pendientes.
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order._id}
                className="bg-white rounded-xl shadow border border-slate-200 p-3 sm:p-4"
              >
                {/* encabezado mesa / para llevar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {order.toGo
                        ? "Para llevar"
                        : `Mesa ${order.tableNumber || "N/A"}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatTime(order.createdAt)}
                    </div>
                  </div>

                  <div className="text-right text-sm font-semibold text-emerald-600">
                    Total: {formatCOP(order.total || 0)}
                  </div>
                </div>

                {/* items */}
                <div className="mt-2 space-y-1 text-sm text-slate-800">
                  {order.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-slate-50 rounded-lg px-2 py-1"
                    >
                      <div>
                        <div className="font-medium">
                          {item.productName} x{item.quantity}
                        </div>
                        {item.burgerConfig && (
                          <div className="text-[11px] text-slate-500">
                            Carne: {item.burgerConfig.meatType} ·
                            &nbsp;Toc.: {item.burgerConfig.baconType} ·
                            &nbsp;Lechuga: {item.burgerConfig.lettuceOption} ·
                            &nbsp;Tomate:{" "}
                            {item.burgerConfig.tomato ? "sí" : "no"} ·
                            &nbsp;Cebolla:{" "}
                            {item.burgerConfig.onion ? "sí" : "no"}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatCOP(item.totalPrice || 0)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* botones de estado */}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() =>
                      handleSetStatus(order._id, "preparando")
                    }
                    disabled={updatingId === order._id}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 disabled:opacity-60"
                  >
                    {updatingId === order._id &&
                    order.status === "preparando"
                      ? "Guardando..."
                      : "Preparando"}
                  </button>
                  <button
                    onClick={() => handleSetStatus(order._id, "listo")}
                    disabled={updatingId === order._id}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 disabled:opacity-60"
                  >
                    {updatingId === order._id && order.status === "listo"
                      ? "Guardando..."
                      : "Listo"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {message && (
          <p className="text-xs text-slate-600 mt-1">{message}</p>
        )}
      </main>
    </div>
  );
}

export default CocinaPage;
