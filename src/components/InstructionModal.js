import React from 'react';

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
};

const boxStyle = {
  background: '#fff', padding: '18px', borderRadius: '8px', maxWidth: '620px', width: '90%', boxShadow: '0 6px 18px rgba(0,0,0,0.15)'
};

const closeBtnStyle = {
  border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer'
};

export default function InstructionModal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title || 'Instrucciones'} style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title || 'Instrucciones'}</h3>
          <button aria-label="Cerrar" style={closeBtnStyle} onClick={onClose}>✕</button>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto', lineHeight: 1.5 }}>
          {children}
        </div>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '6px 12px', cursor: 'pointer' }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
