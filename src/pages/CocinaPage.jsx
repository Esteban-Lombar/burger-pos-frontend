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

// 💰 mismos precios que usas en MeseroPage
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

// 🔢 mismo cálculo que en MeseroPage
function calculateUnitPrice(product, cfg) {
  let unit = product.price || 0;

  const meatQty = Number(cfg.meatQty) || 1;
  if (meatQty > 1) {
    unit += (meatQty - 1) * ADDON_PRICES.extraMeat;
  }

  if (cfg.extraBacon) {
    unit += ADDON_PRICES.extraBacon;
  }

  if (cfg.extraCheese) {
    unit += ADDON_PRICES.extraCheese;
  }

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

function summarizeConfig(item) {
  const c = item.burgerConfig || {};
  return [
    `Carne: ${c.meatQty || 1}x`,
    `Toc: ${c.baconType || "asada"}${c.extraBacon ? " + adic." : ""}`,
    `Queso extra: ${c.extraCheese ? "sí" : "no"}`,
    `Verduras: ${c.noVeggies ? "sin" : "con"}`,
    `Lechuga: ${
      c.lettuceOption === "wrap"
        ? "wrap"
        : c.lettuceOption === "sin"
        ? "no"
        : "sí"
    }`,
    `Tomate: ${c.tomato ? "sí" : "no"}`,
    `Cebolla: ${c.onion ? "sí" : "no"}`,
    `Combo: ${item.includesFries ? "con papas" : "solo hamburguesa"}`,
    `Adic. papas: ${item.extraFriesQty || 0}`,
    `Gaseosa: ${drinkLabel(item.drinkCode)}`,
  ].join(" · ");
}

function CocinaPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [products, setProducts] = useState([]);

  // estado para modal de edición/agregado
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null); // null = agregando
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [config, setConfig] = useState(baseConfig);
  const [savingItem, setSavingItem] = useState(false);

  // mensaje de error abajo
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      const [ordersRes, productsRes] = await Promise.all([
        fetchPendingOrders(),
        fetchProducts(),
      ]);
      setOrders(ordersRes);
      setProducts(productsRes);
    } catch (err) {
      console.error(err);
      setError("Error cargando pedidos o productos");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId, nextStatus) {
    try {
      setFeedback("");
      await updateOrderStatus(orderId, nextStatus);
      await loadAll();
    } catch (err) {
      console.error(err);
      setFeedback("Error cambiando estado");
    }
  }

  // editar solo mesa / para llevar (lo que ya tenías)
  async function handleEditTable(order) {
    try {
      const input = window.prompt(
        "Número de mesa (deja vacío para marcar como PARA LLEVAR):",
        order.tableNumber || ""
      );

      if (input === null) return; // cancel

      const trimmed = input.trim();
      const isToGo = trimmed === "";

      const payload = {
        tableNumber: isToGo ? null : Number(trimmed),
        toGo: isToGo,
      };

      await updateOrderData(order._id, payload);
      await loadAll();
    } catch (err) {
      console.error(err);
      setFeedback("Error editando la orden");
    }
  }

  // abrir modal para EDITAR un ítem existente
  function openEditItem(order, index) {
    const item = order.items[index];
    if (!item) return;

    const product = products.find((p) => p._id === item.product);
    if (!product) return;

    setEditingOrder(order);
    setEditingIndex(index);
    setSelectedProduct(product);

    const c = item.burgerConfig || {};

    setConfig({
      quantity: item.quantity || 1,
      meatQty: c.meatQty || 1,
      extraBacon: !!c.extraBacon,
      extraCheese: !!c.extraCheese,
      lettuceOption: c.lettuceOption || "normal",
      tomato: typeof c.tomato === "boolean" ? c.tomato : true,
      onion: typeof c.onion === "boolean" ? c.onion : true,
      noVeggies: !!c.noVeggies,
      includesFries: !!item.includesFries,
      extraFriesQty: item.extraFriesQty || 0,
      drinkCode: item.drinkCode || "none",
      notes: c.notes || "",
      baconType:
        c.baconType ||
        (product.options?.tocineta === "caramelizada"
          ? "caramelizada"
          : "asada"),
    });
  }

  // abrir modal para AGREGAR una hamburguesa nueva a la misma orden
  function openAddItem(order) {
    setEditingOrder(order);
    setEditingIndex(null); // agregando
    setSelectedProduct(null); // se selecciona en el select
    setConfig(baseConfig);
  }

  function closeModal() {
    setEditingOrder(null);
    setEditingIndex(null);
    setSelectedProduct(null);
    setConfig(baseConfig);
  }

  function handleConfigChange(field, value) {
    setConfig((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "noVeggies" && value === true) {
        updated.lettuceOption = "sin";
        updated.tomato = false;
        updated.onion = false;
      }

      return updated;
    });
  }

  async function handleSaveItem() {
    if (!editingOrder || !selectedProduct) return;

    try {
      setSavingItem(true);
      setFeedback("");

      const quantity = Number(config.quantity) || 1;
      const unitPrice = calculateUnitPrice(selectedProduct, config);
      const totalPrice = unitPrice * quantity;

      const burgerConfig = {
        meatType: "carne",
        meatQty: Number(config.meatQty) || 1,
        baconType: config.baconType,
        extraBacon: !!config.extraBacon,
        extraCheese: !!config.extraCheese,
        lettuceOption: config.lettuceOption,
        tomato: config.tomato,
        onion: config.onion,
        noVeggies: !!config.noVeggies,
        notes: config.notes,
      };

      const newItem = {
        product: selectedProduct._id,
        productName: selectedProduct.name,
        productCode: selectedProduct.code || null,
        quantity,
        includesFries: !!config.includesFries,
        extraFriesQty: Number(config.extraFriesQty) || 0,
        drinkCode: config.drinkCode,
        burgerConfig,
        unitPrice,
        totalPrice,
      };

      let newItems;
      if (editingIndex === null) {
        // agregando nueva hamburguesa
        newItems = [...editingOrder.items, newItem];
      } else {
        // editando hamburguesa existente
        newItems = editingOrder.items.map((it, idx) =>
          idx === editingIndex ? newItem : it
        );
      }

      await updateOrderData(editingOrder._id, {
        items: newItems,
        tableNumber: editingOrder.tableNumber,
        toGo: editingOrder.toGo,
      });

      await loadAll();
      closeModal();
    } catch (err) {
      console.error(err);
      setFeedback("Error guardando cambios del ítem");
    } finally {
      setSavingItem(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Cocina – Pedidos pendientes</h1>
          <p className="text-xs text-slate-300">
            Marca los pedidos como preparando o listos, y ajusta mesa si hace
            falta.
          </p>
        </div>
        <button
          onClick={loadAll}
          className="px-3 py-1 rounded-full bg-emerald-500 text-sm font-semibold"
        >
          Actualizar
        </button>
      </header>

      {loading ? (
        <p className="p-4 text-sm">Cargando pedidos...</p>
      ) : error ? (
        <p className="p-4 text-sm text-red-300">{error}</p>
      ) : orders.length === 0 ? (
        <p className="p-4 text-sm text-slate-300">
          No hay pedidos pendientes por ahora.
        </p>
      ) : (
        <main className="p-4 space-y-3">
          {orders.map((order) => (
            <div
              key={order._id}
              className="bg-slate-900 border border-slate-700 rounded-xl p-3"
            >
              {/* Cabecera de la orden */}
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs">
                  <div className="font-semibold">
                    Mesa{" "}
                    {order.toGo
                      ? "N/A (Para llevar)"
                      : order.tableNumber || "N/A"}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {new Date(order.createdAt).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                </div>
                <div className="text-xs font-bold text-emerald-300">
                  Total: {formatCOP(order.total || 0)}
                </div>
              </div>

              {/* Lista de ítems */}
              <div className="mt-1 space-y-1 text-xs">
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="border-t border-slate-800 pt-1 mt-1"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold">
                          {item.productName} x{item.quantity}
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {summarizeConfig(item)}
                        </div>
                      </div>
                      <div className="text-[11px] font-bold text-amber-300">
                        {formatCOP(item.totalPrice || 0)}
                      </div>
                    </div>
                    <button
                      onClick={() => openEditItem(order, idx)}
                      className="mt-1 text-[11px] text-emerald-300 underline"
                    >
                      Editar ítem
                    </button>
                  </div>
                ))}

                {/* botón para agregar hamburguesa nueva al mismo pedido */}
                <button
                  onClick={() => openAddItem(order)}
                  className="mt-2 text-[11px] text-amber-300 underline"
                >
                  Agregar hamburguesa
                </button>
              </div>

              {/* Controles de mesa / estado */}
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <button
                  onClick={() => handleEditTable(order)}
                  className="text-sky-300 underline"
                >
                  Editar mesa / para llevar
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange(order._id, "preparando")}
                    className="px-3 py-1 rounded-full border border-amber-300 text-amber-300"
                  >
                    Preparando
                  </button>
                  <button
                    onClick={() => handleStatusChange(order._id, "listo")}
                    className="px-3 py-1 rounded-full border border-emerald-400 text-emerald-300"
                  >
                    Listo
                  </button>
                </div>
              </div>
            </div>
          ))}

          {feedback && (
            <p className="text-xs text-red-300 mt-2 flex items-center gap-1">
              <span>✖</span> {feedback}
            </p>
          )}
        </main>
      )}

      {/* MODAL editar / agregar ítem */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-600 p-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">
                {editingIndex === null
                  ? `Agregar ítem – Mesa ${
                      editingOrder.toGo
                        ? "N/A (Para llevar)"
                        : editingOrder.tableNumber || "N/A"
                    }`
                  : `Editar ítem – Mesa ${
                      editingOrder.toGo
                        ? "N/A (Para llevar)"
                        : editingOrder.tableNumber || "N/A"
                    }`}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-300 hover:text-slate-100"
              >
                Cerrar
              </button>
            </div>

            {/* 🔽 Selector de tipo de hamburguesa (solo al agregar) */}
            {editingIndex === null && (
              <div className="mb-3">
                <span className="block mb-1 text-slate-200">
                  Tipo de hamburguesa:
                </span>
                <select
                  value={selectedProduct?._id || ""}
                  onChange={(e) => {
                    const p = products.find((x) => x._id === e.target.value);
                    if (p) {
                      setSelectedProduct(p);
                      setConfig((prev) => ({
                        ...prev,
                        baconType:
                          p.options?.tocineta === "caramelizada"
                            ? "caramelizada"
                            : "asada",
                      }));
                    }
                  }}
                  className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs"
                >
                  <option value="" disabled>
                    -- Seleccione tipo --
                  </option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}{" "}
                      {p.options?.tocineta === "caramelizada" &&
                        "(Caramelizada)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Si estoy editando, muestro el nombre actual */}
            {editingIndex !== null && selectedProduct && (
              <p className="mb-2 text-slate-200">
                Producto: <span className="font-semibold">{selectedProduct.name}</span>
              </p>
            )}

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
                  className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-600"
                />
              </div>

              {/* Número de carnes */}
              <div className="flex items-center gap-2">
                <span>Número de carnes:</span>
                <input
                  type="number"
                  min="1"
                  value={config.meatQty}
                  onChange={(e) =>
                    handleConfigChange("meatQty", e.target.value)
                  }
                  className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-600"
                />
              </div>

              {/* Tocineta y queso */}
              <div>
                <span className="block mb-1">Tocineta y queso:</span>
                <p className="text-[11px] text-slate-300 mb-1">
                  Tipo de tocineta actual:{" "}
                  {config.baconType === "caramelizada"
                    ? "caramelizada"
                    : "asada"}
                </p>
                <label className="flex items-center gap-1 mt-1">
                  <input
                    type="checkbox"
                    checked={config.extraBacon}
                    onChange={(e) =>
                      handleConfigChange("extraBacon", e.target.checked)
                    }
                  />
                  Adición de tocineta (+$3.000)
                </label>
                <label className="flex items-center gap-1 mt-1">
                  <input
                    type="checkbox"
                    checked={config.extraCheese}
                    onChange={(e) =>
                      handleConfigChange("extraCheese", e.target.checked)
                    }
                  />
                  Adición de queso (+$3.000)
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
                        : "bg-slate-800 text-slate-100 border-slate-600"
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
                        : "bg-slate-800 text-slate-100 border-slate-600"
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
                    className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-600"
                  />
                  <span className="text-[10px] text-slate-300">
                    x$5.000 c/u
                  </span>
                </div>

                <div>
                  <span className="block mb-1">Gaseosa:</span>
                  <select
                    value={config.drinkCode}
                    onChange={(e) =>
                      handleConfigChange("drinkCode", e.target.value)
                    }
                    className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-600"
                  >
                    <option value="none">Sin bebida</option>
                    <option value="coca">
                      Coca-Cola personal (+$4.000)
                    </option>
                    <option value="coca_zero">
                      Coca-Cola Zero personal (+$4.000)
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
                  className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-600"
                  placeholder="Ej: sin sal, partir a la mitad, etc."
                />
              </div>

              <p className="text-[10px] text-slate-400">
                Desde cocina puedes ajustar la configuración del ítem. El precio
                se recalcula automáticamente con las adiciones.
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSaveItem}
                  disabled={savingItem || !selectedProduct}
                  className="flex-1 py-2 rounded-full bg-emerald-400 text-slate-900 text-sm font-semibold disabled:opacity-60"
                >
                  {savingItem
                    ? "Guardando..."
                    : editingIndex === null
                    ? "Agregar al pedido"
                    : "Guardar cambios"}
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 py-2 rounded-full bg-slate-800 border border-slate-600 text-slate-100 text-sm font-semibold"
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
