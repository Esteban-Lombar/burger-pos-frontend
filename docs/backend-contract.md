# Contrato Frontend ↔ Backend (precios + Sangre Azul)

Este documento describe exactamente lo que el frontend (`MeseroPage.jsx` / `CocinaPage.jsx`) espera del backend para que:

1. Los precios actualizados (chessbeicon, doble carne) queden reflejados en cualquier validación server-side.
2. La nueva hamburguesa **Sangre Azul** aparezca en el menú y cobre correctamente.

No hace falta crear endpoints nuevos: el frontend ya solo usa `GET /products` y `POST /orders` (más `PUT /orders/:id` para editar desde cocina). Lo que hace falta es **dato** (el producto nuevo) y, si el backend recalcula/valida precios, **lógica** (las reglas de abajo).

---

## 1. Endpoints que ya consume el frontend

Definidos en `src/api/client.js`, base URL = `VITE_API_URL` (hoy `https://burger-pos-backend.onrender.com/api`):

| Método | Ruta | Uso |
|---|---|---|
| GET | `/products` | Cargar menú (hamburguesas, papas, papas chessbeicon) |
| POST | `/orders` | Crear pedido nuevo desde Mesero |
| GET | `/orders?status=` | Listar pedidos por estado |
| GET | `/orders/pending` | Pedidos pendientes para Cocina |
| PUT | `/orders/:id/status` | Cambiar estado de un pedido |
| PUT | `/orders/:id` | Editar pedido completo (usado por Cocina al editar un ítem) |
| **DELETE** | **`/orders/:id`** | **NUEVO** — Eliminar un pedido completo (botón "Eliminar pedido" en Cocina) |
| GET | `/orders/today/summary?date=` | Resumen de caja (Admin) |

Para el catálogo de productos no se necesita ninguna ruta nueva. Si más adelante quieren gestionar productos sin tocar la base de datos a mano, lo único que faltaría sería un `POST /products` / `PUT /products/:id` administrativos — pero eso es opcional y no bloquea lo de hoy.

### Nuevo: `DELETE /orders/:id`

Motivo: en cocina a veces un pedido queda duplicado (se tomó dos veces por error) y hay que poder borrarlo.

- **Método/ruta:** `DELETE /orders/:id`
- **Respuesta esperada:** `200 OK` con algún body (el frontend hace `res.json()` sobre la respuesta, así que debe devolver JSON válido — puede ser `{ "ok": true }` o el documento eliminado). Si prefieren `204 No Content`, hay que avisar porque el frontend actual llama `res.json()` sin chequear el status code de esa forma.
- **Si el `id` no existe:** devolver `404` (el frontend solo revisa `res.ok`; cualquier status fuera de 2xx dispara el mensaje de error "No se pudo eliminar el pedido").
- **Borrado:** puede ser borrado físico (`deleteOne`) o lógico (marcar `deleted: true` / `status: "eliminado"` y excluirlo de `GET /orders/pending`). Cualquiera de los dos funciona para el frontend, mientras el pedido eliminado deje de aparecer en `/orders/pending` después de borrarlo.
- **Confirmación:** el frontend ya pide confirmación al usuario (`window.confirm`) antes de llamar este endpoint, así que el backend no necesita un paso de confirmación adicional — cuando llega la request, se elimina.
- No hace falta soft-auth especial adicional a la que ya tengan en las otras rutas de `/orders`.

---

## 2. Esquema de producto esperado por el frontend

El frontend consume cada producto de `GET /products` así (campos que realmente lee):

```ts
{
  _id: string;          // ObjectId de Mongo
  name: string;         // nombre para mostrar, ej "Sangre Azul"
  code: string;         // slug único, usado para casos especiales: "papas", "papas_chessbeicon", "sangre_azul"
  type: string;         // "burger" -> se filtra para armar las cards de sencillas/dobles
  price: number;        // precio base "de catálogo" (fallback si no hay override en frontend)
  options?: {
    tocineta?: "asada" | "caramelizada"; // default "asada" si no viene
  };
}
```

Importante: **todas las hamburguesas normales generan automáticamente su versión sencilla y doble en el frontend** (un solo documento en la base de datos, el frontend crea las dos variantes de UI). No hace falta un documento separado para "doble".

---

## 3. Cambios de precio ya aplicados en el frontend (mirror en backend si valida precios)

| Ítem | Precio anterior | Precio nuevo |
|---|---|---|
| Papas chessbeicon (base) | $15.000 | **$18.000** |
| Hamburguesa doble carne (sola) | $25.000 | **$28.000** |
| Hamburguesa doble carne (combo papas+gaseosa) | $30.000 | **$33.000** (= base doble $28.000 + $5.000, la fórmula no cambió) |

