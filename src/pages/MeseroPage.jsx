// src/pages/MeseroPage.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchProducts, createOrder } from "../api/client";

function formatCOP(value) {
  return (Number(value) || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

// 💰 precios de adiciones / combos
// Base hamburguesas:
// - sola: 20.000
// - doble carne: 25.000
// Combo completa: +2.000 papas +4.000 bebida (total +6.000)
// Dobles reciben 1.000 de descuento extra en combo (total +5.000)
const BURGER_BASE_SINGLE = 20000;
const BURGER_BASE_DOUBLE = 25000;

const DRINK_PRICE_BY_CODE = {
  coca: 4000,
  coca_zero: 4000,
  manzana: 4000,
  uva: 4000,
  agua_gas: 4000,
  agua: 3000,
};

const ADDON_PRICES = {
  extraMeat: 5000,
  extraBacon: 3000,
  extraCheese: 3000,

  extraLettuce: 2000,
  extraOnion: 2000,

  fries: 2000, // papas incluídas en combo
  drink: 4000, // fallback para bebida si no está en DRINK_PRICE_BY_CODE
  comboDiscount: 1000, // valor usado solo para doble carne

  extraFries: 5000,
  extraDrink: 4000,
};

const baseConfig = {
  quantity: 1,

  meatQty: 1,
  baconType: "asada",
  extraBacon: false,
  extraCheese: false,

  extraLettuce: false, // ✅ adición de lechuga (papas chessbeicon)
  extraOnion: false, // ✅



  lettuceOption: "normal", // normal | wrap | sin
  tomato: true,
  onion: true,
  noVeggies: false,

  includesFries: false,
  extraFriesQty: 0,

  drinkCode: "none", // none | coca | coca_zero
  extraDrinkQty: 0, // ✅ adición gaseosa (cantidad)

  notes: "",
};

function drinkLabel(code) {
  if (!code || code === "none") return "sin bebida";
  if (code === "coca") return "Coca-Cola";
  if (code === "coca_zero") return "Coca-Cola Zero";
  if (code === "manzana") return "Manzana";
  if (code === "uva") return "Uva";
  if (code === "agua_gas") return "Agua con gas";
  if (code === "agua") return "Agua normal";
  return code;
}

/**
 * Calcula precio unitario final de un item según config y producto.
 */
function calculateUnitPrice(basePrice, config, includedMeats, selectedProduct) {
  let price = Number(basePrice) || 0;

  // ✅ Caso especial: Papas chessbeicon (producto aparte)
const isChess =
  selectedProduct?.isPapasChess || selectedProduct?.code === "papas_chessbeicon";

if (isChess) {
  // 🔒 Base SIEMPRE 15.000 (papas raras)
  let price = Number(basePrice);
  if (!Number.isFinite(price) || price <= 0) price = 15000;

  if (config.extraCheese) price += ADDON_PRICES.extraCheese;
  if (config.extraBacon) price += ADDON_PRICES.extraBacon;
  if (config.extraOnion) price += ADDON_PRICES.extraOnion;
  if (config.extraLettuce) price += ADDON_PRICES.extraLettuce;

  const hasDrink = config.drinkCode && config.drinkCode !== "none";
  if (hasDrink) price += DRINK_PRICE_BY_CODE[config.drinkCode] ?? ADDON_PRICES.drink;
  return price;
}




  // ✅ Caso especial: Papas (solo) (producto aparte)
  if (selectedProduct?.code === "papas") {
    return price; // basePriceOverride ya es 5000
  }

  // 🥩 Carnes: si el cliente sube meatQty por encima de las carnes incluidas, cobra extra
  const meatQty = Number(config.meatQty) || 1;
  const included = Number(includedMeats) || 1;
  const extraMeats = Math.max(0, meatQty - included);
  if (extraMeats > 0) price += extraMeats * ADDON_PRICES.extraMeat;

  // 🧀🥓 extras
  if (config.extraBacon) price += ADDON_PRICES.extraBacon;
  if (config.extraCheese) price += ADDON_PRICES.extraCheese;

  const hasDrink = config.drinkCode && config.drinkCode !== "none";

  // SOLO PAPAS (sin bebida): +5.000
  if (config.includesFries && !hasDrink) {
    price += 5000;
  }

  // SOLO BEBIDA (sin papas): +valor bebida
  if (!config.includesFries && hasDrink) {
    price += DRINK_PRICE_BY_CODE[config.drinkCode] ?? ADDON_PRICES.drink;
  }

  // COMBO (papas + bebida): precio fijo
  if (config.includesFries && hasDrink) {
    if (included === 1) {
      price = BURGER_BASE_SINGLE + 6000; // 20k + 6k = 26k
    } else if (included === 2) {
      price = BURGER_BASE_DOUBLE + 5000; // 25k + 5k = 30k
    }
  }

  // ➕ adiciones por cantidad
  const extraFriesQty = Number(config.extraFriesQty) || 0;
  if (extraFriesQty > 0) price += extraFriesQty * ADDON_PRICES.extraFries;

  const extraDrinkQty = Number(config.extraDrinkQty) || 0;
  if (extraDrinkQty > 0) price += extraDrinkQty * ADDON_PRICES.extraDrink;

  return price;
}

export default function MeseroPage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [config, setConfig] = useState(baseConfig);
  const [editingIndex, setEditingIndex] = useState(null);

  const [items, setItems] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [toGo, setToGo] = useState(false);

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [mesaWarning, setMesaWarning] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingProducts(true);
        setError("");
        const data = await fetchProducts();
        setProducts(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError("Error cargando productos");
      } finally {
        setLoadingProducts(false);
      }
    };
    load();
  }, []);

  // Sencillas: 1 carne incluida
