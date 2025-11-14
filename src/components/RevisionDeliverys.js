/**
 * Componente para que la farmacia revise registros de Distribuidores (delivery).
 * Muestra notificaciones dirigidas a la farmacia (node: notificaciones/{farmaciaUid})
 * y permite Aceptar o Rechazar cada registro, mostrando las dos imágenes (frente/reverso).
 */
import React, { useEffect, useState } from 'react';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const RevisionDeliverys = () => {
  const [notifs, setNotifs] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  const [rechazoText, setRechazoText] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let notUnsub = null;
    // Espera a que el auth esté listo
    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setNotifs([]);
        return;
      }
      const notRef = ref(db, `notificaciones/${user.uid}`);
      notUnsub = onValue(notRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setNotifs([]);
          return;
        }
        // Mostrar cualquier notificación de tipo 'delivery_registro' (sin filtrar estrictamente por status)
        const list = Object.entries(data)
          .map(([id, n]) => ({ id, ...n }))
          .filter(n => n.tipo === 'delivery_registro');
        setNotifs(list);
      });
    });
    return () => {
      if (typeof notUnsub === 'function') notUnsub();
      if (typeof authUnsub === 'function') authUnsub();
    };
  }, []);

  const abrirModal = (img) => setModalImage(img);
  const cerrarModal = () => setModalImage(null);

  const aceptar = async (notif) => {
    try {
      // marcar delivery como aceptado y permitir login (deliveryVerified = true)
      await update(ref(db, `users/${notif.deliveryUid}`), {
        deliveryVerified: true,
        deliveryVerification: {
          status: 'accepted',
          message: '',
          fechaRevision: new Date().toISOString(),
          revisadoPor: auth.currentUser?.uid || null
        }
      });
      // notificar al delivery
      await push(ref(db, `notificaciones/${notif.deliveryUid}`), {
        tipo: 'delivery_aceptado',
        mensaje: 'Tu registro como delivery fue aceptado por la farmacia.',
        fecha: new Date().toISOString()
      });
      // eliminar notificación local (la del array) buscando por id
      await remove(ref(db, `notificaciones/${auth.currentUser.uid}/${notif.id}`));
      setMsg('Registro aceptado correctamente');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      console.error(e);
      setMsg('No se pudo aceptar el registro. Intenta nuevamente.');
    }
  };

  const rechazar = async (notif) => {
    if (!rechazoText.trim()) {
      setMsg('Ingresa un motivo para el rechazo');
      return;
    }
    try {
      // marcar como rechazado y dejar mensaje; deliveryVerified queda en false
      await update(ref(db, `users/${notif.deliveryUid}`), {
        deliveryVerified: false,
        deliveryVerification: {
          status: 'rejected',
          message: rechazoText,
          fechaRevision: new Date().toISOString(),
          revisadoPor: auth.currentUser?.uid || null
        }
      });
      // notificar al delivery con el motivo
      await push(ref(db, `notificaciones/${notif.deliveryUid}`), {
        tipo: 'delivery_rechazado',
        mensaje: `Registro rechazado: ${rechazoText}`,
        fecha: new Date().toISOString()
      });
      // eliminar notificación para la farmacia
      await remove(ref(db, `notificaciones/${auth.currentUser.uid}/${notif.id}`));
      setRechazoText('');
      setMsg('Registro rechazado y se notificó al usuario');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      console.error(e);
      setMsg('No se pudo rechazar el registro. Intenta nuevamente.');
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: 'auto', padding: 12 }}>
      <h2>Revisión de Registros Delivery</h2>
      {msg && <p style={{ color: msg.includes('No se pudo') ? 'red' : 'green' }}>{msg}</p>}
      {notifs.length === 0 ? (
        <p>No hay registros nuevos de delivery para revisar.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Fecha</th>
              <th>Documentos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {notifs.map(n => (
              <tr key={n.id}>
                <td>{n.deliveryEmail || n.deliveryUid}</td>
                <td>{n.fecha ? new Date(n.fecha).toLocaleString() : ''}</td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {n.frente ? (
                      <img src={n.frente} alt="Frente" style={{ width: 100, height: 80, objectFit: 'cover', cursor: 'pointer' }} onClick={() => abrirModal(n.frente)} />
                    ) : <span style={{ color: '#888' }}>Sin frente</span>}
                    {n.reverso ? (
                      <img src={n.reverso} alt="Reverso" style={{ width: 100, height: 80, objectFit: 'cover', cursor: 'pointer' }} onClick={() => abrirModal(n.reverso)} />
                    ) : <span style={{ color: '#888' }}>Sin reverso</span>}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={() => aceptar(n)} style={{ background: '#28a745', color: '#fff', padding: '8px' }}>Aceptar</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input placeholder="Motivo de rechazo" value={rechazoText} onChange={e => setRechazoText(e.target.value)} style={{ flex: 1 }} />
                      <button onClick={() => rechazar(n)} style={{ background: '#dc3545', color: '#fff', padding: '8px' }}>Rechazar</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalImage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={cerrarModal}>
          <div style={{ background: '#fff', padding: 12, borderRadius: 8, maxWidth: '90%', maxHeight: '90%' }} onClick={e => e.stopPropagation()}>
            <button onClick={cerrarModal} style={{ float: 'right' }}>Cerrar</button>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <img src={modalImage} alt="Documento" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 6 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevisionDeliverys;
