import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { push, ref, onValue } from 'firebase/database';

const UploadRecetaSimple = ({ producto, farmaciaId, onUploadComplete, onCancel }) => {
  const [imagen, setImagen] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [preview, setPreview] = useState(null);
  const [recetaPendiente, setRecetaPendiente] = useState(false);

  // Verificar si ya existe una receta pendiente para este producto
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const recetasRef = ref(db, 'recetas');
    const unsubscribe = onValue(recetasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const recetasUsuario = Object.values(data).filter(receta => 
          receta.usuarioId === user.uid && 
          receta.productoId === producto.id && 
          receta.estado === 'pendiente'
        );
        setRecetaPendiente(recetasUsuario.length > 0);
      } else {
        setRecetaPendiente(false);
      }
    });

    return () => unsubscribe();
  }, [producto.id]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setImagen(file);
        setMensaje('');
        
        // Crear preview
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imagen) {
      setMensaje('Por favor selecciona una imagen de la receta médica');
      return;
    }

    setSubiendo(true);
    setMensaje('');

    try {
      // Convertir imagen a base64 para almacenar directamente en Firebase
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Image = event.target.result;
          
          // Guardar información de la receta en la base de datos (con imagen en base64)
          const recetaData = {
            productoId: producto.id,
            productoNombre: producto.nombre,
            farmaciaId: farmaciaId,
            imagenBase64: base64Image,
            fechaSubida: new Date().toISOString(),
            estado: 'pendiente', // pendiente, aceptada, rechazada
            usuarioId: auth.currentUser?.uid,
            cantidad: producto.cantidad || 1
          };

          await push(ref(db, 'recetas'), recetaData);
          
          setMensaje('Receta médica enviada correctamente. La farmacia la revisará.');
          setTimeout(() => {
            onUploadComplete(base64Image);
          }, 1500);

        } catch (error) {
          setMensaje('Error al guardar la receta: ' + error.message);
        } finally {
          setSubiendo(false);
        }
      };
      
      reader.readAsDataURL(imagen);

    } catch (error) {
      setMensaje('Error al procesar la receta: ' + error.message);
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
          backgroundColor: recetaPendiente ? '#d1ecf1' : '#fff3cd',
          border: `1px solid ${recetaPendiente ? '#bee5eb' : '#ffeaa7'}`,
          borderRadius: '5px',
          padding: '15px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            El medicamento <strong>{producto.nombre}</strong> requiere una receta médica.
          </p>
          {recetaPendiente ? (
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#0c5460' }}>
              ⏳ Ya tienes una receta médica pendiente de revisión para este medicamento. 
              Espera la respuesta de la farmacia antes de subir una nueva.
            </p>
          ) : (
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
              Por favor sube una imagen clara de tu receta médica para continuar con la compra.
            </p>
          )}
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
            
            {preview && (
              <div style={{ marginTop: '10px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>Vista previa:</p>
                <img
                  src={preview}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
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
              disabled={!imagen || subiendo || recetaPendiente}
              style={{
                padding: '10px 20px',
                border: 'none',
                backgroundColor: subiendo || recetaPendiente ? '#ccc' : '#007bff',
                color: 'white',
                borderRadius: '5px',
                cursor: subiendo || recetaPendiente ? 'not-allowed' : 'pointer'
              }}
            >
              {recetaPendiente ? 'Receta Pendiente' : subiendo ? 'Subiendo...' : 'Enviar Receta'}
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

export default UploadRecetaSimple;
