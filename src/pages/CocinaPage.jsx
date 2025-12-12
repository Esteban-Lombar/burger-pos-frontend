import { useEffect, useState } from "react";
import {
  fetchPendingOrders,
  updateOrderStatus,
  updateOrderData,
} from "../api/client";

// -------------------------------
// Auxiliar: nombre de bebida
// -------------------------------
function drinkLabel(code) {
  if (code === "coca") return "Coca-Cola";
  if (code === "coca_zero") return "Coca-Cola Zero";
  return "sin bebida";
}

export default function CocinaPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal para editar item
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [config, setConfig] = useState(null);

  // Cargar pedidos pendientes
  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchPendingOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
      setError("Error cargando pedidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // -----------------------------------------
  // Abrir edición de un item dentro de una orden
  // -----------------------------------------
  const openItemEditor = (order, index) => {
    const item = order.items[index];
    setEditingOrder(order);
    setEditingIndex(index);

    setConfig({
      quantity: item.quantity,
      meatQty: item.burgerConfig?.meatQty || 1,
      baconType: item.burgerConfig?.baconType || "asada",
      extraBacon: item.burgerConfig?.extraBacon || false,
      extraCheese: item.burgerConfig?.extraCheese || false,
      lettuceOption: item.burgerConfig?.lettuceOption || "normal",
      tomato: item.burgerConfig?.tomato ?? true,
      onion: item.burgerConfig?.onion ?? true,
      noVeggies: item.burgerConfig?.noVeggies || false,
      includesFries: item.includesFries || false,
      extraFriesQty: item.extraFriesQty || 0,
      drinkCode: item.drinkCode || "none",
      notes: item.burgerConfig?.notes || "",
    });
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  // -----------------------------------------
  // Guardar cambios del item editado
  // -----------------------------------------
  const saveItemChanges = async () => {
    const order = editingOrder;
    const index = editingIndex;
    const newItems = [...order.items];

    const oldItem = newItems[index];

    // Handshake con lógica de mesero (precios iguales)
    const ADDON_PRICES = {
      extraMeat: 5000,
      extraBacon: 3000,
      fries: 5000,
      extraFries: 5000,
      drink: 4000,
      extraCheese: 3000,
    };
    const COMBO_DISCOUNT = 1000;

    const calculateUnitPrice = (cfg) => {
      let unit = oldItem.unitPrice ?? 18000; // fallback si no viene

      const meatQty = Number(cfg.meatQty) || 1;
      if (meatQty > 1) unit += (meatQty - 1) * ADDON_PRICES.extraMeat;

      if (cfg.extraBacon) unit += ADDON_PRICES.extraBacon;
      if (cfg.extraCheese) unit += ADDON_PRICES.extraCheese;

      if (cfg.includesFries) unit += ADDON_PRICES.fries;

      const efq = Number(cfg.extraFriesQty) || 0;
      if (efq > 0) unit += efq * ADDON_PRICES.extraFries;

      const hasDrink = cfg.drinkCode && cfg.drinkCode !== "none";
      if (hasDrink) unit += ADDON_PRICES.drink;

      if (cfg.includesFries && hasDrink) unit -= COMBO_DISCOUNT;

      return unit;
    };

    const newUnit = calculateUnitPrice(config);
    const newTotal = newUnit * config.quantity;

    newItems[index] = {
      ...oldItem,
      quantity: config.quantity,
      includesFries: config.includesFries,
      extraFriesQty: config.extraFriesQty,
      drinkCode: config.drinkCode,
      unitPrice: newUnit,
      totalPrice: newTotal,
      burgerConfig: {
        meatQty: config.meatQty,
        baconType: config.baconType,
        extraBacon: config.extraBacon,
        extraCheese: config.extraCheese,
        lettuceOption: config.lettuceOption,
        tomato: config.tomato,
        onion: config.onion,
        noVeggies: config.noVeggies,
        notes: config.notes,
      },
    };

    await updateOrderData(order._id, { items: newItems });

    setEditingOrder(null);
    setEditingIndex(null);
    setConfig(null);

    await loadOrders();
  };

  // Actualizar mesa / para llevar
  const editMesa = async (order) => {
    let mesa = prompt(
      "Número de mesa (deja vacío para PARA LLEVAR):",
      order.tableNumber ?? ""
    );
    if (mesa === null) return;

    await updateOrderData(order._id, {
      tableNumber: mesa === "" ? null : Number(mesa),
      toGo: mesa === "",
    });

    loadOrders();
  };

  // Cambiar estado
  const changeStatus = async (order, status) => {
  try {
    await updateOrderStatus(order._id, status);
    await loadOrders();
  } catch (e) {
    console.error(e);
    alert("No se pudo actualizar el estado. Revisa conexión/servidor.");
  }
};


  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-950/95 backdrop-blur flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-50">
            Cocina – Pedidos pendientes 👨‍🍳
          </h1>
          <p className="text-[11px] text-slate-300">
            Ve las mesas, ajusta pedidos y marca como preparando / listo.
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold shadow"
        >
          Actualizar
        </button>
      </header>

      {/* Contenido */}
      <main className="flex-1 p-4">
        {loading && (
          <div className="text-sm text-slate-300 mb-3">Cargando pedidos…</div>
        )}
        {error && (
          <div className="text-sm text-red-400 mb-3">{error}</div>
        )}

        {orders.length === 0 && !loading ? (
          <p className="text-sm text-slate-400">
            No hay pedidos pendientes en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {orders.map((order) => (
              <div
                key={order._id}
                className="bg-slate-950/90 border border-slate-700 rounded-2xl p-3 shadow-sm"
              >
                {/* Encabezado de la tarjeta */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div
                      className={`text-sm md:text-base font-bold ${
                        order.toGo ? "text-orange-300" : "text-emerald-300"
                      }`}
                    >
                      {order.toGo
                        ? "🛍 PARA LLEVAR"
                        : `🍽 Mesa ${order.tableNumber}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-300">
                      <span className="px-2 py-[2px] rounded-full border border-slate-600 bg-slate-900">
                        Estado:{" "}
                        <span className="font-semibold text-emerald-300">
                          {(order.status || "pendiente").toUpperCase()}
                        </span>
                      </span>
                      <span className="px-2 py-[2px] rounded-full border border-slate-600 bg-slate-900">
                        Ítems: {order.items?.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-slate-300">
                      Total pedido
                    </div>
                    <div className="text-sm md:text-base font-bold text-emerald-300">
                      $
                      {order.total?.toLocaleString("es-CO", {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                </div>

                {/* DETALLE COMPLETO */}
                <div className="mt-2 text-[12px] text-slate-300 border-t border-slate-700 pt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900/80 border border-slate-700 rounded-lg p-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="font-semibold text-[13px] text-slate-50">
                            {item.productName} x{item.quantity}
                          </div>

                          <div className="mt-1 text-[11px] text-slate-200 space-y-1 leading-4">
  {/* Línea 1: carne + tocineta + queso */}
  <div>
    <span className="font-semibold text-slate-50">Carne:</span>{" "}
    {item.burgerConfig?.meatQty || 1}x{" "}
    <span className="mx-1">·</span>
    <span className="font-semibold text-slate-50">Tocineta:</span>{" "}
    {item.burgerConfig?.baconType || "asada"}
    {item.burgerConfig?.extraBacon && " + adición"}
    <span className="mx-1">·</span>
    <span className="font-semibold text-slate-50">Queso extra:</span>{" "}
    {item.burgerConfig?.extraCheese ? "sí" : "no"}
  </div>

  {/* Línea 2: verduras */}
  <div>
    <span className="font-semibold text-slate-50">Verduras:</span>{" "}
    {item.burgerConfig?.noVeggies ? "sin" : "con"}
    <span className="mx-1">·</span>
    <span className="font-semibold text-slate-50">Lechuga:</span>{" "}
    {item.burgerConfig?.lettuceOption === "wrap"
      ? "wrap"
      : item.burgerConfig?.lettuceOption === "sin"
      ? "no"
      : "sí"}
    <span className="mx-1">·</span>
    <span className="font-semibold text-slate-50">Tomate:</span>{" "}
    {item.burgerConfig?.tomato ? "sí" : "no"}
    <span className="mx-1">·</span>
    <span className="font-semibold text-slate-50">Cebolla:</span>{" "}
    {item.burgerConfig?.onion ? "sí" : "no"}
  </div>

  {/* Línea 3: papas / combo / gaseosa */}
  <div>
    <span className="font-semibold text-slate-50">Acompañamientos:</span>{" "}
    {item.includesFries ? "con papas" : "solo hamburguesa"}
    {typeof item.extraFriesQty === "number" &&
      item.extraFriesQty > 0 && (
        <>
          {" "}
          · Adic. papas: {item.extraFriesQty}
        </>
      )}
    <span className="mx-1">·</span>
    <span className="font-semibold text-slate-50">Bebida:</span>{" "}
    {drinkLabel(item.drinkCode)}
  </div>

  {/* Etiqueta combo para que el cocinero lo vea rápido */}
  {item.includesFries && item.drinkCode && item.drinkCode !== "none" && (
    <div className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-emerald-900/70 border border-emerald-500 text-[10px] text-emerald-100">
      <span>🥤🍟</span>
      <span>COMBO (papas + gaseosa)</span>
    </div>
  )}

  {/* Nota para cocina bien visible */}
  {item.burgerConfig?.notes && item.burgerConfig.notes.trim() !== "" && (
    <div className="text-yellow-300 font-semibold">
      📝 Nota cocina: {item.burgerConfig.notes}
    </div>
  )}
</div>


                          {item.burgerConfig?.notes?.trim() !== "" && (
                            <div className="text-[11px] text-yellow-300 font-semibold mt-1">
                              📝 Nota cocina: {item.burgerConfig.notes}
                            </div>
                          )}
                        </div>

                        {item.totalPrice != null && (
                          <div className="text-[11px] font-bold text-emerald-300 whitespace-nowrap">
                            $
                            {item.totalPrice.toLocaleString("es-CO", {
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        )}
                      </div>

                      <button
                        className="mt-1 text-[11px] text-sky-300 underline"
                        onClick={() => openItemEditor(order, idx)}
                      >
                        Editar item
                      </button>
                    </div>
                  ))}
                </div>

                {/* Botones de acción */}
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <button
                    className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600"
                    onClick={() => editMesa(order)}
                  >
                    Editar mesa / para llevar
                  </button>

                  <button
                    className="px-3 py-1.5 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
                    onClick={() => changeStatus(order, "preparando")}
                  >
                    Preparando
                  </button>

                  <button
                    className="px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
                    onClick={() => changeStatus(order, "listo")}
                  >
                    Listo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal edición */}
      {config && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-950 w-full max-w-sm mx-4 p-4 rounded-2xl border border-slate-700 shadow-xl text-slate-50">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold">
                Editar ítem de cocina
              </h2>
              <button
                onClick={() => {
                  setConfig(null);
                  setEditingOrder(null);
                  setEditingIndex(null);
                }}
                className="text-[11px] text-slate-300 hover:text-slate-100"
              >
                Cerrar ✕
              </button>
            </div>

            {/* Configuración del item */}
            <div className="space-y-2 text-xs">
              <label className="block">
                <span className="text-slate-200">Cantidad:</span>
                <input
                  type="number"
                  value={config.quantity}
                  onChange={(e) =>
                    handleConfigChange("quantity", e.target.value)
                  }
                  className="w-full mt-1 rounded bg-slate-900 border border-slate-700 p-1 outline-none"
                />
              </label>

              <label className="block">
                <span className="text-slate-200">Carnes:</span>
                <input
                  type="number"
                  value={config.meatQty}
                  onChange={(e) =>
                    handleConfigChange("meatQty", e.target.value)
                  }
                  className="w-full mt-1 rounded bg-slate-900 border border-slate-700 p-1 outline-none"
                />
              </label>

              <label className="block">
                <span className="text-slate-200">Tipo de tocineta:</span>
                <select
                  value={config.baconType}
                  onChange={(e) =>
                    handleConfigChange("baconType", e.target.value)
                  }
                  className="w-full mt-1 rounded bg-slate-900 border border-slate-700 p-1 outline-none"
                >
                  <option value="asada">Asada</option>
                  <option value="caramelizada">Caramelizada</option>
                </select>
              </label>

              <label className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={config.extraBacon}
                  onChange={(e) =>
                    handleConfigChange("extraBacon", e.target.checked)
                  }
                />
                <span>Extra tocineta</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.extraCheese}
                  onChange={(e) =>
                    handleConfigChange("extraCheese", e.target.checked)
                  }
                />
                <span>Extra queso</span>
              </label>

              <label className="block">
                <span className="text-slate-200">Notas:</span>
                <textarea
                  value={config.notes}
                  onChange={(e) =>
                    handleConfigChange("notes", e.target.value)
                  }
                  className="w-full mt-1 rounded bg-slate-900 border border-slate-700 p-1 outline-none"
                  rows={2}
                />
              </label>
            </div>

            <div className="flex mt-4 gap-2 text-sm">
              <button
                onClick={saveItemChanges}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 py-1.5 rounded-full text-slate-950 font-semibold"
              >
                Guardar cambios
              </button>
              <button
                onClick={() => {
                  setConfig(null);
                  setEditingOrder(null);
                  setEditingIndex(null);
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 py-1.5 rounded-full font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
