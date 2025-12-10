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
    let mesa = prompt("Número de mesa (deja vacío para PARA LLEVAR):", order.tableNumber ?? "");
    if (mesa === null) return;

    await updateOrderData(order._id, {
      tableNumber: mesa === "" ? null : Number(mesa),
      toGo: mesa === "",
    });

    loadOrders();
  };

  // Cambiar estado
  const changeStatus = async (order, status) => {
    await updateOrderStatus(order._id, status);
    loadOrders();
  };

  return (
    <div className="p-4">
      <h1 className="text-xl mb-3">Cocina – Pedidos pendientes</h1>

      <button onClick={loadOrders} className="mb-3 px-3 py-1 bg-green-600 text-white rounded">
        Actualizar
      </button>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-red-400">{error}</p>}

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order._id} className="border border-slate-600 rounded p-3 bg-[#0b200b]">
            <div className="flex justify-between">
              <div
  className={`font-bold text-lg ${
    order.toGo ? "text-orange-400" : "text-blue-400"
  }`}
>
  {order.toGo ? "PARA LLEVAR" : `Mesa ${order.tableNumber}`}
</div>

              <div className="text-green-300 font-bold">
                Total: ${order.total?.toLocaleString("es-CO")}
              </div>
            </div>

            {/* ----------------------
                DETALLE COMPLETO
            ----------------------- */}
            <div className="mt-1 text-[12px] text-slate-400">
              {order.items.map((item, idx) => (
                <div key={idx} className="mb-1">
                  <div className="font-semibold text-sm text-white">
                    {item.productName} x{item.quantity}
                  </div>

                  <div className="text-[11px] text-slate-300">
                    Carne: {item.burgerConfig?.meatQty || 1}x · Toc:{" "}
                    {item.burgerConfig?.baconType || "asada"}
                    {item.burgerConfig?.extraBacon && " + adic. toc"} · Queso ext:{" "}
                    {item.burgerConfig?.extraCheese ? "sí" : "no"} · Verduras:{" "}
                    {item.burgerConfig?.noVeggies ? "sin" : "con"} · Lechuga:{" "}
                    {item.burgerConfig?.lettuceOption} · Tomate:{" "}
                    {item.burgerConfig?.tomato ? "sí" : "no"} · Cebolla:{" "}
                    {item.burgerConfig?.onion ? "sí" : "no"} · Combo:{" "}
                    {item.includesFries ? "con papas" : "solo"} · Adic papas:{" "}
                    {item.extraFriesQty} · Gaseosa: {drinkLabel(item.drinkCode)}
                  </div>

                  {item.burgerConfig?.notes?.trim() !== "" && (
                    <div className="text-[11px] text-yellow-300 font-semibold">
                      Nota cocina: {item.burgerConfig.notes}
                    </div>
                  )}

                  <button
                    className="text-[11px] text-blue-300 underline mt-1"
                    onClick={() => openItemEditor(order, idx)}
                  >
                    Editar item
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <button
                className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                onClick={() => editMesa(order)}
              >
                Editar mesa / para llevar
              </button>

              <button
                className="px-2 py-1 bg-yellow-500 text-black rounded text-sm"
                onClick={() => changeStatus(order, "preparando")}
              >
                Preparando
              </button>

              <button
                className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                onClick={() => changeStatus(order, "listo")}
              >
                Listo
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal edición */}
      {config && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#102030] p-4 rounded-xl w-[380px] text-white">
            <h2 className="text-lg font-semibold mb-2">Editar ítem</h2>

            {/* Configuración del item */}
            <div className="space-y-2 text-sm">
              <label>
                Cantidad:
                <input
                  type="number"
                  value={config.quantity}
                  onChange={(e) => handleConfigChange("quantity", e.target.value)}
                  className="w-full mt-1 rounded bg-slate-800 border border-slate-600 p-1"
                />
              </label>

              <label>
                Carnes:
                <input
                  type="number"
                  value={config.meatQty}
                  onChange={(e) => handleConfigChange("meatQty", e.target.value)}
                  className="w-full mt-1 rounded bg-slate-800 border border-slate-600 p-1"
                />
              </label>

              <label>
                Tipo de tocineta:
                <select
                  value={config.baconType}
                  onChange={(e) => handleConfigChange("baconType", e.target.value)}
                  className="w-full mt-1 rounded bg-slate-800 border border-slate-600 p-1"
                >
                  <option value="asada">Asada</option>
                  <option value="caramelizada">Caramelizada</option>
                </select>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.extraBacon}
                  onChange={(e) => handleConfigChange("extraBacon", e.target.checked)}
                />
                Extra tocineta
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.extraCheese}
                  onChange={(e) => handleConfigChange("extraCheese", e.target.checked)}
                />
                Extra queso
              </label>

              <label>
                Notas:
                <textarea
                  value={config.notes}
                  onChange={(e) => handleConfigChange("notes", e.target.value)}
                  className="w-full mt-1 rounded bg-slate-800 border border-slate-600 p-1"
                />
              </label>
            </div>

            <div className="flex mt-4 gap-2">
              <button
                onClick={saveItemChanges}
                className="flex-1 bg-green-600 py-1 rounded"
              >
                Guardar cambios
              </button>
              <button
                onClick={() => {
                  setConfig(null);
                  setEditingOrder(null);
                }}
                className="flex-1 bg-red-600 py-1 rounded"
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
