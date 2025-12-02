import { useEffect, useState } from "react";
import { fetchProducts, createOrder } from "../api/client";

function formatCOP(value) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

const baseConfig = {
  extraBacon: false,
  lettuceOption: "normal", // normal | sin | wrap
  tomato: true,
  onion: true,
  noVeggies: false,
  includesFries: false,
  extraFriesQty: 0,
  drinkCode: "none", // none | coca | coca_zero
  notes: "",
  quantity: 1,
  baconType: "asada", // 👈 valor por defecto
};

function MeseroPage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  const [tableNumber, setTableNumber] = useState("");
  const [toGo, setToGo] = useState(false);
  const [items, setItems] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [config, setConfig] = useState(baseConfig);

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

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

  const openConfig = (product) => {
    // AHORA: usamos product.options.tocineta ("asada" / "caramelizada")
    const baconType =
      product.options?.tocineta === "caramelizada"
        ? "caramelizada"
        : "asada";

    setSelectedProduct(product);
    setConfig({
      ...baseConfig,
      baconType,
    });
  };

  const closeConfig = () => {
    setSelectedProduct(null);
    setConfig(baseConfig);
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

  const handleAddItem = () => {
    if (!selectedProduct) return;

    const unitPrice = selectedProduct.price || 0;
    const quantity = Number(config.quantity) || 1;
    const totalPrice = unitPrice * quantity;

    const burgerConfig = {
      meatType: "carne", // si después tienes doble carne lo podemos ampliar
      baconType: config.baconType, // asada / caramelizada
      extraBacon: config.extraBacon,
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

    setItems((prev) => [...prev, newItem]);
    closeConfig();
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const orderTotal = items.reduce(
    (sum, item) => sum + (item.totalPrice || 0),
    0
  );

  const handleSendOrder = async () => {
    try {
      if (items.length === 0) {
        alert("Agrega al menos un producto al pedido");
        return;
      }

      setSending(true);
      setMessage("");

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

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-emerald-800 flex justify-between items-center bg-emerald-950/80">
        <div>
          <h1 className="text-lg font-bold text-emerald-50">
            Tomar pedido 🍔
          </h1>
          <p className="text-xs text-emerald-200">
            Una mesa = un pedido, varias personas = varios items
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row">
        {/* Menú */}
        <section className="flex-1 p-4 border-r border-emerald-800/60">
          <h2 className="text-sm font-semibold text-emerald-50 mb-2">
            Menú
          </h2>

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
              {products.map((product) => (
                <button
                  key={product._id}
                  onClick={() => openConfig(product)}
                  className="bg-emerald-800/70 hover:bg-emerald-700/80 text-left rounded-xl p-3 text-emerald-50 border border-emerald-700/60"
                >
                  <div className="font-semibold text-sm">
                    {product.name}
                  </div>
                  <div className="text-[11px] text-emerald-200 uppercase">
                    {product.options?.tocineta === "caramelizada"
                      ? "TOCINETA CARAMELIZADA"
                      : "TOCINETA ASADA"}
                  </div>
                  <div className="mt-1 text-sm font-bold text-amber-200">
                    {formatCOP(product.price || 0)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Pedido actual (barra lateral) */}
        <section className="w-full md:w-80 lg:w-96 p-4 bg-emerald-950/80 border-l border-emerald-800/80">
          <h2 className="text-sm font-semibold text-emerald-50 mb-2">
            Pedido actual
          </h2>

          {/* Mesa / para llevar */}
          <div className="space-y-2 text-sm text-emerald-50">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-emerald-200">Mesa:</label>
              <input
                type="number"
                min="1"
                disabled={toGo}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="flex-1 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs text-emerald-50 outline-none"
              />
              <label className="flex items-center gap-1 text-xs text-emerald-200">
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
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-emerald-900/80 rounded-lg p-2 border border-emerald-700/70"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-xs">
                            {item.productName} x{item.quantity}
                          </div>
                          <div className="text-[11px] text-emerald-300">
                            {item.burgerConfig?.baconType === "caramelizada"
                              ? "Tocineta caramelizada"
                              : "Tocineta asada"}
                            {item.includesFries && " · Con papas"}
                            {item.drinkCode === "coca" && " · Coca-Cola"}
                            {item.drinkCode === "coca_zero" &&
                              " · Coca-Cola Zero"}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-amber-200">
                          {formatCOP(item.totalPrice || 0)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="mt-1 text-[11px] text-red-200"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total y enviar */}
            <div className="mt-3 border-t border-emerald-800/80 pt-2 text-xs">
              <div className="flex justify-between mb-2">
                <span className="text-emerald-200">Total:</span>
                <span className="font-bold text-amber-300">
                  {formatCOP(orderTotal)}
                </span>
              </div>

              <button
                onClick={handleSendOrder}
                disabled={sending || items.length === 0}
                className="w-full py-2 rounded-full bg-amber-400 text-emerald-950 text-sm font-semibold disabled:opacity-60"
              >
                {sending ? "Enviando..." : "Enviar a cocina"}
              </button>

              {message && (
                <p className="mt-1 text-[11px] text-emerald-200">
                  {message}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Panel configuración por persona */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-40">
          <div className="bg-emerald-950 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-emerald-700 p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-emerald-50">
                {selectedProduct.name}
              </h3>
              <button
                onClick={closeConfig}
                className="text-xs text-emerald-300"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-2 text-xs text-emerald-50">
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
                  className="w-16 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                />
              </div>

              {/* Tocineta */}
              <div>
                <span className="block mb-1">Tocineta:</span>
                <p className="text-[11px] text-emerald-200 mb-1">
                  {config.baconType === "caramelizada"
                    ? "Caramelizada (fijo de esta hamburguesa)"
                    : "Asada (fijo de esta hamburguesa)"}
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
              </div>

              {/* Verduras */}
              <div>
                <span className="block mb-1">Verduras:</span>
                <div className="flex flex-wrap gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleConfigChange("lettuceOption", "normal")
                    }
                    className={`px-2 py-1 rounded-full border text-[11px] ${
                      config.lettuceOption === "normal" &&
                      !config.noVeggies
                        ? "bg-emerald-300 text-emerald-950 border-emerald-400"
                        : "bg-emerald-900 text-emerald-100 border-emerald-700"
                    }`}
                  >
                    Con verduras
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleConfigChange("lettuceOption", "wrap")
                    }
                    className={`px-2 py-1 rounded-full border text-[11px] ${
                      config.lettuceOption === "wrap"
                        ? "bg-emerald-300 text-emerald-950 border-emerald-400"
                        : "bg-emerald-900 text-emerald-100 border-emerald-700"
                    }`}
                  >
                    Envolver en lechuga
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
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
                  className="w-full px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                  placeholder="Ej: partir a la mitad, muy bien asada, etc."
                />
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleAddItem}
                  className="flex-1 py-2 rounded-full bg-amber-400 text-emerald-950 text-sm font-semibold"
                >
                  Agregar al pedido
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
