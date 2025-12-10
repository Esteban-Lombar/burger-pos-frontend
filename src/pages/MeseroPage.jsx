import { useEffect, useState } from "react";
import { fetchProducts, createOrder } from "../api/client";

function formatCOP(value) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

// 💰 precios de las adiciones
// Base: hamburguesa sola = 18.000
// + papas -> 21.000 (+3.000)
// + gaseosa -> 21.000 (+3.000)
// + papas + gaseosa -> 23.000 (+6.000 - 1.000 de descuento combo)
const ADDON_PRICES = {
  extraMeat: 5000, // carne adicional
  extraBacon: 3000, // adición de tocineta
  fries: 5000, // papas incluidas (combo)
  extraFries: 5000, // porción adicional de papas
  drink: 4000, // gaseosa personal
  extraCheese: 3000, // adición de queso
};

const COMBO_DISCOUNT = 1000; // descuento cuando lleva papas + gaseosa

const baseConfig = {
  meatQty: 1,
  extraBacon: false,
  extraCheese: false,
  lettuceOption: "normal", // normal | sin | wrap
  tomato: true,
  onion: true,
  noVeggies: false,
  includesFries: false,
  extraFriesQty: 0,
  drinkCode: "none", // none | coca | coca_zero
  notes: "",
  quantity: 1,
  baconType: "asada",
};

// label para gaseosa
function drinkLabel(code) {
  if (code === "coca") return "Coca-Cola";
  if (code === "coca_zero") return "Coca-Cola Zero";
  return "sin bebida";
}

// 🔢 calcula el precio POR HAMBURGUESA con todos los extras
function calculateUnitPrice(product, cfg) {
  let unit = product.price || 0;

  // carnes extra (la primera carne ya va incluida)
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

  // papas incluidas (la porción del combo)
  if (cfg.includesFries) {
    unit += ADDON_PRICES.fries; // +5.000
  }

  // porciones adicionales de papas
  const extraFriesQty = Number(cfg.extraFriesQty) || 0;
  if (extraFriesQty > 0) {
    unit += extraFriesQty * ADDON_PRICES.extraFries; // +5.000 c/u
  }

  // gaseosa (siempre se cobra aparte, a menos que elijas "sin bebida")
  const hasDrink = cfg.drinkCode && cfg.drinkCode !== "none";
  if (hasDrink) {
    unit += ADDON_PRICES.drink; // +4.000
  }

  // 💥 descuento combo: papas + gaseosa -> -1.000
  if (cfg.includesFries && hasDrink) {
    unit -= COMBO_DISCOUNT;
  }

  return unit;
}

