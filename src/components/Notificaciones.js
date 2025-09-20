import React, { useEffect, useState } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { db, auth } from '../firebase';

const Notificaciones = () => {
  const [notificaciones, setNotificaciones] = useState([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Obtener notificaciones del usuario
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

  const handleEliminarNotificacion = async (notificacionId) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await remove(ref(db, `notificaciones/${user.uid}/${notificacionId}`));
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  };

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
      <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
        <h3>🔔 Notificaciones</h3>
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: '#6c757d' }}>
            No tienes notificaciones
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <h3>🔔 Notificaciones ({notificaciones.length})</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {notificaciones.map((notif) => {
          const accion = getAccionTipo(notif.tipo, notif.puedeReintentar);
          return (
            <div key={notif.id} style={{
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: '#fff',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>
                  {getIconoTipo(notif.tipo)}
                </span>
                
                <div style={{ flex: 1 }}>
                  <p style={{ 
                    margin: '0 0 5px 0', 
                    fontWeight: 'bold',
                    color: getColorTipo(notif.tipo)
                  }}>
                    {notif.mensaje}
                  </p>
                  
                  {accion && (
                    <div style={{
                      margin: '8px 0',
                      padding: '8px 12px',
                      backgroundColor: accion.color + '20',
                      border: `1px solid ${accion.color}`,
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      <span style={{ marginRight: '5px' }}>{accion.icono}</span>
                      {accion.texto}
                    </div>
                  )}
                  
                  <p style={{ 
                    margin: 0, 
                    fontSize: '12px', 
                    color: '#6c757d' 
                  }}>
                    {new Date(notif.fecha).toLocaleString()}
                  </p>
                </div>
                
                <button
                  onClick={() => handleEliminarNotificacion(notif.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '0'
                  }}
                  title="Eliminar notificación"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Notificaciones;
