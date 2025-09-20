import React, { useEffect, useState } from 'react';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { db, auth } from '../firebase';

const RevisionRecetas = () => {
  const [recetas, setRecetas] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [comentarioRechazo, setComentarioRechazo] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Obtener recetas pendientes para esta farmacia
    const recetasRef = ref(db, 'recetas');
    const unsubscribe = onValue(recetasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, receta]) => ({ id, ...receta }))
          .filter(receta => 
            receta.farmaciaId === user.uid && 
            receta.estado === 'pendiente'
          );
        setRecetas(lista);
      } else {
        setRecetas([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAprobarReceta = async (recetaId, productoId) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Actualizar estado de la receta
      await update(ref(db, `recetas/${recetaId}`), {
        estado: 'aceptada',
        fechaRevision: new Date().toISOString(),
        revisadoPor: user.uid
      });

      // Cambiar estado del producto a 'por_comprar' para permitir la compra
      await update(ref(db, `productos/${productoId}`), {
        estado: 'por_comprar',
        recetaAprobada: true
      });

      // Obtener datos de la receta para la notificación
      const recetaSnapshot = await onValue(ref(db, `recetas/${recetaId}`), (snapshot) => {
        const recetaData = snapshot.val();
        if (recetaData) {
          // Notificar al usuario
          push(ref(db, `notificaciones/${recetaData.usuarioId}`), {
            tipo: 'receta_aceptada',
            mensaje: `Tu receta médica para ${recetaData.productoNombre} ha sido aprobada. Puedes proceder con la compra.`,
            fecha: new Date().toISOString(),
            productoId: productoId
          });
        }
      }, { onlyOnce: true });

      setMensaje('Receta aprobada correctamente');
      setTimeout(() => setMensaje(''), 3000);

    } catch (error) {
      setMensaje('Error al aprobar receta: ' + error.message);
    }
  };

  const handleRechazarReceta = async (recetaId, productoId) => {
    if (!comentarioRechazo.trim()) {
      setMensaje('Por favor proporciona un motivo para el rechazo');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
      // Obtener datos de la receta antes de eliminarla
      const recetaRef = ref(db, `recetas/${recetaId}`);
      const recetaSnapshot = await new Promise((resolve, reject) => {
        onValue(recetaRef, (snapshot) => {
          resolve(snapshot.val());
        }, { onlyOnce: true }, reject);
      });

      if (recetaSnapshot) {
        // Notificar al usuario ANTES de eliminar la receta
        await push(ref(db, `notificaciones/${recetaSnapshot.usuarioId}`), {
          tipo: 'receta_rechazada',
          mensaje: `Tu receta médica para ${recetaSnapshot.productoNombre} ha sido rechazada. Motivo: ${comentarioRechazo}. Puedes subir una nueva receta médica para intentar nuevamente.`,
          fecha: new Date().toISOString(),
          productoId: productoId,
          puedeReintentar: true
        });

        // Eliminar la receta rechazada
        await remove(recetaRef);

        // Cambiar estado del producto a 'por_comprar' para permitir nueva compra
        await update(ref(db, `productos/${productoId}`), {
          estado: 'por_comprar',
          recetaAprobada: false
        });

        setMensaje('Receta rechazada correctamente. El usuario puede volver a intentar.');
        setComentarioRechazo('');
        setTimeout(() => setMensaje(''), 3000);
      }

    } catch (error) {
      setMensaje('Error al rechazar receta: ' + error.message);
    }
  };

  if (recetas.length === 0) {
    return (
      <div style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
        <h2>📋 Revisión de Recetas Médicas</h2>
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: '#6c757d' }}>
            No hay recetas médicas pendientes de revisión
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
      <h2>📋 Revisión de Recetas Médicas</h2>
      
      {mensaje && (
        <div style={{
          padding: '10px',
          borderRadius: '5px',
          backgroundColor: mensaje.includes('Error') ? '#f8d7da' : '#d4edda',
          color: mensaje.includes('Error') ? '#721c24' : '#155724',
          marginBottom: '20px'
        }}>
          {mensaje}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {recetas.map((receta) => (
          <div key={receta.id} style={{
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0' }}>Medicamento: {receta.productoNombre}</h4>
                <p style={{ margin: '0', color: '#6c757d', fontSize: '14px' }}>
                  Fecha de solicitud: {new Date(receta.fechaSubida).toLocaleString()}
                </p>
              </div>
              <span style={{
                backgroundColor: '#ffc107',
                color: '#856404',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                PENDIENTE
              </span>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <h5 style={{ margin: '0 0 10px 0' }}>Receta médica:</h5>
              <img
                src={receta.imagenURL || receta.imagenBase64}
                alt="Receta médica"
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  const imageUrl = receta.imagenURL || receta.imagenBase64;
                  if (imageUrl) {
                    window.open(imageUrl, '_blank');
                  }
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <button
                onClick={() => handleAprobarReceta(receta.id, receta.productoId)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✅ Aprobar
              </button>
              
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  placeholder="Motivo del rechazo (opcional)"
                  value={comentarioRechazo}
                  onChange={(e) => setComentarioRechazo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <button
                onClick={() => handleRechazarReceta(receta.id, receta.productoId)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ❌ Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RevisionRecetas;
