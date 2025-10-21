import React from 'react';
import DistribuidorProductos from './DistribuidorProductos';

/**
 * Componente principal para el rol de Distribuidor.
 * Muestra el panel de productos y pedidos para el distribuidor.
 *
 * No recibe props. Utiliza el componente DistribuidorProductos para la lógica principal.
 */

// Componente principal para el rol de Distribuidor
const Distribuidor = () => {
  // Estilos tipo login
  const baseFont = "Nunito Sans, Inter, Poppins, Arial, sans-serif";
  const colorPrimary = "#22223b";
  const colorAccent = "#4ea8de";
  const colorButton = "#4361ee";
  const [show, setShow] = React.useState(false);
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
        <h2 style={{ textAlign: "center", marginBottom: 26, color: colorPrimary, fontWeight: 900, fontSize: 32, letterSpacing: 1.2, textShadow: "0 2px 8px #4ea8de22", fontFamily: baseFont }}>Distribuidor</h2>
        {/* Panel principal de productos y pedidos */}
        <DistribuidorProductos />
      </div>
    </div>
  );
};

export default Distribuidor;
