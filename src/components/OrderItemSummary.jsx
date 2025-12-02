export default function OrderItemSummary({ item }) {
  const {
    productName,
    productCode,
    quantity,
    unitPrice,
    totalPrice,
    burgerConfig,
    includesFries,
    extraFriesQty,
    drinkCode,
  } = item;

  return (
    <div className="border border-slate-200 rounded-lg p-3 mb-2 bg-white shadow-sm">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="font-semibold text-sm">
            {productName}{' '}
            <span className="text-xs text-slate-500">x{quantity}</span>
          </p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            {productCode}
          </p>
        </div>
        <div className="text-right">
          {unitPrice > 0 && (
            <p className="text-xs text-slate-500">
              ${unitPrice.toLocaleString('es-CO')} c/u
            </p>
          )}
          <p className="text-sm font-semibold text-emerald-600">
            ${totalPrice.toLocaleString('es-CO')}
          </p>
        </div>
      </div>

      {burgerConfig && (
        <div className="mt-2 text-xs text-slate-600 space-y-1">
          <p>
            <span className="font-medium">Carne:</span> {burgerConfig.meatType} ·{' '}
            <span className="font-medium">Tocineta:</span> {burgerConfig.baconType}{' '}
            {burgerConfig.extraBacon && (
              <span className="text-amber-600 font-medium">(+ extra)</span>
            )}
          </p>
          <p>
            <span className="font-medium">Lechuga:</span>{' '}
            {burgerConfig.lettuceOption} ·{' '}
            <span className="font-medium">Tomate:</span>{' '}
            {burgerConfig.tomato ? 'con' : 'sin'} ·{' '}
            <span className="font-medium">Cebolla:</span>{' '}
            {burgerConfig.onion ? 'con' : 'sin'}
          </p>
          {burgerConfig.noVeggies && (
            <p className="text-red-500 font-medium">Sin verduras</p>
          )}
          {burgerConfig.notes && (
            <p className="italic text-slate-500">Nota: {burgerConfig.notes}</p>
          )}
        </div>
      )}

      <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-2">
        {includesFries && (
          <span className="px-2 py-0.5 bg-slate-100 rounded-full">
            Incluye papas
          </span>
        )}
        {extraFriesQty > 0 && (
          <span className="px-2 py-0.5 bg-slate-100 rounded-full">
            Adición papas x{extraFriesQty}
          </span>
        )}
        {drinkCode !== 'NONE' && (
          <span className="px-2 py-0.5 bg-slate-100 rounded-full">
            Bebida:{' '}
            {drinkCode === 'DRINK_COKE_ORIGINAL'
              ? 'Coca-Cola original'
              : drinkCode === 'DRINK_COKE_ZERO'
              ? 'Coca-Cola cero'
              : drinkCode}
          </span>
        )}
      </div>
    </div>
  );
}
