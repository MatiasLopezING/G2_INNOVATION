/*
Utils: Son funciones utilitarias o de ayuda, que pueden ser usadas en cualquier
parte del proyecto. No siguen las reglas de los hooks y no dependen de React.
Por ejemplo, funciones para formatear fechas, calcular totales, etc
*/

import { ref, onValue, update, get, push, remove } from "firebase/database";
import { db } from "../firebase";
// Actualiza el estado de la compra a 'enviando' para un producto y usuario
export async function actualizarCompraAEnviandoPorProducto(productoId, userId) {
  const comprasRef = ref(db, `compras/${userId}`);
  const snapshot = await get(comprasRef);
  const compras = snapshot.val();
  if (compras) {
    Object.entries(compras).forEach(async ([compraId, compra]) => {
      if (compra.productoId === productoId && compra.estado !== ESTADOS_COMPRA.ENVIANDO) {
        await update(ref(db, `compras/${userId}/${compraId}`), { estado: ESTADOS_COMPRA.ENVIANDO });
      }
    });
  }
}
// Estados recomendados para recetas y compras
export const ESTADOS_RECETA = {
  POR_ACEPTAR: 'por_aceptar', // Receta subida, esperando pago
  PENDIENTE: 'pendiente',     // Pagada, esperando revisión
  ACEPTADA: 'aceptada',
  RECHAZADA: 'rechazada',
};

export const ESTADOS_COMPRA = {
  POR_COMPRAR: 'por_comprar',
  ENVIANDO: 'enviando',
  RECIBIDO: 'recibido',
};

// Actualiza el estado de una receta
export async function actualizarEstadoReceta(recetaId, nuevoEstado) {
  await update(ref(db, `recetas/${recetaId}`), { estado: nuevoEstado });
}

// Actualiza el estado de una compra
export async function actualizarEstadoCompra(compraId, userId, nuevoEstado) {
  await update(ref(db, `compras/${userId}/${compraId}`), { estado: nuevoEstado });
}

// Itera sobre todas las compras y ejecuta una acción para cada compra que cumpla la condición
async function forEachCompra(condicion, accion) {
  const comprasRef = ref(db, "compras");
  await new Promise((resolve) => {
    onValue(comprasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        Object.entries(data).forEach(([uid, comprasUsuario]) => {
          Object.entries(comprasUsuario).forEach(([compraId, compra]) => {
            if (condicion(compra)) {
              accion(uid, compraId, compra);
            }
          });
        });
      }
      resolve();
    }, { onlyOnce: true });
  });
}

// Actualiza el estado de todas las compras asociadas a un producto
export async function updateCompraEstado(productoId, estado, extra = {}) {
  await forEachCompra(
    compra => compra.productoId === productoId && compra.estado !== estado,
    (uid, compraId) => update(ref(db, `compras/${uid}/${compraId}`), { estado, ...extra })
  );
}

// Actualiza el estado de un producto
export async function updateProductoEstado(productoId, estado, extra = {}) {
  await update(ref(db, `productos/${productoId}`), { estado, ...extra });
}

// Elimina todas las compras y el producto asociado
export async function eliminarCompraYProducto(productoId) {
  await forEachCompra(
    compra => compra.productoId === productoId,
    (uid, compraId) => remove(ref(db, `compras/${uid}/${compraId}`))
  );
  await remove(ref(db, `productos/${productoId}`));
}

// Repone el stock de un producto
export async function reponerStock(productoId, cantidad) {
  const snap = await get(ref(db, `productos/${productoId}`));
  const prod = snap.val();
  const nuevoStock = prod && prod.stock ? prod.stock + (cantidad || 1) : (cantidad || 1);
  await update(ref(db, `productos/${productoId}`), { stock: nuevoStock });
}


