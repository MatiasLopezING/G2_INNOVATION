/**
 * Componente Carrito
 * Muestra los productos agregados y permite eliminarlos o comprar todos.
 * Props:
 *   - carrito: Array de productos en el carrito
 *   - onRemove: Función para eliminar producto
 *   - onComprar: Función para comprar todos los productos
 */

import React from "react";
import { actualizarEstadoReceta, ESTADOS_RECETA, actualizarCompraAEnviandoPorProducto } from '../utils/firebaseUtils';

// Componente Carrito: muestra los productos agregados y permite eliminarlos o comprar todos
function Carrito({ carrito, onRemove, onComprar }) {
  // Función de pago: actualiza estado de recetas y compras
  const handleComprar = async () => {
    const userId = (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
    for (const prod of carrito) {
      if (prod.recetaSubida && prod.recetaId) {
        await actualizarEstadoReceta(prod.recetaId, ESTADOS_RECETA.PENDIENTE);
      } else {
        // Si no requiere receta, actualiza compra a 'enviando'
        if (userId && prod.id) {
          await actualizarCompraAEnviandoPorProducto(prod.id, userId);
        }
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
      <button onClick={handleComprar} disabled={carrito.length === 0} style={{ padding: "8px 16px", fontWeight: "bold", background: "#28a745", color: "#fff", border: "none", borderRadius: "5px", cursor: carrito.length === 0 ? "not-allowed" : "pointer" }}>
        Comprar todo
      </button>
    </div>
  );
}

export default Carrito;
