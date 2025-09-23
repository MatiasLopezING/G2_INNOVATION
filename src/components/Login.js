/**
 * Componente para login de usuario.
 * Props:
 *   - botonMargin: margen inferior del botón de login
 *   - botonRegistro: función para mostrar registro
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from '../firebase';

export default function Login({ botonMargin = 10, botonRegistro }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userRef = ref(db, 'users/' + user.uid);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        // Redirección según rol usando useNavigate
        if (userData.role === 'Distribuidor') {
          navigate('/distribuidor');
        } else if (userData.role === 'Farmacia') {
          navigate('/farmacia');
        } else {
          navigate('/usuario');
        }
      } else {
        setError('No se encontró el rol del usuario.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: "350px", width: '100%', background: '#fff', padding: "30px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <h2 style={{ textAlign: 'center', marginBottom: 18 }}>Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '100%' }}>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ingresa tu email"
              required
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ width: '100%' }}>
            <label>Contraseña:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
              style={{ width: "100%" }}
            />
          </div>
          <button type="submit" style={{ width: "100%", marginBottom: botonMargin }}>
            Ingresar
          </button>
          {botonRegistro && (
            <button type="button" style={{ width: "100%" }} onClick={botonRegistro}>
              Registrarse
            </button>
          )}
        </form>
        {error && <p style={{color:'red', textAlign:'center'}}>{error}</p>}
      </div>
    </div>
  );
}
