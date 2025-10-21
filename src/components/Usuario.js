
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

  // Estilos tipo login
  const baseFont = "Nunito Sans, Inter, Poppins, Arial, sans-serif";
  const colorPrimary = "#22223b";
  const colorAccent = "#4ea8de";
  const colorButton = "#4361ee";
  const colorButtonHover = "#4895ef";
  const colorError = "#e63946";

  const [show, setShow] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      width: "100vw",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(120deg, #f2e9e4 0%, #e0ecfc 100%)"
    }}>
      <div
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "scale(1)" : "scale(0.97)",
          transition: "all 0.5s cubic-bezier(.4,2,.3,1)",
          background: "rgba(255,255,255,0.98)",
          borderRadius: 28,
          boxShadow: "0 2px 12px #22223b11",
          padding: 24,
          width: "100%",
          maxWidth: 700,
          minWidth: 320,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            marginBottom: 26,
            color: colorPrimary,
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: 1.2,
            textShadow: "0 2px 8px #4ea8de22",
            fontFamily: baseFont,
          }}
        >
          Usuario
        </h2>
        <MapaUsuario usuario={usuario} farmacias={farmacias} />
        <div style={{ marginBottom: '20px', width: '100%', display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button 
            onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)} 
            style={{
              padding:'10px 20px', 
              fontWeight:'bold',
              background: mostrarNotificaciones ? colorError : colorButton,
              color: 'white',
              border: 'none',
              borderRadius: '18px',
              cursor: 'pointer',
              fontFamily: baseFont,
              fontSize: 17,
              boxShadow: "0 2px 8px #22223b22",
              transition: "all 0.2s"
            }}
            onMouseOver={e => { e.currentTarget.style.background = colorButtonHover; }}
            onMouseOut={e => { e.currentTarget.style.background = mostrarNotificaciones ? colorError : colorButton; }}
          >
            {mostrarNotificaciones ? 'Ocultar notificaciones' : '🔔 Notificaciones'}
          </button>
          {!mostrarNotificaciones && (
            <button 
              onClick={() => setMostrarCarrito(!mostrarCarrito)} 
              style={{
                padding:'10px 20px',
                fontWeight:'bold',
                background: colorAccent,
                color: 'white',
                border: 'none',
                borderRadius: '18px',
                cursor: 'pointer',
                fontFamily: baseFont,
                fontSize: 17,
                boxShadow: "0 2px 8px #22223b22",
                transition: "all 0.2s"
              }}
              onMouseOver={e => { e.currentTarget.style.background = colorButtonHover; }}
              onMouseOut={e => { e.currentTarget.style.background = colorAccent; }}
            >
              {mostrarCarrito ? 'Ocultar carrito' : 'Ver carrito de compras'}
            </button>
          )}
        </div>
        <div style={{ width: '100%' }}>
          {mostrarNotificaciones ? (
            <Notificaciones />
          ) : (
            <>
              <ListaProductos mostrarCarrito={mostrarCarrito} />
              <HistorialCompras />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Usuario;
