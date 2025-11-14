/**
 * Componente para subir recetas médicas con hosting externo.
 * Permite al usuario subir una imagen de receta para un producto específico.
 *
 * Props:
 * - producto: objeto del producto
 * - farmaciaId: id de la farmacia
 * - onUploadComplete: callback al finalizar subida
 * - onCancel: callback para cancelar
 */
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { push } from 'firebase/database';

const UploadReceta = ({ producto, farmaciaId, onUploadComplete, onCancel }) => {
  const [imagen, setImagen] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const acceptedFormatsText = 'Aceptamos fotos en JPG, JPEG, PNG, WEBP y HEIC.';

  // Maneja el cambio de archivo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const name = String(file.name || '').toLowerCase();
      const isImageByType = file.type && file.type.startsWith('image/');
      const isImageByExt = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.heic') || name.endsWith('.heif');
      if (isImageByType || isImageByExt) {
        setImagen(file);
        setMensaje('');
      } else {
        setMensaje('Lo que estás cargando no parece una foto. Por favor subí una foto en formato JPG, PNG o WEBP.');
        setImagen(null);
      }
    }
  };

  // Envía la receta usando hosting externo
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imagen) {
      setMensaje('Por favor selecciona una imagen de la receta médica');
      return;
    }
    setSubiendo(true);
    setMensaje('');
    try {
      const formData = new FormData();
      formData.append('file', imagen);
      // Subida a FreeImageHosting
      const response = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        const recetaData = {
          productoId: producto.id,
          productoNombre: producto.nombre,
          farmaciaId: farmaciaId,
          imagenURL: result.image.url,
          imagenId: result.image.hash,
          fechaSubida: new Date().toISOString(),
          estado: 'pendiente',
          usuarioId: auth.currentUser?.uid,
          cantidad: producto.cantidad || 1
        };
        await push(ref(db, 'recetas'), recetaData);
        setMensaje('Receta médica enviada correctamente. La farmacia la revisará.');
        setTimeout(() => {
          onUploadComplete(result.image.url);
        }, 1500);
      } else {
        setMensaje('No se pudo subir la imagen. Por favor intenta de nuevo.');
      }
    } catch (error) {
      console.error(error);
      setMensaje('No se pudo subir la receta. Intenta nuevamente más tarde.');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
        <h3>Subir Receta Médica</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="file" accept="image/*" onChange={handleFileChange} disabled={subiendo} />
            <button type="button" onClick={() => setShowHelp(s => !s)} style={{ padding: '4px 8px' }}>?</button>
          </div>
          {showHelp && (
            <div style={{ background: '#f1f1f1', padding: '8px', borderRadius: 6, marginBottom: 8 }}>
              <strong>¿Qué archivos aceptamos?</strong>
              <div style={{ marginTop: 6 }}>{acceptedFormatsText} Si subís otro tipo de archivo (por ejemplo PDF o DOCX) no vas a poder continuar.</div>
            </div>
          )}
          <div style={{ margin: '10px 0' }}>
            <button type="submit" disabled={subiendo} style={{ marginRight: 8 }}>Enviar</button>
            <button type="button" onClick={onCancel} disabled={subiendo}>Cancelar</button>
          </div>
        </form>
        {mensaje && <p style={{ color: mensaje.includes('Error') ? 'red' : 'green' }}>{mensaje}</p>}
      </div>
    </div>
  );
};

export default UploadReceta;
