/**
 * Componente principal para el panel del distribuidor.
 * Muestra productos, farmacias, usuarios y gestiona pedidos.
 * No recibe props.
 */

import React, { useEffect, useState } from "react";
import { ref, onValue, get, update } from "firebase/database";
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
  const [canReceiveWork, setCanReceiveWork] = useState(false);
  const [verifStatus, setVerifStatus] = useState(null); // 'accepted' | 'pendiente' | 'rejected' | null
  const [rejectionReason, setRejectionReason] = useState('');
  const [previousFront, setPreviousFront] = useState(null);
  const [previousBack, setPreviousBack] = useState(null);
  // Reintento verificación
  const [retryFrontFile, setRetryFrontFile] = useState(null);
  const [retryBackFile, setRetryBackFile] = useState(null);
  const [retryFrontPreview, setRetryFrontPreview] = useState(null);
  const [retryBackPreview, setRetryBackPreview] = useState(null);
  const [retryError, setRetryError] = useState('');
  const [retryMsg, setRetryMsg] = useState('');
  const [retryProcessing, setRetryProcessing] = useState(false);
  const [showRetryForm, setShowRetryForm] = useState(false);
  // Notificaciones dirigidas al distribuidor (aceptado / rechazado)
  const [deliveryNotifs, setDeliveryNotifs] = useState([]);
  const [lastNotifUpdate, setLastNotifUpdate] = useState(null);

  // Leer verificación del distribuidor actual y actualizar gating de trabajos
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const userRef = ref(db, `users/${u.uid}`);
    onValue(userRef, (snap) => {
      const data = snap.val() || {};
      const status = data?.deliveryVerification?.status || (data?.deliveryVerified ? 'accepted' : null);
      setVerifStatus(status);
      setCanReceiveWork(status === 'accepted');
      if (status === 'rejected') {
        setRejectionReason(data?.deliveryVerification?.message || 'Sin motivo proporcionado.');
        setPreviousFront(data?.deliveryVerification?.frente || null);
        setPreviousBack(data?.deliveryVerification?.reverso || null);
      } else {
        setRejectionReason('');
        setPreviousFront(null);
        setPreviousBack(null);
      }
    });
    return () => off(userRef);
  }, []);

  // Escuchar notificaciones del distribuidor para mostrar mensajes de farmacia
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const notifRef = ref(db, `notificaciones/${u.uid}`);
    onValue(notifRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, n]) => ({ id, ...n }))
        .filter(n => n.tipo === 'delivery_aceptado' || n.tipo === 'delivery_rechazado')
        .sort((a,b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      setDeliveryNotifs(list);
      setLastNotifUpdate(new Date());
    });
    return () => off(notifRef);
  }, []);

  // Utilidad convertir archivo a Base64 data URL
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } catch (e) { reject(e); }
  });

  const handleResubmitVerification = async (e) => {
    e.preventDefault();
    setRetryError(''); setRetryMsg('');
    if (!retryFrontFile || !retryBackFile) {
      setRetryError('Debes subir ambas imágenes (frente y reverso).');
      return;
    }
    const u = auth.currentUser;
    if (!u) {
      setRetryError('Sesión no válida. Vuelve a iniciar sesión.');
      return;
    }
    setRetryProcessing(true);
    try {
      const frenteB64 = await fileToDataUrl(retryFrontFile);
      const reversoB64 = await fileToDataUrl(retryBackFile);
      await update(ref(db, `users/${u.uid}`), {
        deliveryVerification: {
          status: 'pendiente',
            frente: frenteB64,
            reverso: reversoB64,
            fechaReintento: new Date().toISOString(),
            message: ''
        }
      });
      // Enviar notificación a todas las farmacias nuevamente
      const allUsersSnap = await get(ref(db, 'users'));
      const allUsers = allUsersSnap.val() || {};
      Object.entries(allUsers).forEach(([uidFarmacia, userObj]) => {
        if (userObj && userObj.role === 'Farmacia') {
          push(ref(db, `notificaciones/${uidFarmacia}`), {
            tipo: 'delivery_registro',
            deliveryUid: u.uid,
            deliveryEmail: (auth.currentUser.email || '').toLowerCase(),
            frente: frenteB64,
            reverso: reversoB64,
            fecha: Date.now(),
            estado: 'pendiente'
          }).catch(()=>{});
        }
      });
      setRetryMsg('Reintento enviado. Espera aprobación.');
      setShowRetryForm(false);
      setRetryFrontFile(null); setRetryBackFile(null);
      setRetryFrontPreview(null); setRetryBackPreview(null);
      setTimeout(()=> setRetryMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setRetryError('No se pudo enviar el reintento. Intenta nuevamente.');
    }
    setRetryProcessing(false);
  };

  // Timer solo para pedidos en estado 'enviando'
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
              const diff = Math.max(0, 600 - Math.floor((now - pedidoTime) / 1000));
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
      // Solo cancelar si el estado sigue siendo 'enviando' y el timer llegó a cero
      if (p.fecha && timers[p.id] === 0) {
        // Verifica el estado actual en la base de datos antes de eliminar
        const compraRef = ref(db, `compras/${p.usuarioId}/${p.id}`);
        const snap = await get(compraRef);
        const compraActual = snap.val();
        if (compraActual && compraActual.estado === "enviando") {
          // Actualiza el estado a 'cancelado' antes de eliminar para el historial
          await update(ref(db, `compras/${p.usuarioId}/${p.id}`), { estado: "cancelado" });
          await eliminarCompraYProducto(p.id);
        }
      }
    });
  }, [timers, productos]);
  // Handler para aceptar pedido
  const handleAceptarPedido = async (id) => {
    if (!canReceiveWork) {
      alert('Aún no estás aprobado por una farmacia. Podés iniciar sesión, pero no recibir pedidos hasta la aprobación.');
      return;
    }
    // no permitir aceptar si ya tenemos un pedido aceptado distinto
    if (acceptedOrderId && acceptedOrderId !== id) {
      alert('Ya tenés un pedido activo. Entregá ese pedido antes de aceptar otro.');
      return;
    }
    setProcesando(id);
    try {
      const user = auth.currentUser;
      // Buscar el producto en la lista actual
      const pedido = productos.find(p => p.id === id);
      if (pedido) {
        const { usuarioId } = pedido;
        // Actualizar solo la compra específica
        await update(ref(db, `compras/${usuarioId}/${id}`), { estado: "aceptado", deliveryId: user?.uid });
      }
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
      const user = auth.currentUser;
      const pedido = productos.find(p => p.id === id);
      if (pedido) {
        const { usuarioId } = pedido;
        await update(ref(db, `compras/${usuarioId}/${id}`), {
          estado: "recibido",
          fechaEntrega: new Date().toISOString(),
        });
      }
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
    // Consulta la tabla de productos para obtener los datos completos
    const productosRef = ref(db, "productos");
    let productosData = {};
    const unsubscribeProductos = onValue(productosRef, (snapshot) => {
      productosData = snapshot.val() || {};
    });

    // Ahora el delivery consulta la tabla de compras
    const comprasRef = ref(db, "compras");
    const unsubscribeCompras = onValue(comprasRef, (snapshot) => {
      const data = snapshot.val();
      let comprasFiltradas = [];
      const user = auth.currentUser;
      let pedidoAceptado = null;
      if (data) {
        Object.entries(data).forEach(([usuarioId, comprasUsuario]) => {
          Object.entries(comprasUsuario).forEach(([compraId, compra]) => {
            // Buscar datos completos del producto
            const productoInfo = productosData[compra.productoId] || {};
            // Combinar datos, asegurando que 'estado' de la compra tenga prioridad
            const datosCombinados = { id: compraId, usuarioId, ...productoInfo, ...compra };
            // Si el pedido está aceptado y lo aceptó el delivery actual, lo mostramos
            if (compra.estado === "aceptado" && compra.deliveryId === user?.uid) {
              pedidoAceptado = datosCombinados;
            }
            // Si el pedido está enviando y no hay pedido aceptado, lo mostramos
            if (compra.estado === "enviando" && !pedidoAceptado) {
              comprasFiltradas.push(datosCombinados);
            }
          });
        });
      }
      // Si hay pedido aceptado, solo mostramos ese
      setProductos(pedidoAceptado ? [pedidoAceptado] : comprasFiltradas);
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

    return () => {
      unsubscribeCompras();
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
      {verifStatus !== 'accepted' && (
        <div style={{ background:'#fff3cd', border:'1px solid #ffeeba', color:'#856404', padding:10, borderRadius:6, marginBottom:12 }}>
          {verifStatus === 'pendiente' && 'Tu registro está pendiente de aprobación por una farmacia. Podés navegar, pero no vas a recibir pedidos hasta que te aprueben.'}
          {verifStatus === 'rejected' && 'Tu registro fue rechazado. Podés reintentar enviando nuevamente las imágenes del documento.'}
          {!verifStatus && 'Aún no enviaste verificación. Envía tus imágenes para comenzar el proceso.'}
        </div>
      )}
      {deliveryNotifs.length > 0 && (
        <div style={{ background:'#e9f7ff', border:'1px solid #b6e2f9', padding:10, borderRadius:6, marginBottom:16 }}>
          <strong>Notificaciones de farmacia:</strong>
          <ul style={{ margin:'8px 0 0', paddingLeft:18 }}>
            {deliveryNotifs.slice(0,5).map(n => (
              <li key={n.id} style={{ fontSize:13 }}>
                {n.tipo === 'delivery_aceptado' && (
                  <span style={{ color:'#2e7d32' }}>✔ {n.mensaje || 'Aprobado'}</span>
                )}
                {n.tipo === 'delivery_rechazado' && (
                  <span style={{ color:'#c62828' }}>✖ {n.mensaje || 'Rechazado'}</span>
                )}
                {n.fecha && (
                  <span style={{ color:'#555', marginLeft:6 }}>
                    ({new Date(n.fecha).toLocaleString()})
                  </span>
                )}
              </li>
            ))}
          </ul>
          {deliveryNotifs.length > 5 && <div style={{ fontSize:11, color:'#555', marginTop:4 }}>Mostrando últimas 5. (Total {deliveryNotifs.length})</div>}
          {lastNotifUpdate && <div style={{ fontSize:10, color:'#777', marginTop:4 }}>Actualizado: {lastNotifUpdate.toLocaleTimeString()}</div>}
        </div>
      )}
      {(verifStatus === 'rejected' || !verifStatus || verifStatus === null) && (
        <div style={{ background:'#f8f9fa', border:'1px solid #ddd', padding:12, borderRadius:6, marginBottom:18 }}>
          {verifStatus === 'rejected' && rejectionReason && (
            <div style={{ marginBottom:10, background:'#ffe6e6', border:'1px solid #ffcccc', padding:8, borderRadius:4 }}>
              <strong>Motivo del rechazo:</strong> {rejectionReason}
            </div>
          )}
          {verifStatus === 'rejected' && (previousFront || previousBack) && (
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:10 }}>
              {previousFront && (
                <div style={{ textAlign:'center' }}>
                  <span style={{ fontSize:12 }}>Frente anterior</span>
                  <img src={previousFront} alt="Frente anterior" style={{ width:80, height:'auto', display:'block', marginTop:4, borderRadius:4, objectFit:'cover', border:'1px solid #ccc' }} />
                </div>
              )}
              {previousBack && (
                <div style={{ textAlign:'center' }}>
                  <span style={{ fontSize:12 }}>Reverso anterior</span>
                  <img src={previousBack} alt="Reverso anterior" style={{ width:80, height:'auto', display:'block', marginTop:4, borderRadius:4, objectFit:'cover', border:'1px solid #ccc' }} />
                </div>
              )}
            </div>
          )}
          {!showRetryForm && (
            <button onClick={() => { setShowRetryForm(true); setRetryError(''); }} style={{ padding:'8px 12px' }}>Enviar verificación</button>
          )}
          {showRetryForm && (
            <form onSubmit={handleResubmitVerification} style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
              <div>
                <label>Frente del documento:</label>
                <input type="file" accept="image/*" onChange={(e)=> {
                  const f = e.target.files && e.target.files[0];
                  if (f) { setRetryFrontFile(f); setRetryFrontPreview(URL.createObjectURL(f)); }
                }} />
                {retryFrontPreview && <img src={retryFrontPreview} alt="Frente" style={{ width:100, marginTop:6, borderRadius:4 }} />}
              </div>
              <div>
                <label>Reverso del documento:</label>
                <input type="file" accept="image/*" onChange={(e)=> {
                  const f = e.target.files && e.target.files[0];
                  if (f) { setRetryBackFile(f); setRetryBackPreview(URL.createObjectURL(f)); }
                }} />
                {retryBackPreview && <img src={retryBackPreview} alt="Reverso" style={{ width:100, marginTop:6, borderRadius:4 }} />}
              </div>
              {retryError && <div style={{ color:'red' }}>{retryError}</div>}
              {retryMsg && <div style={{ color:'green' }}>{retryMsg}</div>}
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" disabled={retryProcessing} style={{ background:'#007bff', color:'#fff', padding:'8px 12px' }}>{retryProcessing ? 'Enviando...' : 'Enviar reintento'}</button>
                <button type="button" onClick={() => { setShowRetryForm(false); setRetryFrontFile(null); setRetryBackFile(null); setRetryFrontPreview(null); setRetryBackPreview(null); }} style={{ padding:'8px 12px' }}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}
      {/* Dinero acumulado: feature removed */}
      {productos.length === 0 ? (
        <p>No hay productos en estado 'Enviando' o 'Aceptado'.</p>
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
                  {/* Estado ENVIANDO: mostrar timer y botón aceptar solo si no hay pedido aceptado */}
                  {prod.estado === "enviando" && timers[prod.id] !== null && (
                    <span style={{ color: timers[prod.id] <= 60 ? "red" : "black", fontWeight: "bold" }}>
                      {timers[prod.id] > 0
                        ? `Tiempo para aceptar: ${Math.floor(timers[prod.id] / 60)}:${(timers[prod.id] % 60).toString().padStart(2, "0")}`
                        : "Pedido cancelado por tiempo"}
                    </span>
                  )}
                  {prod.estado === "enviando" && timers[prod.id] > 0 && productos.length === 1 && (
                    <button onClick={() => handleAceptarPedido(prod.id)} disabled={procesando === prod.id} style={{ marginLeft: "10px" }}>
                      {procesando === prod.id ? "Procesando..." : "Aceptar pedido"}
                    </button>
                  )}
                  {/* Estado ACEPTADO: mostrar botón entregar solo si el delivery actual lo aceptó */}
                  {prod.estado === "aceptado" && (
                    <button onClick={() => handlePedidoEntregado(prod.id)} disabled={procesando === prod.id} style={{ marginLeft: "10px", backgroundColor: "#4caf50", color: "white" }}>
                      {procesando === prod.id ? "Procesando..." : "Pedido entregado"}
                    </button>
                  )}
                  {/* Estado CANCELADO: mensaje */}
                  {prod.estado === "cancelado" && (
                    <span style={{ color: "red", fontWeight: "bold" }}>Pedido cancelado</span>
                  )}
                  {/* Estado RECIBIDO: mensaje y hora de entrega */}
                  {prod.estado === "recibido" && (
                    <span style={{ color: "green", fontWeight: "bold" }}>
                      Pedido entregado<br />
                      {prod.fechaEntrega ? `Entregado: ${new Date(prod.fechaEntrega).toLocaleString()}` : null}
                    </span>
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
