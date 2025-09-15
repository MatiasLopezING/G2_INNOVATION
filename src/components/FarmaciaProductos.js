import React, { useState } from "react";
import { ref, push } from "firebase/database";
import { db, auth } from "../firebase";

const FarmaciaProductos = () => {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    const user = auth.currentUser;
    if (!user) {
      setMensaje("Debes iniciar sesión como farmacia.");
      return;
    }
    try {
      await push(ref(db, "productos"), {
        nombre,
        precio: Number(precio),
        stock: Number(stock),
        farmaciaId: user.uid,
        estado: "por_comprar"
      });
      setMensaje("Producto agregado correctamente.");
  setNombre("");
  setPrecio("");
  setStock("");
    } catch (err) {
      setMensaje("Error al agregar producto: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "auto", padding: "20px" }}>
      <h2>Agregar Producto</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nombre:</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label>Precio:</label>
          <input
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label>Stock:</label>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <button type="submit" style={{ width: "100%" }}>
          Agregar
        </button>
      </form>
      {mensaje && <p style={{ color: mensaje.includes("Error") ? "red" : "green" }}>{mensaje}</p>}
    </div>
  );
};

export default FarmaciaProductos;
