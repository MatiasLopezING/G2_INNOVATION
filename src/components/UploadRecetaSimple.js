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
import React, { useEffect } from 'react';
import { db, auth } from '../firebase';
import { push, ref, onValue } from 'firebase/database';
import { useUploadReceta } from '../hooks/useUploadReceta';

const UploadRecetaSimple = ({ producto, farmaciaId, onUploadComplete, onCancel }) => {
  const [recetaPendiente, setRecetaPendiente] = React.useState(false);
  const {

    subiendo,
    mensaje,
    preview,
    onImagenSeleccionada,
    onEnviarReceta
  } = useUploadReceta({
    onUpload: async (imagen, recetaParams, setMensaje, setSubiendo, onComplete) => {
      // Convierte imagen a base64 y sube a Firebase
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Image = event.target.result;
          const recetaData = {
            productoId: recetaParams.producto.id,
            productoNombre: recetaParams.producto.nombre,
            farmaciaId: recetaParams.farmaciaId,
            imagenBase64: base64Image,
            fechaSubida: new Date().toISOString(),
            estado: 'por_aceptar', // Esperando pago
            usuarioId: auth.currentUser?.uid,
            cantidad: recetaParams.producto.cantidad || 1
          };
          const recetaRef = await push(ref(db, 'recetas'), recetaData);
          setMensaje('Receta enviada correctamente. La farmacia la revisará.');
          setTimeout(() => {
            onComplete(base64Image, recetaRef.key);
          }, 1500);
        } catch (error) {
          setMensaje('Error al subir la receta: ' + error.message);
        } finally {
          setSubiendo(false);
        }
      };
      reader.readAsDataURL(imagen);
    },
    onComplete: onUploadComplete
  });

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



  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
        <h3>Subir Receta Médica</h3>
        {recetaPendiente && <p style={{ color: 'orange' }}>Ya tienes una receta pendiente para este producto.</p>}
        <form onSubmit={e => onEnviarReceta(e, { producto, farmaciaId })}>
          <input type="file" accept="image/*" onChange={onImagenSeleccionada} disabled={subiendo || recetaPendiente} />
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
