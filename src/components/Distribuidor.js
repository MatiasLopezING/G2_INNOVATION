import React from 'react';
import DistribuidorProductos from './DistribuidorProductos';
import Header from './Header';

/**
 * Componente principal para el rol de Distribuidor.
 * Muestra el panel de productos y pedidos para el distribuidor.
 *
 * No recibe props. Utiliza el componente DistribuidorProductos para la lógica principal.
 */

// Componente principal para el rol de Distribuidor
const Distribuidor = () => {
  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: '20px' }}>
      <Header title="Distribuidor" />
      {/* Panel principal de productos y pedidos */}
      <DistribuidorProductos />
    </div>
  );
};

export default Distribuidor;
