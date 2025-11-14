/**
 * Componente para registro de usuarios, farmacias y deliverys.
 * No recibe props. Utiliza pasos y formularios según el rol seleccionado.
 */

import React, { useState } from 'react';
import VideoBackground from './VideoBackground';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { ref, set, get, push } from 'firebase/database';
import { auth, db } from '../firebase';
import { isDniRegistered, isEmailRegisteredInDb } from '../utils/firebaseUtils';
import { useNavigate } from "react-router-dom";
import HorariosFarmacia from './HorariosFarmacia';

const Register = () => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({}); // errors por campo
  const [success, setSuccess] = useState('');
  const [showFormat, setShowFormat] = useState(false);
  const navigate = useNavigate();

  // Usuario
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [obraSocial, setObraSocial] = useState('');
  const [nroAfiliado, setNroAfiliado] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [cobertura, setCobertura] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [coordStatus, setCoordStatus] = useState(null); // null, 'ok', 'fail'
  // Tarjeta (simulación)
  const [tarjeta, setTarjeta] = useState('');
  const [codigoTarjeta, setCodigoTarjeta] = useState('');

  // Farmacia
  const [nombreFarmacia, setNombreFarmacia] = useState('');
  const [direccionFarmacia, setDireccionFarmacia] = useState('');
  const [latFarmacia, setLatFarmacia] = useState('');
  const [lngFarmacia, setLngFarmacia] = useState('');
  const [coordStatusFarmacia, setCoordStatusFarmacia] = useState(null); // null, 'ok', 'fail'
  const [contactoFarmacia, setContactoFarmacia] = useState('');
  const [obrasSocialesAceptadas, setObrasSocialesAceptadas] = useState([]);
  const [obraSocialInput, setObraSocialInput] = useState('');
  const [horarios, setHorarios] = useState(null);

  // Delivery
  const [dniDelivery, setDniDelivery] = useState('');
  const [contactoDelivery, setContactoDelivery] = useState('');
  // Images for delivery verification (frente/reverso)
  const [frontImageFile, setFrontImageFile] = useState(null);
  const [backImageFile, setBackImageFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [showHelpDelivery, setShowHelpDelivery] = useState(false);
  const acceptedFormatsText = 'Aceptamos fotos en JPG, JPEG, PNG, WEBP y HEIC. Si subís otro tipo de archivo (ej: PDF) no vas a poder continuar.';

  const handleNext = (e) => {
    e.preventDefault();
    if (!role) {
      setError('Por favor selecciona qué tipo de cuenta quieres crear.');
      return;
    }
    setError('');
    // fade out, then change step to allow a smooth transition
    setIsFading(true);
    setTimeout(() => {
      setStep(2);
      setIsFading(false);
    }, 300);
  };

  // local state to control fade class during step transitions
  const [isFading, setIsFading] = useState(false);

  // Validaciones por campo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const detectEmojiOrInvisible = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{C}]/u;

  const validateField = (field, value) => {
    const v = value === undefined || value === null ? '' : String(value).trim();
    switch (field) {
      case 'email':
        if (!v) return 'Por favor ingresa tu correo.';
        if (v !== v.toLowerCase()) return 'Escribe el correo en minúsculas, sin espacios.';
        if (v.includes(' ')) return 'El correo no puede contener espacios.';
        if (!emailRegex.test(v)) return 'Ese correo no parece válido. Ej: nombre@ejemplo.com';
        return '';
      case 'password':
        if (!v) return 'Por favor ingresa una contraseña.';
        if (v.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
        if (v.length > 1000) return 'La contraseña es demasiado larga.';
        if (/^\s+$/.test(value)) return 'La contraseña no puede ser solo espacios.';
        if (detectEmojiOrInvisible.test(v)) return 'La contraseña contiene caracteres inválidos.';
        return '';
      case 'dni':
        if (!v) return 'Por favor ingresa tu DNI.';
        if (!/^\d+$/.test(v)) return 'El DNI solo debe tener números.';
        if (/^0+/.test(v)) return 'El DNI no debe empezar con ceros.';
        if (v.length < 6 || v.length > 10) return 'El DNI parece tener una longitud incorrecta.';
        return '';
      case 'nombre':
      case 'apellido':
        if (!v) return 'Por favor completa este campo.';
        if (/\d/.test(v)) return 'No uses números aquí.';
        if (detectEmojiOrInvisible.test(v)) return 'No uses emojis aquí.';
        if (v.length > 200) return 'Texto demasiado largo.';
        return '';
      case 'obraSocial':
        if (!v) return 'Por favor indica tu obra social.';
        if (/<script|<\/?[a-z][\s\S]*>/i.test(value)) return 'Nombre inválido.';
        if (v.length > 200) return 'Nombre demasiado largo.';
        return '';
      case 'nroAfiliado':
        if (!v) return 'Por favor ingresa tu número de afiliado.';
  if (/[^0-9-]/.test(v)) return 'Número de afiliado inválido.';
        if (v.length > 50) return 'Número de afiliado demasiado largo.';
        return '';
      case 'vencimiento':
        if (!v) return 'Por favor indica la fecha de vencimiento.';
        // Validar YYYY-MM-DD estrictamente y que sea futura y no demasiado lejana (10 años)
        {
          const parts = String(v).split('-').map(p => Number(p));
          const [y, m, d] = parts;
          if (parts.length !== 3 || !Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return 'La fecha ingresada no es válida.';
          const dt = new Date(y, m - 1, d);
          if (dt.getFullYear() !== y || (dt.getMonth() + 1) !== m || dt.getDate() !== d) return 'La fecha ingresada no es válida.';
          const hoy = new Date(); hoy.setHours(0,0,0,0);
          dt.setHours(0,0,0,0);
          if (dt <= hoy) return 'La fecha de vencimiento debe ser futura.';
          const max = new Date(); max.setFullYear(max.getFullYear() + 10); max.setHours(0,0,0,0);
          if (dt > max) return 'La fecha de vencimiento es demasiado lejana.';
          return '';
        }
        
      case 'fechaNacimiento':
        if (!v) return 'Por favor indica la fecha de nacimiento.';
        {
          const parts = String(v).split('-').map(p => Number(p));
          const [y, m, d] = parts;
          if (parts.length !== 3 || !Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return 'La fecha ingresada no es válida.';
          const dt = new Date(y, m - 1, d);
          if (dt.getFullYear() !== y || (dt.getMonth() + 1) !== m || dt.getDate() !== d) return 'La fecha ingresada no es válida.';
          const hoy = new Date(); hoy.setHours(0,0,0,0);
          dt.setHours(0,0,0,0);
          if (dt > hoy) return 'La fecha de nacimiento no puede ser futura.';
          // edad máxima razonable: 120 años
          const limite = new Date(); limite.setFullYear(limite.getFullYear() - 120); limite.setHours(0,0,0,0);
          if (dt < limite) return 'La fecha de nacimiento indica una edad fuera de rango.';
          return '';
        }
      case 'cobertura':
        if (!v) return 'Por favor indica la cobertura.';
        return '';
      case 'tarjeta':
        if (!v) return '';
        if (!/^\d+$/.test(v)) return 'La tarjeta debe tener solo números.';
        if (v.length < 13 || v.length > 19) return 'La tarjeta debe tener entre 13 y 19 dígitos.';
        return '';
      case 'codigoTarjeta':
        if (!v) return 'Por favor ingresa el código de la tarjeta (CVV).';
        if (!/^\d+$/.test(v)) return 'El CVV debe tener solo números.';
        if (v.length < 3 || v.length > 4) return 'El CVV debe tener 3 o 4 dígitos.';
        return '';
      case 'direccion':
        if (!v) return 'Por favor ingresa la dirección.';
        if (/<script|<\/?[a-z][\s\S]*>/i.test(value)) return 'Dirección inválida.';
        if (v.length > 500) return 'Dirección demasiado larga.';
        return '';
      case 'coords':
        // value expected as {lat, lng}
        if (!value) return 'No se encontraron las coordenadas. Usa el botón para buscarlas o completa la dirección.';
        const latN = Number(value.lat);
        const lngN = Number(value.lng);
        if (!isFinite(latN) || !isFinite(lngN)) return 'Coordenadas inválidas.';
        if (latN === 0 && lngN === 0) return 'Coordenadas inválidas.';
        return '';
      default:
        return '';
    }
  };

  const setFieldError = (field, msg) => {
    setErrors(prev => ({ ...prev, [field]: msg }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      // Validar todos los campos antes de intentar crear el usuario
      const validationErrors = {};
      // campos comunes
      validationErrors.email = validateField('email', email);
      validationErrors.password = validateField('password', password);
      if (role === 'Usuario') {
        validationErrors.dni = validateField('dni', dni);
        validationErrors.nombre = validateField('nombre', nombre);
        validationErrors.apellido = validateField('apellido', apellido);
        validationErrors.fechaNacimiento = validateField('fechaNacimiento', fechaNacimiento);
        validationErrors.obraSocial = validateField('obraSocial', obraSocial);
        validationErrors.nroAfiliado = validateField('nroAfiliado', nroAfiliado);
        validationErrors.vencimiento = validateField('vencimiento', vencimiento);
        validationErrors.cobertura = validateField('cobertura', cobertura);
        validationErrors.direccion = validateField('direccion', direccion);
        validationErrors.tarjeta = validateField('tarjeta', tarjeta);
        validationErrors.codigoTarjeta = validateField('codigoTarjeta', codigoTarjeta);
        validationErrors.coords = validateField('coords', { lat, lng });
      } else if (role === 'Farmacia') {
        validationErrors.nombreFarmacia = nombreFarmacia ? '' : 'Nombre de farmacia vacío';
        validationErrors.direccionFarmacia = validateField('direccion', direccionFarmacia);
      } else if (role === 'Distribuidor') {
        validationErrors.dniDelivery = validateField('dni', dniDelivery);
        validationErrors.fechaNacimiento = validateField('fechaNacimiento', fechaNacimiento);
        // validar imagenes frente/reverso
        if (!frontImageFile) validationErrors.frontImage = 'Por favor sube la imagen del frente del documento.';
        if (!backImageFile) validationErrors.backImage = 'Por favor sube la imagen del reverso del documento.';
      }
      // filtrar y setear errores
      Object.keys(validationErrors).forEach(k => setFieldError(k, validationErrors[k] || ''));
      const hasErrors = Object.values(validationErrors).some(v => v);
      if (hasErrors) {
        setError('Por favor corrige los campos marcados arriba.');
        return;
      }

      // Verificar duplicados en DB/Auth
      // Email: comprobar en Auth (fetchSignInMethodsForEmail) y en Realtime DB
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods && methods.length > 0) {
          setFieldError('email', 'Este correo ya está registrado.');
          setError('Este correo ya está registrado. Usa otro correo o inicia sesión.');
          return;
        }
      } catch (e) {
        // Si fetchSignInMethodsForEmail falla por red o limit, seguimos y comprobamos DB
      }
      const emailInDb = await isEmailRegisteredInDb(email);
      if (emailInDb) {
        setFieldError('email', 'Este correo ya está registrado.');
        setError('Este correo ya está registrado. Usa otro correo o inicia sesión.');
        return;
      }

      if (role === 'Usuario' || role === 'Distribuidor') {
        const checkDni = role === 'Usuario' ? dni : dniDelivery;
        if (await isDniRegistered(checkDni)) {
          setFieldError('dni', 'Este DNI ya está registrado.');
          setError('Este DNI ya está registrado. Si es tu caso, intenta recuperar la cuenta.');
          return;
        }
      }

      // Helper para convertir File a base64 (DataURL)
      const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
        try {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = (ev) => reject(ev);
          reader.readAsDataURL(file);
        } catch (e) {
          reject(e);
        }
      });

  // Variables para almacenar imágenes base64 de delivery (declaradas aquí para que estén
  // visibles tanto dentro del bloque de creación como después al notificar a farmacias)
  let frontBase64 = null;
  let backBase64 = null;

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      let userData = { email, role };
      if (role === 'Usuario') {
        userData = {
          ...userData,
          dni,
          nombre,
          apellido,
          fechaNacimiento,
          obraSocial,
          nroAfiliado,
          vencimiento,
          cobertura,
            latitud: lat,
            longitud: lng
          ,
          // guardar el string de dirección original tal como lo ingresó el usuario
          addressString: direccion
        };
        // Simulamos almacenamiento de tarjeta: guardamos versión enmascarada en la DB
        if (tarjeta) {
          const maskedCard = tarjeta.replace(/\d(?=\d{4})/g, '*');
          const maskedCode = codigoTarjeta ? '***' : '';
          userData.tarjeta = maskedCard;
          userData.codigoTarjeta = maskedCode; // nunca almacenar CVV real en producción
          try {
            // Simulación adicional: almacenar (base64) en localStorage para pruebas
            if (typeof window !== 'undefined' && window.localStorage) {
              const raw = { tarjeta, codigoTarjeta };
              window.localStorage.setItem('card_' + user.uid, btoa(JSON.stringify(raw)));
            }
          } catch (e) {
            // no crítico, continuar
            console.warn('No se pudo almacenar la tarjeta en localStorage (simulación)');
          }
        }
      } else if (role === 'Farmacia') {
        userData = {
          ...userData,
          nombreFarmacia,
          latitud: latFarmacia,
          longitud: lngFarmacia,
          contactoFarmacia,
          obrasSocialesAceptadas,
          horarios
          ,
          // guardar el string de dirección original tal como lo ingresó la farmacia
          addressString: direccionFarmacia
        };
      } else if (role === 'Distribuidor') {
  // convertir imagenes a base64 y guardarlas en DB para revisión
        try {
          if (frontImageFile) frontBase64 = await readFileAsDataURL(frontImageFile);
          if (backImageFile) backBase64 = await readFileAsDataURL(backImageFile);
        } catch (e) {
          console.warn('No se pudo convertir las imágenes a base64', e);
        }
        userData = {
          ...userData,
          dni: dniDelivery,
          fechaNacimiento,
          contacto: contactoDelivery,
          deliveryImages: {
            frente: frontBase64,
            reverso: backBase64
          },
          // flag explícita para permitir login cuando la farmacia acepte
          deliveryVerified: false,
          // estado para que el farmacéutico pueda aceptar/rechazar
          deliveryVerification: {
            status: 'pendiente', // pendiente | accepted | rejected
            message: '',
            fechaSubida: new Date().toISOString()
          }
        };
      }
      await set(ref(db, 'users/' + user.uid), userData);
      // Si es distribuidor, notificar a todas las farmacias registradas
      if (role === 'Distribuidor') {
        try {
          const usersSnapshot = await get(ref(db, 'users'));
          const usersData = usersSnapshot.val();
          if (usersData) {
            Object.entries(usersData).forEach(async ([farmUid, farmData]) => {
              try {
                if (farmData && farmData.role === 'Farmacia') {
                  // crear notificación en el nodo de la farmacia
                  await push(ref(db, `notificaciones/${farmUid}`), {
                    tipo: 'delivery_registro',
                    mensaje: `Se registró un nuevo delivery: ${email}`,
                    fecha: new Date().toISOString(),
                    deliveryUid: user.uid,
                    deliveryEmail: email,
                    frente: frontBase64,
                    reverso: backBase64,
                    status: 'pendiente'
                  });
                }
              } catch (e) {
                console.warn('No se pudo crear notificación para farmacia', farmUid, e);
              }
            });
          }
        } catch (e) {
          console.warn('No se pudo obtener la lista de farmacias para notificar', e);
        }
      }
  setSuccess('Registro exitoso. Ya podés iniciar sesión.');
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      console.error(err);
      setError('No se pudo crear la cuenta. Intenta de nuevo más tarde.');
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <VideoBackground src="/login-bg.mp4" />

      <div className={(isFading ? 'fade-out ' : 'fade-in ') + 'form-step'}
           style={{ maxWidth: "420px", width: '90%', background: 'rgba(255,255,255,0.95)', padding: "30px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", position: 'fixed', zIndex: 10, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <img src="/RecetApp.png" alt="RecetApp" style={{ width: 120, height: 'auto', objectFit: 'contain' }} onError={(e)=>{e.target.style.display='none'}} />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 18 }}>Registro</h2>
        {step === 1 ? (
          <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label>Tipo de usuario:</label>
            <select value={role} onChange={e => setRole(e.target.value)} required>
              <option value="">Selecciona...</option>
              <option value="Usuario">Usuario</option>
              <option value="Farmacia">Farmacia</option>
              <option value="Distribuidor">Delivery/Repartidor</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => navigate('/')}>Volver al login</button>
              <button type="submit">Siguiente</button>
            </div>
            {error && <div style={{ color: 'red' }}>{error}</div>}
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => { setIsFading(true); setTimeout(()=>{ setStep(1); setIsFading(false); }, 300); }}>← Volver</button>
              <button type="button" onClick={() => setShowFormat(s => !s)}>{showFormat ? 'Ocultar formato' : 'Formato esperado'}</button>
            </div>
            {role ? (
              <div style={{ background: '#f7f7f7', padding: 8, borderRadius: 6 }}>
                Registrando como: <strong>{role}</strong>
                <button
                  type="button"
                  style={{ marginLeft: 8 }}
                  onClick={() => { setIsFading(true); setTimeout(()=>{ setStep(1); setIsFading(false); }, 300); }}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <label>Tipo de usuario:</label>
                <select value={role} onChange={e => setRole(e.target.value)} required>
                  <option value="">Selecciona...</option>
                  <option value="Usuario">Usuario</option>
                  <option value="Farmacia">Farmacia</option>
                  <option value="Distribuidor">Delivery/Repartidor</option>
                </select>
              </>
            )}
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit">Registrar</button>
            {error && <div style={{ color: 'red' }}>{error}</div>}
            {success && <div style={{ color: 'green' }}>{success}</div>}
          </form>
        )}
      </div>
    </div>
  );
}

export default Register;
