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
import { getEstadoFarmacia } from '../utils/horariosUtils';
import { Input } from './ui/input';
import { Button as UiButton } from './ui/button';
import { Badge } from './ui/badge';
import { Alert as UiAlert } from './ui/alert';
import { cn } from '../lib/utils';

// Componente principal para mostrar y gestionar productos disponibles
const ListaProductos = ({
  mostrarCarrito = true,
  highlightedFarmaciaId = null,
  onHoverFarmaciaId,
  onCartCountChange,
}) => {
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
    // 1. Obtener datos del usuario actual
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

  // Exponer cantidad de items en carrito al contenedor (para badge del navbar)
  useEffect(() => {
    if (typeof onCartCountChange !== 'function') return;
    const count = carrito.reduce((sum, item) => sum + (Number(item.cantidad) || 1), 0);
    onCartCountChange(count);
  }, [carrito, onCartCountChange]);

  /**
   * Formatea la distancia para mostrar en la tabla
   */
  function mostrarDistancia(dist) {
    if (dist === null || dist === undefined || isNaN(dist)) return "—";
    const metros = Number(dist);
    if (metros < 1000) return `${Math.round(metros)} m`;
    const km = metros / 1000;
    if (km >= 10) return `${Math.round(km)} km`;
    return `${km.toFixed(1)} km`;
  }

  function formatearPrecioArs(value) {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(n);
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
      return true;
    });

  // Ordenar productos filtrados por distancia (menor primero)
  productosFiltradosConDistancia.sort((a, b) => {
    if (a.distancia === null) return 1;
    if (b.distancia === null) return -1;
    return a.distancia - b.distancia;
  });

  // Render principal del componente
  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Productos cerca tuyo</h2>
          <p className="text-sm text-slate-500">
            {productosFiltradosConDistancia.length} resultado{productosFiltradosConDistancia.length === 1 ? '' : 's'}
          </p>
        </div>

        <Input
          type="text"
          placeholder="Buscar medicamento"
          value={filtroNombre}
          onChange={e => setFiltroNombre(e.target.value)}
        />

        {mostrarCarrito && (
          <Carrito carrito={carrito} onRemove={removerProductoDelCarrito} onComprar={handleComprar} />
        )}
        {notif && <UiAlert variant="success">{notif}</UiAlert>}
      </header>

      {productosFiltradosConDistancia.length === 0 ? (
        filtroNombre && String(filtroNombre).trim() !== "" ? (
          <UiAlert variant="default">
            <div className="space-y-2">
              <div className="font-semibold">No se encontraron resultados.</div>
              <div className="text-slate-600">Probá con otra palabra o limpiá la búsqueda.</div>
              <UiButton type="button" variant="outline" size="sm" onClick={() => setFiltroNombre('')}>
                Mostrar todos
              </UiButton>
            </div>
          </UiAlert>
        ) : (
          <UiAlert variant="default">No hay productos cargados.</UiAlert>
        )
      ) : (
        <div className="space-y-3">
          {productosFiltradosConDistancia.map((prod) => {
            const estadoFarmacia = getEstadoFarmacia(prod.farmacia?.horarios);
            const active = highlightedFarmaciaId && String(highlightedFarmaciaId) === String(prod.farmaciaId);

            return (
              <div
                key={prod.id}
                onMouseEnter={() => onHoverFarmaciaId && onHoverFarmaciaId(prod.farmaciaId)}
                onMouseLeave={() => onHoverFarmaciaId && onHoverFarmaciaId(null)}
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm transition',
                  'hover:shadow-md',
                  active ? 'border-teal-300 ring-1 ring-teal-200' : 'border-slate-200'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-slate-900 truncate">{prod.nombre}</div>
                    <div className="mt-1 text-sm text-slate-500 truncate">
                      <span className="text-slate-400">🏥</span>{' '}
                      {prod.farmacia ? (prod.farmacia.nombreFarmacia || 'Farmacia') : (prod.farmaciaId || 'Farmacia')}
                    </div>
                  </div>
                  <div className="shrink-0 text-lg font-semibold text-slate-900">
                    {formatearPrecioArs(prod.precio)}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={estadoFarmacia.abierta ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>
                    {estadoFarmacia.abierta ? '● Abierto ahora' : '● Cerrado'}
                  </Badge>
                  {prod.requiereReceta && (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700">📄 Receta</Badge>
                  )}
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                    <span className="text-slate-400">📍</span> a {mostrarDistancia(prod.distancia)}
                  </Badge>
                </div>

                {!estadoFarmacia.abierta && estadoFarmacia.mensaje && (
                  <div className="mt-2 text-xs text-slate-500">{estadoFarmacia.mensaje}</div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={prod.stock}
                      value={cantidades[prod.id] || 1}
                      onChange={e => setCantidades({ ...cantidades, [prod.id]: e.target.value })}
                      className="w-20"
                    />
                    <div className="text-xs text-slate-500">Stock: {prod.stock}</div>
                  </div>

                  <UiButton type="button" onClick={() => agregarProductoAlCarrito(prod.id)}>
                    Agregar
                  </UiButton>
                </div>
              </div>
            );
          })}
        </div>
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
