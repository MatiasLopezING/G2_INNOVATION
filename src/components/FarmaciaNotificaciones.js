import React from 'react';
import { useNavigate } from 'react-router-dom';
import RevisionRecetas from './RevisionRecetas';
import RevisionDeliverys from './RevisionDeliverys';

const FarmaciaNotificaciones = () => {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ margin:0 }}>Notificaciones</h2>
        <button onClick={() => navigate(-1)} style={{ padding:'6px 12px', background:'#007bff', color:'#fff', border:'none', borderRadius:4, cursor:'pointer' }}>Volver</button>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '12px 0' }}>Recetas Médicas</h3>
        <div style={{ border: '1px solid #eee', borderRadius: 8 }}>
          <RevisionRecetas embedded />
        </div>
      </section>

      <section>
        <h3 style={{ margin: '12px 0' }}>Registros Delivery</h3>
        <div style={{ border: '1px solid #eee', borderRadius: 8 }}>
          <RevisionDeliverys embedded />
        </div>
      </section>
    </div>
  );
};

export default FarmaciaNotificaciones;
