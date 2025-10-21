/**
 * Componente para revisar recetas médicas pendientes en la farmacia.
 * Permite aprobar o rechazar recetas y notifica al usuario.
 *
 * No recibe props. Utiliza Firebase para obtener y actualizar recetas.
 */
import React, { useEffect, useState } from 'react';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { db, auth } from '../firebase';
import { actualizarCompraAEnviandoPorProducto } from '../utils/firebaseUtils';


const RevisionRecetas = () => {
  const [recetas, setRecetas] = useState([]);
  const [usuarios, setUsuarios] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [comentarioRechazo, setComentarioRechazo] = useState('');

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

  // Aprueba la receta y notifica al usuario
  const aprobarReceta = async (recetaId, productoId) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
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
          mensaje: `Tu receta médica para ${recetaSnapshot.productoNombre} ha sido aprobada. Puedes proceder con la compra.`,
          fecha: new Date().toISOString(),
          productoId: productoId
        });
      }
      setMensaje('Receta aprobada correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      setMensaje('Error al aprobar receta: ' + error.message);
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
      setMensaje('Error al rechazar receta: ' + error.message);
    }
  };

  // Elimina receta
  const eliminarReceta = async (recetaId) => {
    try {
      await remove(ref(db, `recetas/${recetaId}`));
      setMensaje('Receta eliminada');
      setTimeout(() => setMensaje(''), 2000);
    } catch (error) {
      setMensaje('Error al eliminar receta: ' + error.message);
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
    </div>
  );
};

export default RevisionRecetas;
