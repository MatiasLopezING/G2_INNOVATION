
import React, { useEffect, useState } from "react";
import { ref, onValue, update, get } from "firebase/database";
import { db, auth } from "../firebase";

const openRouteApiKey = process.env.REACT_APP_OPENROUTE_API_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY5YjI1NzI1YmViMTQ1MWQ4OWVmYjhhM2E0YmJlM2NjIiwiaCI6Im11cm11cjY0In0=";

function DistribuidorProductos() {
  // Declarar todos los useState al inicio
  const [productos, setProductos] = useState([]);
  const [farmacias, setFarmacias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [procesando, setProcesando] = useState("");
  const [dinero, setDinero] = useState(0);
  const [distanciasApi, setDistanciasApi] = useState({});
  const [timers, setTimers] = useState({});

  useEffect(() => {
    if (!Array.isArray(productos)) return;
    const interval = setInterval(() => {
      setTimers((prev) => {
        const nuevos = { ...prev };
        productos.forEach((p) => {
          if (p && p.fecha && p.estado === "enviando") {
            const pedidoTime = Date.parse(p.fecha);
            if (!isNaN(pedidoTime)) {
              const now = Date.now();
              const diff = Math.max(0, 600 - Math.floor((now - pedidoTime) / 1000)); // 10 min = 600 seg
              nuevos[p.id] = diff;
            } else {
              nuevos[p.id] = null;
            }
          } else {
            nuevos[p.id] = null;
          }
        });
        return nuevos;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [productos]);

  useEffect(() => {
    // Cancelar pedidos expirados y reponer stock
    productos.forEach(async (p) => {
      if (p.fecha && timers[p.id] === 0 && p.estado === "enviando") {
        // Buscar compra asociada
        const comprasRef = ref(db, "compras");
        onValue(comprasRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            Object.entries(data).forEach(([uid, comprasUsuario]) => {
              Object.entries(comprasUsuario).forEach(([compraId, compra]) => {
                if (compra.productoId === p.id && compra.estado === "enviando") {
                  // Cambiar estado a cancelado
                  update(ref(db, `compras/${uid}/${compraId}`), { estado: "cancelado" });
                  // Reponer stock
                  get(ref(db, `productos/${p.id}`)).then((snap) => {
                    const prod = snap.val();
                    const nuevoStock = prod && prod.stock ? prod.stock + (compra.cantidad || 1) : (compra.cantidad || 1);
                    update(ref(db, `productos/${p.id}`), { estado: "por_comprar", stock: nuevoStock });
                  });
                }
              });
            });
          }
        }, { onlyOnce: true });
      }
    });
  }, [timers, productos]);

  useEffect(() => {
    const productosRef = ref(db, "productos");
    const unsubscribeProductos = onValue(productosRef, (snapshot) => {
      const data = snapshot.val();
      console.log('=== DEBUG DISTRIBUIDOR ===');
      console.log('Todos los productos:', data);
      
      const productosEnviando = data
        ? Object.entries(data)
            .map(([id, p]) => ({ id, ...p }))
            .filter((p) => p.estado === "enviando")
        : [];
      
      console.log('Productos en estado "enviando":', productosEnviando);
      console.log('========================');
      
      setProductos(productosEnviando);
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

    // Debug: Verificar compras
    const comprasRef = ref(db, "compras");
    const unsubscribeCompras = onValue(comprasRef, (snapshot) => {
      const data = snapshot.val();
      console.log('=== DEBUG COMPRAS ===');
      console.log('Todas las compras:', data);
      if (data) {
        const comprasEnviando = [];
        Object.entries(data).forEach(([uid, comprasUsuario]) => {
          Object.entries(comprasUsuario).forEach(([compraId, compra]) => {
            if (compra.estado === "enviando") {
              comprasEnviando.push({ uid, compraId, ...compra });
            }
          });
        });
        console.log('Compras en estado "enviando":', comprasEnviando);
      }
      console.log('====================');
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
      unsubscribeCompras();
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
    } catch (error) {
      console.error('Error al calcular distancia:', error);
      setDistanciasApi((prev) => ({ ...prev, [prodId]: null }));
    }
  };

  const handleRecibido = async (id) => {
    setProcesando(id);
    try {
      // Buscar la compra asociada para obtener la cantidad
      const comprasRef = ref(db, "compras");
      let cantidadComprada = 1;
      await new Promise((resolve) => {
        onValue(comprasRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            Object.entries(data).forEach(([uid, comprasUsuario]) => {
              Object.entries(comprasUsuario).forEach(([compraId, compra]) => {
                if (compra.productoId === id && compra.estado === "enviando") {
                  cantidadComprada = compra.cantidad || 1;
                  update(ref(db, `compras/${uid}/${compraId}`), { estado: "recibido" });
                }
              });
            });
          }
          resolve();
        }, { onlyOnce: true });
      });
      // Actualizar estado y descontar stock
      const productoSnap = await get(ref(db, `productos/${id}`));
      const producto = productoSnap.val();
      const nuevoStock = producto && producto.stock ? Math.max(producto.stock - cantidadComprada, 0) : 0;
      await update(ref(db, `productos/${id}`), { estado: "recibido", stock: nuevoStock });
      // Repartidor gana dinero
      const precio = producto && producto.precio ? Number(producto.precio) : 0;
      const user = auth.currentUser;
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        const userSnap = await get(userRef);
        const datos = userSnap.val();
        const dineroActual = datos && datos.dinero ? Number(datos.dinero) : 0;
        const nuevoDinero = dineroActual + precio * 0.05 * cantidadComprada;
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
                  {prod.estado === "enviando" && timers[prod.id] !== null && (
                    <span style={{ color: timers[prod.id] <= 60 ? "red" : "black", fontWeight: "bold" }}>
                      {timers[prod.id] > 0
                        ? `Tiempo para aceptar: ${Math.floor(timers[prod.id] / 60)}:${(timers[prod.id] % 60).toString().padStart(2, "0")}`
                        : "Pedido cancelado por tiempo"}
                    </span>
                  )}
                  {prod.estado === "enviando" && timers[prod.id] > 0 && (
                    <button onClick={() => handleRecibido(prod.id)} disabled={procesando === prod.id} style={{ marginLeft: "10px" }}>
                      {procesando === prod.id ? "Procesando..." : "Marcar como recibido"}
                    </button>
                  )}
                  {prod.estado === "cancelado" && (
                    <span style={{ color: "red", fontWeight: "bold" }}>Pedido cancelado</span>
                  )}
                  {prod.estado === "recibido" && (
                    <span style={{ color: "green", fontWeight: "bold" }}>Pedido entregado</span>
                  )}
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
