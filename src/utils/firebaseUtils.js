// Funciones utilitarias para lógica repetida de productos y compras
// Utilidades para manipulación de productos y compras en Firebase
import { ref, onValue, update, get, remove } from "firebase/database";
import { db } from "../firebase";

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

// Verifica si un DNI ya está registrado en la base de datos de usuarios (Realtime DB)
export async function isDniRegistered(dni) {
  if (!dni) return false;
  const snap = await get(ref(db, 'users'));
  const data = snap.val();
  if (!data) return false;
  return Object.values(data).some(user => {
    if (!user) return false;
    // Si es distribuidor y está rechazado, permitir re-registro (ignorar su DNI)
    if (user.role === 'Distribuidor' && user.deliveryVerification && user.deliveryVerification.status === 'rejected') {
      return false;
    }
    return (user.dni === dni || user.dni === Number(dni) || String(user.dni) === String(dni));
  });
}

// Verifica si un email ya está registrado en la base de datos de usuarios (Realtime DB)
// Nota: para emails, Firebase Auth también rechazará correos duplicados al crear el usuario.
export async function isEmailRegisteredInDb(email) {
  if (!email) return false;
  const snap = await get(ref(db, 'users'));
  const data = snap.val();
  if (!data) return false;
  return Object.values(data).some(user => user && user.email && String(user.email).toLowerCase() === String(email).toLowerCase());
}
