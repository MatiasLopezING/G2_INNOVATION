/**
 * Componente de notificaciones para el usuario.
 * Muestra y permite eliminar notificaciones recibidas.
 *
 * No recibe props. Utiliza Firebase para obtener y eliminar notificaciones.
 */
import React, { useEffect, useState } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { db, auth } from '../firebase';

const Notificaciones = () => {
  const [notificaciones, setNotificaciones] = useState([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    // Escucha notificaciones del usuario
    const notificacionesRef = ref(db, `notificaciones/${user.uid}`);
    const unsubscribe = onValue(notificacionesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, notif]) => ({ id, ...notif }))
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setNotificaciones(lista);
      } else {
        setNotificaciones([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Elimina una notificación
  const eliminarNotificacion = async (notificacionId) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await remove(ref(db, `notificaciones/${user.uid}/${notificacionId}`));
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  };

  // Icono según tipo de notificación
  const getIconoTipo = (tipo) => {
    switch (tipo) {
      case 'receta_aceptada':
        return '✅';
      case 'receta_rechazada':
        return '❌';
      default:
        return '📢';
    }
  };

  // Color según tipo de notificación
  const getColorTipo = (tipo) => {
    switch (tipo) {
      case 'receta_aceptada':
        return '#28a745';
      case 'receta_rechazada':
        return '#dc3545';
      default:
        return '#007bff';
    }
  };

  // Mensaje adicional según tipo
  const getAccionTipo = (tipo, puedeReintentar) => {
    if (tipo === 'receta_rechazada' && puedeReintentar) {
      return {
        texto: 'Puedes volver a intentar subiendo una nueva receta médica.',
        color: '#ffc107',
        icono: '🔄'
      };
    }
    return null;
  };

  if (notificaciones.length === 0) {
    return (
      <div style={{ maxWidth: '600px', margin: 'auto', padding: '20px' }}>
        <h3>🔔 Notificaciones</h3>
        <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
          No tienes notificaciones.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: 'auto', padding: '20px' }}>
      <h3>🔔 Notificaciones</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {notificaciones.map(notif => (
          <li key={notif.id} style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: '8px', marginBottom: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: getColorTipo(notif.tipo), fontSize: '22px', marginRight: '12px' }}>{getIconoTipo(notif.tipo)}</span>
            <span style={{ flex: 1 }}>
              {notif.mensaje}
              {getAccionTipo(notif.tipo, notif.puedeReintentar) && (
                <span style={{ color: getAccionTipo(notif.tipo, notif.puedeReintentar).color, marginLeft: 8 }}>
                  {getAccionTipo(notif.tipo, notif.puedeReintentar).icono} {getAccionTipo(notif.tipo, notif.puedeReintentar).texto}
                </span>
              )}
            </span>
            <button onClick={() => eliminarNotificacion(notif.id)} style={{ marginLeft: '12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '5px', padding: '6px 12px', cursor: 'pointer' }}>Eliminar</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Notificaciones;
