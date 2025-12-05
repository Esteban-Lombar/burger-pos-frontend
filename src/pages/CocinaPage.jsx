// src/pages/CocinaPage.jsx
import { useEffect, useState } from "react";
import {
  fetchPendingOrders,
  fetchProducts,
  updateOrderStatus,
  updateOrderData,
} from "../api/client";

function formatCOP(value) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

// 💰 mismos precios que estás usando en MeseroPage
const ADDON_PRICES = {
  extraMeat: 5000,   // carne adicional
  extraBacon: 3000,  // adición de tocineta
  fries: 5000,       // papas incluidas (combo)
  extraFries: 5000,  // porción adicional de papas
  drink: 4000,       // gaseosa personal
  extraCheese: 3000, // adición de queso
};

const COMBO_DISCOUNT = 1000; // descuento cuando lleva papas + gaseosa

const baseConfig = {
  quantity: 1,
  meatQty: 1,
  extraBacon: false,
  extraCheese: false,
  lettuceOption: "normal", // normal | sin | wrap
  tomato: true,
  onion: true,
  noVeggies: false,
  includesFries: false,
  extraFriesQty: 0,
  drinkCode: "none",
  notes: "",
  baconType: "asada",
};

function drinkLabel(code) {
  if (code === "coca") return "Coca-Cola";
  if (code === "coca_zero") return "Coca-Cola Zero";
  return "sin bebida";
}

// 🔢 mismo cálculo de precio POR HAMBURGUESA que usas en MeseroPage
function calculateUnitPrice(basePrice, cfg) {
  let unit = basePrice || 0;

  const meatQty = Number(cfg.meatQty) || 1;
  if (meatQty > 1) {
    unit += (meatQty - 1) * ADDON_PRICES.extraMeat;
  }

  if (cfg.extraBacon) unit += ADDON_PRICES.extraBacon;
  if (cfg.extraCheese) unit += ADDON_PRICES.extraCheese;

  if (cfg.includesFries) {
    unit += ADDON_PRICES.fries;
  }

  const extraFriesQty = Number(cfg.extraFriesQty) || 0;
  if (extraFriesQty > 0) {
    unit += extraFriesQty * ADDON_PRICES.extraFries;
  }

  const hasDrink = cfg.drinkCode && cfg.drinkCode !== "none";
  if (hasDrink) {
    unit += ADDON_PRICES.drink;
  }

  if (cfg.includesFries && hasDrink) {
    unit -= COMBO_DISCOUNT;
  }

  return unit;
}

function CocinaPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // edición de mesa/para llevar
  const [editingTableOrder, setEditingTableOrder] = useState(null);

  // edición de ÍTEM
  const [editingOrder, setEditingOrder] = useState(null); // orden completa
  const [editingItemIndex, setEditingItemIndex] = useState(null); // índice del item
  const [config, setConfig] = useState(baseConfig);
  const [modalOpen, setModalOpen] = useState(false);

  // cargar pedidos + productos
  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        setError("");
        const [ordersResp, productsResp] = await Promise.all([
          fetchPendingOrders(),
          fetchProducts(),
        ]);
        setOrders(ordersResp);
        setProducts(productsResp);
      } catch (err) {
        console.error(err);
        setError("Error cargando pedidos pendientes");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const refreshOrders = async () => {
    try {
      const data = await fetchPendingOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
      setError("Error actualizando pedidos");
    }
  };

  // ----------------- Cambiar estado -----------------
  const handleStatusChange = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      await refreshOrders();
    } catch (err) {
      console.error(err);
      alert("Error cambiando estado");
    }
  };

  // ----------------- EDITAR MESA / PARA LLEVAR -----------------
  const handleEditTable = async (order) => {
    const currentMesa =
      order.toGo || order.tableNumber == null ? "" : String(order.tableNumber);

    const nuevaMesa = window.prompt(
      "Número de mesa (deja vacío para marcar como PARA LLEVAR):",
      currentMesa
    );

    if (nuevaMesa === null) return;

    const payload = {
      tableNumber: nuevaMesa === "" ? null : Number(nuevaMesa),
      toGo: nuevaMesa === "" ? true : false,
    };

    try {
      await updateOrderData(order._id, payload);
      await refreshOrders();
    } catch (err) {
      console.error(err);
      alert("Error editando la orden");
    }
  };

  // ----------------- EDITAR ÍTEM COMPLETO -----------------

  const openEditItemModal = (order, itemIndex) => {
    const item = order.items[itemIndex];
    if (!item) return;

    // buscar producto para saber tipo de tocineta
    const product = products.find((p) => String(p._id) === String(item.product));

    setEditingOrder(order);
    setEditingItemIndex(itemIndex);
    setConfig({
      quantity: item.quantity || 1,
      meatQty: item.burgerConfig?.meatQty || 1,
      extraBacon: item.burgerConfig?.extraBacon || false,
      extraCheese: item.burgerConfig?.extraCheese || false,
      lettuceOption: item.burgerConfig?.lettuceOption || "normal",
      tomato:
        typeof item.burgerConfig?.tomato === "boolean"
          ? item.burgerConfig.tomato
          : true,
      onion:
        typeof item.burgerConfig?.onion === "boolean"
          ? item.burgerConfig.onion
          : true,
      noVeggies: item.burgerConfig?.noVeggies || false,
      includesFries: item.includesFries || false,
      extraFriesQty: item.extraFriesQty || 0,
      drinkCode: item.drinkCode || "none",
      notes: item.burgerConfig?.notes || "",
      baconType:
        item.burgerConfig?.baconType ||
        (product?.options?.tocineta === "caramelizada"
          ? "caramelizada"
          : "asada"),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingOrder(null);
    setEditingItemIndex(null);
    setConfig(baseConfig);
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "noVeggies" && value === true) {
        updated.lettuceOption = "sin";
        updated.tomato = false;
        updated.onion = false;
      }

      return updated;
    });
  };

  const handleSaveEditedItem = async () => {
    if (!editingOrder || editingItemIndex == null) return;

    const order = editingOrder;
    const item = order.items[editingItemIndex];

    // buscamos el producto para tener el precio base
    const product = products.find((p) => String(p._id) === String(item.product));
    const basePrice = product?.price || item.unitPrice || 0;

    const quantity = Number(config.quantity) || 1;
    const unitPrice = calculateUnitPrice(basePrice, config);
    const totalPrice = unitPrice * quantity;

    const burgerConfig = {
      meatType: "carne",
      meatQty: Number(config.meatQty) || 1,
      baconType: config.baconType,
      extraBacon: config.extraBacon,
      extraCheese: config.extraCheese,
      lettuceOption: config.lettuceOption,
      tomato: config.tomato,
      onion: config.onion,
      noVeggies: config.noVeggies,
      notes: config.notes,
    };

    const updatedItems = order.items.map((it, idx) =>
      idx === editingItemIndex
        ? {
            ...it,
            quantity,
            includesFries: config.includesFries,
            extraFriesQty: Number(config.extraFriesQty) || 0,
            drinkCode: config.drinkCode,
            burgerConfig,
            unitPrice,
            totalPrice,
          }
        : it
    );

    const newOrderTotal = updatedItems.reduce(
      (sum, it) => sum + (it.totalPrice || 0),
      0
    );

    const payload = {
      tableNumber: order.tableNumber,
      toGo: order.toGo,
      items: updatedItems,
      total: newOrderTotal, // igual el back lo recalcula, pero lo mandamos bien
    };

    try {
      await updateOrderData(order._id, payload);
      // actualizar en el estado local
      setOrders((prev) =>
        prev.map((o) =>
          String(o._id) === String(order._id)
            ? { ...o, items: updatedItems, total: newOrderTotal }
            : o
        )
      );
      closeModal();
    } catch (err) {
      console.error(err);
      alert("Error editando la orden");
    }
  };

  // ----------------- RENDER -----------------
  if (loading) {
    return (
      <div className="p-4 text-emerald-50">
        Cargando pedidos pendientes...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Cocina – Pedidos pendientes</h1>
          <p className="text-xs text-slate-300">
            Marca los pedidos como preparando o listos, y ajusta mesa si hace
            falta.
          </p>
        </div>
        <button
          onClick={refreshOrders}
          className="px-3 py-1 text-xs rounded-full bg-emerald-500 text-slate-900 font-semibold"
        >
          Actualizar
        </button>
      </header>

      {error && (
        <div className="p-4 text-sm text-red-200">⚠️ {error}</div>
      )}

      <main className="p-4 space-y-3">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-300">No hay pedidos pendientes.</p>
        ) : (
          orders.map((order) => (
            <div
              key={order._id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2"
            >
              <div className="flex justify-between items-center text-xs">
                <div>
                  <div className="font-semibold">
                    {order.toGo || order.tableNumber == null
                      ? "Mesa N/A (PARA LLEVAR)"
                      : `Mesa ${order.tableNumber}`}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {new Date(order.createdAt).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Total:</div>
                  <div className="text-sm font-bold text-emerald-300">
                    {formatCOP(order.total || 0)}
                  </div>
                </div>
              </div>

              {/* items */}
              <div className="mt-1 space-y-1 text-[11px]">
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/80 rounded-lg p-2 border border-slate-800"
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-xs">
                        {item.productName} x{item.quantity}
                      </div>
                      <div className="text-xs font-bold text-emerald-300">
                        {formatCOP(item.totalPrice || 0)}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-300">
                      Carne: {item.burgerConfig?.meatQty || 1}x · Toc:{" "}
                      {item.burgerConfig?.baconType || "asada"}
                      {item.burgerConfig?.extraBacon && " + adic."} · Queso
                      extra: {item.burgerConfig?.extraCheese ? "sí" : "no"} ·
                      Verduras:{" "}
                      {item.burgerConfig?.noVeggies ? "sin" : "con"} · Lechuga:{" "}
                      {item.burgerConfig?.lettuceOption === "wrap"
                        ? "wrap"
                        : item.burgerConfig?.lettuceOption === "sin"
                        ? "no"
                        : "sí"}{" "}
                      · Tomate:{" "}
                      {item.burgerConfig?.tomato ? "sí" : "no"} · Cebolla:{" "}
                      {item.burgerConfig?.onion ? "sí" : "no"}
                      <br />
                      Combo:{" "}
                      {item.includesFries ? "con papas" : "solo hamburguesa"} ·
                      Adic. papas: {item.extraFriesQty || 0} · Gaseosa:{" "}
                      {drinkLabel(item.drinkCode)}
                    </div>

                    <button
                      onClick={() => openEditItemModal(order, idx)}
                      className="mt-1 text-[11px] text-emerald-300 underline"
                    >
                      Editar ítem
                    </button>
                  </div>
                ))}
              </div>

              {/* acciones de la orden */}
              <div className="flex justify-between items-center mt-2 text-[11px]">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditTable(order)}
                    className="px-3 py-1 rounded-full border border-slate-600 text-slate-100 hover:bg-slate-800"
                  >
                    Editar mesa / para llevar
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleStatusChange(order._id, "preparando")
                    }
                    className={`px-3 py-1 rounded-full text-xs ${
                      order.status === "preparando"
                        ? "bg-amber-400 text-black"
                        : "border border-amber-400 text-amber-300"
                    }`}
                  >
                    Preparando
                  </button>
                  <button
                    onClick={() => handleStatusChange(order._id, "listo")}
                    className={`px-3 py-1 rounded-full text-xs ${
                      order.status === "listo"
                        ? "bg-emerald-400 text-black"
                        : "border border-emerald-400 text-emerald-300"
                    }`}
                  >
                    Listo
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* MODAL EDITAR ÍTEM */}
      {modalOpen && editingOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-slate-950 w-full sm:max-w-md rounded-2xl border border-slate-700 p-4 max-h-[90vh] overflow-y-auto text-xs text-slate-50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">
                Editar ítem –{" "}
                {editingOrder.toGo || editingOrder.tableNumber == null
                  ? "Mesa N/A (PARA LLEVAR)"
                  : `Mesa ${editingOrder.tableNumber}`}
              </h3>
              <button onClick={closeModal} className="text-slate-300 text-xs">
                Cerrar
              </button>
            </div>

            <div className="space-y-2">
              {/* Cantidad */}
              <div className="flex items-center gap-2">
                <span>Personas (cantidad):</span>
                <input
                  type="number"
                  min="1"
                  value={config.quantity}
                  onChange={(e) =>
                    handleConfigChange("quantity", e.target.value)
                  }
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs outline-none"
                />
              </div>

              {/* Carnes */}
              <div className="flex items-center gap-2">
                <span>Número de carnes:</span>
                <input
                  type="number"
                  min="1"
                  value={config.meatQty}
                  onChange={(e) =>
                    handleConfigChange("meatQty", e.target.value)
                  }
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs outline-none"
                />
              </div>

              {/* Tocineta / queso */}
              <div>
                <span className="block mb-1">Tocineta y queso:</span>
                <p className="text-[11px] text-slate-300 mb-1">
                  Tipo de tocineta actual: {config.baconType}
                </p>
                <label className="flex items-center gap-1 mb-1">
                  <input
                    type="checkbox"
                    checked={config.extraBacon}
                    onChange={(e) =>
                      handleConfigChange("extraBacon", e.target.checked)
                    }
                  />
                  Adición de tocineta
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={config.extraCheese}
                    onChange={(e) =>
                      handleConfigChange("extraCheese", e.target.checked)
                    }
                  />
                  Adición de queso
                </label>
              </div>

              {/* Verduras */}
              <div>
                <span className="block mb-1">Verduras:</span>
                <div className="flex flex-wrap gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleConfigChange("noVeggies", false);
                      handleConfigChange("lettuceOption", "normal");
                      handleConfigChange("tomato", true);
                      handleConfigChange("onion", true);
                    }}
                    className={`px-2 py-1 rounded-full border text-[11px] ${
                      !config.noVeggies && config.lettuceOption === "normal"
                        ? "bg-emerald-300 text-slate-900 border-emerald-400"
                        : "bg-slate-900 text-slate-100 border-slate-700"
                    }`}
                  >
                    Con verduras
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleConfigChange("noVeggies", false);
                      handleConfigChange("lettuceOption", "wrap");
                      handleConfigChange("tomato", true);
                      handleConfigChange("onion", true);
                    }}
                    className={`px-2 py-1 rounded-full border text-[11px] ${
                      !config.noVeggies && config.lettuceOption === "wrap"
                        ? "bg-emerald-300 text-slate-900 border-emerald-400"
                        : "bg-slate-900 text-slate-100 border-slate-700"
                    }`}
                  >
                    Envolver en lechuga
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={
                        !config.noVeggies && config.lettuceOption !== "sin"
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (!checked) {
                          handleConfigChange("lettuceOption", "sin");
                        } else {
                          handleConfigChange("noVeggies", false);
                          handleConfigChange("lettuceOption", "normal");
                        }
                      }}
                    />
                    Con lechuga
                  </label>

                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={config.tomato}
                      onChange={(e) =>
                        handleConfigChange("tomato", e.target.checked)
                      }
                    />
                    Con tomate
                  </label>

                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={config.onion}
                      onChange={(e) =>
                        handleConfigChange("onion", e.target.checked)
                      }
                    />
                    Con cebolla
                  </label>

                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={config.noVeggies}
                      onChange={(e) =>
                        handleConfigChange("noVeggies", e.target.checked)
                      }
                    />
                    Sin verduras
                  </label>
                </div>
              </div>

              {/* Papas y gaseosa */}
              <div>
                <span className="block mb-1">Papas y gaseosa:</span>
                <label className="flex items-center gap-1 mb-1">
                  <input
                    type="checkbox"
                    checked={config.includesFries}
                    onChange={(e) =>
                      handleConfigChange("includesFries", e.target.checked)
                    }
                  />
                  En combo (papas incluidas)
                </label>

                <div className="flex items-center gap-2 mb-2">
                  <span>Adición de papas:</span>
                  <input
                    type="number"
                    min="0"
                    value={config.extraFriesQty}
                    onChange={(e) =>
                      handleConfigChange("extraFriesQty", e.target.value)
                    }
                    className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs outline-none"
                  />
                  <span className="text-[10px] text-slate-400">
                    (adicionales)
                  </span>
                </div>

                <div>
                  <span className="block mb-1">Gaseosa:</span>
                  <select
                    value={config.drinkCode}
                    onChange={(e) =>
                      handleConfigChange("drinkCode", e.target.value)
                    }
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 outline-none"
                  >
                    <option value="none">Sin bebida</option>
                    <option value="coca">Coca-Cola personal</option>
                    <option value="coca_zero">
                      Coca-Cola Zero personal
                    </option>
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <span className="block mb-1">Notas para cocina:</span>
                <textarea
                  rows={2}
                  value={config.notes}
                  onChange={(e) =>
                    handleConfigChange("notes", e.target.value)
                  }
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs outline-none"
                />
              </div>

              {/* (Opcional) mostrar precio calculado */}
              {(() => {
                const order = editingOrder;
                const firstItem =
                  order && order.items[editingItemIndex]
                    ? order.items[editingItemIndex]
                    : null;
                const product = firstItem
                  ? products.find(
                      (p) => String(p._id) === String(firstItem.product)
                    )
                  : null;
                const basePrice = product?.price || firstItem?.unitPrice || 0;
                const unit = calculateUnitPrice(basePrice, config);
                const qty = Number(config.quantity) || 1;
                const subtotal = unit * qty;

                return (
                  <div className="mt-2 text-[11px] text-emerald-300">
                    Precio por hamburguesa: {formatCOP(unit)} · Subtotal ítem:{" "}
                    {formatCOP(subtotal)}
                  </div>
                );
              })()}

              <p className="mt-1 text-[10px] text-slate-400">
                Notas: desde cocina se actualiza la configuración del ítem, pero
                el precio también se recalcula para que el cierre de caja quede
                correcto.
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSaveEditedItem}
                  className="flex-1 py-2 rounded-full bg-emerald-400 text-slate-900 text-sm font-semibold"
                >
                  Guardar cambios
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 py-2 rounded-full bg-slate-900 border border-slate-600 text-slate-50 text-sm font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CocinaPage;
