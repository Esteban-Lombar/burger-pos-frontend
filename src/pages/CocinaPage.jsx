// src/pages/CocinaPage.jsx
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

function formatCOP(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

// ✅ mismos precios que Mesero (y extras papas chessbeicon)
const ADDON_PRICES = {
  extraMeat: 5000,
  extraBacon: 3000,
  extraCheese: 3000,

  fries: 3000,       // papas del combo (solo hamburguesas)
  extraFries: 5000,  // adic papas (solo hamburguesas)
  drink: 3000,       // gaseosa del combo (solo hamburguesas)
  extraDrink: 4000,  // ✅ adición gaseosa (aparte del combo)

  // ✅ papas chessbeicon veggies add-ons
  extraOnion: 2000,
  extraLettuce: 2000,
};

const COMBO_DISCOUNT = 1000;

// 🔢 Recalcular unitario desde BASE (no desde unitPrice)
// includedMeats = carnes incluidas en el basePrice
function calculateUnitPrice(basePrice, cfg, includedMeats = 1) {
  const productCode = cfg?.productCode || null;

  // ✅ PAPAS (SOLO): precio es base (ej 5000)
  if (productCode === "papas") {
    const unit = Number(basePrice) || 0;
    return unit;
  }

  // ✅ PAPAS CHESSBEICON: base 10k + extras + gaseosa del producto (+4k)
  if (productCode === "papas_chessbeicon") {
    let unit = Number(basePrice);
    if (!Number.isFinite(unit) || unit <= 0) unit = 10000;

    if (cfg.extraCheese) unit += ADDON_PRICES.extraCheese;
    if (cfg.extraBacon) unit += ADDON_PRICES.extraBacon;

    if (cfg.extraOnion) unit += ADDON_PRICES.extraOnion;
    if (cfg.extraLettuce) unit += ADDON_PRICES.extraLettuce;

    // gaseosa del producto (NO es combo) => +4000 si eligió una
    const hasDrink = cfg.drinkCode && cfg.drinkCode !== "none";
    if (hasDrink) unit += 4000;

    // adición gaseosa aparte (si la usan)
    const extraDrinkQty = Number(cfg.extraDrinkQty) || 0;
    if (extraDrinkQty > 0) unit += extraDrinkQty * ADDON_PRICES.extraDrink;

    return unit;
  }

  // ✅ HAMBURGUESAS: lógica normal de combo y extras
  let unit = Number(basePrice) || 0;

  const meatQty = Number(cfg.meatQty) || 1;
  if (meatQty > includedMeats) {
    unit += (meatQty - includedMeats) * ADDON_PRICES.extraMeat;
  }

  if (cfg.extraBacon) unit += ADDON_PRICES.extraBacon;
  if (cfg.extraCheese) unit += ADDON_PRICES.extraCheese;

  if (cfg.includesFries) unit += ADDON_PRICES.fries;

  const extraFriesQty = Number(cfg.extraFriesQty) || 0;
  if (extraFriesQty > 0) unit += extraFriesQty * ADDON_PRICES.extraFries;

  const hasDrink = cfg.drinkCode && cfg.drinkCode !== "none";
  if (hasDrink) unit += ADDON_PRICES.drink;

  const extraDrinkQty = Number(cfg.extraDrinkQty) || 0;
  if (extraDrinkQty > 0) unit += extraDrinkQty * ADDON_PRICES.extraDrink;

  // descuento combo SOLO cuando lleva papas+ bebida del combo
  if (cfg.includesFries && hasDrink) unit -= COMBO_DISCOUNT;

  return unit;
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
      setError("");
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
      // ✅ importante para saber si es papas/papas_chessbeicon
      productCode: item.productCode || null,

      // cantidad
      quantity: Number(item.quantity) || 1,

      // burger config
      meatQty: item.burgerConfig?.meatQty || 1,
      includedMeats: item.burgerConfig?.includedMeats || 1,
      baconType: item.burgerConfig?.baconType || "asada",
      extraBacon: !!item.burgerConfig?.extraBacon,
      extraCheese: !!item.burgerConfig?.extraCheese,

      // ✅ extras papas chessbeicon
      extraOnion: !!item.burgerConfig?.extraOnion,
      extraLettuce: !!item.burgerConfig?.extraLettuce,

      lettuceOption: item.burgerConfig?.lettuceOption || "normal",
      tomato: item.burgerConfig?.tomato ?? true,
      onion: item.burgerConfig?.onion ?? true,
      noVeggies: !!item.burgerConfig?.noVeggies,

      // combos
      includesFries: !!item.includesFries,
      extraFriesQty: Number(item.extraFriesQty) || 0,
      drinkCode: item.drinkCode || "none",

      // ✅ adición gaseosa aparte del combo
      extraDrinkQty: Number(item.extraDrinkQty) || 0,

      notes: item.burgerConfig?.notes || "",

      // ✅ basePrice guardado desde mesero (para recalcular sin doble cobro)
      basePrice: Number(item.basePrice) || 18000,
    });
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => {
      const updated = { ...prev, [field]: value };

      // si marca "sin verduras", apaga cosas
      if (field === "noVeggies" && value === true) {
        updated.lettuceOption = "sin";
        updated.tomato = false;
        updated.onion = false;

        updated.extraOnion = false;
        updated.extraLettuce = false;
      }

      // si apaga cebolla, apaga extra cebolla
      if (field === "onion" && value === false) {
        updated.extraOnion = false;
      }

      // si quita lechuga, apaga extra lechuga
      if (field === "lettuceOption" && value === "sin") {
        updated.extraLettuce = false;
      }

      return updated;
    });
  };

  // -----------------------------------------
  // Guardar cambios del item editado
  // -----------------------------------------
  const saveItemChanges = async () => {
    try {
      const order = editingOrder;
      const index = editingIndex;
      const newItems = [...order.items];
      const oldItem = newItems[index];

      const qty = Number(config.quantity) || 1;
      const includedMeats = Number(config.includedMeats) || 1;
      const basePrice = Number(config.basePrice) || 18000;

      // ✅ recalcular desde BASE, NO desde unitPrice
      const newUnit = calculateUnitPrice(basePrice, config, includedMeats);
      const newTotal = newUnit * qty;

      newItems[index] = {
        ...oldItem,

        quantity: qty,

        includesFries: !!config.includesFries,
        extraFriesQty: Number(config.extraFriesQty) || 0,
        drinkCode: config.drinkCode || "none",
        extraDrinkQty: Number(config.extraDrinkQty) || 0,

        basePrice,

        unitPrice: newUnit,
        totalPrice: newTotal,

        burgerConfig: {
          ...(oldItem.burgerConfig || {}),

          meatQty: Number(config.meatQty) || 1,
          includedMeats,

          baconType: config.baconType || "asada",
          extraBacon: !!config.extraBacon,
          extraCheese: !!config.extraCheese,

          extraOnion: !!config.extraOnion,
          extraLettuce: !!config.extraLettuce,

          lettuceOption: config.lettuceOption || "normal",
          tomato: !!config.tomato,
          onion: !!config.onion,
          noVeggies: !!config.noVeggies,
          notes: config.notes || "",
        },
      };

      await updateOrderData(order._id, { items: newItems });

      setEditingOrder(null);
      setEditingIndex(null);
      setConfig(null);

      await loadOrders();
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el cambio. Revisa conexión/servidor.");
    }
  };

  // Actualizar mesa / para llevar
  const editMesa = async (order) => {
    let mesa = prompt(
      "Número de mesa (deja vacío para PARA LLEVAR):",
      order.tableNumber ?? ""
    );
    if (mesa === null) return;

    try {
      await updateOrderData(order._id, {
        tableNumber: mesa === "" ? null : Number(mesa),
        toGo: mesa === "",
      });
      await loadOrders();
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar mesa/para llevar.");
    }
  };

  // ✅ changeStatus robusto
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
        {error && <div className="text-sm text-red-400 mb-3">{error}</div>}

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
                {/* Encabezado */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div
                      className={`text-sm md:text-base font-bold ${
                        order.toGo ? "text-orange-300" : "text-emerald-300"
                      }`}
                    >
                      {order.toGo ? "🛍 PARA LLEVAR" : `🍽 Mesa ${order.tableNumber}`}
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
                    <div className="text-[11px] text-slate-300">Total pedido</div>
                    <div className="text-sm md:text-base font-bold text-emerald-300">
                      {formatCOP(order.total)}
                    </div>
                  </div>
                </div>

                {/* DETALLE */}
                <div className="mt-2 text-[12px] text-slate-300 border-t border-slate-700 pt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
                  {order.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900/80 border border-slate-700 rounded-lg p-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="font-semibold text-[13px] text-slate-50">
                            {item.productName} x{item.quantity}
                          </div>

                          {/* ✅ DETALLE (FIX PARA PAPAS) */}
                          <div className="mt-1 text-[11px] text-slate-200 space-y-1 leading-4">
                            {(() => {
                              const isPapasSolo = item.productCode === "papas";
                              const isPapasChess = item.productCode === "papas_chessbeicon";

                              if (isPapasSolo) {
                                return (
                                  <>
                                    {item.burgerConfig?.notes?.trim() && (
                                      <div className="text-yellow-300 font-semibold">
                                        📝 Nota cocina: {item.burgerConfig.notes}
                                      </div>
                                    )}
                                  </>
                                );
                              }

                              if (isPapasChess) {
                                const hasDrink = item.drinkCode && item.drinkCode !== "none";
                                const hasLettuce = item.burgerConfig?.lettuceOption !== "sin";
                                const hasOnion = !!item.burgerConfig?.onion;

                                return (
                                  <>
                                    <div>
                                      <span className="font-semibold text-slate-50">Tocineta:</span>{" "}
                                      {item.burgerConfig?.baconType || "asada"}
                                      {item.burgerConfig?.extraBacon && " + adición"}
                                      <span className="mx-1">·</span>
                                      <span className="font-semibold text-slate-50">Queso extra:</span>{" "}
                                      {item.burgerConfig?.extraCheese ? "sí" : "no"}
                                    </div>

                                    <div>
                                      <span className="font-semibold text-slate-50">Verduras:</span>{" "}
                                      <span className="mx-1" />
                                      <span className="font-semibold text-slate-50">Lechuga:</span>{" "}
                                      {hasLettuce ? "sí" : "no"}
                                      <span className="mx-1">·</span>
                                      <span className="font-semibold text-slate-50">Cebolla:</span>{" "}
                                      {hasOnion ? "sí" : "no"}
                                    </div>

                                    <div>
                                      <span className="font-semibold text-slate-50">Bebida:</span>{" "}
                                      {hasDrink ? drinkLabel(item.drinkCode) : "sin bebida"}
                                      {Number(item.extraDrinkQty) > 0 && (
                                        <> · Adic. gaseosa: {item.extraDrinkQty}</>
                                      )}
                                    </div>

                                    {item.burgerConfig?.notes?.trim() && (
                                      <div className="text-yellow-300 font-semibold">
                                        📝 Nota cocina: {item.burgerConfig.notes}
                                      </div>
                                    )}
                                  </>
                                );
                              }

                              // hamburguesas normal
                              return (
                                <>
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

                                  <div>
                                    <span className="font-semibold text-slate-50">Acompañamientos:</span>{" "}
                                    {item.includesFries ? "con papas" : "solo hamburguesa"}
                                    {Number(item.extraFriesQty) > 0 && (
                                      <> · Adic. papas: {item.extraFriesQty}</>
                                    )}
                                    {Number(item.extraDrinkQty) > 0 && (
                                      <> · Adic. gaseosa: {item.extraDrinkQty}</>
                                    )}
                                    <span className="mx-1">·</span>
                                    <span className="font-semibold text-slate-50">Bebida:</span>{" "}
                                    {drinkLabel(item.drinkCode)}
                                  </div>

                                  {item.includesFries &&
                                    item.drinkCode &&
                                    item.drinkCode !== "none" && (
                                      <div className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-emerald-900/70 border border-emerald-500 text-[10px] text-emerald-100">
                                        <span>🥤🍟</span>
                                        <span>COMBO (papas + gaseosa)</span>
                                      </div>
                                    )}

                                  {item.burgerConfig?.notes?.trim() && (
                                    <div className="text-yellow-300 font-semibold">
                                      📝 Nota cocina: {item.burgerConfig.notes}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {item.totalPrice != null && (
                          <div className="text-[11px] font-bold text-emerald-300 whitespace-nowrap">
                            {formatCOP(item.totalPrice)}
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

                {/* Botones */}
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

      {/* ✅ Modal edición con TODO (como Mesero) */}
      {config && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-950 w-full max-w-md mx-4 p-4 rounded-2xl border border-slate-700 shadow-xl text-slate-50">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold">Editar ítem de cocina</h2>
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

            {/* Preview precio */}
            <div className="text-[12px] bg-slate-900 border border-slate-700 rounded-xl p-2 mb-3">
              {(() => {
                const unit = calculateUnitPrice(
                  config.basePrice,
                  config,
                  config.includedMeats
                );
                const total = unit * (Number(config.quantity) || 1);
                return (
                  <div className="flex justify-between">
                    <span className="text-slate-200">
                      Unit: <b className="text-emerald-300">{formatCOP(unit)}</b>
                    </span>
                    <span className="text-slate-200">
                      Total: <b className="text-emerald-300">{formatCOP(total)}</b>
                    </span>
                  </div>
                );
              })()}
            </div>

            {(() => {
              const isPapasSolo = config.productCode === "papas";
              const isPapasChess = config.productCode === "papas_chessbeicon";
              const isBurger = !isPapasSolo && !isPapasChess;

              return (
                <div className="space-y-3 text-xs">
                  {/* Cantidad */}
                  <label className="block">
                    <span className="text-slate-200">Cantidad:</span>
                    <input
                      type="number"
                      min="1"
                      value={config.quantity}
                      onChange={(e) => handleConfigChange("quantity", e.target.value)}
                      className="w-full mt-1 rounded bg-slate-900 border border-slate-700 p-2 outline-none"
                    />
                  </label>

                  {/* ✅ CARNES (solo hamburguesas) */}
                  {isBurger && (
                    <label className="block">
                      <span className="text-slate-200">Carnes (total):</span>
                      <input
                        type="number"
                        min="1"
                        value={config.meatQty}
                        onChange={(e) => handleConfigChange("meatQty", e.target.value)}
                        className="w-full mt-1 rounded bg-slate-900 border border-slate-700 p-2 outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Incluidas en el precio base: {config.includedMeats} (se cobra extra por encima).
                      </p>
                    </label>
                  )}

                  {/* ✅ TOCINETA (hamburguesas y papas chessbeicon) */}
                  {!isPapasSolo && (
                    <label className="block">
                      <span className="text-slate-200">Tipo de tocineta:</span>
                      <select
                        value={config.baconType}
                        onChange={(e) => handleConfigChange("baconType", e.target.value)}
                        className="w-full mt-1 rounded bg-slate-900 border border-slate-700 p-2 outline-none"
                      >
                        <option value="asada">Asada</option>
                        <option value="caramelizada">Caramelizada</option>
                      </select>
                    </label>
                  )}

                  {!isPapasSolo && (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.extraBacon}
                          onChange={(e) => handleConfigChange("extraBacon", e.target.checked)}
                        />
                        <span>Extra tocineta</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.extraCheese}
                          onChange={(e) => handleConfigChange("extraCheese", e.target.checked)}
                        />
                        <span>Extra queso</span>
                      </label>
                    </div>
                  )}

                  {/* ✅ VERDURAS */}
                  {isBurger && (
                    <div className="border border-slate-700 rounded-xl p-2 bg-slate-900">
                      <div className="text-slate-200 font-semibold mb-2">Verduras</div>

                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={config.noVeggies}
                          onChange={(e) => handleConfigChange("noVeggies", e.target.checked)}
                        />
                        <span>Sin verduras</span>
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="text-slate-300">Lechuga:</span>
                          <select
                            value={config.lettuceOption}
                            disabled={config.noVeggies}
                            onChange={(e) => handleConfigChange("lettuceOption", e.target.value)}
                            className="w-full mt-1 rounded bg-slate-950 border border-slate-700 p-2 outline-none disabled:opacity-40"
                          >
                            <option value="normal">normal</option>
                            <option value="wrap">wrap</option>
                            <option value="sin">sin</option>
                          </select>
                        </label>

                        <div className="flex flex-col justify-end gap-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={config.noVeggies}
                              checked={!!config.tomato}
                              onChange={(e) => handleConfigChange("tomato", e.target.checked)}
                            />
                            <span>Tomate</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={config.noVeggies}
                              checked={!!config.onion}
                              onChange={(e) => handleConfigChange("onion", e.target.checked)}
                            />
                            <span>Cebolla</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ✅ VERDURAS papas chessbeicon (sin tomate) */}
                  {isPapasChess && (
                    <div className="border border-slate-700 rounded-xl p-2 bg-slate-900">
                      <div className="text-slate-200 font-semibold mb-2">
                        Verduras (papas chessbeicon)
                      </div>

                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={config.lettuceOption !== "sin"}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            handleConfigChange("lettuceOption", checked ? "normal" : "sin");
                            if (!checked) handleConfigChange("extraLettuce", false);
                          }}
                        />
                        <span>Con lechuga</span>
                      </label>

                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={!!config.extraLettuce}
                          disabled={config.lettuceOption === "sin"}
                          onChange={(e) => handleConfigChange("extraLettuce", e.target.checked)}
                        />
                        <span>Adición de lechuga (+$2.000)</span>
                      </label>

                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={!!config.onion}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            handleConfigChange("onion", checked);
                            if (!checked) handleConfigChange("extraOnion", false);
                          }}
                        />
                        <span>Con cebolla</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!config.extraOnion}
                          disabled={!config.onion}
                          onChange={(e) => handleConfigChange("extraOnion", e.target.checked)}
                        />
                        <span>Adición de cebolla (+$2.000)</span>
                      </label>
                    </div>
                  )}

                  {/* ✅ PAPAS/BEBIDAS */}
                  {isBurger && (
                    <div className="border border-slate-700 rounded-xl p-2 bg-slate-900">
                      <div className="text-slate-200 font-semibold mb-2">Papas y bebidas</div>

                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={config.includesFries}
                          onChange={(e) => handleConfigChange("includesFries", e.target.checked)}
                        />
                        <span>En combo (papas incluidas)</span>
                      </label>

                      <label className="block mb-2">
                        <span className="text-slate-300">Adición de papas:</span>
                        <input
                          type="number"
                          min="0"
                          value={config.extraFriesQty}
                          onChange={(e) => handleConfigChange("extraFriesQty", e.target.value)}
                          className="w-full mt-1 rounded bg-slate-950 border border-slate-700 p-2 outline-none"
                        />
                      </label>

                      <label className="block mb-2">
                        <span className="text-slate-300">Bebida del combo:</span>
                        <select
                          value={config.drinkCode}
                          onChange={(e) => handleConfigChange("drinkCode", e.target.value)}
                          className="w-full mt-1 rounded bg-slate-950 border border-slate-700 p-2 outline-none"
                        >
                          <option value="none">Sin bebida</option>
                          <option value="coca">Coca-Cola</option>
                          <option value="coca_zero">Coca-Cola Zero</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-slate-300">Adición gaseosa (aparte):</span>
                        <input
                          type="number"
                          min="0"
                          value={config.extraDrinkQty}
                          onChange={(e) => handleConfigChange("extraDrinkQty", e.target.value)}
                          className="w-full mt-1 rounded bg-slate-950 border border-slate-700 p-2 outline-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Esta es la gaseosa extra que vale $4.000 (no es la del combo).
                        </p>
                      </label>
                    </div>
                  )}

                  {isPapasChess && (
                    <div className="border border-slate-700 rounded-xl p-2 bg-slate-900">
                      <div className="text-slate-200 font-semibold mb-2">Bebida (papas chessbeicon)</div>

                      <label className="block mb-2">
                        <span className="text-slate-300">Gaseosa:</span>
                        <select
                          value={config.drinkCode}
                          onChange={(e) => handleConfigChange("drinkCode", e.target.value)}
                          className="w-full mt-1 rounded bg-slate-950 border border-slate-700 p-2 outline-none"
                        >
                          <option value="none">Sin bebida</option>
                          <option value="coca">Coca-Cola</option>
                          <option value="coca_zero">Coca-Cola Zero</option>
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Si elige gaseosa aquí, suma +$4.000 (queda en $14.000).
                        </p>
                      </label>

                      <label className="block">
                        <span className="text-slate-300">Adición gaseosa (aparte):</span>
                        <input
                          type="number"
                          min="0"
                          value={config.extraDrinkQty}
                          onChange={(e) => handleConfigChange("extraDrinkQty", e.target.value)}
                          className="w-full mt-1 rounded bg-slate-950 border border-slate-700 p-2 outline-none"
                        />
                      </label>
                    </div>
                  )}

                  {/* Notas */}
                  <label className="block">
                    <span className="text-slate-200">Notas:</span>
                    <textarea
                      value={config.notes}
                      onChange={(e) => handleConfigChange("notes", e.target.value)}
                      className="w-full mt-1 rounded bg-slate-900 border border-slate-700 p-2 outline-none"
                      rows={3}
                    />
                  </label>
                </div>
              );
            })()}

            <div className="flex mt-4 gap-2 text-sm">
              <button
                onClick={saveItemChanges}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 py-2 rounded-full text-slate-950 font-semibold"
              >
                Guardar cambios
              </button>
              <button
                onClick={() => {
                  setConfig(null);
                  setEditingOrder(null);
                  setEditingIndex(null);
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-full font-semibold"
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
