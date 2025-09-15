import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db, auth } from "../firebase";

const HistorialCompras = () => {
  const [compras, setCompras] = useState([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const comprasRef = ref(db, `compras/${user.uid}`);
    const unsubscribe = onValue(comprasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data).map(([id, compra]) => ({ id, ...compra }));
        setCompras(lista);
      } else {
        setCompras([]);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <h2>Historial de Compras</h2>
      {compras.length === 0 ? (
        <p>No has realizado compras.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Medicamento</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {compras.map((compra) => (
              <tr key={compra.id}>
                <td>{compra.nombre}</td>
                <td>${compra.precio}</td>
                <td>{
                  compra.estado === "por_comprar" ? "Por comprar" :
                  compra.estado === "enviando" ? "Enviando" :
                  compra.estado === "recibido" ? "Recibido" : compra.estado
                }</td>
                <td>{new Date(compra.fecha).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default HistorialCompras;
