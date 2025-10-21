/**
 * Componente para login de usuario.
 * Props:
 *   - botonMargin: margen inferior del botón de login
 *   - botonRegistro: función para mostrar registro
 */

import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from "../firebase";

export default function Login({ botonMargin = 10, botonRegistro }) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const snapshot = await get(ref(db, `users/${user.uid}`));

      if (snapshot.exists()) {
        const { role } = snapshot.val();
        if (role === "Distribuidor") navigate("/distribuidor");
        else if (role === "Farmacia") navigate("/farmacia");
        else navigate("/home");
      } else {
        setError("No se encontraron datos de usuario.");
      }
    } catch (err) {
      if (err.code === "auth/invalid-credential") {
        setError("Credenciales incorrectas. Verifique su correo o contraseña.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Demasiados intentos. Intente nuevamente más tarde.");
      } else {
  setError("Error al iniciar sesión. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const baseFont = "Nunito Sans, Inter, Poppins, Arial, sans-serif";

  // Paleta de colores mejorada
  const colorPrimary = "#22223b"; // Azul oscuro neutro
  const colorAccent = "#4ea8de"; // Azul claro (detalle)
  const colorSecondary = "#f2e9e4"; // Fondo claro
  const colorButton = "#4361ee"; // Botón principal
  const colorButtonHover = "#4895ef";
  const colorInputBorder = "#b5b5c3";
  const colorError = "#e63946";

  const inputStyle = {
    width: "100%",
    maxWidth: 400,
    padding: "15px 18px",
    borderRadius: 18,
    border: `1.5px solid ${colorInputBorder}`,
    fontSize: 17,
    background: "rgba(255,255,255,0.97)",
    boxShadow: "0 2px 12px #22223b11",
    transition: "all 0.2s",
    fontFamily: baseFont,
    outline: "none",
  };

  const buttonStyle = {
    width: "100%",
    maxWidth: 400,
    borderRadius: 18,
    fontWeight: 800,
    fontSize: 19,
    padding: "15px 0",
    cursor: "pointer",
    letterSpacing: 1,
    transition: "all 0.2s",
    fontFamily: baseFont,
    boxShadow: "0 2px 16px #22223b22",
    border: "none",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(120deg, #f2e9e4 0%, #e0ecfc 100%)",
      }}
    >
      <div
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "scale(1)" : "scale(0.97)",
          transition: "all 0.5s cubic-bezier(.4,2,.3,1)",
          background: "rgba(255,255,255,0.98)",
          borderRadius: 28,
          boxShadow: "0 2px 12px #22223b11",
          padding: 24,
          width: "100%",
          maxWidth: 350,
          minWidth: 280,
        }}
      >
        {/* Logo de la empresa */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <img
            src={"/RecetAppSinFondo.png"}
            alt="Logo empresa"
            style={{ width: 150, height: 150, objectFit: "contain" }}
          />
        </div>
        <h2
          style={{
            textAlign: "center",
            marginBottom: 26,
            color: colorPrimary,
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: 1.2,
            textShadow: "0 2px 8px #4ea8de22",
            fontFamily: baseFont,
          }}
        >
          Iniciar sesión
        </h2>
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
        autoComplete="on"
      >
        <label
          style={{
            fontWeight: 700,
            color: colorPrimary,
            width: "100%",
            maxWidth: 400,
            textAlign: "left",
            marginBottom: 5,
            letterSpacing: 0.5,
            fontSize: 16,
          }}
        >
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ejemplo@email.com"
          required
          style={{
            ...inputStyle,
            borderColor: error ? colorError : colorInputBorder,
          }}
          aria-label="Correo electrónico"
          onFocus={e => e.target.style.boxShadow = "0 0 0 2px #4ea8de55"}
          onBlur={e => e.target.style.boxShadow = inputStyle.boxShadow}
        />

        <label
          style={{
            fontWeight: 700,
            color: colorPrimary,
            width: "100%",
            maxWidth: 400,
            textAlign: "left",
            marginBottom: 5,
            letterSpacing: 0.5,
            fontSize: 16,
          }}
        >
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          style={{
            ...inputStyle,
            borderColor: error ? colorError : colorInputBorder,
          }}
          aria-label="Contraseña"
          onFocus={e => e.target.style.boxShadow = "0 0 0 2px #4ea8de55"}
          onBlur={e => e.target.style.boxShadow = inputStyle.boxShadow}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            background: loading
              ? colorButtonHover
              : `linear-gradient(90deg, ${colorButton} 0%, ${colorAccent} 100%)`,
            color: "#fff",
            marginBottom: botonMargin,
            transform: loading ? "scale(0.98)" : "scale(1)",
            opacity: loading ? 0.8 : 1,
            border: "none",
            outline: "none",
          }}
          aria-label="Ingresar"
          onFocus={e => e.currentTarget.style.boxShadow = "0 0 0 2px #4ea8de55"}
          onBlur={e => e.currentTarget.style.boxShadow = buttonStyle.boxShadow}
          onMouseOver={e => {
            if (!loading) e.currentTarget.style.background = colorButtonHover;
          }}
          onMouseOut={e => {
            if (!loading) e.currentTarget.style.background = `linear-gradient(90deg, ${colorButton} 0%, ${colorAccent} 100%)`;
          }}
        >
          {loading ? "Ingresando..." : "Ingresar"}
  </button>

        {botonRegistro && (
          <button
            type="button"
            style={{
              ...buttonStyle,
              background: colorSecondary,
              color: colorButton,
              border: `1.5px solid ${colorButton}`,
              boxShadow: "0 2px 16px #22223b11",
              outline: "none",
            }}
            aria-label="Registrarse"
            onClick={botonRegistro}
            onFocus={e => e.currentTarget.style.boxShadow = "0 0 0 2px #4ea8de55"}
            onBlur={e => e.currentTarget.style.boxShadow = buttonStyle.boxShadow}
            onMouseOver={e => {
              e.currentTarget.style.background = colorAccent;
              e.currentTarget.style.color = "#fff";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = colorSecondary;
              e.currentTarget.style.color = colorButton;
            }}
          >
            Registrarse
          </button>
        )}
      </form>

        

        {error && (
          <p
            style={{
              color: colorError,
              textAlign: "center",
              marginTop: 20,
              fontWeight: 700,
              background: "rgba(255,255,255,0.97)",
              borderRadius: 14,
              padding: "12px 0",
              boxShadow: "0 1px 8px #e6394622",
              fontFamily: baseFont,
              border: `1.5px solid ${colorError}22`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              animation: "shake 0.3s",
            }}
          >
            <span style={{fontWeight:900, fontSize:18, marginRight:6}}>!</span> {error}
          </p>
        )}
      </div>
    </div>
  );
}

Login.propTypes = {
  botonMargin: PropTypes.number,
  botonRegistro: PropTypes.func,
};
