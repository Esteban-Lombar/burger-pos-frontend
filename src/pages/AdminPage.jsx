// src/pages/AdminPage.jsx
import { useEffect, useState } from "react";
import { fetchTodaySummary } from "../api/client";

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
  });
}

function formatDateLabel(dateString) {
  if (!dateString) return "HOY";
  const d = new Date(dateString);
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function AdminPage() {
  const [summary, setSummary] = useState({
    total: 0,
    numOrders: 0,
    orders: [],
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`; // YYYY-MM-DD para el input date
  });

  const ticketPromedio =
    summary.numOrders > 0 ? summary.total / summary.numOrders : 0;

  async function loadSummary(dateString, showSpinner = true) {
    try {
      if (showSpinner) setLoading(true);
      setMessage("");

      const data = await fetchTodaySummary(dateString);
      setSummary(data);
    } catch (err) {
      console.error(err);
      setMessage("Error cargando resumen");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    // cargar al inicio la fecha seleccionada (hoy)
    loadSummary(selectedDate, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangeDate = (e) => {
    const value = e.target.value;
    setSelectedDate(value);
    loadSummary(value, true);
  };

  const handleRefresh = () => {
    loadSummary(selectedDate, true);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/90">
        <div>
          <h1 className="text-lg font-bold text-slate-50">
            Admin – Cierre de caja
          </h1>
          <p className="text-xs text-slate-300">
            Resumen de ventas del día 🧾💵
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de fecha */}
          <div className="flex flex-col items-end">
            <label className="text-[11px] text-slate-300 mb-0.5">
              Fecha:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleChangeDate}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-xs text-slate-100 outline-none"
            />
          </div>

          <button
            onClick={handleRefresh}
            className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-sm font-semibold"
          >
            Actualizar
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 p-4 space-y-4">
        {/* Tarjetas resumen */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-emerald-300 mb-1">
              TOTAL VENDIDO ({formatDateLabel(selectedDate)})
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatCOP(summary.total || 0)}
            </div>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-300 mb-1">
              NÚMERO DE PEDIDOS
            </div>
            <div className="text-2xl font-bold text-slate-50">
              {summary.numOrders}
            </div>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-amber-300 mb-1">
              TICKET PROMEDIO
            </div>
            <div className="text-2xl font-bold text-amber-300">
              {formatCOP(ticketPromedio || 0)}
            </div>
          </div>
        </section>

        {/* Lista de pedidos */}
        <section className="bg-slate-950 rounded-xl border border-slate-800 p-4">
          <h2 className="text-sm font-semibold text-slate-100 mb-2">
            Pedidos de {formatDateLabel(selectedDate).toLowerCase()}
          </h2>

          {loading ? (
            <div className="h-24 flex items-center justify-center text-slate-400 text-sm">
              Cargando pedidos...
            </div>
          ) : summary.orders.length === 0 ? (
            <p className="text-sm text-slate-400">
              No hay pedidos registrados para esta fecha.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {summary.orders.map((order) => (
                <div
                  key={order._id}
                  className="flex justify-between items-center bg-slate-900 rounded-lg border border-slate-700 px-3 py-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">
                        {order.toGo
                          ? "Para llevar"
                          : `Mesa ${order.tableNumber || "N/A"}`}
                      </span>
                      <span className="text-[10px] px-2 py-[2px] rounded-full bg-emerald-900 text-emerald-200 border border-emerald-500">
                        {(order.status || "listo").toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatTime(order.createdAt)} ·{" "}
                      {order.items?.length || 0} ítem(s)
                    </div>
                  </div>

                  <div className="text-sm font-semibold text-emerald-300">
                    {formatCOP(order.total || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {message && (
            <p className="text-xs text-slate-400 mt-2">{message}</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminPage;
