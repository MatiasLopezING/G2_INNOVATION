import React, { useEffect, useState } from "react";
import { ref, onValue, update, push } from "firebase/database";
import { db, auth } from "../firebase";

const ListaProductos = () => {
  const [productos, setProductos] = useState([]);
  const [comprando, setComprando] = useState("");

  useEffect(() => {
    const productosRef = ref(db, "productos");
    const unsubscribe = onValue(productosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data).map(([id, prod]) => ({ id, ...prod }));
        setProductos(lista);
      } else {
        setProductos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleComprar = async (id) => {
    setComprando(id);
    const user = auth.currentUser;
    if (!user) {
      alert("Debes iniciar sesión para comprar.");
      setComprando("");
      return;
    }
    const producto = productos.find(p => p.id === id);
    try {
      // Cambiar estado del producto a 'enviando'
      await update(ref(db, `productos/${id}`), { estado: "enviando" });
      // Guardar la compra en el nodo 'compras' del usuario
      await push(ref(db, `compras/${user.uid}`), {
        productoId: id,
        nombre: producto.nombre,
        precio: producto.precio,
        estado: "enviando",
        fecha: new Date().toISOString(),
        farmaciaId: producto.farmaciaId
      });
    } catch (err) {
      alert("Error al comprar: " + err.message);
    }
    setComprando("");
  };

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <h2>Productos disponibles</h2>
      {productos.length === 0 ? (
        <p>No hay productos cargados.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((prod) => (
              <tr key={prod.id}>
                <td>{prod.nombre}</td>
                <td>${prod.precio}</td>
                <td>{prod.stock}</td>
                <td>{
                  prod.estado === "por_comprar" ? "Por comprar" :
                  prod.estado === "enviando" ? "Enviando" :
                  prod.estado === "recibido" ? "Recibido" : prod.estado
                }</td>
                <td>
                  {prod.estado === "por_comprar" ? (
                    <button onClick={() => handleComprar(prod.id)} disabled={comprando === prod.id}>
                      {comprando === prod.id ? "Comprando..." : "Comprar"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ListaProductos;
