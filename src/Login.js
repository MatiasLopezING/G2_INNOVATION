import React, { useState } from "react";
import { db } from "./firebase";
import { ref, push } from "firebase/database";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Por favor completa todos los campos.");
      return;
    }

    // Envía los datos a Realtime Database
    const usuariosRef = ref(db, "usuarios");
    push(usuariosRef, {
      email: email,
      password: password, // ⚠️ Solo para pruebas: no almacenes contraseñas en texto plano en producción
      timestamp: new Date().toISOString()
    })
      .then(() => {
        alert("Usuario registrado correctamente.");
        setEmail("");
        setPassword("");
      })
      .catch((error) => {
        console.error("Error al registrar:", error);
        alert("Error al registrar el usuario.");
      });
  };

  return (
    <div style={{ maxWidth: "300px", margin: "auto", padding: "20px" }}>
      <h2>Login / Registro</h2>
      <form onSubmit={handleSubmit}>
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
          Enviar
        </button>
      </form>
    </div>
  );
}