function MeseroPage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  const [tableNumber, setTableNumber] = useState("");
  const [toGo, setToGo] = useState(false);
  const [items, setItems] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [config, setConfig] = useState(baseConfig);
  const [editingIndex, setEditingIndex] = useState(null); // 👈 para saber si estoy editando

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [mesaWarning, setMesaWarning] = useState(""); // 🚨 aviso cuando falta mesa / para llevar

  // Cargar menú
  useEffect(() => {
    async function loadProducts() {
      try {
        setLoadingProducts(true);
        setError("");
        const data = await fetchProducts();
        setProducts(data);
      } catch (err) {
        console.error(err);
        setError("Error cargando el menú");
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, []);

  // Abrir configurador para NUEVO item
  const openConfigForNew = (product) => {
    const baconType =
      product.options?.tocineta === "caramelizada" ? "caramelizada" : "asada";

    setSelectedProduct(product);
    setConfig({
      ...baseConfig,
      baconType,
    });
    setEditingIndex(null);
  };

  // Abrir configurador para EDITAR item existente
  const openConfigForEdit = (index) => {
    const item = items[index];
    if (!item) return;

    const product = products.find((p) => p._id === item.product);
    if (!product) return;

    setSelectedProduct(product);
    setConfig({
      quantity: item.quantity,
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
        (product.options?.tocineta === "caramelizada"
          ? "caramelizada"
          : "asada"),
    });
    setEditingIndex(index);
  };

  const closeConfig = () => {
    setSelectedProduct(null);
    setConfig(baseConfig);
    setEditingIndex(null);
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => {
      let updated = { ...prev, [field]: value };

      if (field === "noVeggies" && value === true) {
        updated.lettuceOption = "sin";
        updated.tomato = false;
        updated.onion = false;
      }

      return updated;
    });
  };

  // Guardar (nuevo o editar)
  const handleSaveItem = () => {
    if (!selectedProduct) return;

    const quantity = Number(config.quantity) || 1;
    const unitPrice = calculateUnitPrice(selectedProduct, config);
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

    const newItem = {
      product: selectedProduct._id,
      productName: selectedProduct.name,
      productCode: selectedProduct.code || null,

      quantity,
      includesFries: config.includesFries,
      extraFriesQty: Number(config.extraFriesQty) || 0,
      drinkCode: config.drinkCode,

      burgerConfig,
      unitPrice,
      totalPrice,
    };

    if (editingIndex !== null) {
      // editar
      setItems((prev) =>
        prev.map((it, idx) => (idx === editingIndex ? newItem : it))
      );
    } else {
      // nuevo
      setItems((prev) => [...prev, newItem]);
    }

    closeConfig();
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const orderTotal = items.reduce(
    (sum, item) => sum + (item.totalPrice || 0),
    0
  );

  // ✅ regla: debe haber items y (mesa válida o para llevar)
  const mesaValida = toGo || (!!tableNumber && Number(tableNumber) > 0);
  const canSend = items.length > 0 && mesaValida;

  const handleSendOrder = async () => {
    try {
      if (items.length === 0) {
        alert("Agrega al menos un producto al pedido");
        return;
      }

      if (!mesaValida) {
        setMesaWarning(
          "Selecciona un número de mesa o marca la opción PARA LLEVAR."
        );
        return;
      }

      setSending(true);
      setMessage("");
      setMesaWarning("");

      const payload = {
        tableNumber: toGo ? null : Number(tableNumber) || null,
        toGo,
        items,
      };

      await createOrder(payload);

      setItems([]);
      setTableNumber("");
      setToGo(false);
      setMessage("✅ Pedido enviado a cocina");
    } catch (err) {
      console.error(err);
      alert("Error enviando pedido a cocina");
    } finally {
      setSending(false);
    }
  };

  // 🧮 Resumen en vivo del ítem que se está configurando
  const previewUnitPrice =
    selectedProduct != null ? calculateUnitPrice(selectedProduct, config) : 0;
  const previewQuantity = Number(config.quantity) || 1;
  const previewTotal = previewUnitPrice * previewQuantity;

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-emerald-800 flex justify-between items-center bg-emerald-950/90">
        <div>
          <h1 className="text-lg font-bold text-emerald-50">
            Mesero – Tomar pedido 🍔
          </h1>
          <p className="text-xs text-emerald-200">
            Paso 1: elige hamburguesa · Paso 2: configura · Paso 3: confirma y
            envía
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row">
        {/* Menú */}
        <section className="flex-1 p-4 border-r border-emerald-800/60">
          <h2 className="text-sm font-semibold text-emerald-50 mb-1">
            Paso 1 – Menú
          </h2>
          <p className="text-[11px] text-emerald-200 mb-3">
            Toca una hamburguesa para configurarla.
          </p>

          {loadingProducts ? (
            <p className="text-emerald-100 text-sm">Cargando menú...</p>
          ) : error ? (
            <p className="text-red-100 text-sm">{error}</p>
          ) : products.length === 0 ? (
            <p className="text-emerald-100 text-sm">
              Aún no hay productos cargados.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((product) => {
                const isSelected =
                  selectedProduct && selectedProduct._id === product._id;
                return (
                  <button
                    key={product._id}
                    onClick={() => openConfigForNew(product)}
                    className={`text-left rounded-2xl p-3 border transition shadow-sm ${
                      isSelected
                        ? "bg-emerald-400 text-emerald-950 border-emerald-300 shadow-lg"
                        : "bg-emerald-800/70 hover:bg-emerald-700/90 text-emerald-50 border-emerald-700/60"
                    }`}
                  >
                    <div className="font-semibold text-sm">
                      {product.name}
                    </div>
                    <div className="text-[11px] mt-0.5 uppercase">
                      {product.options?.tocineta === "caramelizada"
                        ? "TOCINETA CARAMELIZADA"
                        : "TOCINETA ASADA"}
                    </div>
                    <div className="mt-2 text-sm font-bold">
                      {formatCOP(product.price || 0)}
                    </div>
                    <div className="mt-1 text-[10px] opacity-80">
                      Toca para configurar
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Pedido actual (barra lateral) */}
        <section className="w-full md:w-80 lg:w-96 p-4 bg-emerald-950/90 border-l border-emerald-800/80">
          <h2 className="text-sm font-semibold text-emerald-50 mb-1">
            Paso 3 – Pedido actual
          </h2>
          <p className="text-[11px] text-emerald-200 mb-2">
            Revisa con el cliente y envía a cocina.
          </p>

          {/* Mesa / para llevar */}
          <div className="space-y-2 text-sm text-emerald-50">
            <div className="flex items-center justify-between gap-2 bg-emerald-900/80 border border-emerald-700 rounded-xl px-2 py-2">
              <label className="text-xs text-emerald-200">Mesa:</label>
              <input
                type="number"
                min="1"
                disabled={toGo}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="flex-1 px-2 py-1 rounded bg-emerald-950 border border-emerald-700 text-xs text-emerald-50 outline-none"
              />
              <label className="flex items-center gap-1 text-[11px] text-emerald-200">
                <input
                  type="checkbox"
                  checked={toGo}
                  onChange={(e) => setToGo(e.target.checked)}
                />
                Para llevar
              </label>
            </div>

            {/* Items */}
            <div className="mt-2 border-t border-emerald-800/80 pt-2">
              {items.length === 0 ? (
                <p className="text-xs text-emerald-200">
                  Aún no has agregado productos.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-emerald-900/90 rounded-xl p-2 border border-emerald-700/80"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="font-semibold text-xs">
                            {item.productName} x{item.quantity}
                          </div>
                          {/* 🔍 Resumen super detallado para confirmar con el cliente */}
                          <div className="text-[11px] text-emerald-300 leading-4 mt-0.5">
                            Carne: {item.burgerConfig?.meatQty || 1}x · Toc:{" "}
                            {item.burgerConfig?.baconType || "asada"}
                            {item.burgerConfig?.extraBacon && " + adición"} ·{" "}
                            Queso extra:{" "}
                            {item.burgerConfig?.extraCheese ? "sí" : "no"} ·{" "}
                            Verduras:{" "}
                            {item.burgerConfig?.noVeggies ? "sin" : "con"} ·{" "}
                            Lechuga:{" "}
                            {item.burgerConfig?.lettuceOption === "wrap"
                              ? "wrap"
                              : item.burgerConfig?.lettuceOption === "sin"
                              ? "no"
                              : "sí"}{" "}
                            · Tomate:{" "}
                            {item.burgerConfig?.tomato ? "sí" : "no"} · Cebolla:{" "}
                            {item.burgerConfig?.onion ? "sí" : "no"} · Combo:{" "}
                            {item.includesFries
                              ? "con papas"
                              : "solo hamburguesa"}{" "}
                            · Adic. papas: {item.extraFriesQty || 0} · Gaseosa:{" "}
                            {drinkLabel(item.drinkCode)}
                            {item.burgerConfig?.notes && (
                              <>
                                <br />
                                <span className="text-amber-200">
                                  📝 {item.burgerConfig.notes}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-amber-200 whitespace-nowrap">
                          {formatCOP(item.totalPrice || 0)}
                        </div>
                      </div>
                      <div className="mt-1 flex gap-3 text-[11px]">
                        <button
                          onClick={() => openConfigForEdit(index)}
                          className="text-emerald-200 underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-200 underline"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total y enviar */}
            <div className="mt-3 border-t border-emerald-800/80 pt-2 text-xs">
              <div className="flex justify-between mb-2">
                <span className="text-emerald-200">Total pedido:</span>
                <span className="font-bold text-amber-300">
                  {formatCOP(orderTotal)}
                </span>
              </div>

              <button
                onClick={handleSendOrder}
                disabled={sending || !canSend}
                className="w-full py-2 rounded-full bg-amber-400 text-emerald-950 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? "Enviando..." : "Enviar a cocina"}
              </button>

              {mesaWarning && (
                <p className="mt-1 text-[11px] text-red-200">{mesaWarning}</p>
              )}

              {message && (
                <p className="mt-1 text-[11px] text-emerald-200">{message}</p>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Panel configuración por persona */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-40">
          <div className="bg-emerald-950 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-emerald-700 p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-emerald-50">
                Paso 2 – Configurar {selectedProduct.name}
              </h3>
              <button
                onClick={closeConfig}
                className="text-xs text-emerald-300"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-3 text-xs text-emerald-50">
              {/* Cantidad de personas */}
              <div className="flex items-center justify-between gap-2">
                <span>Personas (cantidad):</span>
                <input
                  type="number"
                  min="1"
                  value={config.quantity}
                  onChange={(e) =>
                    handleConfigChange("quantity", e.target.value)
                  }
                  className="w-20 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                />
              </div>

              {/* Número de carnes */}
              <div className="flex items-center justify-between gap-2">
                <span>Número de carnes:</span>
                <input
                  type="number"
                  min="1"
                  value={config.meatQty}
                  onChange={(e) =>
                    handleConfigChange("meatQty", e.target.value)
                  }
                  className="w-20 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                />
              </div>

              {/* Tocineta y queso */}
              <div>
                <span className="block mb-1">Tocineta y queso:</span>
                <p className="text-[11px] text-emerald-200 mb-1">
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

                {/* botones generales */}
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
                        ? "bg-emerald-300 text-emerald-950 border-emerald-400"
                        : "bg-emerald-900 text-emerald-100 border-emerald-700"
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
                        ? "bg-emerald-300 text-emerald-950 border-emerald-400"
                        : "bg-emerald-900 text-emerald-100 border-emerald-700"
                    }`}
                  >
                    Envolver en lechuga
                  </button>
                </div>

                {/* checkboxes individuales */}
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
                    className="w-16 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                  />
                  <span className="text-[10px] text-emerald-300">
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
                    className="w-full px-2 py-1 rounded bg-emerald-900 border border-emerald-700 outline-none"
                  >
                    <option value="none">Sin bebida</option>
                    <option value="coca">Coca-Cola personal (+$4.000)</option>
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
                  className="w-full px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                  placeholder="Ej: partir a la mitad, muy bien asada, etc."
                />
              </div>

              {/* Resumen en vivo del ítem */}
              <div className="mt-2 border-t border-emerald-700 pt-2 text-xs text-emerald-100">
                <div className="flex justify-between">
                  <span>Precio por hamburguesa:</span>
                  <span className="font-semibold text-amber-300">
                    {formatCOP(previewUnitPrice)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Total ítem (x{previewQuantity}):</span>
                  <span className="font-semibold text-amber-300">
                    {formatCOP(previewTotal)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSaveItem}
                  className="flex-1 py-2 rounded-full bg-amber-400 text-emerald-950 text-sm font-semibold"
                >
                  {editingIndex !== null ? "Guardar cambios" : "Agregar al pedido"}
                </button>
                <button
                  onClick={closeConfig}
                  className="flex-1 py-2 rounded-full bg-emerald-900 text-emerald-50 text-sm font-semibold border border-emerald-600"
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

export default MeseroPage;
