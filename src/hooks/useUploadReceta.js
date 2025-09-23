import { useState } from 'react';

/**
 * Hook para manejar la lógica de subida de recetas médicas.
 * Permite seleccionar imagen, mostrar preview, manejar estados y enviar receta.
 * Recibe una función onUpload que realiza la subida específica (base64 o URL externa).
 */
export function useUploadReceta({ onUpload, onComplete }) {
  const [imagen, setImagen] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [preview, setPreview] = useState(null);

  // Maneja el cambio de archivo y genera preview
  const onImagenSeleccionada = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setImagen(file);
        setMensaje('');
        const reader = new FileReader();
        reader.onload = (event) => {
          setPreview(event.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        setMensaje('Por favor selecciona una imagen válida');
        setImagen(null);
        setPreview(null);
      }
    }
  };

  // Envía la receta usando la función onUpload
  const onEnviarReceta = async (e, recetaParams) => {
    e.preventDefault();
    if (!imagen) {
      setMensaje('Por favor selecciona una imagen de la receta médica');
      return;
    }
    setSubiendo(true);
    setMensaje('');
    try {
      await onUpload(imagen, recetaParams, setMensaje, setSubiendo, onComplete);
    } catch (error) {
      setMensaje('Error al subir la receta: ' + error.message);
      setSubiendo(false);
    }
  };

  return { imagen, subiendo, mensaje, preview, onImagenSeleccionada, onEnviarReceta };
}
