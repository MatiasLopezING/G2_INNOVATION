/**
 * Componente principal de la farmacia.
 * Permite alternar entre revisión de recetas y gestión de productos/ventas.
 *
 * No recibe props. Utiliza componentes internos para la lógica principal.
 */
import React, { useState } from 'react';
import FarmaciaProductos from './FarmaciaProductos';
import FarmaciaVentas from './FarmaciaVentas';
import RevisionRecetas from './RevisionRecetas';
import RevisionDeliverys from './RevisionDeliverys';
import Header from './Header';

const Farmacia = () => {
  const [mostrarRecetas, setMostrarRecetas] = useState(false);
  const [mostrarDeliverys, setMostrarDeliverys] = useState(false);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: '20px' }}>
      <Header title="Farmacia" />
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setMostrarRecetas(!mostrarRecetas)}
          style={{
            padding: '10px 20px',
            backgroundColor: mostrarRecetas ? '#dc3545' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {mostrarRecetas ? 'Ocultar Recetas' : '📋 Revisar Recetas Médicas'}
        </button>
        <button
          onClick={() => setMostrarDeliverys(!mostrarDeliverys)}
          style={{
            padding: '10px 20px',
            backgroundColor: mostrarDeliverys ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {mostrarDeliverys ? 'Ocultar Registros Delivery' : '🚚 Revisar Registros Delivery'}
        </button>
      </div>
      {mostrarRecetas ? (
        <RevisionRecetas />
      ) : (
        <>
          <FarmaciaProductos />
          <FarmaciaVentas />
        </>
      )}
      {mostrarDeliverys && <RevisionDeliverys />}
    </div>
  );
};

export default Farmacia;
