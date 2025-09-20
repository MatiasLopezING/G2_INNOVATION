import React, { useState } from 'react';
import FarmaciaProductos from './FarmaciaProductos';
import FarmaciaVentas from './FarmaciaVentas';
import RevisionRecetas from './RevisionRecetas';

const Farmacia = () => {
  const [mostrarRecetas, setMostrarRecetas] = useState(false);

  return (
    <div style={{background:'#fff', minHeight:'100vh', padding:'20px'}}>
      <h1>Farmacia</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setMostrarRecetas(!mostrarRecetas)}
          style={{
            padding: '10px 20px',
            backgroundColor: mostrarRecetas ? '#dc3545' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginRight: '10px'
          }}
        >
          {mostrarRecetas ? 'Ocultar Recetas' : '📋 Revisar Recetas Médicas'}
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
    </div>
  );
};

export default Farmacia;
