/**
 * Componente para mostrar la lista de productos disponibles.
 * Props:
 *   - productos: array de productos
 *   - onAgregar: función para agregar producto al carrito
 */

import React, { useEffect, useState, useCallback } from "react";
import { ref, onValue, push, update } from "firebase/database";
import { db, auth } from "../firebase";
import Carrito from "./Carrito";
import UploadRecetaSimple from "./UploadRecetaSimple";
import { isFarmaciaAbierta, getEstadoFarmacia } from '../utils/horariosUtils';

// Componente principal para mostrar y gestionar productos disponibles
const ListaProductos = ({ mostrarCarrito = true }) => {
  // Estado: compras pendientes por producto
  const [comprasPendientes, setComprasPendientes] = useState({});
  // Estado: lista de productos disponibles
  const [productos, setProductos] = useState([]);
  // Estado: filtro de búsqueda por nombre
  const [filtroNombre, setFiltroNombre] = useState("");
  // Estado: datos del usuario actual
  const [usuario, setUsuario] = useState(null);
  // Estado: distancias calculadas por producto
  const [distanciasApi, setDistanciasApi] = useState({});
  // API Key para OpenRouteService
  const openRouteApiKey = process.env.REACT_APP_OPENROUTE_API_KEY;
  // Estado: productos en el carrito
  const [carrito, setCarrito] = useState([]);
  const [notif, setNotif] = useState('');
  // Estado: cantidades seleccionadas por producto
  const [cantidades, setCantidades] = useState({});
  // Estado: mostrar modal de subida de receta
  const [mostrarUploadReceta, setMostrarUploadReceta] = useState(false);
  // Estado: producto seleccionado para receta
  const [productoParaReceta, setProductoParaReceta] = useState(null);
  // Estado: lista de farmacias disponibles
  const [farmacias, setFarmacias] = useState([]);

  useEffect(() => {
    // 1. Consultar todas las compras en estado 'enviando' para cada producto
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
    // 2. Obtener datos del usuario actual
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      onValue(userRef, (snapshot) => {
        setUsuario(snapshot.val());
      }, { onlyOnce: true });
    }
    // 3. Obtener productos
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
    // 4. Obtener farmacias
    const farmaciasRef = ref(db, "users");
    const unsubscribeFarmacias = onValue(farmaciasRef, (snapshot) => {
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
    // Limpieza de suscripciones
    return () => {
      unsubscribe();
      unsubscribeFarmacias();
    };
  }, []);

  // Eliminado handleComprar y referencias a setComprando y realizarCompra

  /**
   * Calcula la distancia entre usuario y farmacia usando la API de OpenRouteService
   * Guarda el resultado en el estado distanciasApi
   */
  const calcularDistanciaApi = useCallback(async (usuario, farmacia, productoId) => {
    if (!usuario || !farmacia || !usuario.latitud || !usuario.longitud || !farmacia.latitud || !farmacia.longitud) return null;
    if (distanciasApi[productoId] !== undefined) return;
    try {
      const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${openRouteApiKey}&start=${farmacia.longitud},${farmacia.latitud}&end=${usuario.longitud},${usuario.latitud}`);
      const data = await response.json();
      if (data && data.features && data.features[0] && data.features[0].properties && data.features[0].properties.summary) {
        const metros = data.features[0].properties.summary.distance;
        setDistanciasApi(prev => ({ ...prev, [productoId]: metros }));
      }
    } catch {
      setDistanciasApi(prev => ({ ...prev, [productoId]: null }));
    }
  }, [openRouteApiKey, distanciasApi]);

  // Calcular distancia entre usuario y farmacia
  // Distancia real usando lat/lng (Haversine)
  // función distancia eliminada (no se usa)

  // Agregar producto al carrito con cantidad
  /**
   * Agrega un producto al carrito con la cantidad seleccionada
   */
  const agregarProductoAlCarrito = useCallback((id) => {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;
    const cantidad = cantidades[id] ? parseInt(cantidades[id]) : 1;
    const stockDisponible = producto.stock;
    const idx = carrito.findIndex(p => p.id === id);
    const cantidadEnCarrito = idx >= 0 ? (carrito[idx].cantidad || 1) : 0;
    if (cantidad < 1 || (cantidad + cantidadEnCarrito) > stockDisponible) {
      alert(`No hay suficiente stock. Solo quedan ${stockDisponible - cantidadEnCarrito} unidades disponibles.`);
      return;
    }
    if (producto.requiereReceta) {
      setProductoParaReceta({ ...producto, cantidad });
      setMostrarUploadReceta(true);
      return;
    }
    if (idx >= 0) {
      const nuevoCarrito = [...carrito];
      nuevoCarrito[idx].cantidad = cantidadEnCarrito + cantidad;
      setCarrito(nuevoCarrito);
    } else {
      setCarrito([...carrito, { ...producto, cantidad }]);
    }
    setCantidades({ ...cantidades, [id]: 1 });
    // Notificación temporal de agregado (mostrar 5s más que antes)
    setNotif('Producto agregado al carrito. Podés completar la compra desde tu carrito.');
    setTimeout(() => setNotif(''), 7000);
  }, [productos, carrito, cantidades]);

  // Eliminar producto del carrito
  /**
   * Elimina un producto del carrito
   */
  const removerProductoDelCarrito = (id) => {
    setCarrito(carrito.filter(p => p.id !== id));
  };

  // Manejar completar upload de receta
  /**
   * Handler cuando se completa la subida de receta
   */
  const onRecetaSubida = useCallback((imagenURL) => {
    setMostrarUploadReceta(false);
    if (productoParaReceta) {
      const cantidad = productoParaReceta.cantidad || 1;
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
  }, [productoParaReceta, carrito, cantidades]);

  // Manejar cancelar upload de receta
  /**
   * Cancela la subida de receta y cierra el modal
   */
  const cancelarSubidaReceta = () => {
    setMostrarUploadReceta(false);
    setProductoParaReceta(null);
  };

  // Carrito: lógica de compra se gestiona en otro componente
  // Implementación local de compra por todos los items del carrito
  const handleComprar = async () => {
    const uid = auth.currentUser ? auth.currentUser.uid : null;
    if (!uid) {
      alert('Para comprar, primero tenés que iniciar sesión.');
      return;
    }
    if (carrito.length === 0) return;
    try {
      // Por cada producto en el carrito, crear una entrada en compras/<uid>
      for (const prod of carrito) {
        const compraRef = ref(db, `compras/${uid}`);
        await push(compraRef, {
          productoId: prod.id,
          nombre: prod.nombre,
          cantidad: prod.cantidad || 1,
          estado: 'enviando',
          precio: prod.precio,
          farmaciaId: prod.farmaciaId || prod.farmacia?.id || null,
          fecha: Date.now()
        });
  // Actualizar stock del producto en la BD y marcar la fecha de compra para el timer del delivery
  const nuevoStock = (typeof prod.stock === 'number' ? prod.stock : Number(prod.stock || 0)) - (prod.cantidad || 1);
  await update(ref(db, `productos/${prod.id}`), { stock: nuevoStock < 0 ? 0 : nuevoStock, estado: 'enviando', fecha: Date.now() });
      }
      // Limpiar carrito y notificar (mostrar 5s más que antes)
      setCarrito([]);
      setNotif('Compra realizada. Podés revisar el estado en Mis compras.');
      setTimeout(() => setNotif(''), 8000);
    } catch (err) {
      console.error(err);
      alert('No se pudo completar la compra. Intenta nuevamente en unos minutos.');
    }
  };

  /**
   * Formatea la distancia para mostrar en la tabla
   */
  function mostrarDistancia(dist) {
    if (dist === null || dist === undefined || isNaN(dist)) return "-";
    if (dist < 1000) return Math.round(dist) + " m";
    return (dist / 1000).toFixed(2) + " km";
  }


  /**
   * Filtra productos por nombre, asocia farmacia y calcula distancia
   */
  const productosFiltradosConDistancia = productos
    // proteger contra nombres undefined -> evitar crash al llamar toLowerCase
    .filter(prod => (prod && prod.nombre ? String(prod.nombre) : '').toLowerCase().includes(String(filtroNombre || '').toLowerCase()))
    .map(prod => {
      const farmacia = farmacias.find(f => f.id === prod.farmaciaId);
      if (farmacia && usuario && prod.id && distanciasApi[prod.id] === undefined) {
        calcularDistanciaApi(usuario, farmacia, prod.id);
      }
      return {
        ...prod,
        farmacia,
        distancia: distanciasApi[prod.id] !== undefined ? distanciasApi[prod.id] : null
      };
    })
    // ocultar productos sin stock
    .filter(prod => Number(prod.stock) > 0)
    .filter(prod => {
      if (!prod.farmacia) return false;
      return isFarmaciaAbierta(prod.farmacia.horarios);
    });

  // Ordenar productos filtrados por distancia (menor primero)
  productosFiltradosConDistancia.sort((a, b) => {
    if (a.distancia === null) return 1;
    if (b.distancia === null) return -1;
    return a.distancia - b.distancia;
  });

  // Render principal del componente
  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <h2>Productos disponibles</h2>
      {/* Filtro de búsqueda por nombre */}
      <input
        type="text"
        placeholder="Filtrar por nombre de medicamento"
        value={filtroNombre}
        onChange={e => setFiltroNombre(e.target.value)}
        style={{ marginBottom: "15px", width: "100%", padding: "8px" }}
      />
      {/* Carrito de compras */}
      {mostrarCarrito && (
        <Carrito carrito={carrito} onRemove={removerProductoDelCarrito} onComprar={handleComprar} />
      )}
      {notif && <div style={{ marginTop: '8px', padding: '8px', background: '#e9f7ef', color: '#155724', borderRadius: '6px' }}>{notif}</div>}
      {/* Tabla de productos filtrados */}
      {productosFiltradosConDistancia.length === 0 ? (
        // Si el usuario está aplicando un filtro de búsqueda y no hay resultados,
        // mostrar un mensaje amigable y una opción para limpiar el filtro.
        filtroNombre && String(filtroNombre).trim() !== "" ? (
          <div style={{ padding: '12px', background: '#fff3cd', color: '#856404', borderRadius: '6px' }}>
            <p style={{ margin: 0, fontWeight: '600' }}>No se encontró ningún resultado para tu búsqueda.</p>
            <p style={{ margin: '6px 0 0 0' }}>Probá con otra palabra, verificá la ortografía o sacá los filtros para ver todos los productos.</p>
            <button onClick={() => setFiltroNombre('')} style={{ marginTop: '8px' }}>Mostrar todos los productos</button>
          </div>
        ) : (
          <p>No hay productos cargados.</p>
        )
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
            {productosFiltradosConDistancia.map((prod) => {
              const estadoFarmacia = getEstadoFarmacia(prod.farmacia?.horarios);
              return (
                <tr key={prod.id}>
                  <td>{prod.nombre}</td>
                  <td>${prod.precio}</td>
                  <td>{prod.stock}</td>
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
                    {/* Permitir volver a comprar el mismo producto después de pagar: */}
                    {/* mostramos el control de cantidad y botón siempre que haya stock disponible */}
                    {Number(prod.stock) > 0 ? (
                      <>
                        <input
                          type="number"
                          min={1}
                          max={prod.stock}
                          value={cantidades[prod.id] || 1}
                          onChange={e => setCantidades({ ...cantidades, [prod.id]: e.target.value })}
                          style={{ width: "60px", marginRight: "8px" }}
                        />
                        <button onClick={() => agregarProductoAlCarrito(prod.id)}>
                          Agregar al carrito
                        </button>
                      </>
                    ) : (
                      <span style={{ color: '#888' }}>Sin stock</span>
                    )}
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
          onUploadComplete={onRecetaSubida}
          onCancel={cancelarSubidaReceta}
        />
      )}
    </div>
  );
};

export default ListaProductos;
