import { useEffect, useState } from "react";
import { fetchOrdersByStatus, updateOrderStatus } from "../api/client";

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

function getVeggiesLabel(cfg) {
  if (cfg.noVeggies) return "sin verduras";
  if (cfg.lettuceOption === "wrap") return "envolver en lechuga";
  if (cfg.lettuceOption === "sin") return "no lechuga";
  return "con verduras";
}

function getDrinkLabel(code) {
  if (code === "coca") return "Coca-Cola personal";
  if (code === "coca_zero") return "Coca-Cola Zero personal";
  return "Sin bebida";
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

      // solo pedidos pendientes
      const data = await fetchOrdersByStatus("pendiente");
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
    // cargar al entrar
    loadOrders(true);

    // auto-refresh cada 5s
    const interval = setInterval(() => {
      loadOrders(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSetStatus = async (orderId, status) => {
    try {
      setUpdatingId(orderId);
      await updateOrderStatus(orderId, status);
      await loadOrders(false); // recargar lista sin spinner grande

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
                  {order.items?.map((item, idx) => {
                    const cfg = item.burgerConfig || {};
                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 rounded-lg px-2 py-1"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-medium">
                            {item.productName} x{item.quantity}
                          </div>
                          <div className="text-xs text-slate-600">
                            {formatCOP(item.totalPrice || 0)}
                          </div>
                        </div>

                        {/* Línea 1: carnes, tocineta, verduras */}
<div className="text-[11px] text-slate-600">
  <span className="font-semibold">Carne:</span>{" "}
  {cfg.meatQty || 1}x{" "}
  · <span className="font-semibold">Toc.:</span>{" "}
  {cfg.baconType || "-"}
  {cfg.extraBacon && " (+ adición)"}{" "}
  · <span className="font-semibold">Verduras:</span>{" "}
  {getVeggiesLabel(cfg)}{" "}
  · · <span className="font-semibold">Lechuga:</span>{" "}
  {cfg.noVeggies || cfg.lettuceOption === "sin"
  ? "no"
  : cfg.lettuceOption === "wrap"
  ? "wrap"
  : "sí"}
  · <span className="font-semibold">Tomate:</span>{" "}
  {cfg.tomato ? "sí" : "no"}{" "}
  · <span className="font-semibold">Cebolla:</span>{" "}
  {cfg.onion ? "sí" : "no"}
</div>


                        {/* Línea 2: papas, combo, gaseosa */}
                        <div className="text-[11px] text-slate-600">
                          {item.includesFries && (
                            <>
                              <span className="font-semibold">Combo:</span>{" "}
                              con papas{" "}
                            </>
                          )}
                          {item.extraFriesQty > 0 && (
                            <>
                              ·{" "}
                              <span className="font-semibold">
                                Adición papas:
                              </span>{" "}
                              {item.extraFriesQty}
                            </>
                          )}
                          {item.drinkCode && item.drinkCode !== "none" && (
                            <>
                              {" "}
                              ·{" "}
                              <span className="font-semibold">Bebida:</span>{" "}
                              {getDrinkLabel(item.drinkCode)}
                            </>
                          )}
                        </div>

                        {/* Línea 3: notas */}
                        {cfg.notes && cfg.notes.trim() !== "" && (
                          <div className="text-[11px] text-slate-700 mt-0.5">
                            <span className="font-semibold">Notas:</span>{" "}
                            {cfg.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                    {updatingId === order._id &&
                    order.status === "listo"
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
