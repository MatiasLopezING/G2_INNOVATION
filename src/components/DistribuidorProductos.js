
import React, { useEffect, useState } from "react";
import { ref, onValue, update, get } from "firebase/database";
import { db, auth } from "../firebase";

const openRouteApiKey = "TU_API_KEY_AQUI"; // ⚠️ Ideal moverlo a backend

function DistribuidorProductos() {
  const [productos, setProductos] = useState([]);
  const [farmacias, setFarmacias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [procesando, setProcesando] = useState("");
  const [dinero, setDinero] = useState(0);
  const [distanciasApi, setDistanciasApi] = useState({});

  useEffect(() => {
    const productosRef = ref(db, "productos");
    const unsubscribeProductos = onValue(productosRef, (snapshot) => {
      const data = snapshot.val();
      setProductos(
        data
          ? Object.entries(data)
              .map(([id, p]) => ({ id, ...p }))
              .filter((p) => p.estado === "enviando")
          : []
      );
    });

    const farmaciasRef = ref(db, "users");
    const unsubscribeFarmacias = onValue(farmaciasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFarmacias(
          Object.entries(data)
            .map(([id, u]) => ({ id, ...u }))
            .filter((u) => u.role === "Farmacia")
        );
        setUsuarios(Object.entries(data).map(([id, u]) => ({ id, ...u })));
      } else {
        setFarmacias([]);
        setUsuarios([]);
      }
    });

    // Dinero del repartidor
    let unsubscribeDinero = () => {};
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      unsubscribeDinero = onValue(userRef, (snapshot) => {
        const datos = snapshot.val();
        setDinero(datos?.dinero ? Number(datos.dinero) : 0);
      });
    }

    return () => {
      unsubscribeProductos();
      unsubscribeFarmacias();
      unsubscribeDinero();
    };
  }, []);

  const distanciaPorCalles = async (usuario, farmacia, prodId) => {
    if (!usuario?.lat || !farmacia?.lat) return;
    try {
      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${openRouteApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coordinates: [
              [farmacia.lng, farmacia.lat],
              [usuario.lng, usuario.lat],
            ],
          }),
        }
      );
      const data = await response.json();
      const distancia =
        data?.features?.[0]?.properties?.segments?.[0]?.distance || null;
      setDistanciasApi((prev) => ({ ...prev, [prodId]: distancia }));
    } catch {
      setDistanciasApi((prev) => ({ ...prev, [prodId]: null }));
    }
  };

  const handleRecibido = async (id) => {
    setProcesando(id);
    try {
      await update(ref(db, `productos/${id}`), { estado: "recibido" });
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
      const productoSnap = await get(ref(db, `productos/${id}`));
      const producto = productoSnap.val();
      const precio = producto && producto.precio ? Number(producto.precio) : 0;
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

  // Calcular productos con farmacia, usuario y distancia antes del return
  const productosConDistancia = productos
    .map((prod) => {
      const farmacia = farmacias.find(f => f.id === prod.farmaciaId);
      let usuarioCompra = null;
      if (usuarios.length > 0) {
        for (const u of usuarios) {
          if (u.compras) {
            for (const compraId in u.compras) {
              const compra = u.compras[compraId];
              if (compra.productoId === prod.id && compra.estado === "enviando") {
                usuarioCompra = u;
                break;
              }
            }
          }
          if (usuarioCompra) break;
        }
      }
      // Llamar a la API solo si no está calculado
      if (farmacia && usuarioCompra && prod.id && distanciasApi[prod.id] === undefined) {
        distanciaPorCalles(usuarioCompra, farmacia, prod.id);
      }
      return {
        prod,
        farmacia,
        distanciaValor: distanciasApi[prod.id] !== undefined ? distanciasApi[prod.id] : Infinity,
        distancia: distanciasApi[prod.id] !== undefined ? distanciasApi[prod.id] : null
      };
    })
    .sort((a, b) => a.distanciaValor - b.distanciaValor);

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
            {productosConDistancia.map(({ prod, farmacia, distancia }, idx) => (
              <tr key={prod.id}>
                <td>{prod.nombre}</td>
                <td>${prod.precio}</td>
                <td>{prod.stock}</td>
                <td>{farmacia ? farmacia.nombreFarmacia : prod.farmaciaId}</td>
                <td>{distancia === null ? '-' : (distancia < 1000 ? Math.round(distancia) + ' m' : (distancia / 1000).toFixed(2) + ' km')}</td>
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
}

export default DistribuidorProductos;
