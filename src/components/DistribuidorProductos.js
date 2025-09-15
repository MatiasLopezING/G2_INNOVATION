import React, { useEffect, useState } from "react";
import { ref, onValue, update, get } from "firebase/database";
import { db, auth } from "../firebase";

const DistribuidorProductos = () => {
  const [productos, setProductos] = useState([]);
  const [procesando, setProcesando] = useState("");
  const [dinero, setDinero] = useState(0);
  const [farmacias, setFarmacias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    // Productos en estado "enviando"
    const productosRef = ref(db, "productos");
    const unsubscribeProductos = onValue(productosRef, (snapshot) => {
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
    // Farmacias
    const farmaciasRef = ref(db, "users");
    const unsubscribeFarmacias = onValue(farmaciasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, u]) => ({ id, ...u }))
          .filter(u => u.role === "Farmacia");
        setFarmacias(lista);
        // También obtener todos los usuarios para buscar el comprador
        setUsuarios(Object.entries(data).map(([id, u]) => ({ id, ...u })));
      } else {
        setFarmacias([]);
        setUsuarios([]);
      }
    });
    // Dinero del repartidor
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      const unsubscribeDinero = onValue(userRef, (snapshot) => {
        const datos = snapshot.val();
        setDinero(datos && datos.dinero ? Number(datos.dinero) : 0);
      });
      return () => {
        unsubscribeProductos();
        unsubscribeFarmacias();
        unsubscribeDinero();
      };
    }
    return () => {
      unsubscribeProductos();
      unsubscribeFarmacias();
    };
  }, []);

  const handleRecibido = async (id) => {
    setProcesando(id);
    try {
      // Cambiar estado del producto a recibido
      await update(ref(db, `productos/${id}`), { estado: "recibido" });
      // Actualizar el estado en la compra del usuario
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

      // Obtener precio del producto
      const productoSnap = await get(ref(db, `productos/${id}`));
      const producto = productoSnap.val();
      const precio = producto && producto.precio ? Number(producto.precio) : 0;

      // Obtener usuario actual (repartidor)
      const user = auth.currentUser;
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        const userSnap = await get(userRef);
        const datos = userSnap.val();
        const dineroActual = datos && datos.dinero ? Number(datos.dinero) : 0;
        const nuevoDinero = dineroActual + precio * 0.05;
        await update(userRef, { dinero: nuevoDinero });
      }
    } catch (err) {
      alert("Error al actualizar estado: " + err.message);
    }
    setProcesando("");
  };

  // Calcular distancia entre farmacia y usuario comprador
  function calcularDistancia(farmacia, usuario) {
    if (!farmacia || !usuario) return "-";
    const dx = Math.abs(Number(usuario.calle1) - Number(farmacia.calle1));
    const dy = Math.abs(Number(usuario.calle2) - Number(farmacia.calle2));
    const metros = (dx + dy) * 100;
    if (metros < 1000) return metros + " m";
    return (metros / 1000).toFixed(2) + " km";
  }

  return (
    <div style={{ maxWidth: "700px", margin: "auto", padding: "20px" }}>
      <h2>Productos para entregar</h2>
      <div style={{ marginBottom: "15px", fontWeight: "bold", fontSize: "18px" }}>
        Dinero acumulado: ${dinero.toFixed(2)}
      </div>
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
              <th>Distancia a recorrer</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {[...productos]
              .map((prod) => {
                // Buscar farmacia por ID
                const farmacia = farmacias.find(f => f.id === prod.farmaciaId);
                // Buscar usuario comprador (por la compra en la base de datos)
                let usuarioCompra = null;
                let distanciaValor = Infinity;
                let distancia = "-";
                if (usuarios.length > 0) {
                  for (const u of usuarios) {
                    if (u.compras) {
                      for (const compraId in u.compras) {
                        const compra = u.compras[compraId];
                        if (compra.productoId === prod.id && compra.estado === "enviando") {
                          usuarioCompra = u;
                          distanciaValor = Math.abs(Number(u.calle1) - Number(farmacia.calle1)) + Math.abs(Number(u.calle2) - Number(farmacia.calle2));
                          distanciaValor = distanciaValor * 100;
                          distancia = distanciaValor < 1000 ? distanciaValor + " m" : (distanciaValor / 1000).toFixed(2) + " km";
                          break;
                        }
                      }
                    }
                    if (usuarioCompra) break;
                  }
                }
                return {
                  prod,
                  farmacia,
                  distanciaValor,
                  distancia
                };
              })
              .sort((a, b) => a.distanciaValor - b.distanciaValor)
              .map(({ prod, farmacia, distancia }, idx) => (
                <tr key={prod.id}>
                  <td>{prod.nombre}</td>
                  <td>${prod.precio}</td>
                  <td>{prod.stock}</td>
                  <td>{farmacia ? farmacia.nombreFarmacia : prod.farmaciaId}</td>
                  <td>{distancia}</td>
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
