import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from '../firebase';

export default function Login() {
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
    <div style={{ maxWidth: "300px", margin: "auto", padding: "20px" }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ingresa tu email"
            required
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label>Contraseña:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingresa tu contraseña"
            required
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <button type="submit" style={{ width: "100%" }}>
          Ingresar
        </button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
    </div>
  );
}
