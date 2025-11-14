/**
 * Componente para login de usuario.
 * Props:
 *   - botonMargin: margen inferior del botón de login
 *   - botonRegistro: función para mostrar registro
 */

import React, { useState } from "react";
import VideoBackground from './VideoBackground';
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from "firebase/auth";
import { ref, get, remove } from "firebase/database";
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
      // Usar persistencia por sesión para que cada pestaña/ventana tenga su propia sesión
      // Esto permite iniciar con distintas cuentas en diferentes pestañas del mismo origen.
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userRef = ref(db, 'users/' + user.uid);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        // Redirección según rol usando useNavigate
        if (userData.role === 'Distribuidor') {
          const dv = userData.deliveryVerification || { status: 'pendiente' };
          // Permitir login si la farmacia marcó deliveryVerified = true o el status es accepted
          if (userData.deliveryVerified === true || dv.status === 'accepted' || dv.status === 'accept') {
            navigate('/distribuidor');
          } else if (dv.status === 'pendiente' || dv.status === 'pending') {
            // impedir inicio de sesión hasta que sea aceptado
            await signOut(auth);
            setError('Tu cuenta está pendiente de verificación por un farmacéutico.');
            return;
          } else if (dv.status === 'rejected' || dv.status === 'rechazado') {
            // mostrar mensaje de rechazo y eliminar el usuario para que pueda registrarse de nuevo
            const message = dv.message || 'Tu cuenta fue rechazada por el farmacéutico.';
            try {
              // borrar nodo en la base de datos
              await remove(userRef);
            } catch (errRemove) {
              console.warn('No se pudo eliminar el registro en DB', errRemove);
            }
            try {
              // eliminar cuenta de Auth (usuario ya está autenticado)
              await user.delete();
            } catch (errDel) {
              console.warn('No se pudo eliminar el usuario de Auth', errDel);
            }
            setError(message + ' Puedes registrarte nuevamente.');
            return;
          } else {
            // cualquier otro caso, impedir inicio
            await signOut(auth);
            setError('Tu cuenta no está autorizada para iniciar sesión.');
            return;
          }
        } else if (userData.role === 'Farmacia') {
          navigate('/farmacia');
        } else {
          navigate('/usuario');
        }
      } else {
        setError('No se encontró el rol del usuario.');
      }
    } catch (err) {
      console.error(err);
      setError('No pudimos iniciar sesión. Verifica tu correo y contraseña, y vuelve a intentar.');
    }
  };

  // Video background moved to a reusable component (see src/components/VideoBackground.js)

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      {/* Video de fondo (reusable) */}
      <VideoBackground src="/login-bg.mp4" />

  <div className="fade-in" style={{ maxWidth: "420px", width: '90%', background: 'rgba(255,255,255,0.95)', padding: "30px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", position: 'fixed', zIndex: 10, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <img src="/RecetApp.png" alt="RecetApp" style={{ width: 120, height: 'auto', objectFit: 'contain' }} onError={(e)=>{e.target.style.display='none'}} />
        </div>
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
