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
  const [mensaje, setMensaje] = useState('');
  const [comentarioRechazo, setComentarioRechazo] = useState('');

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
          .filter(receta => receta.farmaciaId === user.uid && receta.estado === 'pendiente'); // Solo recetas pagadas
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
      await update(ref(db, `recetas/${recetaId}`), {
        estado: 'aceptada',
        fechaRevision: new Date().toISOString(),
        revisadoPor: user.uid
      });
      await update(ref(db, `productos/${productoId}`), {
        estado: 'por_comprar',
        recetaAprobada: true
      });
      // Actualiza la compra asociada a 'enviando'
      if (user && productoId) {
        await actualizarCompraAEnviandoPorProducto(productoId, user.uid);
      }
      // Notifica al usuario
      const recetaSnapshot = await new Promise(resolve => {
        onValue(ref(db, `recetas/${recetaId}`), snapshot => resolve(snapshot.val()), { onlyOnce: true });
      });
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
            {recetas.map(receta => (
              <tr key={receta.id}>
                <td>{receta.productoNombre}</td>
                <td>{receta.usuarioId}</td>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RevisionRecetas;
