import React, { useEffect, useState } from "react";
import { ref, onValue, update, push } from "firebase/database";
import { db, auth } from "../firebase";
import Carrito from "./Carrito";
import UploadRecetaSimple from "./UploadRecetaSimple";
import { isFarmaciaAbierta, getEstadoFarmacia, debugHorarios } from '../utils/horariosUtils';

const ListaProductos = ({ mostrarCarrito = true }) => {
  const [comprasPendientes, setComprasPendientes] = useState({});
  const [productos, setProductos] = useState([]);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [comprando, setComprando] = useState("");
  const [distanciasApi, setDistanciasApi] = useState({});
  const openRouteApiKey = process.env.REACT_APP_OPENROUTE_API_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY5YjI1NzI1YmViMTQ1MWQ4OWVmYjhhM2E0YmJlM2NjIiwiaCI6Im11cm11cjY0In0=";
  const [carrito, setCarrito] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [mostrarUploadReceta, setMostrarUploadReceta] = useState(false);
  const [productoParaReceta, setProductoParaReceta] = useState(null);

  useEffect(() => {
    // Consultar todas las compras en estado 'enviando' para cada producto
    const comprasRef = ref(db, "compras");
    onValue(comprasRef, (snapshot) => {
      const data = snapshot.val();
      const pendientes = {};
      if (data) {
        Object.values(data).forEach(usuarioCompras => {
          Object.values(usuarioCompras).forEach(compra => {
            if (compra.estado === "enviando") {
              pendientes[compra.productoId] = (pendientes[compra.productoId] || 0) + (compra.cantidad || 1);
            }
          });
        });
      }
      setComprasPendientes(pendientes);
    });
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
    // Buscar farmacia asociada al producto
    const farmacia = farmacias.find(f => f.id === producto.farmaciaId);
    let precioFinal = Number(producto.precio);
    // Si obra social del usuario coincide con la aceptada por la farmacia, aplicar descuento
    if (
      usuario && farmacia && usuario.obraSocial && farmacia.obraSocial &&
      usuario.obraSocial.trim().toLowerCase() === farmacia.obraSocial.trim().toLowerCase()
    ) {
      precioFinal = precioFinal * 0.9;
    }
    try {
      // Cambiar estado del producto a 'enviando'
      await update(ref(db, `productos/${id}`), { estado: "enviando" });
      // Guardar la compra en el nodo 'compras' del usuario
      await push(ref(db, `compras/${user.uid}`), {
        productoId: id,
        nombre: producto.nombre,
        precio: precioFinal,
        estado: "enviando",
        fecha: new Date().toISOString(),
        farmaciaId: producto.farmaciaId
      });
    } catch (err) {
      alert("Error al comprar: " + err.message);
    }
    setComprando("");
  };

  async function distanciaPorCalles(u, f, prodId) {
    if (!u || !f || !u.latitud || !u.longitud || !f.latitud || !f.longitud) return null;
    try {
      const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${openRouteApiKey}&start=${f.longitud},${f.latitud}&end=${u.longitud},${u.latitud}`);
      const data = await response.json();
      if (data && data.features && data.features[0] && data.features[0].properties && data.features[0].properties.summary) {
        const metros = data.features[0].properties.summary.distance;
        setDistanciasApi(prev => ({ ...prev, [prodId]: metros }));
      }
    } catch {
      setDistanciasApi(prev => ({ ...prev, [prodId]: null }));
    }
  }

  // Calcular distancia entre usuario y farmacia
  // Distancia real usando lat/lng (Haversine)
  function distancia(u, f) {
    if (!u || !f || !u.latitud || !u.longitud || !f.latitud || !f.longitud) return Infinity;
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371000; // Radio de la Tierra en metros
    const lat1 = toRad(Number(u.latitud));
    const lon1 = toRad(Number(u.longitud));
    const lat2 = toRad(Number(f.latitud));
    const lon2 = toRad(Number(f.longitud));
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Agregar producto al carrito con cantidad
  const handleAgregarCarrito = (id) => {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;
    
    const cantidad = cantidades[id] ? parseInt(cantidades[id]) : 1;
    // Calcular stock disponible
    const pendientes = comprasPendientes[id] || 0;
    const stockDisponible = producto.stock - pendientes;
    // Si ya está en el carrito, sumar la cantidad total que tendría
    const idx = carrito.findIndex(p => p.id === id);
    const cantidadEnCarrito = idx >= 0 ? (carrito[idx].cantidad || 1) : 0;
    if (cantidad < 1 || (cantidad + cantidadEnCarrito) > stockDisponible) {
      alert(`No puedes agregar ${cantidad} unidades. Stock disponible: ${stockDisponible - cantidadEnCarrito}`);
      return;
    }
    
    // Si requiere receta, mostrar modal de upload
    if (producto.requiereReceta) {
      setProductoParaReceta({ ...producto, cantidad });
      setMostrarUploadReceta(true);
      return;
    }
    
    // Si ya está en el carrito, suma la cantidad
    if (idx >= 0) {
      const nuevoCarrito = [...carrito];
      nuevoCarrito[idx].cantidad = cantidadEnCarrito + cantidad;
      setCarrito(nuevoCarrito);
    } else {
      setCarrito([...carrito, { ...producto, cantidad }]);
    }
    setCantidades({ ...cantidades, [id]: 1 });
  };

  // Eliminar producto del carrito
  const handleRemoveCarrito = (id) => {
    setCarrito(carrito.filter(p => p.id !== id));
  };

  // Manejar completar upload de receta
  const handleRecetaCompletada = (imagenURL) => {
    setMostrarUploadReceta(false);
    
    // Agregar producto al carrito después de subir receta
    if (productoParaReceta) {
      const cantidad = productoParaReceta.cantidad || 1;
      
      // Verificar si ya está en el carrito
      const idx = carrito.findIndex(p => p.id === productoParaReceta.id);
      if (idx >= 0) {
        const nuevoCarrito = [...carrito];
        nuevoCarrito[idx].cantidad = (nuevoCarrito[idx].cantidad || 1) + cantidad;
        setCarrito(nuevoCarrito);
      } else {
        setCarrito([...carrito, { 
          ...productoParaReceta, 
          cantidad,
          recetaSubida: true,
          recetaURL: imagenURL
        }]);
      }
      
      setCantidades({ ...cantidades, [productoParaReceta.id]: 1 });
    }
    
    setProductoParaReceta(null);
  };

  // Manejar cancelar upload de receta
  const handleCancelarReceta = () => {
    setMostrarUploadReceta(false);
    setProductoParaReceta(null);
  };

  // Comprar todos los productos del carrito
  const handleComprarCarrito = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Debes iniciar sesión para comprar.");
      return;
    }
    setComprando("carrito");
    try {
      for (const producto of carrito) {
        // Buscar farmacia asociada al producto
        const farmacia = farmacias.find(f => f.id === producto.farmaciaId);
        let precioFinal = Number(producto.precio);
        if (
          usuario && farmacia && usuario.obraSocial && farmacia.obraSocial &&
          usuario.obraSocial.trim().toLowerCase() === farmacia.obraSocial.trim().toLowerCase()
        ) {
          precioFinal = precioFinal * 0.9;
        }
        // Cambiar estado del producto a 'enviando'
        await update(ref(db, `productos/${producto.id}`), { estado: "enviando" });
        // Guardar la compra en el nodo 'compras' del usuario
        await push(ref(db, `compras/${user.uid}`), {
          productoId: producto.id,
          nombre: producto.nombre,
          precio: precioFinal,
          cantidad: producto.cantidad || 1,
          estado: "enviando",
          fecha: new Date().toISOString(),
          farmaciaId: producto.farmaciaId
        });
      }
      setCarrito([]);
      alert("¡Compra realizada!");
    } catch (err) {
      alert("Error al comprar: " + err.message);
    }
    setComprando("");
  };

  function mostrarDistancia(dist) {
    if (dist === null || dist === undefined || isNaN(dist)) return "-";
    if (dist < 1000) return Math.round(dist) + " m";
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
  const productosConDistancia = productos
    .filter(prod => prod.nombre.toLowerCase().includes(filtroNombre.toLowerCase()))
    .map(prod => {
      const farmacia = farmacias.find(f => f.id === prod.farmaciaId);
      if (farmacia && usuario && prod.id && distanciasApi[prod.id] === undefined) {
        distanciaPorCalles(usuario, farmacia, prod.id);
      }
      return {
        ...prod,
        farmacia,
        distancia: distanciasApi[prod.id] !== undefined ? distanciasApi[prod.id] : null
      };
    })
    .filter(prod => {
      // Filtrar productos de farmacias cerradas
      if (!prod.farmacia) {
        console.log(`Producto ${prod.nombre} sin farmacia asociada`);
        return false;
      }
      
      const estaAbierta = isFarmaciaAbierta(prod.farmacia.horarios);
      console.log(`Farmacia ${prod.farmacia.nombreFarmacia} para producto ${prod.nombre}:`, estaAbierta);
      if (!estaAbierta) {
        debugHorarios(prod.farmacia.horarios);
      }
      
      return estaAbierta;
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
      <input
        type="text"
        placeholder="Filtrar por nombre de medicamento"
        value={filtroNombre}
        onChange={e => setFiltroNombre(e.target.value)}
        style={{ marginBottom: "15px", width: "100%", padding: "8px" }}
      />
      {mostrarCarrito && (
        <Carrito carrito={carrito} onRemove={handleRemoveCarrito} onComprar={handleComprarCarrito} />
      )}
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
              <th>Estado Farmacia</th>
              <th>Receta</th>
              <th>Distancia</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {productosConDistancia.map((prod) => {
              const estadoFarmacia = getEstadoFarmacia(prod.farmacia?.horarios);
              return (
                <tr key={prod.id}>
                  <td>{prod.nombre}</td>
                  <td>${prod.precio}</td>
                  <td>{prod.stock - (comprasPendientes[prod.id] || 0)}</td>
                  <td>{prod.farmacia ? prod.farmacia.nombreFarmacia : prod.farmaciaId}</td>
                  <td>
                    <span style={{
                      color: estadoFarmacia.abierta ? '#28a745' : '#dc3545',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {estadoFarmacia.abierta ? '🟢 Abierta' : '🔴 Cerrada'}
                    </span>
                    {!estadoFarmacia.abierta && (
                      <div style={{ fontSize: '10px', color: '#666' }}>
                        {estadoFarmacia.mensaje}
                      </div>
                    )}
                  </td>
                  <td>
                    {prod.requiereReceta ? (
                      <span style={{
                        backgroundColor: '#ffc107',
                        color: '#856404',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        📋 Receta
                      </span>
                    ) : (
                      <span style={{ color: '#6c757d', fontSize: '12px' }}>-</span>
                    )}
                  </td>
                  <td>{mostrarDistancia(prod.distancia)}</td>
                  <td>{
                    prod.estado === "por_comprar" ? "Por comprar" :
                    prod.estado === "enviando" ? "Enviando" :
                    prod.estado === "recibido" ? "Recibido" : prod.estado
                  }</td>
                <td>
                  {prod.estado === "por_comprar" ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={prod.stock}
                        value={cantidades[prod.id] || 1}
                        onChange={e => setCantidades({ ...cantidades, [prod.id]: e.target.value })}
                        style={{ width: "60px", marginRight: "8px" }}
                      />
                      <button onClick={() => handleAgregarCarrito(prod.id)}>
                        Agregar al carrito
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Modal para subir receta médica */}
      {mostrarUploadReceta && productoParaReceta && (
        <UploadRecetaSimple
          producto={productoParaReceta}
          farmaciaId={productoParaReceta.farmaciaId}
          onUploadComplete={handleRecetaCompletada}
          onCancel={handleCancelarReceta}
        />
      )}
    </div>
  );
};

export default ListaProductos;
