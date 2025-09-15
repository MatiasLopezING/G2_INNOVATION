import React from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Distribuidor from "./components/Distribuidor";
import Farmacia from "./components/Farmacia";
import Usuario from "./components/Usuario";

function HomeLogin() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Bienvenido a G2 INNOVATION</h1>
      <Login />
      <button style={{marginTop:20}} onClick={() => navigate("/register")}>Registrarse</button>
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
        <Route path="/usuario" element={<Usuario />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
