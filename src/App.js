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
    <Login botonMargin={6} botonRegistro={() => navigate("/register")} />
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
