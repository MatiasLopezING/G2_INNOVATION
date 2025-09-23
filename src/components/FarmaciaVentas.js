/**
 * Componente para mostrar y vender productos físicos en la farmacia.
 * Permite actualizar el stock tras cada venta.
 *
 * No recibe props. Utiliza Firebase para obtener y actualizar productos.
 */
import React, { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { db, auth } from "../firebase";

const FarmaciaVentas = () => {
  const [productos, setProductos] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const productosRef = ref(db, "productos");
    const unsubscribe = onValue(productosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, prod]) => ({ id, ...prod }))
          .filter((p) => p.farmaciaId === user.uid);
        setProductos(lista);
      } else {
        setProductos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Vende un producto y actualiza el stock
  const venderProducto = async (id) => {
    setMensaje("");
    const producto = productos.find((p) => p.id === id);
    if (!producto || !producto.stock || producto.stock <= 0) {
      setMensaje("No hay stock disponible.");
      return;
    }
    try {
      const nuevoStock = Math.max(0, producto.stock - 1);
      await update(ref(db, `productos/${id}`), { stock: nuevoStock });
      setMensaje(`Venta realizada. Stock restante: ${nuevoStock}`);
    } catch (err) {
      setMensaje("Error al realizar la venta: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <h2>Venta física en local</h2>
      {mensaje && (
        <p style={{ color: mensaje.includes("Error") ? "red" : "green" }}>
          {mensaje}
        </p>
      )}
      {productos.length === 0 ? (
        <p>No hay productos cargados.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((prod) => (
              <tr key={prod.id}>
                <td>{prod.nombre}</td>
                <td>${prod.precio}</td>
                <td>{prod.stock}</td>
                <td>
                  <button
                    onClick={() => venderProducto(prod.id)}
                    disabled={prod.stock <= 0}
                  >
                    Vender
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FarmaciaVentas;
