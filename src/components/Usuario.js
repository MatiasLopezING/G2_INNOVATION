
import React, { useEffect, useState } from 'react';
import ListaProductos from './ListaProductos';
import HistorialCompras from './HistorialCompras';
import MapaUsuario from './MapaUsuario';
import Notificaciones from './Notificaciones';
import { ref, onValue } from "firebase/database";
import { db, auth } from "../firebase";
import { isFarmaciaAbierta, debugHorarios } from '../utils/horariosUtils';

const Usuario = () => {
  const [usuario, setUsuario] = useState(null);
  const [farmacias, setFarmacias] = useState([]);

  useEffect(() => {
    // Obtener usuario actual
    const user = auth.currentUser;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      onValue(userRef, (snapshot) => {
        setUsuario(snapshot.val());
      }, { onlyOnce: true });
    }
    // Obtener farmacias
    const farmaciasRef = ref(db, "users");
    onValue(farmaciasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, u]) => ({ id, ...u }))
          .filter(u => u.role === "Farmacia");
        
        // Debug: mostrar todas las farmacias y sus horarios
        console.log('Todas las farmacias encontradas:', lista);
        lista.forEach(farmacia => {
          console.log(`Farmacia: ${farmacia.nombreFarmacia || farmacia.id}`);
          debugHorarios(farmacia.horarios);
        });
        
        // Filtrar solo farmacias abiertas
        const farmaciasAbiertas = lista.filter(farmacia => isFarmaciaAbierta(farmacia.horarios));
        console.log('Farmacias abiertas:', farmaciasAbiertas);
        setFarmacias(farmaciasAbiertas);
      } else {
        setFarmacias([]);
      }
    }, { onlyOnce: true });
  }, []);

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
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
          <>
            <button onClick={() => setMostrarCarrito(!mostrarCarrito)} style={{margin:'10px 10px 10px 0', padding:'10px 20px', fontWeight:'bold'}}>
              {mostrarCarrito ? 'Ocultar carrito' : 'Ver carrito de compras'}
            </button>
            <button onClick={() => setMostrarHistorial(true)} style={{margin:'10px 10px 10px 0', padding:'10px 20px', fontWeight:'bold'}}>
              Ver mis compras
            </button>
          </>
        )}
      </div>

      {mostrarNotificaciones ? (
        <Notificaciones />
      ) : !mostrarHistorial ? (
        <>
          <ListaProductos mostrarCarrito={mostrarCarrito} />
        </>
      ) : (
        <>
          <button onClick={() => setMostrarHistorial(false)} style={{margin:'20px 0', padding:'10px 20px', fontWeight:'bold'}}>Volver a productos</button>
          <HistorialCompras />
        </>
      )}
    </div>
  );
};

export default Usuario;
