import React from 'react';
import FarmaciaProductos from './FarmaciaProductos';
import FarmaciaVentas from './FarmaciaVentas';

const Farmacia = () => (
  <div style={{background:'#fff', minHeight:'100vh', padding:'20px'}}>
    <h1>Farmacia</h1>
    <FarmaciaProductos />
    <FarmaciaVentas />
  </div>
);

export default Farmacia;
