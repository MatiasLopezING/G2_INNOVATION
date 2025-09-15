import React, { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebase";

const DistribuidorProductos = () => {
  const [productos, setProductos] = useState([]);
  const [procesando, setProcesando] = useState("");

  useEffect(() => {
    const productosRef = ref(db, "productos");
    const unsubscribe = onValue(productosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, prod]) => ({ id, ...prod }))
          .filter((prod) => prod.estado === "enviando");
        setProductos(lista);
      } else {
        setProductos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRecibido = async (id) => {
    setProcesando(id);
    try {
      await update(ref(db, `productos/${id}`), { estado: "recibido" });
      // Actualizar el estado en la compra del usuario
      // Buscar la compra en todos los usuarios
      const comprasRef = ref(db, "compras");
      onValue(comprasRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          Object.entries(data).forEach(([uid, comprasUsuario]) => {
            Object.entries(comprasUsuario).forEach(([compraId, compra]) => {
              if (compra.productoId === id && compra.estado === "enviando") {
                update(ref(db, `compras/${uid}/${compraId}`), { estado: "recibido" });
              }
            });
          });
        }
      }, { onlyOnce: true });
    } catch (err) {
      alert("Error al actualizar estado: " + err.message);
    }
    setProcesando("");
  };

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <h2>Productos para entregar</h2>
      {productos.length === 0 ? (
        <p>No hay productos en estado 'Enviando'.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Farmacia</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((prod) => (
              <tr key={prod.id}>
                <td>{prod.nombre}</td>
                <td>${prod.precio}</td>
                <td>{prod.stock}</td>
                <td>{prod.farmaciaId}</td>
                <td>
                  <button onClick={() => handleRecibido(prod.id)} disabled={procesando === prod.id}>
                    {procesando === prod.id ? "Procesando..." : "Marcar como recibido"}
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

export default DistribuidorProductos;
