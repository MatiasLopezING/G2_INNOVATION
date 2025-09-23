
import React, { useEffect, useState } from 'react';
import ListaProductos from './ListaProductos';
import HistorialCompras from './HistorialCompras';
import MapaUsuario from './MapaUsuario';
import Notificaciones from './Notificaciones';
import { ref, onValue } from "firebase/database";
import { db, auth } from "../firebase";
import { isFarmaciaAbierta } from '../utils/horariosUtils';

const Usuario = () => {
  // Estado del usuario actual y farmacias abiertas
  const [usuario, setUsuario] = useState(null);
  const [farmacias, setFarmacias] = useState([]);

  useEffect(() => {
    // Obtiene el usuario actual y las farmacias abiertas
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      onValue(userRef, (snapshot) => {
        setUsuario(snapshot.val());
      }, { onlyOnce: true });
    }
    const farmaciasRef = ref(db, "users");
    onValue(farmaciasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Solo farmacias abiertas
        const farmaciasAbiertas = Object.entries(data)
          .map(([id, u]) => ({ id, ...u }))
          .filter(u => u.role === "Farmacia" && isFarmaciaAbierta(u.horarios));
        setFarmacias(farmaciasAbiertas);
      } else {
        setFarmacias([]);
      }
    }, { onlyOnce: true });
  }, []);

  // Estado para mostrar/ocultar secciones
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);

  return (
    <div style={{background:'#fff', minHeight:'100vh', padding:'20px'}}>
      <h1>Usuario</h1>
      <MapaUsuario usuario={usuario} farmacias={farmacias} />
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)} 
          style={{
            margin:'10px 10px 10px 0', 
            padding:'10px 20px', 
            fontWeight:'bold',
            backgroundColor: mostrarNotificaciones ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {mostrarNotificaciones ? 'Ocultar notificaciones' : '🔔 Notificaciones'}
        </button>
        {!mostrarNotificaciones && (
          <button onClick={() => setMostrarCarrito(!mostrarCarrito)} style={{margin:'10px 10px 10px 0', padding:'10px 20px', fontWeight:'bold'}}>
            {mostrarCarrito ? 'Ocultar carrito' : 'Ver carrito de compras'}
          </button>
        )}
      </div>
      {mostrarNotificaciones ? (
        <Notificaciones />
      ) : (
        <>
          <ListaProductos mostrarCarrito={mostrarCarrito} />
          <HistorialCompras />
        </>
      )}
    </div>
  );
};

export default Usuario;
