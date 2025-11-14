/**
 * Componente principal para el panel del distribuidor.
 * Muestra productos, farmacias, usuarios y gestiona pedidos.
 * No recibe props.
 */

import React, { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { db, auth } from "../firebase";
import { updateCompraEstado, updateProductoEstado, eliminarCompraYProducto } from "../utils/firebaseUtils";

const openRouteApiKey = process.env.REACT_APP_OPENROUTE_API_KEY;

// Componente principal para el panel del distribuidor
function DistribuidorProductos() {
  // Estados principales
  const [productos, setProductos] = useState([]);
  const [farmacias, setFarmacias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [comprasMap, setComprasMap] = useState({}); // productoId -> { uid, compraId, compra }
  const [procesando, setProcesando] = useState("");
  const [distanciasApi, setDistanciasApi] = useState({});
  const [timers, setTimers] = useState({});
  const [acceptedOrderId, setAcceptedOrderId] = useState(null);
  const [modalProductId, setModalProductId] = useState(null);
  const [returnModalProductId, setReturnModalProductId] = useState(null); // para mostrar modal de devolución
  const [addressMap, setAddressMap] = useState({}); // productId -> { farmaciaAddr, entregaAddr }

  // Timer para pedidos en estado "enviando"
  useEffect(() => {
    if (!Array.isArray(productos)) return;
    const interval = setInterval(() => {
      setTimers((prev) => {
        const nuevos = { ...prev };
        productos.forEach((p) => {
          if (p && p.estado === "enviando") {
            // obtener fecha del producto o, si no existe, de la compra asociada en comprasMap
            const compraInfo = comprasMap[p.id];
            const fechaRaw = p.fecha ?? compraInfo?.compra?.fecha;
            // soportar fecha como timestamp (number) o como string
            let pedidoTime = null;
            if (typeof fechaRaw === 'number') {
              pedidoTime = fechaRaw;
            } else if (typeof fechaRaw === 'string') {
              const parsed = Date.parse(fechaRaw);
              pedidoTime = isNaN(parsed) ? null : parsed;
            }
            if (pedidoTime) {
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
  }, [productos, comprasMap]);

  // Cancelar pedidos expirados y reponer stock SOLO si sigue en estado 'enviando'
  useEffect(() => {
    productos.forEach(async (p) => {
      if (p.fecha && timers[p.id] === 0 && p.estado === "enviando") {
        await eliminarCompraYProducto(p.id);
        window.alert("No hay repartidores disponibles ahora. Por favor intenta de nuevo en unos minutos.");
      }
    });
  }, [timers, productos]);
  // Handler para aceptar pedido
  const handleAceptarPedido = async (id) => {
    // no permitir aceptar si ya tenemos un pedido aceptado distinto
    if (acceptedOrderId && acceptedOrderId !== id) {
      alert('Ya tenés un pedido activo. Entregá ese pedido antes de aceptar otro.');
      return;
    }
    setProcesando(id);
    try {
      // Buscar la compra asociada a este producto para actualizar solo esa entrada
      const compraInfo = comprasMap[id];
      const uid = compraInfo?.uid;
      const compraId = compraInfo?.compraId;
      // marcar producto y compra como aceptado y asignar deliveryId
      const deliveryId = auth.currentUser ? auth.currentUser.uid : null;
      await updateProductoEstado(id, "aceptado");
      // Intentar obtener direcciones para persistir en la compra
      const compraUpdate = { estado: 'aceptado', deliveryId };
      const farmacia = farmacias.find(f => f.id === (productos.find(p=>p.id===id)?.farmaciaId));
  const usuarioCompra = compraInfo ? usuarios.find(u => u.id === compraInfo.uid) : null;
    // Preferir cache y campos de texto ya guardados en farmacia/usuario/compra
    const cached = addressMap[id] || {};
    // Preferir los campos textuales de farmacia / usuario primero (son más precisos)
    let farmaciaAddr = cached.farmaciaAddr || farmacia?.direccionFarmacia || farmacia?.direccion || farmacia?.direccionCompleta || compraInfo?.compra?.farmaciaDireccion || farmacia?.direccionString || null;
    let entregaAddr = cached.entregaAddr || usuarioCompra?.direccion || usuarioCompra?.direccionCompleta || usuarioCompra?.direccionEntrega || compraInfo?.compra?.direccionEntrega || usuarioCompra?.direccionString || null;
      // reverse geocode si hace falta
      if (!farmaciaAddr) {
        const farmLat = farmacia?.lat || farmacia?.latitud || farmacia?.latitude || farmacia?.longitud || farmacia?.lng;
        const farmLng = farmacia?.lng || farmacia?.longitud || farmacia?.longitude || farmacia?.longitud || farmacia?.lng;
        if (farmLat && farmLng) {
          farmaciaAddr = await reverseGeocode(farmLat, farmLng);
        }
      }
      if (!entregaAddr && usuarioCompra) {
        const userLat = usuarioCompra?.lat || usuarioCompra?.latitud || usuarioCompra?.latitude || usuarioCompra?.longitud || usuarioCompra?.lng;
        const userLng = usuarioCompra?.lng || usuarioCompra?.longitud || usuarioCompra?.longitude || usuarioCompra?.longitud || usuarioCompra?.lng;
        if (userLat && userLng) {
          entregaAddr = await reverseGeocode(userLat, userLng);
        }
      }
      if (farmaciaAddr) compraUpdate.farmaciaDireccion = farmaciaAddr;
      if (entregaAddr) compraUpdate.direccionEntrega = entregaAddr;
      if (uid && compraId) {
        await update(ref(db, `compras/${uid}/${compraId}`), compraUpdate);
      } else {
        // fallback: actualizar todas las compras asociadas al producto
        await updateCompraEstado(id, 'aceptado', compraUpdate);
      }
      setAcceptedOrderId(id);
      // abrir modal con direcciones
      setModalProductId(id);
    } catch (err) {
      console.error(err);
      alert("No se pudo aceptar el pedido. Por favor intenta de nuevo.");
    }
    setProcesando("");
  };

  // Handler para marcar pedido como entregado
  const handlePedidoEntregado = async (id) => {
    setProcesando(id);
    try {
      // actualizar compra específica si la tenemos
      const compraInfo = comprasMap[id];
      if (compraInfo && compraInfo.uid && compraInfo.compraId) {
        await update(ref(db, `compras/${compraInfo.uid}/${compraInfo.compraId}`), { estado: 'recibido' });
      } else {
        await updateCompraEstado(id, 'recibido');
      }
      await updateProductoEstado(id, "recibido");
      // liberar lock y cerrar modal
      if (acceptedOrderId === id) setAcceptedOrderId(null);
      if (modalProductId === id) setModalProductId(null);
    } catch (err) {
      console.error(err);
      alert("No se pudo actualizar el estado del pedido. Intenta nuevamente.");
    }
    setProcesando("");
  };

  // Handler para marcar pedido como DEVUELTO (cuando la farmacia cancela mientras el delivery lo tiene)
  const handlePedidoDevuelto = async (id) => {
    setProcesando(id);
    try {
      const compraInfo = comprasMap[id];
      // marcar la compra como 'devuelto' y el producto como 'devuelto'
      if (compraInfo && compraInfo.uid && compraInfo.compraId) {
        await update(ref(db, `compras/${compraInfo.uid}/${compraInfo.compraId}`), { estado: 'devuelto' });
      }
      await updateProductoEstado(id, 'devuelto');
      // limpiar estados locales
      if (acceptedOrderId === id) setAcceptedOrderId(null);
      if (modalProductId === id) setModalProductId(null);
      if (returnModalProductId === id) setReturnModalProductId(null);
    } catch (err) {
      console.error(err);
      alert('No se pudo marcar el pedido como devuelto. Intenta nuevamente.');
    }
    setProcesando('');
  };

  // Carga inicial de productos, farmacias y usuarios
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

    // Escuchar compras para mapear producto -> usuario que compró
    const comprasRef = ref(db, 'compras');
    const unsubscribeCompras = onValue(comprasRef, (snapshot) => {
      const data = snapshot.val() || {};
      const map = {};
      Object.entries(data).forEach(([uid, comprasUsuario]) => {
        if (!comprasUsuario) return;
        Object.entries(comprasUsuario).forEach(([compraId, compra]) => {
          if (compra && compra.productoId) {
            // Para cada producto guardamos la última compra activa (enviando/aceptado)
            map[compra.productoId] = { uid, compraId, compra };
          }
        });
      });
      setComprasMap(map);
    });

    const user = auth.currentUser;

    return () => {
      unsubscribeProductos();
      unsubscribeFarmacias();
      unsubscribeCompras();
  // no hay listener de dinero
    };
  }, []);

  // Calcula la distancia entre usuario y farmacia usando la API
  const distanciaPorCalles = async (usuario, farmacia, prodId) => {
    // Obtener coordenadas de usuario y farmacia en varios formatos posibles
    const userLat = usuario?.lat || usuario?.latitud || usuario?.latitude || usuario?.longitud;
    const userLng = usuario?.lng || usuario?.longitud || usuario?.longitude || usuario?.longitud;
    const farmLat = farmacia?.lat || farmacia?.latitud || farmacia?.latitude || farmacia?.longitud;
    const farmLng = farmacia?.lng || farmacia?.longitud || farmacia?.longitude || farmacia?.longitud;
    if (!userLat || !userLng || !farmLat || !farmLng) return;
    try {
      const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${openRouteApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [[farmLng, farmLat], [userLng, userLat]] })
      });
      const data = await response.json();
      const distancia =
        data?.features?.[0]?.properties?.segments?.[0]?.distance || null;
      setDistanciasApi((prev) => ({ ...prev, [prodId]: distancia }));
    } catch (error) {
      setDistanciasApi((prev) => ({ ...prev, [prodId]: null }));
    }
  };

  // Reverse geocode helper (Nominatim) - returns display_name or null
  const reverseGeocode = async (lat, lng) => {
    try {
      if (!lat || !lng) return null;
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.display_name || null;
    } catch (e) {
      return null;
    }
  };

  // Cuando se abre el modal, intentar obtener direcciones (farmacia y entrega).
  // Prioridad: compra.farmaciaDireccion / compra.direccionEntrega -> farmacia fields -> usuario fields -> cached -> reverseGeocode.
  // Importante: si en algún momento la compra/farmacia/usuario añade una dirección textual, la cache se sobrescribe para mostrar siempre la string ingresada.
  useEffect(() => {
    if (!modalProductId) return;
    (async () => {
      const prod = productos.find(p => p.id === modalProductId) || {};
      const compraInfo = comprasMap[modalProductId];
      const usuarioCompra = compraInfo ? usuarios.find(u => u.id === compraInfo.uid) : null;
      const farmacia = farmacias.find(f => f.id === prod.farmaciaId) || null;
      const key = modalProductId;
      const existing = addressMap[key] || {};

      // Primero, preferir cualquier campo textual ya presente en compra/farmacia/usuario
      let farmaciaAddr = compraInfo?.compra?.farmaciaDireccion || farmacia?.direccionFarmacia || farmacia?.direccion || farmacia?.direccionCompleta || farmacia?.direccionString || existing.farmaciaAddr || null;
      let entregaAddr = compraInfo?.compra?.direccionEntrega || usuarioCompra?.direccion || usuarioCompra?.direccionCompleta || usuarioCompra?.direccionEntrega || usuarioCompra?.direccionString || existing.entregaAddr || null;

      // Si todavía faltan, intentar reverse geocode desde lat/lng (solo entonces)
      if (!farmaciaAddr) {
        const farmLat = farmacia?.lat || farmacia?.latitud || farmacia?.latitude || farmacia?.longitud || farmacia?.lng;
        const farmLng = farmacia?.lng || farmacia?.longitud || farmacia?.longitude || farmacia?.longitud || farmacia?.lng;
        if (farmLat && farmLng) {
          try {
            farmaciaAddr = await reverseGeocode(farmLat, farmLng);
          } catch (e) {
            farmaciaAddr = existing.farmaciaAddr || null;
          }
        }
      }

      if (!entregaAddr && usuarioCompra) {
        const userLat = usuarioCompra?.lat || usuarioCompra?.latitud || usuarioCompra?.latitude || usuarioCompra?.longitud || usuarioCompra?.lng;
        const userLng = usuarioCompra?.lng || usuarioCompra?.longitud || usuarioCompra?.longitude || usuarioCompra?.longitud || usuarioCompra?.lng;
        if (userLat && userLng) {
          try {
            entregaAddr = await reverseGeocode(userLat, userLng);
          } catch (e) {
            entregaAddr = existing.entregaAddr || null;
          }
        }
      }

      // Si hay nueva información textual (desde compra/farmacia/usuario) la usamos y sobrescribimos la cache.
      setAddressMap(prev => ({ ...prev, [key]: { farmaciaAddr, entregaAddr } }));
    })();
  }, [modalProductId, productos, comprasMap, usuarios, farmacias, addressMap]);

  // Detectar si la compra asociada al pedido aceptado fue cancelada mientras el repartidor la tenía
  useEffect(() => {
    if (!acceptedOrderId) return;
    const compraInfo = comprasMap[acceptedOrderId];
    const estadoCompra = compraInfo?.compra?.estado;
    // Si la compra fue marcada como 'cancelado' mientras el repartidor la tenía, abrir modal de devolución
    if (estadoCompra === 'cancelado') {
      setReturnModalProductId(acceptedOrderId);
      // asegurarnos de cerrar el modal normal de entrega si estaba abierto
      if (modalProductId === acceptedOrderId) setModalProductId(null);
    }
  }, [comprasMap, acceptedOrderId, modalProductId]);

  // Calcular productos con farmacia, usuario y distancia antes del render
  const productosConDistancia = productos
    .map((prod) => {
      const farmacia = farmacias.find(f => f.id === prod.farmaciaId);
      const compraInfo = comprasMap[prod.id];
      const usuarioCompra = compraInfo ? usuarios.find(u => u.id === compraInfo.uid) : null;
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
      {/* Dinero acumulado: feature removed */}
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
                        <button onClick={() => handleAceptarPedido(prod.id)} disabled={procesando === prod.id || (acceptedOrderId && acceptedOrderId !== prod.id)} style={{ marginLeft: "10px" }}>
                          {procesando === prod.id ? "Procesando..." : (acceptedOrderId === prod.id ? "Pedido aceptado" : "Aceptar pedido")}
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
      {/* Modal simple para confirmar entrega y mostrar direcciones */}
      {modalProductId && (() => {
        const prod = productos.find(p => p.id === modalProductId) || {};
        const compraInfo = comprasMap[modalProductId];
        const usuarioCompra = compraInfo ? usuarios.find(u => u.id === compraInfo.uid) : null;
        const farmacia = farmacias.find(f => f.id === prod.farmaciaId) || null;
        const cached = addressMap[modalProductId] || {};
  let farmaciaDir = cached.farmaciaAddr || compraInfo?.compra?.farmaciaDireccion || farmacia?.direccionFarmacia || farmacia?.direccion || farmacia?.direccionCompleta || null;
  let entregaDir = cached.entregaAddr || compraInfo?.compra?.direccionEntrega || usuarioCompra?.direccion || usuarioCompra?.direccionCompleta || usuarioCompra?.direccionEntrega || null;
        // Si no hay dirección textual, pero hay lat/lng, mostrar lat/lng como fallback
        const farmLat = farmacia?.lat || farmacia?.latitud || farmacia?.latitude || farmacia?.longitud || farmacia?.lng || farmacia?.latFarmacia;
        const farmLng = farmacia?.lng || farmacia?.longitud || farmacia?.longitude || farmacia?.longitud || farmacia?.lng || farmacia?.lngFarmacia;
        const userLat = usuarioCompra?.lat || usuarioCompra?.latitud || usuarioCompra?.latitude || usuarioCompra?.longitud || usuarioCompra?.lng;
        const userLng = usuarioCompra?.lng || usuarioCompra?.longitud || usuarioCompra?.longitude || usuarioCompra?.longitud || usuarioCompra?.lng;
        if (!farmaciaDir) {
          if (farmLat && farmLng) farmaciaDir = `Lat: ${farmLat}, Lng: ${farmLng}`;
          else farmaciaDir = 'Dirección no disponible';
        }
        if (!entregaDir) {
          if (userLat && userLng) entregaDir = `Lat: ${userLat}, Lng: ${userLng}`;
          else entregaDir = 'Dirección de entrega no disponible';
        }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '520px' }}>
              <h3>Pedido aceptado</h3>
              <p><strong>Producto:</strong> {prod.nombre || compraInfo?.compra?.nombre || '-'}</p>
              <p><strong>Dirección farmacia:</strong> {farmaciaDir}</p>
              <p><strong>Dirección de entrega:</strong> {entregaDir}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => handlePedidoEntregado(modalProductId)} style={{ backgroundColor:'#4caf50', color:'#fff', padding:'8px 12px', border:'none', borderRadius:'6px' }}>Entregar</button>
                <button onClick={() => setModalProductId(null)} style={{ padding:'8px 12px', border:'1px solid #ccc', borderRadius:'6px' }}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Modal específico para devolución (cuando la compra fue cancelada por la farmacia mientras el delivery la tenía) */}
      {returnModalProductId && (() => {
        const id = returnModalProductId;
        const prod = productos.find(p => p.id === id) || {};
        const compraInfo = comprasMap[id];
        const usuarioCompra = compraInfo ? usuarios.find(u => u.id === compraInfo.uid) : null;
        const farmacia = farmacias.find(f => f.id === prod.farmaciaId) || null;
        const cached = addressMap[id] || {};
        let farmaciaDir = cached.farmaciaAddr || compraInfo?.compra?.farmaciaDireccion || farmacia?.direccionFarmacia || farmacia?.direccion || farmacia?.direccionCompleta || null;
        if (!farmaciaDir) {
          const farmLat = farmacia?.lat || farmacia?.latitud || farmacia?.latitude || farmacia?.longitud || farmacia?.lng || farmacia?.latFarmacia;
          const farmLng = farmacia?.lng || farmacia?.longitud || farmacia?.longitude || farmacia?.longitud || farmacia?.lng || farmacia?.lngFarmacia;
          if (farmLat && farmLng) farmaciaDir = `Lat: ${farmLat}, Lng: ${farmLng}`;
          else farmaciaDir = 'Dirección no disponible';
        }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '520px' }}>
              <h3>Pedido cancelado — Devolver</h3>
              <p>Tenés que devolverlo.</p>
              <p><strong>Producto:</strong> {prod.nombre || compraInfo?.compra?.nombre || '-'}</p>
              <p><strong>Dirección farmacia:</strong> {farmaciaDir}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => handlePedidoDevuelto(id)} disabled={procesando === id} style={{ backgroundColor:'#ff5722', color:'#fff', padding:'8px 12px', border:'none', borderRadius:'6px' }}>{procesando === id ? 'Procesando...' : 'Devuelto'}</button>
                <button onClick={() => setReturnModalProductId(null)} style={{ padding:'8px 12px', border:'1px solid #ccc', borderRadius:'6px' }}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default DistribuidorProductos;