La hamburguesa sencilla normal ($20.000 base, combo $26.000) **no cambió**.

---

## 4. Producto nuevo: Sangre Azul

Documento a insertar en la colección de productos:

```json
{
  "name": "Sangre Azul",
  "code": "sangre_azul",
  "type": "burger",
  "price": 25000,
  "options": {
    "tocineta": "asada"
  }
}
```

Con esto, el frontend automáticamente:
- La muestra en "Hamburguesas sencillas" y en "Hamburguesas doble carne" (por ser `type: "burger"`).
- Le aplica un precio base **distinto al resto de hamburguesas** porque detecta `code === "sangre_azul"`.

### Precios de Sangre Azul (ya implementados en frontend, para referencia/validación)

**Sencilla** (base $25.000):
| Configuración | Precio |
|---|---|
| Sola | $25.000 |
| + gaseosa (sin papas) | $29.000 |
| + papas (sin gaseosa) | $30.000 |
| Combo completo (papas + gaseosa) | $30.000 |

**Doble carne** (base $33.000):
| Configuración | Precio |
|---|---|
| Sola | $33.000 |
| + gaseosa (sin papas) | $37.000 |
| + papas (sin gaseosa) | $38.000 |
| Combo completo (papas + gaseosa) | $38.000 |

### Regla de negocio (la única diferencia real con el resto de hamburguesas)

Todos los add-ons (carne extra, tocineta extra, queso extra, papas extra, gaseosa extra) se calculan **igual que cualquier otra hamburguesa**. La única regla especial es el **combo sencillo**:

- Combo de cualquier otra hamburguesa sencilla = `base + 6.000`.
- Combo de Sangre Azul sencilla = `base + 5.000`.
- Combo doble (Sangre Azul o cualquier otra) = `base + 5.000` (esto **no cambia**, ya era así).

Pseudocódigo equivalente al que usa el frontend (`calculateUnitPrice` en `MeseroPage.jsx` / `CocinaPage.jsx`):

```
precio = basePrice                      // 25000 / 28000(otras) / 33000 sangre azul doble
si extraMeat > 0: precio += extraMeat * 5000
si extraBacon: precio += 3000
si extraCheese: precio += 3000

hasDrink = drinkCode != "none"

si includesFries y NO hasDrink: precio += 5000
si NO includesFries y hasDrink: precio += precioBebida(drinkCode)   // 3000 agua sola, 4000 el resto

si includesFries y hasDrink:                                        // COMBO, precio fijo
  si includedMeats == 1:
    precio = basePrice + (esSangreAzul ? 5000 : 6000)
  si includedMeats == 2:
    precio = basePrice + 5000

precio += extraFriesQty * 5000
precio += extraDrinkQty * 4000
```

`esSangreAzul` = `productCode === "sangre_azul"`.

Precios de bebida usados (`DRINK_PRICE_BY_CODE` en frontend): `coca`, `coca_zero`, `manzana`, `uva`, `agua_gas` = $4.000; `agua` = $3.000.

---

## 5. Contrato del payload de pedido (`POST /orders`)

```ts
{
  tableNumber: number | null;
  toGo: boolean;
  items: [
    {
      product: string;        // _id del producto base (mismo para sencilla y doble)
      productName: string;    // "Sangre Azul" o "Sangre Azul (doble carne)"
      productCode: string;    // "sangre_azul"
      quantity: number;

      includesFries: boolean;
      extraFriesQty: number;

      drinkCode: "none" | "coca" | "coca_zero" | "manzana" | "uva" | "agua_gas" | "agua";
      extraDrinkQty: number;

      burgerConfig: {
        meatType: "carne";
        meatQty: number;          // 1 o 2 normalmente (0 si es un acompañamiento tipo papas)
        baconType: "asada" | "caramelizada";
        extraBacon: boolean;
        extraCheese: boolean;
        lettuceOption: "normal" | "wrap" | "sin";
        tomato: boolean;
        onion: boolean;
        noVeggies: boolean;
        notes: string;
        includedMeats: number;    // 1 = sencilla, 2 = doble
      };

      unitPrice: number;   // ya calculado por el frontend
      totalPrice: number;  // unitPrice * quantity
      basePrice: number;   // base usada (25000 / 28000 / 33000 / etc.), clave para poder recalcular después
    }
  ];
}
```

**Recomendación:** si el backend recalcula/valida `unitPrice`/`totalPrice` en vez de confiar en lo que manda el cliente, debe implementar exactamente el pseudocódigo de la sección 4 (más las reglas ya existentes de papas y papas chessbeicon), usando `productCode` y `basePrice` del ítem para decidir la rama de precio. Si el backend **no** valida y solo persiste lo que llega, con insertar el documento de la sección 4 basta y no hay que tocar lógica de precios en el servidor.
