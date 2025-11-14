/**
 * Componente para revisar recetas médicas pendientes en la farmacia.
 * Permite aprobar o rechazar recetas y notifica al usuario.
 *
 * No recibe props. Utiliza Firebase para obtener y actualizar recetas.
 */
import React, { useEffect, useState } from 'react';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { db, auth } from '../firebase';

const RevisionRecetas = () => {
  const [recetas, setRecetas] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [comentarioRechazo, setComentarioRechazo] = useState('');
  const [modalReceta, setModalReceta] = useState(null);

  const abrirModalReceta = (imagenBase64) => {
    setModalReceta(imagenBase64);
  };

  const cerrarModalReceta = () => setModalReceta(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    // Escucha recetas pendientes para esta farmacia
    const recetasRef = ref(db, 'recetas');
    const unsubscribe = onValue(recetasRef, (snapshot) => {
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
    return () => unsubscribe();
  }, []);

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

      // Obtengo la receta para usar su información (usuario, cantidad, nombre)
      const recetaSnapshot = await new Promise(resolve => {
        onValue(ref(db, `recetas/${recetaId}`), snapshot => resolve(snapshot.val()), { onlyOnce: true });
      });

      // Notifico al usuario que la receta fue aceptada
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
    if (!comentarioRechazo.trim()) {
      setMensaje('Por favor proporciona un motivo para el rechazo');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    try {
      await update(ref(db, `recetas/${recetaId}`), {
        estado: 'rechazada',
        fechaRevision: new Date().toISOString(),
        revisadoPor: user.uid,
        comentarioRechazo
      });
      await push(ref(db, `notificaciones/${recetaId}`), {
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
    }
  };

  // Elimina receta
  const eliminarReceta = async (recetaId) => {
    try {
      await remove(ref(db, `recetas/${recetaId}`));
      setMensaje('Receta eliminada');
      setTimeout(() => setMensaje(''), 2000);
    } catch (error) {
      console.error(error);
      setMensaje('No se pudo eliminar la receta. Intenta nuevamente.');
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: 'auto', padding: '20px' }}>
      <h2>Revisión de Recetas Médicas</h2>
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
            {recetas.map(receta => (
              <tr key={receta.id}>
                <td>{receta.productoNombre}</td>
                <td>{receta.usuarioId}</td>
                <td>{receta.fechaSubida ? new Date(receta.fechaSubida).toLocaleString() : 'Sin fecha'}</td>
                <td style={{ textAlign: 'center' }}>
                  {receta.imagenBase64 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img
                        src={receta.imagenBase64}
                        alt="Receta"
                        onClick={() => abrirModalReceta(receta.imagenBase64)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') abrirModalReceta(receta.imagenBase64); }}
                        role="button"
                        tabIndex={0}
                        title="Abrir receta en tamaño completo"
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
                      />
                      <button onClick={() => abrirModalReceta(receta.imagenBase64)}>Ver</button>
                    </div>
                  ) : (
                    <span style={{ color: '#888' }}>Sin imagen</span>
                  )}
                </td>
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
            ))}
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
