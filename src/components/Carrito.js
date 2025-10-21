/**
 * Componente Carrito
 * Muestra los productos agregados y permite eliminarlos o comprar todos.
 * Props:
 *   - carrito: Array de productos en el carrito
 *   - onRemove: Función para eliminar producto
 *   - onComprar: Función para comprar todos los productos
 */

import React from "react";
import { actualizarEstadoReceta, ESTADOS_RECETA } from '../utils/firebaseUtils';
import { db } from '../firebase';
import { ref, push, update } from "firebase/database";

// Componente Carrito: muestra los productos agregados y permite eliminarlos o comprar todos
function Carrito({ carrito, onRemove, onComprar }) {
  // Función de pago: crea registro en 'compras' y actualiza stock
  const handleComprar = async () => {
    // Validar stock antes de procesar la compra
    for (const prod of carrito) {
      if ((prod.stock || 0) < (prod.cantidad || 1)) {
        alert(`No hay suficiente stock para el producto '${prod.nombre}'. Stock disponible: ${prod.stock}`);
        return;
      }
    }
    const userId = (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
    for (const prod of carrito) {
      // Actualiza receta si corresponde
      if (prod.recetaSubida && prod.recetaId) {
        await actualizarEstadoReceta(prod.recetaId, ESTADOS_RECETA.PENDIENTE);
      }
      // Crea registro de compra en la tabla 'compras'
      if (userId && prod.id) {
        const compra = {
          productoId: prod.id,
          productoNombre: prod.nombre,
          farmaciaId: prod.farmaciaId,
          cantidad: prod.cantidad || 1,
          precio: prod.precio,
          estado: 'por_comprar',
          fecha: new Date().toISOString(),
          requiereReceta: !!prod.requiereReceta,
          recetaId: prod.recetaId || null,
          recetaURL: prod.recetaURL || null
        };
        await push(ref(db, `compras/${userId}`), compra);
        // Actualiza el stock en productos
        const nuevoStock = Math.max(0, (prod.stock || 0) - (prod.cantidad || 1));
        await update(ref(db, `productos/${prod.id}`), { stock: nuevoStock });
      }
    }
    if (onComprar) onComprar();
  };
  // Calcula el total del carrito
  const total = carrito.reduce((acc, prod) => {
    const precio = Number(prod.precio) || 0;
    const cantidad = prod.cantidad || 1;
    return acc + (precio * cantidad);
  }, 0);

  // Deshabilitar botón de compra si algún producto tiene stock 0
  const hayStockInsuficiente = carrito.some(prod => (prod.stock || 0) < 1);

  return (
    <div style={{ margin: "20px 0", padding: "15px", border: "1px solid #ccc", borderRadius: "8px", background: "#f9f9f9" }}>
      <h3>Carrito de compras</h3>
      {carrito.length === 0 ? (
        <div>El carrito está vacío.</div>
      ) : (
        <table style={{ width: "100%", marginBottom: "10px", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio unitario</th>
              <th>Cantidad</th>
              <th>Subtotal</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {carrito.map((prod) => (
              <tr key={prod.id}>
                <td>{prod.nombre}</td>
                <td>${Number(prod.precio) || 0}</td>
                <td>{prod.cantidad || 1}</td>
                <td>${((Number(prod.precio) || 0) * (prod.cantidad || 1)).toFixed(2)}</td>
                <td>
                  <button onClick={() => onRemove(prod.id)} style={{ padding: "4px 10px", color: "#fff", background: "#dc3545", border: "none", borderRadius: "4px", cursor: "pointer" }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ fontWeight: "bold", marginBottom: "10px" }}>Total: ${total.toFixed(2)}</div>
      <button
        onClick={handleComprar}
        disabled={carrito.length === 0 || hayStockInsuficiente}
        style={{
          padding: "8px 16px",
          fontWeight: "bold",
          background: hayStockInsuficiente ? "#ccc" : "#28a745",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: carrito.length === 0 || hayStockInsuficiente ? "not-allowed" : "pointer"
        }}
      >
        Comprar todo
      </button>
    </div>
  );
}

export default Carrito;