const singleProducts = useMemo(
  () =>
    products
      .filter((p) => p.type === "burger") // ✅ solo hamburguesas
      .map((p) => ({
        ...p,
        uiId: p._id + "-single",
        uiName: p.name,
        basePriceOverride: BURGER_BASE_SINGLE,
        includedMeats: 1,
        baseProductId: p._id,
      })),
  [products]
);


 // Dobles: 2 carnes incluidas, base = precio sencilla + 5.000
const doubleProducts = useMemo(
  () =>
    products
      .filter((p) => p.type === "burger") // ✅ solo hamburguesas
      .map((p) => ({
        ...p,
        uiId: p._id + "-double",
        uiName: `${p.name} (doble carne)`,
        basePriceOverride: BURGER_BASE_DOUBLE,
        includedMeats: 2,
        baseProductId: p._id,
      })),
  [products]
);


  // ✅ NUEVOS: Papas y Papas chessbeicon (deben existir en BD por code)
  const papasProduct = useMemo(
    () => products.find((p) => p.code === "papas"),
    [products]
  );
  const papasChessProduct = useMemo(
    () => products.find((p) => p.code === "papas_chessbeicon"),
    [products]
  );

  const sides = useMemo(
    () =>
      [
        papasProduct
          ? {
              ...papasProduct,
              uiId: papasProduct._id + "-side",
              uiName: "Papas (solo)",
              basePriceOverride: 5000,
              includedMeats: 0,
              baseProductId: papasProduct._id,
            }
          : null,
        papasChessProduct
          ? {
              ...papasChessProduct,
              uiId: papasChessProduct._id + "-side",
              uiName: "Papas chessbeicon",
              basePriceOverride: 15000,
              includedMeats: 0,
              baseProductId: papasChessProduct._id,
              isPapasChess: true,
            }
          : null,
      ].filter(Boolean),
    [papasProduct, papasChessProduct]
  );

  // Abrir configurador para NUEVO item
  const openConfigForNew = (product, options = {}) => {
    const baconType =
      product.options?.tocineta === "caramelizada" ? "caramelizada" : "asada";

    const initialMeatQty =
      typeof options.initialMeatQty === "number"
        ? options.initialMeatQty
        : product.includedMeats || 1;

    setSelectedProduct({
      ...product,
      basePriceOverride:
        options.basePriceOverride ?? product.basePriceOverride ?? product.price,
      baseProductId: product.baseProductId || product._id,
      includedMeats:
  typeof product.includedMeats === "number" ? product.includedMeats : 1,

    });

    setConfig({
      ...baseConfig,
      baconType,
      meatQty: initialMeatQty,
    });

    setEditingIndex(null);
  };

  // Abrir configurador para EDITAR item existente
