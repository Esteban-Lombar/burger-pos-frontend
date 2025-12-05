// src/pages/CocinaPage.jsx
import { useEffect, useState } from "react";
import {
  fetchPendingOrders,
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

// etiqueta para gaseosa
function drinkLabel(code) {
  if (code === "coca") return "Coca-Cola";
  if (code === "coca_zero") return "Coca-Cola Zero";
  return "sin bebida";
}

// resumen corto del ítem (igual que en mesero)
function itemSummary(item) {
  const cfg = item.burgerConfig || {};
  return [
    `Carne: ${cfg.meatQty || 1}x`,
    `Toc: ${cfg.baconType || "asada"}${
      cfg.extraBacon ? " + adición" : ""
    }`,
    `Queso extra: ${cfg.extraCheese ? "sí" : "no"}`,
    `Verduras: ${cfg.noVeggies ? "sin" : "con"}`,
    `Lechuga: ${
      cfg.lettuceOption === "wrap"
        ? "wrap"
        : cfg.lettuceOption === "sin"
        ? "no"
        : "sí"
    }`,
    `Tomate: ${cfg.tomato ? "sí" : "no"}`,
    `Cebolla: ${cfg.onion ? "sí" : "no"}`,
    `Combo: ${item.includesFries ? "con papas" : "solo hamburguesa"}`,
    `Adic. papas: ${item.extraFriesQty || 0}`,
    `Gaseosa: ${drinkLabel(item.drinkCode)}`,
  ].join(" · ");
}

// config base SOLO para cuando falte algún dato
const emptyConfig = {
  quantity: 1,
  meatQty: 1,
  extraBacon: false,
  extraCheese: false,
  lettuceOption: "normal",
  tomato: true,
  onion: true,
  noVeggies: false,
  includesFries: false,
  extraFriesQty: 0,
  drinkCode: "none",
  notes: "",
  baconType: "asada",
};

function CocinaPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // --- edición de mesa / para llevar (lo que ya tenías) ---
  const [editingMesa, setEditingMesa] = useState(false);

  // --- edición de ÍTEM ---
  const [editingOrder, setEditingOrder] = useState(null); // orden completa
  const [editingItemIndex, setEditingItemIndex] = useState(null); // índice del item dentro de la orden
  const [config, setConfig] = useState(emptyConfig);

  // cargar pedidos pendientes
  const loadOrders = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await fetchPendingOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error cargando pedidos pendientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      await loadOrders();
    } catch (err) {
      console.error(err);
      setErrorMsg("Error cambiando estado de la orden");
    }
  };

  // =========================
  //  EDITAR SOLO MESA / TOGO
  // =========================
  const handleEditMesa = async (order) => {
    if (editingMesa) return;
    setEditingMesa(true);

    try {
      const value = window.prompt(
        "Número de mesa (deja vacío para marcar como PARA LLEVAR):",
        order.tableNumber ?? ""
      );

      if (value === null) {
        setEditingMesa(false);
        return;
      }

      const trimmed = value.trim();
      const payload = {};

      if (trimmed === "") {
        payload.tableNumber = null;
        payload.toGo = true;
      } else {
        payload.tableNumber = Number(trimmed) || null;
        payload.toGo = false;
      }

      await updateOrderData(order._id, payload);
      await loadOrders();
    } catch (err) {
      console.error(err);
      setErrorMsg("Error editando la orden");
    } finally {
      setEditingMesa(false);
    }
  };

  // =========================
  //  EDITAR ÍTEM COMPLETO
  // =========================
  const openEditItemModal = (order, index) => {
    const item = order.items[index];
    if (!item) return;

    const cfg = item.burgerConfig || {};

    setEditingOrder(order);
    setEditingItemIndex(index);
    setConfig({
      quantity: item.quantity || 1,
      meatQty: cfg.meatQty || 1,
      extraBacon: cfg.extraBacon || false,
      extraCheese: cfg.extraCheese || false,
      lettuceOption: cfg.lettuceOption || "normal",
      tomato:
        typeof cfg.tomato === "boolean" ? cfg.tomato : true,
      onion:
        typeof cfg.onion === "boolean" ? cfg.onion : true,
      noVeggies: cfg.noVeggies || false,
      includesFries: item.includesFries || false,
      extraFriesQty: item.extraFriesQty || 0,
      drinkCode: item.drinkCode || "none",
      notes: cfg.notes || "",
      baconType: cfg.baconType || "asada",
    });
  };

  const closeEditItemModal = () => {
    setEditingOrder(null);
    setEditingItemIndex(null);
    setConfig(emptyConfig);
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => {
      const updated = { ...prev, [field]: value };

      // lógica de "sin verduras" igual que en mesero
      if (field === "noVeggies" && value === true) {
        updated.lettuceOption = "sin";
        updated.tomato = false;
        updated.onion = false;
      }

      return updated;
    });
  };

  const handleSaveEditedItem = async () => {
    if (!editingOrder || editingItemIndex === null) return;

    try {
      const itemsCopy = editingOrder.items.map((it) => ({ ...it }));

      const oldItem = itemsCopy[editingItemIndex];
      if (!oldItem) {
        closeEditItemModal();
        return;
      }

      const newBurgerConfig = {
        ...(oldItem.burgerConfig || {}),
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

      const newItem = {
        ...oldItem,
        quantity: Number(config.quantity) || 1,
        includesFries: config.includesFries,
        extraFriesQty: Number(config.extraFriesQty) || 0,
        drinkCode: config.drinkCode,
        burgerConfig: newBurgerConfig,
        // OJO: aquí NO tocamos unitPrice ni totalPrice
        // para no dañar el cierre de caja.
      };

      itemsCopy[editingItemIndex] = newItem;

      await updateOrderData(editingOrder._id, { items: itemsCopy });
      await loadOrders();
      closeEditItemModal();
    } catch (err) {
      console.error(err);
      setErrorMsg("Error editando el ítem");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/80">
        <div>
          <h1 className="text-lg font-bold">Cocina – Pedidos pendientes</h1>
          <p className="text-xs text-slate-300">
            Marca los pedidos como preparando o listos, y ajusta mesa si hace falta.
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="px-3 py-1 rounded-full bg-emerald-500 text-xs font-semibold"
        >
          Actualizar
        </button>
      </header>

      <main className="p-4">
        {loading ? (
          <p className="text-sm text-slate-200">Cargando pedidos...</p>
        ) : errorMsg ? (
          <p className="text-sm text-red-300">{errorMsg}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-200">No hay pedidos pendientes.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order._id}
                className="bg-slate-900/80 border border-slate-700 rounded-xl p-3"
              >
                {/* cabecera de la orden */}
                <div className="flex justify-between items-center mb-1 text-xs">
                  <div>
                    <div className="font-semibold">
                      {order.toGo
                        ? "PARA LLEVAR"
                        : order.tableNumber
                        ? `Mesa ${order.tableNumber}`
                        : "Mesa N/A"}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {new Date(order.createdAt).toLocaleTimeString("es-CO")}
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
                <div className="mt-2 space-y-1">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-700/70"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-xs font-semibold">
                            {item.productName} x{item.quantity}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            {itemSummary(item)}
                          </div>
                        </div>
                        <div className="text-right text-xs font-bold text-emerald-300">
                          {formatCOP(item.totalPrice || 0)}
                        </div>
                      </div>
                      <div className="mt-1 flex gap-2 text-[11px]">
                        <button
                          onClick={() => handleEditMesa(order)}
                          className="text-emerald-300 underline"
                        >
                          Editar mesa / para llevar
                        </button>
                        <button
                          onClick={() => openEditItemModal(order, index)}
                          className="text-amber-300 underline"
                        >
                          Editar ítem
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* botones de estado */}
                <div className="mt-2 flex gap-2 justify-end text-[11px]">
                  <button
                    onClick={() =>
                      handleStatusChange(order._id, "preparando")
                    }
                    className={`px-3 py-1 rounded-full border ${
                      order.status === "preparando"
                        ? "bg-amber-400 text-slate-900 border-amber-300"
                        : "bg-slate-900 text-amber-300 border-amber-500/60"
                    }`}
                  >
                    Preparando
                  </button>
                  <button
                    onClick={() => handleStatusChange(order._id, "listo")}
                    className={`px-3 py-1 rounded-full border ${
                      order.status === "listo"
                        ? "bg-emerald-400 text-slate-900 border-emerald-300"
                        : "bg-slate-900 text-emerald-300 border-emerald-500/60"
                    }`}
                  >
                    Listo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {errorMsg && !loading && (
          <p className="mt-2 text-xs text-red-300 flex items-center gap-1">
            <span>✖</span> {errorMsg}
          </p>
        )}
      </main>

      {/* MODAL PARA EDITAR ÍTEM */}
      {editingOrder && editingItemIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-40">
          <div className="bg-slate-950 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold">
                Editar ítem – Mesa{" "}
                {editingOrder.toGo
                  ? "PARA LLEVAR"
                  : editingOrder.tableNumber || "N/A"}
              </h3>
              <button
                onClick={closeEditItemModal}
                className="text-xs text-slate-300"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-50">
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
                <label className="flex items-center gap-1 mt-1">
                  <input
                    type="checkbox"
                    checked={config.extraBacon}
                    onChange={(e) =>
                      handleConfigChange("extraBacon", e.target.checked)
                    }
                  />
                  Adición de tocineta
                </label>
                <label className="flex items-center gap-1 mt-1">
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
                  placeholder="Ej: partir a la mitad, muy bien asada, etc."
                />
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSaveEditedItem}
                  className="flex-1 py-2 rounded-full bg-emerald-400 text-slate-900 text-sm font-semibold"
                >
                  Guardar cambios
                </button>
                <button
                  onClick={closeEditItemModal}
                  className="flex-1 py-2 rounded-full bg-slate-900 text-slate-50 text-sm font-semibold border border-slate-600"
                >
                  Cancelar
                </button>
              </div>

              <p className="mt-1 text-[10px] text-slate-400">
                Nota: desde cocina se actualiza la configuración del ítem,
                pero el precio se mantiene igual para no afectar el cierre
                de caja.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CocinaPage;
