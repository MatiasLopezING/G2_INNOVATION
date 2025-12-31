/**
 * Componente para que la farmacia revise registros de Distribuidores (delivery).
 * Muestra notificaciones dirigidas a la farmacia (node: notificaciones/{farmaciaUid})
 * y permite Aceptar o Rechazar cada registro, mostrando las dos imágenes (frente/reverso).
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, update, push, remove, off, get } from 'firebase/database';
import { db, auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';

const RevisionDeliverys = ({ onClose, embedded = false }) => {
  const [notifs, setNotifs] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  const [rechazoText, setRechazoText] = useState('');
  const [msg, setMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const listSignatureRef = useRef(null);
  const navigate = useNavigate();

  // Elimina de todas las farmacias las notificaciones de registro de un delivery aceptado/rechazado
  const removeDeliveryRegistroFromAllFarmacias = async (deliveryUid) => {
    try {
      const usersSnap = await get(ref(db, 'users'));
      const users = usersSnap.val() || {};
      const updates = {};
      for (const [uid, u] of Object.entries(users)) {
        if (u && u.role === 'Farmacia') {
          const notifsSnap = await get(ref(db, `notificaciones/${uid}`));
          const notifs = notifsSnap.val() || {};
          for (const [nid, n] of Object.entries(notifs)) {
            if (n && (n.tipo === 'delivery_registro' || n.deliveryUid) && n.deliveryUid === deliveryUid) {
              updates[`notificaciones/${uid}/${nid}`] = null;
            }
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    } catch (e) {
      console.warn('No se pudieron limpiar notificaciones en todas las farmacias:', e);
    }
  };

  useEffect(() => {
    let baseRef = null;
    let mounted = true;

    const toMs = (v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return Date.parse(v) || 0;
      return 0;
    };

    const mapDataToList = (data) => {
      if (!data) return [];
      const entries = Object.entries(data).map(([id, n]) => ({ id, ...n }));
      return entries
        .filter(n => n.tipo === 'delivery_registro' || (n.deliveryUid && (n.frente || n.reverso)))
        .sort((a, b) => (toMs(b.fecha) - toMs(a.fecha)));
    };

    const makeSignature = (list) =>
      list.map(n => [n.id, n.tipo, n.deliveryUid, n.frente, n.reverso, toMs(n.fecha)].join('|')).join(';');

    // Espera a que el auth esté listo
    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setNotifs([]);
        listSignatureRef.current = null;
        return;
      }
      baseRef = ref(db, `notificaciones/${user.uid}`);
      onValue(baseRef, (snapshot) => {
        const data = snapshot.val();
        const list = mapDataToList(data);
        setNotifs(list);
        listSignatureRef.current = makeSignature(list);
        if (mounted) setLastUpdated(new Date());
      });
    });
    // Fallback: refresco cada 2s por si el listener en vivo falla en el entorno
    const intervalId = setInterval(async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await get(ref(db, `notificaciones/${uid}`));
        const data = snap.val();
        const list = mapDataToList(data);
        const sig = makeSignature(list);
        if (sig !== listSignatureRef.current) {
          setNotifs(list);
          listSignatureRef.current = sig;
        }
        if (mounted) setLastUpdated(new Date());
      } catch {}
    }, 2000);
    return () => {
      mounted = false;
      if (baseRef) off(baseRef);
      if (typeof authUnsub === 'function') authUnsub();
      clearInterval(intervalId);
    };
  }, []);

  const abrirModal = (img) => setModalImage(img);
  const cerrarModal = () => setModalImage(null);

  const aceptar = async (notif) => {
    try {
      // marcar delivery como aceptado y permitir login (deliveryVerified = true)
      const userRef = ref(db, `users/${notif.deliveryUid}`);
      await update(userRef, {
        deliveryVerified: true,
        deliveryVerification: {
          status: 'accepted',
          message: '',
          fechaRevision: new Date().toISOString(),
          revisadoPor: auth.currentUser?.uid || null,
          frente: notif.frente || '',
          reverso: notif.reverso || ''
        }
      });
      // notificar al delivery
      await push(ref(db, `notificaciones/${notif.deliveryUid}`), {
        tipo: 'delivery_aceptado',
        mensaje: 'Tu registro como delivery fue aceptado por la farmacia.',
        fecha: new Date().toISOString()
      });
      // limpiar la notificación para todas las farmacias
      await removeDeliveryRegistroFromAllFarmacias(notif.deliveryUid);
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
      // Actualizar estado del delivery sin borrar su cuenta para permitir reintento dentro del panel
      const deliveryRef = ref(db, `users/${notif.deliveryUid}`);
      await update(deliveryRef, {
        deliveryVerification: {
          status: 'rejected',
          message: rechazoText,
          fechaRevision: new Date().toISOString(),
          revisadoPor: auth.currentUser?.uid || null,
          frente: notif.frente || '',
          reverso: notif.reverso || ''
        }
      });
      // notificar al delivery con el motivo
      await push(ref(db, `notificaciones/${notif.deliveryUid}`), {
        tipo: 'delivery_rechazado',
        mensaje: `Registro rechazado: ${rechazoText}`,
        fecha: new Date().toISOString()
      });
      // limpiar la notificación para todas las farmacias
      await removeDeliveryRegistroFromAllFarmacias(notif.deliveryUid);
      // eliminar notificación para la farmacia (ya procesada)
      await remove(ref(db, `notificaciones/${auth.currentUser.uid}/${notif.id}`));
      setRechazoText('');
      setMsg('Registro rechazado. El delivery puede reintentar desde su panel.');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      console.error(e);
      setMsg('No se pudo rechazar el registro. Intenta nuevamente.');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '20px' }}>
      {!embedded && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <h2 style={{ margin:0 }}>Revisión de Registros Delivery</h2>
          <button onClick={() => (typeof onClose === 'function' ? onClose() : navigate(-1))} style={{ padding:'6px 12px', background:'#007bff', color:'#fff', border:'none', borderRadius:4, cursor:'pointer' }}>Volver</button>
        </div>
      )}
      {msg && <p style={{ color: msg.includes('No se pudo') ? 'red' : 'green' }}>{msg}</p>}
      {lastUpdated && (
        <p style={{ color: '#666', fontSize: 12 }}>Actualizado: {lastUpdated.toLocaleTimeString()}</p>
      )}
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
