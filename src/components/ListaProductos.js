import React, { useEffect, useState } from "react";
import { ref, onValue, update, push } from "firebase/database";
import { db, auth } from "../firebase";

const ListaProductos = () => {
  const [productos, setProductos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [comprando, setComprando] = useState("");

  useEffect(() => {
    // Obtener datos del usuario actual
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      onValue(userRef, (snapshot) => {
        setUsuario(snapshot.val());
      }, { onlyOnce: true });
    }
    // Obtener productos
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

  // Calcular distancia entre usuario y farmacia
  function distancia(u, f) {
    if (!u || !f) return Infinity;
    const dx = Math.abs(Number(u.calle1) - Number(f.calle1));
    const dy = Math.abs(Number(u.calle2) - Number(f.calle2));
    return (dx + dy) * 100; // cada salto es 100 metros
  }

  function mostrarDistancia(dist) {
    if (dist === null || dist === undefined || isNaN(dist)) return "-";
    if (dist < 1000) return dist + " m";
    return (dist / 1000).toFixed(2) + " km";
  }

  // Obtener farmacias
  const [farmacias, setFarmacias] = useState([]);
  useEffect(() => {
    const farmaciasRef = ref(db, "users");
    const unsubscribe = onValue(farmaciasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, u]) => ({ id, ...u }))
          .filter(u => u.role === "Farmacia");
        setFarmacias(lista);
      } else {
        setFarmacias([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Asociar producto con farmacia y calcular distancia
  const productosConDistancia = productos.map(prod => {
    const farmacia = farmacias.find(f => f.id === prod.farmaciaId);
    return {
      ...prod,
      farmacia,
      distancia: farmacia && usuario ? distancia(usuario, farmacia) : null
    };
  });

  // Ordenar por distancia
  productosConDistancia.sort((a, b) => {
    if (a.distancia === null) return 1;
    if (b.distancia === null) return -1;
    return a.distancia - b.distancia;
  });

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <h2>Productos disponibles</h2>
      {productosConDistancia.length === 0 ? (
        <p>No hay productos cargados.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Farmacia</th>
              <th>Distancia</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {productosConDistancia.map((prod) => (
              <tr key={prod.id}>
                <td>{prod.nombre}</td>
                <td>${prod.precio}</td>
                <td>{prod.stock}</td>
                <td>{prod.farmacia ? prod.farmacia.nombreFarmacia : prod.farmaciaId}</td>
                <td>{mostrarDistancia(prod.distancia)}</td>
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
