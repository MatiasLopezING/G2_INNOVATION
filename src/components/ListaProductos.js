/**
 * Componente para mostrar la lista de productos disponibles.
 * Props:
 *   - productos: array de productos
 *   - onAgregar: función para agregar producto al carrito
 */

import React, { useEffect, useState, useCallback } from "react";
import { ref, onValue } from "firebase/database";
import { db, auth } from "../firebase";
import Carrito from "./Carrito";
import UploadRecetaSimple from "./UploadRecetaSimple";
import { isFarmaciaAbierta, getEstadoFarmacia } from '../utils/horariosUtils';

// Componente principal para mostrar y gestionar productos disponibles
const ListaProductos = ({ mostrarCarrito = true }) => {
  // Estado: lista de productos disponibles
  // Estado: mensaje de compra exitosa
  const [mensajeCompra, setMensajeCompra] = useState("");
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
  // Estado: cantidades seleccionadas por producto
  const [cantidades, setCantidades] = useState({});
  // Estado: mostrar modal de subida de receta
  const [mostrarUploadReceta, setMostrarUploadReceta] = useState(false);
  // Estado: producto seleccionado para receta
  const [productoParaReceta, setProductoParaReceta] = useState(null);
  // Estado: lista de farmacias disponibles
  const [farmacias, setFarmacias] = useState([]);
  const [mensajes, setMensajes] = useState({}); // Para cada compra, el campo de texto se vincula a mensajes[compraId]

  useEffect(() => {
    // Obtener datos del usuario actual
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      onValue(userRef, (snapshot) => {
        setUsuario(snapshot.val());
      });
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
    // Obtener farmacias
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
  }, [openRouteApiKey]);

  // Calcular distancia entre usuario y farmacia
  // Distancia real usando lat/lng (Haversine)
  // función distancia eliminada (no se usa)


  // Función auxiliar para insertar productos en el carrito (con o sin receta)
  const insertarEnCarrito = (producto, cantidad, recetaData = null) => {
    const idx = carrito.findIndex(p => p.id === producto.id);
    let nuevoCarrito = [...carrito];
    if (idx >= 0) {
      nuevoCarrito[idx].cantidad = (nuevoCarrito[idx].cantidad || 1) + cantidad;
      if (recetaData) {
        nuevoCarrito[idx].recetaSubida = true;
        nuevoCarrito[idx].recetaURL = recetaData.imagenURL;
        nuevoCarrito[idx].recetaId = recetaData.recetaId;
      }
    } else {
      nuevoCarrito.push({
        ...producto,
        cantidad,
        ...(recetaData ? {
          recetaSubida: true,
          recetaURL: recetaData.imagenURL,
          recetaId: recetaData.recetaId
        } : {})
      });
    }
    setCarrito(nuevoCarrito);
    setCantidades({ ...cantidades, [producto.id]: 1 });
  };

  // Agregar producto al carrito con cantidad
  const agregarProductoAlCarrito = useCallback((id) => {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;
    const cantidad = cantidades[id] ? parseInt(cantidades[id]) : 1;
    const stockDisponible = producto.stock;
    const idx = carrito.findIndex(p => p.id === id);
    const cantidadEnCarrito = idx >= 0 ? (carrito[idx].cantidad || 1) : 0;
    if (cantidad < 1 || (cantidad + cantidadEnCarrito) > stockDisponible) {
      alert(`No puedes agregar ${cantidad} unidades. Stock disponible: ${stockDisponible - cantidadEnCarrito}`);
      return;
    }
    if (producto.requiereReceta) {
      setProductoParaReceta({ ...producto, cantidad });
      setMostrarUploadReceta(true);
      return;
    }
    insertarEnCarrito(producto, cantidad);
  }, [productos, carrito, cantidades]);

  // Eliminar producto del carrito
  const removerProductoDelCarrito = (id) => {
    setCarrito(carrito.filter(p => p.id !== id));
  };

  // Manejar completar upload de receta
  const onRecetaSubida = useCallback((imagenURL, recetaId) => {
    setMostrarUploadReceta(false);
    if (productoParaReceta) {
      const cantidad = productoParaReceta.cantidad || 1;
      insertarEnCarrito(productoParaReceta, cantidad, { imagenURL, recetaId });
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


  // Función comprarTodoCarrito (dummy, debe implementarse según lógica de compra)
  const comprarTodoCarrito = () => {
    // Aquí iría la lógica para procesar la compra de todos los productos del carrito
    // Por ahora solo muestra mensaje de éxito y limpia el carrito
    setMensajeCompra("¡Compra realizada con éxito!");
    setCarrito([]);
    setTimeout(() => setMensajeCompra(""), 3000);
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
    .filter(prod => prod.nombre.toLowerCase().includes(filtroNombre.toLowerCase()))
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
      <Carrito
        carrito={carrito}
        onRemove={removerProductoDelCarrito}
        onComprar={async () => {
          // Ejecuta la lógica real de compra del carrito
          // handleComprar está definido dentro de Carrito.js, así que llamamos el método del componente
          // Usamos un ref para acceder a la función interna
          // Alternativamente, movemos la lógica aquí:
          const userId = (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
          for (const prod of carrito) {
            if (prod.recetaSubida && prod.recetaId) {
              // Actualiza receta si corresponde
              const { actualizarEstadoReceta, ESTADOS_RECETA } = await import("../utils/firebaseUtils");
              await actualizarEstadoReceta(prod.recetaId, ESTADOS_RECETA.PENDIENTE);
            }
            if (userId && prod.id) {
              const { db } = await import("../firebase");
              const { ref, push, update } = await import("firebase/database");
              const compra = {
                productoId: prod.id,
                productoNombre: prod.nombre,
                farmaciaId: prod.farmaciaId,
                cantidad: prod.cantidad || 1,
                precio: prod.precio,
                estado: 'por_comprar',
                fecha: new Date().toISOString(),
                requiereReceta: !!prod.requiereReceta,
                recetaId: prod.recetaId || null,
                recetaURL: prod.recetaURL || null
              };
              await push(ref(db, `compras/${userId}`), compra);
              // Actualiza el stock en productos
              const nuevoStock = Math.max(0, (prod.stock || 0) - (prod.cantidad || 1));
              await update(ref(db, `productos/${prod.id}`), { stock: nuevoStock });
            }
          }
          setMensajeCompra("¡Compra realizada con éxito!");
          setCarrito([]);
          setTimeout(() => setMensajeCompra("") , 3000);
        }}
      />
    )}
    {/* Mensaje de compra */}
    {mensajeCompra && (
      <div style={{ background: '#d4edda', color: '#155724', padding: '10px', borderRadius: '5px', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold' }}>
        {mensajeCompra}
      </div>
    )}
    {/* Tabla de productos filtrados */}
    {productosFiltradosConDistancia.length === 0 ? (
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
                  {prod.estado === "por_comprar" ? (
                    <React.Fragment>
                      <input
                        type="number"
                        min={1}
                        max={prod.stock}
                        value={cantidades[prod.id] || 1}
                        onChange={e => setCantidades({ ...cantidades, [prod.id]: e.target.value })}
                        style={{ width: "60px", marginRight: "8px" }}
                      />
                      <button
                        onClick={() => agregarProductoAlCarrito(prod.id)}
                        disabled={prod.stock < 1}
                        style={{
                          background: prod.stock < 1 ? "#ccc" : undefined,
                          color: prod.stock < 1 ? "#888" : undefined,
                          cursor: prod.stock < 1 ? "not-allowed" : undefined
                        }}
                      >
                        Agregar al carrito
                      </button>
                    </React.Fragment>
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
        onUploadComplete={onRecetaSubida}
        onCancel={cancelarSubidaReceta}
      />
    )}
  </div>
  );
};

export default ListaProductos;
