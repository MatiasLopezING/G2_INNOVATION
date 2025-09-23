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
import React from 'react';
import { db, auth } from '../firebase';
import { push } from 'firebase/database';
import { useUploadReceta } from '../hooks/useUploadReceta';

const UploadReceta = ({ producto, farmaciaId, onUploadComplete, onCancel }) => {
  const {
    imagen,
    subiendo,
    mensaje,
    preview,
    onImagenSeleccionada,
    onEnviarReceta
  } = useUploadReceta({
    onUpload: async (imagen, recetaParams, setMensaje, setSubiendo, onComplete) => {
      const formData = new FormData();
      formData.append('file', imagen);
      try {
        const response = await fetch('https://freeimage.host/api/1/upload', {
          method: 'POST',
          body: formData
        });
        const result = await response.json();
        if (result.success) {
          const recetaData = {
            productoId: recetaParams.producto.id,
            productoNombre: recetaParams.producto.nombre,
            farmaciaId: recetaParams.farmaciaId,
            imagenURL: result.image.url,
            imagenId: result.image.hash,
            fechaSubida: new Date().toISOString(),
            estado: 'pendiente',
            usuarioId: auth.currentUser?.uid,
            cantidad: recetaParams.producto.cantidad || 1
          };
          await push(ref(db, 'recetas'), recetaData);
          setMensaje('Receta médica enviada correctamente. La farmacia la revisará.');
          setTimeout(() => {
            onComplete(result.image.url);
          }, 1500);
        } else {
          setMensaje('Error al subir la imagen. Por favor intenta de nuevo.');
        }
      } catch (error) {
        setMensaje('Error al subir la receta: ' + error.message);
      } finally {
        setSubiendo(false);
      }
    },
    onComplete: onUploadComplete
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
        <h3>Subir Receta Médica</h3>
        <form onSubmit={e => onEnviarReceta(e, { producto, farmaciaId })}>
          <input type="file" accept="image/*" onChange={onImagenSeleccionada} disabled={subiendo} />
          {preview && <img src={preview} alt="Preview" style={{ width: '100%', margin: '10px 0', borderRadius: '8px' }} />}
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
