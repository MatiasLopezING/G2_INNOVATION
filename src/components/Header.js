import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

const Header = ({ title, logoSize = 70 }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      // ignore sign out errors
    }
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/icons/recetapp.png" alt="RecetApp" style={{ height: logoSize, width: logoSize, objectFit: 'contain' }} />
        <h1 style={{ margin: 0 }}>{title}</h1>
      </div>
      <div>
        <button onClick={handleLogout} style={{ padding: '8px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default Header;
