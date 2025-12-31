import React from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Distribuidor from "./components/Distribuidor";
import Farmacia from "./components/Farmacia";
import Usuario from "./components/Usuario";
import RevisionDeliverys from "./components/RevisionDeliverys";
import RevisionRecetas from "./components/RevisionRecetas";
import FarmaciaNotificaciones from "./components/FarmaciaNotificaciones";

function HomeLogin() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
          <img
            src="/icons/recetapp.png"
            alt="RecetApp"
            style={{ width: 84, height: 84, objectFit: "contain" }}
          />
        </div>
        <Login botonMargin={6} botonRegistro={() => navigate("/register")} />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/distribuidor" element={<Distribuidor />} />
        <Route path="/farmacia" element={<Farmacia />} />
        <Route path="/notificaciones" element={<FarmaciaNotificaciones />} />
        <Route path="/revision-deliverys" element={<RevisionDeliverys />} />
        <Route path="/revision-recetas" element={<RevisionRecetas />} />
        <Route path="/usuario" element={<Usuario />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
