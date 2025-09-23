/**
 * Componente principal para el panel del distribuidor.
 * Muestra productos, farmacias, usuarios y gestiona pedidos.
 * No recibe props.
 */

import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db, auth } from "../firebase";
import { updateCompraEstado, updateProductoEstado, eliminarCompraYProducto } from "../utils/firebaseUtils";

const openRouteApiKey = process.env.REACT_APP_OPENROUTE_API_KEY;

// Componente principal para el panel del distribuidor
function DistribuidorProductos() {
  // Estados principales
  const [productos, setProductos] = useState([]);
  const [farmacias, setFarmacias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [procesando, setProcesando] = useState("");
  const [dinero, setDinero] = useState(0);
  const [distanciasApi, setDistanciasApi] = useState({});
  const [timers, setTimers] = useState({});

  // Timer para pedidos en estado "enviando"
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
              const diff = Math.max(0, 600 - Math.floor((now - pedidoTime) / 1000)); // 10 minutos para aceptar
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

  // Cancelar pedidos expirados y reponer stock SOLO si sigue en estado 'enviando'
  useEffect(() => {
    productos.forEach(async (p) => {
      if (p.fecha && timers[p.id] === 0 && p.estado === "enviando") {
        await eliminarCompraYProducto(p.id);
        window.alert("No se pudo realizar la compra ya que no hay deliverys disponibles. Intenta nuevamente.");
      }
    });
  }, [timers, productos]);
  // Handler para aceptar pedido
  const handleAceptarPedido = async (id) => {
    setProcesando(id);
    try {
      await updateProductoEstado(id, "aceptado");
      await updateCompraEstado(id, "aceptado");
    } catch (err) {
      alert("Error al aceptar pedido: " + err.message);
    }
    setProcesando("");
  };

  // Handler para marcar pedido como entregado
  const handlePedidoEntregado = async (id) => {
    setProcesando(id);
    try {
      await updateCompraEstado(id, "recibido");
      await updateProductoEstado(id, "recibido");
    } catch (err) {
      alert("Error al actualizar estado: " + err.message);
    }
    setProcesando("");
  };

  // Carga inicial de productos, farmacias, usuarios y dinero
  useEffect(() => {
    const productosRef = ref(db, "productos");
    const unsubscribeProductos = onValue(productosRef, (snapshot) => {
      const data = snapshot.val();
      const productosEnviando = data
        ? Object.entries(data)
            .map(([id, p]) => ({ id, ...p }))
            .filter((p) => p.estado === "enviando")
        : [];
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

  // Calcula la distancia entre usuario y farmacia usando la API
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
      setDistanciasApi((prev) => ({ ...prev, [prodId]: null }));
    }
  };

  // Calcular productos con farmacia, usuario y distancia antes del render
  const productosConDistancia = productos
    .map((prod) => {
      const farmacia = farmacias.find(f => f.id === prod.farmaciaId);
      let usuarioCompra = null;
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
                  {/* Estado ENVIANDO: mostrar timer y botón aceptar */}
                  {prod.estado === "enviando" && timers[prod.id] !== null && (
                    <span style={{ color: timers[prod.id] <= 60 ? "red" : "black", fontWeight: "bold" }}>
                      {timers[prod.id] > 0
                        ? `Tiempo para aceptar: ${Math.floor(timers[prod.id] / 60)}:${(timers[prod.id] % 60).toString().padStart(2, "0")}`
                        : "Pedido cancelado por tiempo"}
                    </span>
                  )}
                  {prod.estado === "enviando" && timers[prod.id] > 0 && (
                    <button onClick={() => handleAceptarPedido(prod.id)} disabled={procesando === prod.id} style={{ marginLeft: "10px" }}>
                      {procesando === prod.id ? "Procesando..." : "Aceptar pedido"}
                    </button>
                  )}
                  {/* Estado ACEPTADO: mostrar botón entregar */}
                  {prod.estado === "aceptado" && (
                    <button onClick={() => handlePedidoEntregado(prod.id)} disabled={procesando === prod.id} style={{ marginLeft: "10px", backgroundColor: "#4caf50", color: "white" }}>
                      {procesando === prod.id ? "Procesando..." : "Pedido entregado"}
                    </button>
                  )}
                  {/* Estado CANCELADO: mensaje */}
                  {prod.estado === "cancelado" && (
                    <span style={{ color: "red", fontWeight: "bold" }}>Pedido cancelado</span>
                  )}
                  {/* Estado RECIBIDO: mensaje */}
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
