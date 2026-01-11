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

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: '20px' }}>
      <Header title="Farmacia" logoSize={48} />
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/notificaciones')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔔 Notificaciones
        </button>
      </div>
      {/* Si está activa la vista de revisión de deliverys, ocultar productos y ventas */}
      {/* Vista normal: productos y ventas */}
      <FarmaciaProductos />
      <FarmaciaVentas />
    </div>
  );
};

export default Farmacia;
