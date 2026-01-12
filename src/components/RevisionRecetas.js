/**
 * Componente para revisar recetas médicas pendientes en la farmacia.
 * Permite aprobar o rechazar recetas y notifica al usuario.
 *
 * No recibe props. Utiliza Firebase para obtener y actualizar recetas.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, update, push, get } from 'firebase/database';
import { db, auth } from '../firebase';
import { actualizarCompraAEnviandoPorProducto } from '../utils/firebaseUtils';


const RevisionRecetas = ({ embedded = false, onClose }) => {
  const [recetas, setRecetas] = useState([]);
  const [usuarios, setUsuarios] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [comentarioRechazo, setComentarioRechazo] = useState('');
  const [modalReceta, setModalReceta] = useState(null);
  const [userMap, setUserMap] = useState({}); // uid -> {nombre, email, telefono, ...}
  const enProcesoRef = useRef(new Set()); // evita doble click de acciones por receta

  const abrirModalReceta = (imagenBase64) => {
    setModalReceta(imagenBase64);
  };

  const cerrarModalReceta = () => setModalReceta(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    // Escucha recetas pendientes para esta farmacia
    const recetasRef = ref(db, 'recetas');
    const usuariosRef = ref(db, 'users');
    const unsubRecetas = onValue(recetasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, receta]) => ({ id, ...receta }))
          .filter(receta => receta.farmaciaId === user.uid && receta.estado === 'pendiente');
        setRecetas(lista);
      } else {
        setRecetas([]);
      }
    });
    const unsubUsuarios = onValue(usuariosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUsuarios(data);
      } else {
        setUsuarios({});
      }
    });
    return () => {
      unsubRecetas();
      unsubUsuarios();
    };
  }, []);

  // Fallback: refrescar cada 2 segundos por si el listener no dispara en el entorno
  useEffect(() => {
    let mounted = true;
    const intervalId = setInterval(async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await get(ref(db, 'recetas'));
        const data = snap.val();
        const lista = data
          ? Object.entries(data).map(([id, receta]) => ({ id, ...receta }))
              .filter(receta => receta.farmaciaId === uid && receta.estado === 'pendiente')
          : [];
        if (!mounted) return;
        setRecetas(prev => (prev.length !== lista.length ? lista : prev));
      } catch {}
    }, 2000);
    return () => { mounted = false; clearInterval(intervalId); };
  }, []);

  // Cargar datos de usuario para cada usuarioId involucrado en las recetas
  useEffect(() => {
    const uids = Array.from(new Set(recetas.map(r => r.usuarioId).filter(Boolean)));
    const missing = uids.filter(uid => !userMap[uid]);
    if (missing.length === 0) return;
    missing.forEach(async (uid) => {
      try {
        const info = await new Promise(resolve => {
          onValue(ref(db, `users/${uid}`), snap => resolve(snap.val()), { onlyOnce: true });
        });
        setUserMap(prev => ({ ...prev, [uid]: info || {} }));
      } catch (e) {
        console.warn('No se pudo obtener datos de usuario', uid, e);
        setUserMap(prev => ({ ...prev, [uid]: {} }));
      }
    });
  }, [recetas, userMap]);

  const renderUsuario = (uid) => {
    if (!uid) return '—';
    const info = userMap[uid];
    if (!info) return uid; // aún cargando
    const nombre = info.nombre || info.displayName || info.name;
    const email = info.email;
    const telefono = info.telefono || info.phone;
    if (nombre && email) return `${nombre} (${email})`;
    if (nombre) return nombre;
    if (email) return email;
    if (telefono) return telefono;
    return uid;
  };

  // Aprueba la receta y notifica al usuario
  const aprobarReceta = async (recetaId, productoId) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      // Marco la receta como aceptada
      await update(ref(db, `recetas/${recetaId}`), {
        estado: 'aceptada',
        fechaRevision: new Date().toISOString(),
        revisadoPor: user.uid
      });
      // Obtener datos de la receta para usuarioId
      const recetaSnapshot = await new Promise(resolve => {
        onValue(ref(db, `recetas/${recetaId}`), snapshot => resolve(snapshot.val()), { onlyOnce: true });
      });
      // Restar stock del producto
      const productoRef = ref(db, `productos/${productoId}`);
      const productoSnap = await new Promise(resolve => {
        onValue(productoRef, snapshot => resolve(snapshot.val()), { onlyOnce: true });
      });
      if (productoSnap && productoSnap.stock > 0) {
        await update(productoRef, { stock: productoSnap.stock - 1 });
      }
      // Actualiza la compra asociada a 'enviando' o crea una nueva si no existe
      if (recetaSnapshot && recetaSnapshot.usuarioId && productoId) {
        const comprasRef = ref(db, `compras/${recetaSnapshot.usuarioId}`);
        onValue(comprasRef, async (snapshot) => {
          const compras = snapshot.val();
          let compraExistente = false;
          if (compras) {
            Object.entries(compras).forEach(([compraId, compra]) => {
              if (compra.productoId === productoId && compra.estado === 'por_comprar') {
                update(ref(db, `compras/${recetaSnapshot.usuarioId}/${compraId}`), { estado: 'enviando' });
                compraExistente = true;
              }
            });
          }
          // Si no existe compra, crearla solo si hay stock
          if (!compraExistente && productoSnap && productoSnap.stock > 0) {
            await push(ref(db, `compras/${recetaSnapshot.usuarioId}`), {
              productoId: productoId,
              productoNombre: recetaSnapshot.productoNombre,
              farmaciaId: recetaSnapshot.farmaciaId,
              usuarioId: recetaSnapshot.usuarioId,
              estado: 'enviando',
              fecha: new Date().toISOString()
            });
          }
        }, { onlyOnce: true });
      }
      // Notifica al usuario
      if (recetaSnapshot) {
        await push(ref(db, `notificaciones/${recetaSnapshot.usuarioId}`), {
          tipo: 'receta_aceptada',
          mensaje: `Tu receta médica para ${recetaSnapshot.productoNombre} ha sido aprobada. Será procesada y puesta en envío.`,
          fecha: new Date().toISOString(),
          productoId: productoId
        });
      }

      // Si existe la receta, creamos la compra directamente para que el distribuidor la vea
      if (recetaSnapshot && recetaSnapshot.usuarioId) {
        // Obtengo datos actuales del producto para precio y stock
        const productoSnapshot = await new Promise(resolve => {
          onValue(ref(db, `productos/${productoId}`), snap => resolve(snap.val()), { onlyOnce: true });
        });

        const cantidad = recetaSnapshot.cantidad || 1;
        const precio = (productoSnapshot && productoSnapshot.precio) ? productoSnapshot.precio : 0;

        // Actualizo el producto: lo marco como "enviando", seteo fecha y reduzco stock
        const nuevoStock = Math.max(0, (productoSnapshot?.stock || 0) - cantidad);
        await update(ref(db, `productos/${productoId}`), {
          estado: 'enviando',
          recetaAprobada: true,
          fecha: Date.now(),
          stock: nuevoStock
        });

        // Creo la entrada de compra bajo el usuario que subió la receta
        const compraData = {
          productoId: productoId,
          nombre: recetaSnapshot.productoNombre || (productoSnapshot?.nombre || ''),
          cantidad,
          estado: 'enviando',
          precio,
          farmaciaId: user.uid,
          fecha: Date.now()
        };
        await push(ref(db, `compras/${recetaSnapshot.usuarioId}`), compraData);
      }
      setMensaje('Receta aprobada correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error(error);
      setMensaje('No se pudo aprobar la receta. Intenta nuevamente.');
    }
  };

  // Rechaza la receta y notifica al usuario
  const rechazarReceta = async (recetaId, productoId) => {
    if (enProcesoRef.current.has(recetaId)) return; // evitar doble ejecución
    if (!comentarioRechazo.trim()) {
      setMensaje('Por favor proporciona un motivo para el rechazo');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    try {
      enProcesoRef.current.add(recetaId);
      // Obtener datos de la receta para identificar usuario y cantidad
      const recetaSnapshot = await new Promise(resolve => {
        onValue(ref(db, `recetas/${recetaId}`), snapshot => resolve(snapshot.val()), { onlyOnce: true });
      });

      const usuarioId = recetaSnapshot?.usuarioId;
      const cantidad = recetaSnapshot?.cantidad || 1;
      const productoNombre = recetaSnapshot?.productoNombre || '';

      // Actualizar estado de la receta a rechazada con motivo
      await update(ref(db, `recetas/${recetaId}`), {
        estado: 'rechazada',
        fechaRevision: new Date().toISOString(),
        revisadoPor: user.uid,
        comentarioRechazo
      });
      // Obtener datos de la receta para usuarioId
      const recetaSnapshot = await new Promise(resolve => {
        onValue(ref(db, `recetas/${recetaId}`), snapshot => resolve(snapshot.val()), { onlyOnce: true });
      });
      // Actualiza la compra asociada a 'rechazada' usando el usuarioId del paciente
      if (recetaSnapshot && recetaSnapshot.usuarioId && productoId) {
        const comprasRef = ref(db, `compras/${recetaSnapshot.usuarioId}`);
        onValue(comprasRef, (snapshot) => {
          const compras = snapshot.val();
          if (compras) {
            Object.entries(compras).forEach(([compraId, compra]) => {
              if (compra.productoId === productoId && compra.estado === 'por_comprar') {
                update(ref(db, `compras/${recetaSnapshot.usuarioId}/${compraId}`), { estado: 'rechazada' });
              }
            });
          }
        }, { onlyOnce: true });
      }
      await push(ref(db, `notificaciones/${recetaSnapshot.usuarioId}`), {
        tipo: 'receta_rechazada',
        mensaje: `Tu receta médica para el producto ha sido rechazada. Motivo: ${comentarioRechazo}`,
        fecha: new Date().toISOString(),
        productoId: productoId
      });
      setMensaje('Receta rechazada correctamente');
      setComentarioRechazo('');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error(error);
      setMensaje('No se pudo rechazar la receta. Intenta nuevamente.');
    } finally {
      enProcesoRef.current.delete(recetaId);
    }
  };

  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '20px' }}>
      {!embedded && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <h2 style={{ margin:0 }}>Revisión de Recetas Médicas</h2>
          <button onClick={() => (typeof onClose === 'function' ? onClose() : navigate(-1))} style={{ padding:'6px 12px', background:'#007bff', color:'#fff', border:'none', borderRadius:4, cursor:'pointer' }}>Volver</button>
        </div>
      )}
      {mensaje && <p style={{ color: mensaje.includes('Error') ? 'red' : 'green' }}>{mensaje}</p>}
      {recetas.length === 0 ? (
        <p>No hay recetas pendientes.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
                <tr>
                  <th>Producto</th>
                  <th>Usuario</th>
                  <th>Fecha</th>
                  <th>Receta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
          <tbody>
            {recetas.map(receta => {
              const usuario = usuarios[receta.usuarioId];
              const nombreUsuario = usuario ? (usuario.nombre || usuario.displayName || usuario.email || receta.usuarioId) : receta.usuarioId;
              return (
                <tr key={receta.id}>
                  <td>{receta.productoNombre}</td>
                  <td>{nombreUsuario}</td>
                  <td>{receta.fechaSubida ? new Date(receta.fechaSubida).toLocaleString() : 'Sin fecha'}</td>
                  <td>
                    <button onClick={() => aprobarReceta(receta.id, receta.productoId)} style={{ marginRight: 8 }}>Aprobar</button>
                    <button onClick={() => eliminarReceta(receta.id)} style={{ marginRight: 8 }}>Eliminar</button>
                    <input
                      type="text"
                      placeholder="Motivo rechazo"
                      value={comentarioRechazo}
                      onChange={e => setComentarioRechazo(e.target.value)}
                      style={{ marginRight: 8 }}
                    />
                    <button onClick={() => rechazarReceta(receta.id, receta.productoId)} style={{ background: '#dc3545', color: '#fff' }}>Rechazar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {/* Modal para ver receta en tamaño completo */}
      {modalReceta && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={cerrarModalReceta}>
          <div style={{ maxWidth: '90%', maxHeight: '90%', background: '#fff', padding: 12, borderRadius: 8 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Receta médica</h4>
              <button onClick={cerrarModalReceta} style={{ marginLeft: 12 }}>Cerrar</button>
            </div>
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <img src={modalReceta} alt="Receta completa" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 6 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevisionRecetas;