const openConfigForEdit = (index) => {
  const item = items[index];
  if (!item) return;

  const product = products.find((p) => p._id === item.product);
  if (!product) return;

  // ✅ detectar si es papas chessbeicon
  const isPapasChess =
    product?.isPapasChess || product?.code === "papas_chessbeicon";

  setSelectedProduct({
    ...product,
    basePriceOverride:
      typeof item.basePrice === "number"
        ? item.basePrice
        : product.basePriceOverride ?? product.price,
    baseProductId: product.baseProductId || product._id,
    includedMeats:
      typeof product.includedMeats === "number" ? product.includedMeats : 1,
    isPapasChess,
  });

  setConfig({
    quantity: item.quantity || 1,

    meatQty: item.burgerConfig?.meatQty || 0,
    baconType: item.burgerConfig?.baconType || "asada",
    extraBacon: item.burgerConfig?.extraBacon || false,
    extraCheese: item.burgerConfig?.extraCheese || false,

    // ✅ verduras papas chessbeicon
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

    extraLettuce: item.burgerConfig?.extraLettuce || false,
    extraOnion: item.burgerConfig?.extraOnion || false,

    includesFries: item.includesFries || false,
    extraFriesQty: item.extraFriesQty || 0,

    drinkCode: item.drinkCode || "none",
    extraDrinkQty: item.extraDrinkQty || 0,

    notes: item.burgerConfig?.notes || "",
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

  const basePrice =
    typeof selectedProduct.basePriceOverride === "number"
      ? selectedProduct.basePriceOverride
      : selectedProduct.price || 0;

  const includedMeats = selectedProduct.includedMeats || 1;

  const unitPrice = calculateUnitPrice(
    basePrice,
    config,
    includedMeats,
    selectedProduct
  );
  const totalPrice = unitPrice * quantity;

  // ✅ C2: detectar si es acompañamiento (papas)
  const isSide =
    selectedProduct?.isPapasChess || selectedProduct?.code === "papas";

  const burgerConfig = {
    meatType: "carne",
    // ✅ si es papas, la carne queda en 0 (no 1)
    meatQty: isSide ? 0 : (Number(config.meatQty) || 1),
    baconType: config.baconType,
    extraBacon: config.extraBacon,
    extraCheese: config.extraCheese,
    lettuceOption: config.lettuceOption,
    tomato: config.tomato,
    onion: config.onion,
    noVeggies: config.noVeggies,
    notes: config.notes,
    includedMeats,
  };


    const newItem = {
      product: selectedProduct.baseProductId || selectedProduct._id, // id real para Mongo
      productName: selectedProduct.uiName || selectedProduct.name,
      productCode: selectedProduct.code || null,
      quantity,

      includesFries: config.includesFries,
      extraFriesQty: Number(config.extraFriesQty) || 0,

      drinkCode: config.drinkCode,
      extraDrinkQty: Number(config.extraDrinkQty) || 0, // ✅ adición gaseosa

      burgerConfig,

      unitPrice,
      totalPrice,
      basePrice,
    };

    if (editingIndex !== null) {
      setItems((prev) => prev.map((it, idx) => (idx === editingIndex ? newItem : it)));
    } else {
      setItems((prev) => [...prev, newItem]);
    }

    closeConfig();
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const orderTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const totalItems = items.reduce((sum, it) => sum + (it.quantity || 0), 0);

  const mesaValida = toGo || (!!tableNumber && Number(tableNumber) > 0);
  const canSend = items.length > 0 && mesaValida;

  const handleSendOrder = async () => {
    try {
      if (items.length === 0) {
        alert("Agrega al menos un producto al pedido");
        return;
      }

      if (!mesaValida) {
        setMesaWarning("Selecciona un número de mesa o marca la opción PARA LLEVAR.");
        return;
      }

      setSending(true);
      setMessage("");
      setMesaWarning("");

      const cleanItems = items.map((it) => ({
        ...it,
        quantity: Number(it.quantity) || 1,
        extraFriesQty: Number(it.extraFriesQty) || 0,
        extraDrinkQty: Number(it.extraDrinkQty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        totalPrice: Number(it.totalPrice) || 0,
      }));

      const payload = {
        tableNumber: toGo ? null : Number(tableNumber) || null,
        toGo,
        items: cleanItems,
      };

      await createOrder(payload);

      setItems([]);
      setTableNumber("");
      setToGo(false);
      setMessage("✅ Pedido enviado a cocina");
    } catch (err) {
      console.error("❌ Error enviando pedido:", err);
      alert("Error enviando pedido a cocina");
    } finally {
      setSending(false);
    }
  };

  // 🧮 Resumen en vivo del ítem que se está configurando
  const previewUnitPrice =
    selectedProduct != null
      ? calculateUnitPrice(
          typeof selectedProduct.basePriceOverride === "number"
            ? selectedProduct.basePriceOverride
            : selectedProduct.price || 0,
          config,
          selectedProduct.includedMeats || 1,
          selectedProduct
        )
      : 0;

  const previewQuantity = Number(config.quantity) || 1;
  const previewTotal = previewUnitPrice * previewQuantity;

  // estados para botones rápidos SOLO PAPAS / SOLO GASEOSA
  const isSoloPapas =
    config.includesFries &&
    (Number(config.extraFriesQty) || 0) === 0 &&
    (!config.drinkCode || config.drinkCode === "none");

  const isSoloGaseosa =
    !config.includesFries &&
    (Number(config.extraFriesQty) || 0) === 0 &&
    config.drinkCode &&
    config.drinkCode !== "none";

  return (
    <div className="min-h-screen bg-emerald-950 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-emerald-800 bg-emerald-950/95 backdrop-blur flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-emerald-50">Mesero – Tomar pedido 🍔</h1>
          <p className="text-[11px] text-emerald-200">
            Paso 1: elige hamburguesa · Paso 2: configura · Paso 3: confirma y envía
          </p>
        </div>

        {/* Resumen rápido del pedido */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="px-3 py-1 rounded-full bg-emerald-900 border border-emerald-600 text-emerald-100">
            {toGo ? "🛍 Para llevar" : tableNumber ? `🍽 Mesa ${tableNumber}` : "🍽 Mesa sin asignar"}
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-900 border border-emerald-600 text-emerald-100">
            🧾 Ítems:{" "}
            <span className="font-semibold text-emerald-300">
              {items.length} ({totalItems} hamburguesa(s))
            </span>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-900 border border-emerald-600 text-emerald-100">
            💵 Total:{" "}
            <span className="font-semibold text-amber-300">{formatCOP(orderTotal)}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row">
        {/* Menú */}
        <section className="flex-1 p-4 border-r border-emerald-900/70">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-semibold text-emerald-50">Paso 1 – Menú de hamburguesas</h2>
              <p className="text-[11px] text-emerald-200">Toca una hamburguesa para configurarla.</p>
            </div>
          </div>

          {loadingProducts ? (
            <p className="text-emerald-100 text-sm">Cargando menú...</p>
          ) : error ? (
            <p className="text-red-100 text-sm">{error}</p>
          ) : products.length === 0 ? (
            <p className="text-emerald-100 text-sm">Aún no hay productos cargados.</p>
          ) : (
            <div className="space-y-4">
              {/* BLOQUE: Sencillas */}
              <div>
                <h3 className="text-xs font-semibold text-emerald-300 mb-1 uppercase tracking-wide">
                  Hamburguesas sencillas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {singleProducts.map((product) => {
                    const isSelected =
                      selectedProduct &&
                      selectedProduct.baseProductId === product.baseProductId &&
                      selectedProduct.includedMeats === 1;

                    return (
                      <button
                        key={product.uiId}
                        onClick={() => openConfigForNew(product)}
                        className={`text-left rounded-2xl p-3 border transition shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                          isSelected
                            ? "bg-emerald-300 text-emerald-950 border-emerald-100 shadow-lg"
                            : "bg-emerald-900/80 hover:bg-emerald-800 text-emerald-50 border-emerald-700/60"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="font-semibold text-sm">{product.uiName}</div>
                            <div className="text-[11px] mt-0.5 uppercase text-emerald-200">
                              Hamburguesa sencilla ·{" "}
                              {product.options?.tocineta === "caramelizada"
                                ? "TOCINETA CARAMELIZADA"
                                : "TOCINETA ASADA"}
                            </div>
                          </div>
                          <span className="text-[11px] px-2 py-[2px] rounded-full bg-emerald-950/80 border border-emerald-600">
                            Base {formatCOP(product.basePriceOverride || 0)}
                          </span>
                        </div>
                        <div className="mt-2 text-[10px] opacity-80">Toca para armar combo o agregar extras</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BLOQUE: Dobles */}
              <div>
                <h3 className="text-xs font-semibold text-emerald-300 mb-1 uppercase tracking-wide">
                  Hamburguesas doble carne
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {doubleProducts.map((product) => {
                    const isSelected =
                      selectedProduct &&
                      selectedProduct.baseProductId === product.baseProductId &&
                      selectedProduct.includedMeats === 2;

                    const basePrice = product.basePriceOverride || 0;

                    return (
                      <button
                        key={product.uiId}
                        onClick={() =>
                          openConfigForNew(product, {
                            basePriceOverride: basePrice,
                            initialMeatQty: 2,
                          })
                        }
                        className={`text-left rounded-2xl p-3 border transition shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                          isSelected
                            ? "bg-emerald-300 text-emerald-950 border-emerald-100 shadow-lg"
                            : "bg-emerald-900/80 hover:bg-emerald-800 text-emerald-50 border-emerald-700/60"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="font-semibold text-sm">{product.uiName}</div>
                            <div className="text-[11px] mt-0.5 uppercase text-emerald-200">
                              Doble carne ·{" "}
                              {product.options?.tocineta === "caramelizada"
                                ? "TOCINETA CARAMELIZADA"
                                : "TOCINETA ASADA"}
                            </div>
                          </div>
                          <span className="text-[11px] px-2 py-[2px] rounded-full bg-emerald-950/80 border border-emerald-600">
                            Base {formatCOP(basePrice)}
                          </span>
                        </div>
                        <div className="mt-2 text-[10px] opacity-80">Toca para armar combo o agregar extras</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BLOQUE: Acompañamientos */}
{sides.length > 0 && (
  <div className="mt-4">
    <h3 className="text-xs font-semibold text-emerald-300 mb-1 uppercase tracking-wide">
      Acompañamientos
    </h3>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sides.map((product) => {
        const basePrice = product.basePriceOverride || 0;

        return (
          <button
            key={product.uiId}
            onClick={() => {
              // 🟨 Papas (solo)
              if (product.uiName === "Papas (solo)") {
                openConfigForNew(product, {
                  basePriceOverride: 5000,
                  initialMeatQty: 0,
                });

                // ✅ Papas solas: no llevan nada de burger ni verduras
                setConfig((prev) => ({
                  ...prev,

                  quantity: 1,

                  meatQty: 0,
                  baconType: "asada",
                  extraBacon: false,
                  extraCheese: false,

                  // verduras apagadas
                  noVeggies: true,
                  lettuceOption: "sin",
                  tomato: false,
                  onion: false,

                  // combos/bebidas apagados
                  includesFries: false,
                  extraFriesQty: 0,
                  drinkCode: "none",
                  extraDrinkQty: 0,

                  // extras de chess apagados
                  extraLettuce: false,
                  extraOnion: false,

                  notes: "",
                }));

                return;
              }

              // 🟨 Papas chessbeicon
              openConfigForNew(product, {
                basePriceOverride: 15000,
                initialMeatQty: 0,
              });

              // ✅ Chessbeicon: tomate SIEMPRE false, verduras apagadas por defecto
              setConfig((prev) => ({
                ...prev,

                quantity: 1,

                meatQty: 0,

                // tomate nunca aplica en chessbeicon
                tomato: false,

                // verduras por defecto apagadas
                noVeggies: false,
                lettuceOption: "sin",
                onion: false,

                extraLettuce: false,
                extraOnion: false,

                // combos/bebidas de hamburguesa apagados
                includesFries: false,
                extraFriesQty: 0,
                extraDrinkQty: 0,

                // bebida del producto (la controlas con drinkCode)
                drinkCode: "none",

                notes: "",
              }));
            }}
            className="text-left rounded-2xl p-3 border transition shadow-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-300
                       bg-emerald-900/80 hover:bg-emerald-800
                       text-emerald-50 border-emerald-700/60"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-semibold text-sm">{product.uiName}</div>
                <div className="text-[11px] mt-0.5 uppercase text-emerald-200">
                  Acompañamiento
                </div>
              </div>

              <span className="text-[11px] px-2 py-[2px] rounded-full bg-emerald-950/80 border border-emerald-600">
                Base {formatCOP(basePrice)}
              </span>
            </div>

            <div className="mt-2 text-[10px] opacity-80">Toca para configurar</div>
          </button>
        );
      })}
    </div>
  </div>
)}

            </div>
          )}
        </section>

        {/* Pedido actual (barra lateral) */}
        <section className="w-full md:w-80 lg:w-96 p-4 bg-emerald-950 border-l border-emerald-900/80">
          <h2 className="text-sm font-semibold text-emerald-50 mb-1">Paso 3 – Pedido actual</h2>
          <p className="text-[11px] text-emerald-200 mb-2">Revisa con el cliente y envía a cocina.</p>

          <div className="space-y-3 text-sm text-emerald-50">
            {/* Mesa / para llevar */}
            <div className="bg-emerald-900/90 border border-emerald-700 rounded-2xl px-3 py-3 space-y-2">
              <p className="text-[11px] text-emerald-200 mb-1 font-semibold">
                Selecciona mesa o marca para llevar:
              </p>
              <div className="flex items-center justify-between gap-2">
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
                  <input checked={toGo} onChange={(e) => setToGo(e.target.checked)} type="checkbox" />
                  Para llevar
                </label>
              </div>
            </div>

            {/* Items */}
            <div className="bg-emerald-900/90 border border-emerald-700 rounded-2xl px-3 py-3">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-semibold text-emerald-100">Ítems del pedido ({items.length})</p>
                <span className="text-[11px] text-emerald-300">{totalItems} hamburguesa(s)</span>
              </div>

              <div className="mt-1 border-t border-emerald-800/80 pt-2">
                {items.length === 0 ? (
                  <p className="text-xs text-emerald-200">Aún no has agregado productos.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="bg-emerald-950/90 rounded-xl p-2 border border-emerald-700/80"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className="font-semibold text-xs">
                              {item.productName} x{item.quantity}
                            </div>

                            {/* Resumen detallado */}
                            {/* Resumen detallado */}
<div className="mt-1 text-[11px] text-emerald-200 space-y-1 leading-4">
  {item.productCode === "papas" ? (
    <>
      {/* ✅ Papas (solo): NO mostrar carne/tocineta/queso/verduras/acompañamientos */}
      <div>
        <span className="font-semibold text-emerald-100">Producto:</span> Papas (solo)
      </div>

      {item.burgerConfig?.notes && item.burgerConfig.notes.trim() !== "" && (
        <div className="text-amber-200">
          📝 <span className="font-semibold">Nota:</span> {item.burgerConfig.notes}
        </div>
      )}
    </>
  ) : item.productCode === "papas_chessbeicon" ? (
    <>
      {/* ✅ Papas chessbeicon: mostrar SOLO lo que aplica */}
      <div>
        <span className="font-semibold text-emerald-100">Tocineta:</span>{" "}
        {item.burgerConfig?.baconType || "asada"}
        {item.burgerConfig?.extraBacon && " + adición"}
        <span className="mx-1">·</span>
        <span className="font-semibold text-emerald-100">Queso extra:</span>{" "}
        {item.burgerConfig?.extraCheese ? "sí" : "no"}
      </div>

      <div>
        <span className="font-semibold text-emerald-100">Lechuga:</span>{" "}
        {item.burgerConfig?.lettuceOption === "sin" ? "no" : "sí"}
        {item.burgerConfig?.extraLettuce && " + adición"}
        <span className="mx-1">·</span>
        <span className="font-semibold text-emerald-100">Cebolla:</span>{" "}
        {item.burgerConfig?.onion ? "sí" : "no"}
        {item.burgerConfig?.extraOnion && " + adición"}
      </div>

      <div>
        <span className="font-semibold text-emerald-100">Bebida:</span>{" "}
        {drinkLabel(item.drinkCode)}
      </div>

      {item.burgerConfig?.notes && item.burgerConfig.notes.trim() !== "" && (
        <div className="text-amber-200">
          📝 <span className="font-semibold">Nota:</span> {item.burgerConfig.notes}
        </div>
      )}
    </>
  ) : (
    <>
      {/* ✅ Hamburguesas: tu resumen original */}
      <div>
        <span className="font-semibold text-emerald-100">Carne:</span>{" "}
        {item.burgerConfig?.meatQty || 1}x{" "}
        <span className="mx-1">·</span>
        <span className="font-semibold text-emerald-100">Tocineta:</span>{" "}
        {item.burgerConfig?.baconType || "asada"}
        {item.burgerConfig?.extraBacon && " + adición"}
        <span className="mx-1">·</span>
        <span className="font-semibold text-emerald-100">Queso extra:</span>{" "}
        {item.burgerConfig?.extraCheese ? "sí" : "no"}
      </div>

      <div>
        <span className="font-semibold text-emerald-100">Verduras:</span>{" "}
        {item.burgerConfig?.noVeggies ? "sin" : "con"}
        <span className="mx-1">·</span>
        <span className="font-semibold text-emerald-100">Lechuga:</span>{" "}
        {item.burgerConfig?.lettuceOption === "wrap"
          ? "wrap"
          : item.burgerConfig?.lettuceOption === "sin"
          ? "no"
          : "sí"}
        <span className="mx-1">·</span>
        <span className="font-semibold text-emerald-100">Tomate:</span>{" "}
        {item.burgerConfig?.tomato ? "sí" : "no"}
        <span className="mx-1">·</span>
        <span className="font-semibold text-emerald-100">Cebolla:</span>{" "}
        {item.burgerConfig?.onion ? "sí" : "no"}
      </div>

      <div>
        <span className="font-semibold text-emerald-100">Acompañamientos:</span>{" "}
        {item.includesFries ? "con papas" : "solo hamburguesa"}

        {typeof item.extraFriesQty === "number" && item.extraFriesQty > 0 && (
          <> · Adic. papas: {item.extraFriesQty}</>
        )}

        {typeof item.extraDrinkQty === "number" && item.extraDrinkQty > 0 && (
          <> · Adic. bebida: {item.extraDrinkQty}</>
        )}

        <span className="mx-1">·</span>
        <span className="font-semibold text-emerald-100">Bebida:</span>{" "}
        {drinkLabel(item.drinkCode)}
      </div>

      {item.includesFries && item.drinkCode && item.drinkCode !== "none" && (
        <div className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-emerald-800/80 border border-emerald-500 text-[10px] text-emerald-100">
          <span>🥤🍟</span>
          <span>En combo (papas + gaseosa)</span>
        </div>
      )}

      {item.burgerConfig?.notes && item.burgerConfig.notes.trim() !== "" && (
        <div className="text-amber-200">
          📝 <span className="font-semibold">Nota:</span> {item.burgerConfig.notes}
        </div>
      )}
    </>
  )}
</div>

                          </div>

                          <div className="text-xs font-bold text-amber-200 whitespace-nowrap">
                            {formatCOP(item.totalPrice || 0)}
                          </div>
                        </div>

                        <div className="mt-1 flex gap-3 text-[11px]">
                          <button onClick={() => openConfigForEdit(index)} className="text-emerald-200 underline">
                            Editar
                          </button>
                          <button onClick={() => handleRemoveItem(index)} className="text-red-200 underline">
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Total y enviar */}
            <div className="bg-emerald-900/90 border border-emerald-700 rounded-2xl px-3 py-3 text-xs">
              <div className="flex justify-between mb-2">
                <span className="text-emerald-200 font-semibold">Total pedido:</span>
                <span className="font-bold text-amber-300 text-sm">{formatCOP(orderTotal)}</span>
              </div>

              <button
                onClick={handleSendOrder}
                disabled={sending || !canSend}
                className="w-full py-2 rounded-full bg-amber-400 text-emerald-950 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? "Enviando..." : "Enviar a cocina"}
              </button>

              {mesaWarning && <p className="mt-1 text-[11px] text-red-200">{mesaWarning}</p>}
              {message && <p className="mt-1 text-[11px] text-emerald-200">{message}</p>}
            </div>
          </div>
        </section>
      </main>

      {/* Panel configuración por persona */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-40">
          <div className="bg-emerald-950 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-emerald-700 p-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-sm font-semibold text-emerald-50">
                  Paso 2 – Configurar {selectedProduct.uiName || selectedProduct.name}
                </h3>
                <p className="text-[11px] text-emerald-200">
                  Ajusta carnes, verduras, papas, gaseosa y notas.
                </p>
              </div>
              <button onClick={closeConfig} className="text-xs text-emerald-300 hover:text-emerald-100">
                Cerrar ✕
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
                  onChange={(e) => handleConfigChange("quantity", e.target.value)}
                  className="w-20 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                />
              </div>

              {/* Número de carnes */}
              {!selectedProduct?.isPapasChess && selectedProduct?.code !== "papas" && (
                <div className="flex items-center justify-between gap-2">
                  <span>Número de carnes:</span>
                  <input
                    type="number"
                    min="1"
                    value={config.meatQty}
                    onChange={(e) => handleConfigChange("meatQty", e.target.value)}
                    className="w-20 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                  />
                </div>
              )}

              {/* ✅ Config especial papas chessbeicon */}
              {selectedProduct?.isPapasChess && (
                <div className="border border-emerald-800 rounded-xl p-2 bg-emerald-900/60">
                  <span className="block mb-1 font-semibold text-[11px]">Papas chessbeicon (opciones)</span>

                  <label className="block mb-2">
                    <span className="text-[11px] text-emerald-200">Tipo de tocineta:</span>
                    <select
                      value={config.baconType}
                      onChange={(e) => handleConfigChange("baconType", e.target.value)}
                      className="w-full mt-1 rounded bg-emerald-900 border border-emerald-700 p-1 outline-none"
                    >
                      <option value="asada">Asada</option>
                      <option value="caramelizada">Caramelizada</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={config.extraCheese}
                      onChange={(e) => handleConfigChange("extraCheese", e.target.checked)}
                    />
                    Con adición de queso (+$3.000)
                  </label>

                  <label className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={config.extraBacon}
                      onChange={(e) => handleConfigChange("extraBacon", e.target.checked)}
                    />
                    Con adición de tocineta (+$3.000)
                  </label>

                  {/* gaseosa del producto */}
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={config.drinkCode !== "none"}
                      onChange={(e) => handleConfigChange("drinkCode", e.target.checked ? "coca" : "none")}
                    />
                    ¿La desea con bebida? (+$4.000 para gaseosas/agua con gas, +$3.000 para agua normal)
                  </label>

                  {config.drinkCode !== "none" && (
                    <div className="mt-2">
                      <span className="block mb-1 text-[11px] text-emerald-200">Tipo de bebida:</span>
                      <select
                        value={config.drinkCode}
                        onChange={(e) => handleConfigChange("drinkCode", e.target.value)}
                        className="w-full px-2 py-1 rounded bg-emerald-900 border border-emerald-700 outline-none"
                      >
                        <option value="coca">Coca-Cola</option>
                        <option value="coca_zero">Coca-Cola Zero</option>
                        <option value="manzana">Manzana</option>
                        <option value="uva">Uva</option>
                        <option value="agua_gas">Agua con gas</option>
                        <option value="agua">Agua normal</option>
                      </select>
                    </div>
                  )}
                  {/* ✅ Verduras para Papas chessbeicon */}
<div className="mt-2 border-t border-emerald-800 pt-2">
  <span className="block mb-1 font-semibold text-[11px]">
    Verduras (papas chessbeicon)
  </span>

  <label className="flex items-center gap-2 mb-1">
    <input
      type="checkbox"
      checked={config.lettuceOption !== "sin"}
      onChange={(e) => {
  const checked = e.target.checked;
  handleConfigChange("lettuceOption", checked ? "normal" : "sin");
  if (!checked) handleConfigChange("extraLettuce", false); // ✅ evita cobrar sin lechuga
}}

    />
    Con lechuga
  </label>

  <label className="flex items-center gap-2 mb-1">
    <input
      type="checkbox"
      checked={!!config.extraLettuce}
      onChange={(e) =>
        handleConfigChange("extraLettuce", e.target.checked)
      }
      disabled={config.lettuceOption === "sin"}
    />
    Adición de lechuga (+$2.000)
  </label>

  <label className="flex items-center gap-2 mb-1">
    <input
      type="checkbox"
      checked={!!config.onion}
      onChange={(e) => {
  const checked = e.target.checked;
  handleConfigChange("onion", checked);
  if (!checked) handleConfigChange("extraOnion", false); // ✅ evita cobrar sin cebolla
}}
    />
    Con cebolla
  </label>

  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={!!config.extraOnion}
      onChange={(e) => handleConfigChange("extraOnion", e.target.checked)}
      disabled={!config.onion}
    />
    Adición de cebolla (+$2.000)
  </label>
</div>

                </div>
              )}

              {/* Tocineta y queso (solo hamburguesas) */}
              {!selectedProduct?.isPapasChess && selectedProduct?.code !== "papas" && (
                <div className="border border-emerald-800 rounded-xl p-2 bg-emerald-900/60">
                  <span className="block mb-1 font-semibold text-[11px]">Tocineta y queso</span>
                  <p className="text-[11px] text-emerald-200 mb-1">Tipo de tocineta actual: {config.baconType}</p>

                  <label className="flex items-center gap-1 mt-1">
                    <input
                      type="checkbox"
                      checked={config.extraBacon}
                      onChange={(e) => handleConfigChange("extraBacon", e.target.checked)}
                    />
                    Adición de tocineta (+$3.000)
                  </label>

                  <label className="flex items-center gap-1 mt-1">
                    <input
                      type="checkbox"
                      checked={config.extraCheese}
                      onChange={(e) => handleConfigChange("extraCheese", e.target.checked)}
                    />
                    Adición de queso (+$3.000)
                  </label>
                </div>
              )}

              {/* Verduras (solo hamburguesas) */}
              {!selectedProduct?.isPapasChess && selectedProduct?.code !== "papas" && (
                <div className="border border-emerald-800 rounded-xl p-2 bg-emerald-900/60">
                  <span className="block mb-1 font-semibold text-[11px]">Verduras</span>

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

                  <div className="flex flex-wrap gap-3 mt-1">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!config.noVeggies && config.lettuceOption !== "sin"}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked) handleConfigChange("lettuceOption", "sin");
                          else {
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
                        onChange={(e) => handleConfigChange("tomato", e.target.checked)}
                      />
                      Con tomate
                    </label>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={config.onion}
                        onChange={(e) => handleConfigChange("onion", e.target.checked)}
                      />
                      Con cebolla
                    </label>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={config.noVeggies}
                        onChange={(e) => handleConfigChange("noVeggies", e.target.checked)}
                      />
                      Sin verduras
                    </label>
                  </div>
                </div>
              )}

              {/* Papas y gaseosa (solo hamburguesas) */}
              {!selectedProduct?.isPapasChess && selectedProduct?.code !== "papas" && (
                <div className="border border-emerald-800 rounded-xl p-2 bg-emerald-900/60">
                  <span className="block mb-1 font-semibold text-[11px]">Papas y gaseosa</span>

                  {/* ✅ Adición gaseosa por cantidad */}
                  <div className="flex items-center gap-2 mb-2">
                    <span>Adición de gaseosa:</span>
                    <input
                      type="number"
                      min="0"
                      value={config.extraDrinkQty || 0}
                      onChange={(e) => handleConfigChange("extraDrinkQty", Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                    />
                    <span className="text-[10px] text-emerald-300">x$4.000 c/u</span>
                  </div>

                  {/* Botones rápidos */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          includesFries: true,
                          extraFriesQty: 0,
                          drinkCode: "none",
                          extraDrinkQty: 0,
                        }))
                      }
                      className={`px-2 py-1 rounded-full border text-[11px] ${
                        isSoloPapas
                          ? "bg-emerald-300 text-emerald-950 border-emerald-400"
                          : "bg-emerald-900 text-emerald-100 border-emerald-700"
                      }`}
                    >
                      Solo papas
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          includesFries: false,
                          extraFriesQty: 0,
                          drinkCode: prev.drinkCode === "none" ? "coca" : prev.drinkCode,
                          extraDrinkQty: 0,
                        }))
                      }
                      className={`px-2 py-1 rounded-full border text-[11px] ${
                        isSoloGaseosa
                          ? "bg-emerald-300 text-emerald-950 border-emerald-400"
                          : "bg-emerald-900 text-emerald-100 border-emerald-700"
                      }`}
                    >
                      Solo gaseosa
                    </button>
                  </div>

                  <label className="flex items-center gap-1 mb-1">
                    <input
                      type="checkbox"
                      checked={config.includesFries}
                      onChange={(e) => handleConfigChange("includesFries", e.target.checked)}
                    />
                    En combo (papas incluidas)
                  </label>

                  <div className="flex items-center gap-2 mb-2">
                    <span>Adición de papas:</span>
                    <input
                      type="number"
                      min="0"
                      value={config.extraFriesQty}
                      onChange={(e) => handleConfigChange("extraFriesQty", e.target.value)}
                      className="w-16 px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                    />
                    <span className="text-[10px] text-emerald-300">x$5.000 c/u</span>
                  </div>

                  <div>
                    <span className="block mb-1">Bebida:</span>
                    <select
                      value={config.drinkCode}
                      onChange={(e) => handleConfigChange("drinkCode", e.target.value)}
                      className="w-full px-2 py-1 rounded bg-emerald-900 border border-emerald-700 outline-none"
                    >
                      <option value="none">Sin bebida</option>
                      <option value="coca">Coca-Cola (+$4.000)</option>
                      <option value="coca_zero">Coca-Cola Zero (+$4.000)</option>
                      <option value="manzana">Manzana (+$4.000)</option>
                      <option value="uva">Uva (+$4.000)</option>
                      <option value="agua_gas">Agua con gas (+$4.000)</option>
                      <option value="agua">Agua normal (+$3.000)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Notas */}
              <div className="border border-emerald-800 rounded-xl p-2 bg-emerald-900/60">
                <span className="block mb-1 font-semibold text-[11px]">Notas para cocina</span>
                <textarea
                  rows={2}
                  value={config.notes}
                  onChange={(e) => handleConfigChange("notes", e.target.value)}
                  className="w-full px-2 py-1 rounded bg-emerald-900 border border-emerald-700 text-xs outline-none"
                  placeholder="Ej: partir a la mitad, muy bien asada, etc."
                />
              </div>

              {/* Resumen en vivo */}
              <div className="mt-2 border-t border-emerald-700 pt-2 text-xs text-emerald-100">
                <div className="flex justify-between">
                  <span>Precio por unidad:</span>
                  <span className="font-semibold text-amber-300">{formatCOP(previewUnitPrice)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Total ítem (x{previewQuantity}):</span>
                  <span className="font-semibold text-amber-300">{formatCOP(previewTotal)}</span>
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
