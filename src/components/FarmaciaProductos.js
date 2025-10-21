/**
 * Componente para agregar productos a la farmacia.
 * Permite registrar nombre, precio, stock y si requiere receta médica.
 *
 * No recibe props. Utiliza Firebase para guardar productos.
 */
import React, { useState } from 'react';
import { ref, push } from 'firebase/database';
import { db, auth } from '../firebase';

const FarmaciaProductos = () => {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [requiereReceta, setRequiereReceta] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Envía el producto a la base de datos
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    const user = auth.currentUser;
    if (!user) {
      setMensaje('Debes iniciar sesión como farmacia.');
      return;
    }
    try {
      await push(ref(db, 'productos'), {
        nombre,
        precio: Number(precio),
        stock: Number(stock),
        requiereReceta,
        farmaciaId: user.uid,
        estado: 'por_comprar'
      });
      setMensaje('Producto agregado correctamente.');
      setNombre('');
      setPrecio('');
      setStock('');
      setRequiereReceta(false);
    } catch (err) {
      setMensaje('Error al agregar producto: ' + err.message);
    }
  };

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
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%"
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
        maxWidth: 400,
        minWidth: 280,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        <h2 style={{ textAlign: "center", marginBottom: 18, color: colorPrimary, fontWeight: 900, fontSize: 28, letterSpacing: 1.1, textShadow: "0 2px 8px #4ea8de22", fontFamily: baseFont }}>Agregar Producto</h2>
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontWeight: 700, color: colorPrimary, fontFamily: baseFont, marginBottom: 5 }}>Nombre:</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              style={{ width: '90%', borderRadius: 14, fontSize: 15, fontFamily: baseFont, border: `1.5px solid ${colorAccent}`, background: 'rgba(255,255,255,0.97)', boxShadow: '0 2px 8px #22223b11', padding: '8px 10px', marginBottom: 6, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 700, color: colorPrimary, fontFamily: baseFont, marginBottom: 5 }}>Precio:</label>
            <input
              type="number"
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              required
              style={{ width: '90%', borderRadius: 14, fontSize: 15, fontFamily: baseFont, border: `1.5px solid ${colorAccent}`, background: 'rgba(255,255,255,0.97)', boxShadow: '0 2px 8px #22223b11', padding: '8px 10px', marginBottom: 6, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 700, color: colorPrimary, fontFamily: baseFont, marginBottom: 5 }}>Stock:</label>
            <input
              type="number"
              value={stock}
              onChange={e => setStock(e.target.value)}
              required
              style={{ width: '90%', borderRadius: 14, fontSize: 15, fontFamily: baseFont, border: `1.5px solid ${colorAccent}`, background: 'rgba(255,255,255,0.97)', boxShadow: '0 2px 8px #22223b11', padding: '8px 10px', marginBottom: 6, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: colorPrimary, fontFamily: baseFont }}>
              <input
                type="checkbox"
                checked={requiereReceta}
                onChange={e => setRequiereReceta(e.target.checked)}
                style={{ accentColor: colorAccent }}
              />
              Requiere receta médica
            </label>
          </div>
          <button type="submit" style={{ width: '100%', borderRadius: 18, fontWeight: 800, fontSize: 19, padding: '15px 0', cursor: 'pointer', letterSpacing: 1, fontFamily: baseFont, boxShadow: '0 2px 16px #22223b22', border: 'none', background: `linear-gradient(90deg, ${colorButton} 0%, ${colorAccent} 100%)`, color: '#fff', marginTop: 10, transition: 'all 0.2s' }}>Agregar</button>
        </form>
        {mensaje && <p style={{ color: mensaje.includes('Error') ? colorError : 'green', fontWeight: 700, fontFamily: baseFont, marginTop: 16, background: 'rgba(255,255,255,0.97)', borderRadius: 14, padding: '12px 0', boxShadow: '0 1px 8px #e6394622', border: mensaje.includes('Error') ? `1.5px solid ${colorError}22` : `1.5px solid #28a74522`, textAlign: 'center' }}>{mensaje}</p>}
      </div>
    </div>
  );
};

export default FarmaciaProductos;
