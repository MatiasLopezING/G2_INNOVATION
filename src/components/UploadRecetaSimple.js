/**
 * Componente para subir recetas médicas simples.
 * Permite al usuario subir una imagen de receta para un producto específico.
 *
 * Props:
 * - producto: objeto del producto
 * - farmaciaId: id de la farmacia
 * - onUploadComplete: callback al finalizar subida
 * - onCancel: callback para cancelar
 */
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { push, ref, onValue } from 'firebase/database';

const UploadRecetaSimple = ({ producto, farmaciaId, onUploadComplete, onCancel }) => {
  const [imagen, setImagen] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [preview, setPreview] = useState(null);
  const [recetaPendiente, setRecetaPendiente] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const acceptedFormatsText = 'Aceptamos fotos en JPG, JPEG, PNG, WEBP y HEIC.';
  const [justUploaded, setJustUploaded] = useState(false);

  // Verifica si ya existe una receta pendiente para este producto
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const recetasRef = ref(db, 'recetas');
    const unsubscribe = onValue(recetasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Normalizar y comparar como strings para evitar falsos positivos
        const lista = Object.entries(data).map(([id, receta]) => ({ id, ...receta }));
        const recetasUsuario = lista.filter(receta => {
          if (!receta) return false;
          if (!receta.usuarioId || !receta.productoId) return false;
          return String(receta.usuarioId) === String(user.uid) && String(receta.productoId) === String(producto.id) && receta.estado === 'pendiente';
        });
        setRecetaPendiente(recetasUsuario.length > 0);
      } else {
        setRecetaPendiente(false);
      }
    });
    return () => unsubscribe();
  }, [producto.id]);

  // Maneja el cambio de archivo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Aceptar si el navegador reconoce como image/* o por extensión conocida
      const name = String(file.name || '').toLowerCase();
      const isImageByType = file.type && file.type.startsWith('image/');
      const isImageByExt = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.heic') || name.endsWith('.heif');
      if (isImageByType || isImageByExt) {
        setImagen(file);
        setMensaje('');
        // Preview
        const reader = new FileReader();
        reader.onload = (event) => {
          setPreview(event.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        // Mensaje amigable para usuarios no técnicos
        setMensaje('Lo que estás cargando no parece una foto. Por favor subí una foto en formato JPG, PNG o WEBP.');
        setImagen(null);
        setPreview(null);
      }
    }
  };

  // Envía la receta
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imagen) {
      setMensaje('Por favor selecciona una imagen de la receta médica');
      return;
    }
    setSubiendo(true);
    setMensaje('');
    try {
      // Convierte imagen a base64 para almacenar en Firebase
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Image = event.target.result;
          const recetaData = {
            productoId: producto.id,
            productoNombre: producto.nombre,
            farmaciaId: farmaciaId,
            imagenBase64: base64Image,
            fechaSubida: new Date().toISOString(),
            estado: 'pendiente',
            usuarioId: auth.currentUser?.uid,
            cantidad: producto.cantidad || 1
          };
          await push(ref(db, 'recetas'), recetaData);
          // Evitar que el listener muestre el aviso justo después de nuestra propia subida
          setJustUploaded(true);
          setMensaje('Receta enviada correctamente. La farmacia la revisará.');
          setTimeout(() => {
            onUploadComplete(base64Image);
            // limpiar el flag poco después de cerrar el modal por si el componente sigue montado
            setTimeout(() => setJustUploaded(false), 1000);
          }, 1500);
          } catch (error) {
          console.error(error);
          setMensaje('No se pudo enviar la receta. Intenta nuevamente.');
        } finally {
          setSubiendo(false);
        }
      };
      reader.readAsDataURL(imagen);
    } catch (error) {
      console.error(error);
      setMensaje('No se pudo procesar la imagen. Intenta con otra foto o intenta más tarde.');
      setSubiendo(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
  <h3>Subir Receta Médica</h3>
  {recetaPendiente && !subiendo && !justUploaded && <p style={{ color: 'orange' }}>Ya tienes una receta pendiente para este producto.</p>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="file" accept="image/*" onChange={handleFileChange} disabled={subiendo || recetaPendiente} />
            <button type="button" onClick={() => setShowHelp(s => !s)} style={{ padding: '4px 8px' }}>?</button>
          </div>
          {showHelp && (
            <div style={{ background: '#f1f1f1', padding: '8px', borderRadius: 6, marginBottom: 8 }}>
              <strong>¿Qué archivos aceptamos?</strong>
              <div style={{ marginTop: 6 }}>{acceptedFormatsText} Si subís otro tipo de archivo (por ejemplo PDF o DOCX) no vas a poder continuar.</div>
            </div>
          )}
          {preview && <img src={preview} alt="Preview" style={{ width: '100%', margin: '10px 0', borderRadius: '8px' }} />}
          <div style={{ margin: '10px 0' }}>
            <button type="submit" disabled={subiendo || recetaPendiente} style={{ marginRight: 8 }}>Enviar</button>
            <button type="button" onClick={onCancel} disabled={subiendo}>Cancelar</button>
          </div>
        </form>
        {mensaje && <p style={{ color: mensaje.includes('Error') ? 'red' : 'green' }}>{mensaje}</p>}
      </div>
    </div>
  );
};

export default UploadRecetaSimple;
