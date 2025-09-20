import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { push } from 'firebase/database';

const UploadReceta = ({ producto, farmaciaId, onUploadComplete, onCancel }) => {
  const [imagen, setImagen] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setImagen(file);
        setMensaje('');
      } else {
        setMensaje('Por favor selecciona una imagen válida');
        setImagen(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imagen) {
      setMensaje('Por favor selecciona una imagen de la receta médica');
      return;
    }

    setSubiendo(true);
    setMensaje('');

    try {
      // Subir imagen usando FormData directamente
      const formData = new FormData();
      formData.append('file', imagen);
      
      // Usar FreeImageHosting (completamente gratuito, sin API key)
      const response = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Guardar información de la receta en la base de datos
        const recetaData = {
          productoId: producto.id,
          productoNombre: producto.nombre,
          farmaciaId: farmaciaId,
          imagenURL: result.image.url,
          imagenId: result.image.hash,
          fechaSubida: new Date().toISOString(),
          estado: 'pendiente', // pendiente, aceptada, rechazada
          usuarioId: auth.currentUser?.uid,
          cantidad: producto.cantidad || 1
        };

        await push(ref(db, 'recetas'), recetaData);
        
        setMensaje('Receta médica enviada correctamente. La farmacia la revisará.');
        setTimeout(() => {
          onUploadComplete(result.image.url);
        }, 1500);
      } else {
        setMensaje('Error al subir la imagen. Por favor intenta de nuevo.');
      }

    } catch (error) {
      setMensaje('Error al subir la receta: ' + error.message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>
          📋 Receta Médica Requerida
        </h3>
        
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '5px',
          padding: '15px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            El medicamento <strong>{producto.nombre}</strong> requiere una receta médica.
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
            Por favor sube una imagen clara de tu receta médica para continuar con la compra.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Seleccionar imagen de receta:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '2px dashed #ccc',
                borderRadius: '5px',
                textAlign: 'center'
              }}
            />
            {imagen && (
              <div style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '5px',
                fontSize: '14px'
              }}>
                ✅ Archivo seleccionado: {imagen.name}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                border: '1px solid #ccc',
                backgroundColor: '#f8f9fa',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!imagen || subiendo}
              style={{
                padding: '10px 20px',
                border: 'none',
                backgroundColor: subiendo ? '#ccc' : '#007bff',
                color: 'white',
                borderRadius: '5px',
                cursor: subiendo ? 'not-allowed' : 'pointer'
              }}
            >
              {subiendo ? 'Subiendo...' : 'Enviar Receta'}
            </button>
          </div>
        </form>

        {mensaje && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            borderRadius: '5px',
            backgroundColor: mensaje.includes('Error') ? '#f8d7da' : '#d4edda',
            color: mensaje.includes('Error') ? '#721c24' : '#155724',
            textAlign: 'center'
          }}>
            {mensaje}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadReceta;
