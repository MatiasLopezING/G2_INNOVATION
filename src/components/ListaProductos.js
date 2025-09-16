import React, { useEffect, useState } from "react";
import { ref, onValue, update, push } from "firebase/database";
import { db, auth } from "../firebase";

const ListaProductos = () => {
  const [productos, setProductos] = useState([]);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [comprando, setComprando] = useState("");
  const [distanciasApi, setDistanciasApi] = useState({});
  const openRouteApiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY5YjI1NzI1YmViMTQ1MWQ4OWVmYjhhM2E0YmJlM2NjIiwiaCI6Im11cm11cjY0In0=";

  useEffect(() => {
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
              <th>Distancia</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {productosConDistancia.map((prod) => (
              <tr key={prod.id}>
                <td>{prod.nombre}</td>
                <td>${prod.precio}</td>
                <td>{prod.stock}</td>
                <td>{prod.farmacia ? prod.farmacia.nombreFarmacia : prod.farmaciaId}</td>
                <td>{mostrarDistancia(prod.distancia)}</td>
                <td>{
                  prod.estado === "por_comprar" ? "Por comprar" :
                  prod.estado === "enviando" ? "Enviando" :
                  prod.estado === "recibido" ? "Recibido" : prod.estado
                }</td>
                <td>
                  {prod.estado === "por_comprar" ? (
                    <button onClick={() => handleComprar(prod.id)} disabled={comprando === prod.id}>
                      {comprando === prod.id ? "Comprando..." : "Comprar"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ListaProductos;
