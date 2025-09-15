import React from 'react';
import ListaProductos from './ListaProductos';
import HistorialCompras from './HistorialCompras';

const Usuario = () => (
  <div style={{background:'#fff', minHeight:'100vh', padding:'20px'}}>
    <h1>Usuario</h1>
    <ListaProductos />
    <HistorialCompras />
  </div>
);

export default Usuario;
