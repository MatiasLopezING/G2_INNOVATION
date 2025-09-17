import React from "react";

function Carrito({ carrito, onRemove, onComprar }) {
  const total = carrito.reduce((acc, prod) => acc + Number(prod.precio), 0);
  return (
    <div style={{ margin: "20px 0", padding: "15px", border: "1px solid #ccc", borderRadius: "8px", background: "#f9f9f9" }}>
      <h3>Carrito de compras</h3>
      {carrito.length === 0 ? (
        <div>El carrito está vacío.</div>
      ) : (
        <table style={{ width: "100%", marginBottom: "10px" }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {carrito.map((prod, idx) => (
              <tr key={prod.id}>
                <td>{prod.nombre}</td>
                <td>${prod.precio}</td>
                <td>
                  <button onClick={() => onRemove(prod.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ fontWeight: "bold", marginBottom: "10px" }}>Total: ${total.toFixed(2)}</div>
      <button onClick={onComprar} disabled={carrito.length === 0} style={{ padding: "8px 16px", fontWeight: "bold" }}>
        Comprar todo
      </button>
    </div>
  );
}

export default Carrito;
