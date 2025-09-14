import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Distribuidor from "./components/Distribuidor";
import Farmacia from "./components/Farmacia";
import Usuario from "./components/Usuario";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div>
            <h1>Bienvenido a G2 INNOVATION</h1>
            <Register />
            <Login />
          </div>
        } />
        <Route path="/distribuidor" element={<Distribuidor />} />
        <Route path="/farmacia" element={<Farmacia />} />
        <Route path="/usuario" element={<Usuario />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
