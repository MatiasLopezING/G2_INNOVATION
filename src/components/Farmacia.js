/**
 * Componente principal de la farmacia.
 * Permite alternar entre revisión de recetas y gestión de productos/ventas.
 *
 * No recibe props. Utiliza componentes internos para la lógica principal.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import FarmaciaProductos from './FarmaciaProductos';
import FarmaciaVentas from './FarmaciaVentas';
import Header from './Header';

const Farmacia = () => {
  const navigate = useNavigate();

  // Estilos tipo login
  const baseFont = "Nunito Sans, Inter, Poppins, Arial, sans-serif";
  const colorPrimary = "#22223b";
  const colorAccent = "#4ea8de";
  const colorButton = "#4361ee";
  const colorButtonHover = "#4895ef";
  const colorError = "#e63946";
  const [show, setShow] = useState(false);
  React.useEffect(() => {
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
      <div style={{
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
      }}>
        <h2 style={{ textAlign: "center", marginBottom: 26, color: colorPrimary, fontWeight: 900, fontSize: 32, letterSpacing: 1.2, textShadow: "0 2px 8px #4ea8de22", fontFamily: baseFont }}>Farmacia</h2>
        <div style={{ marginBottom: '20px', width: '100%', display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={() => setMostrarRecetas(!mostrarRecetas)}
            style={{
              padding: '10px 20px',
              fontWeight: 'bold',
              background: mostrarRecetas ? colorError : colorButton,
              color: 'white',
              border: 'none',
              borderRadius: '18px',
              cursor: 'pointer',
              fontFamily: baseFont,
              fontSize: 17,
              boxShadow: "0 2px 8px #22223b22",
              transition: "all 0.2s",
              marginRight: '10px'
            }}
            onMouseOver={e => { e.currentTarget.style.background = colorButtonHover; }}
            onMouseOut={e => { e.currentTarget.style.background = mostrarRecetas ? colorError : colorButton; }}
          >
            {mostrarRecetas ? 'Ocultar Recetas' : '📋 Revisar Recetas Médicas'}
          </button>
        </div>
        <div style={{ width: '100%' }}>
          {mostrarRecetas ? (
            <RevisionRecetas />
          ) : (
            <>
              <FarmaciaProductos />
              <FarmaciaVentas />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Farmacia;
