/**
 * Componente para registro de usuarios, farmacias y deliverys.
 * Versión avanzada: validaciones por campo, ayudas de formato,
 * geocodificación de direcciones y (para delivery) validación de imágenes.
 * No usa ningún fondo de video.
 */

import React, { useState } from 'react';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { ref, set, get, push } from 'firebase/database';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import HorariosFarmacia from './HorariosFarmacia';
import { isDniRegistered, isEmailRegisteredInDb } from '../utils/firebaseUtils';

const Register = () => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [showFormat, setShowFormat] = useState(false);
  const [isFading, setIsFading] = useState(false);
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
  const [coordStatus, setCoordStatus] = useState(null); // null | 'ok' | 'fail'
  const [tarjeta, setTarjeta] = useState('');
  const [codigoTarjeta, setCodigoTarjeta] = useState('');

  // Farmacia
  const [nombreFarmacia, setNombreFarmacia] = useState('');
  const [direccionFarmacia, setDireccionFarmacia] = useState('');
  const [latFarmacia, setLatFarmacia] = useState('');
  const [lngFarmacia, setLngFarmacia] = useState('');
  const [coordStatusFarmacia, setCoordStatusFarmacia] = useState(null);
  const [contactoFarmacia, setContactoFarmacia] = useState('');
  const [obrasSocialesAceptadas, setObrasSocialesAceptadas] = useState([]);
  const [obraSocialInput, setObraSocialInput] = useState('');
  const [horarios, setHorarios] = useState(null);

  // Delivery
  const [dniDelivery, setDniDelivery] = useState('');
  const [contactoDelivery, setContactoDelivery] = useState('');
  const [frontImageFile, setFrontImageFile] = useState(null);
  const [backImageFile, setBackImageFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [showHelpDelivery, setShowHelpDelivery] = useState(false);
  const acceptedFormatsText = 'Aceptamos fotos en JPG, JPEG, PNG, WEBP y HEIC. Si subís otro tipo de archivo (ej: PDF) no vas a poder continuar.';

  // Validaciones
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const detectEmojiOrInvisible = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{C}]/u;

  const setFieldError = (field, msg) => setErrors(prev => ({ ...prev, [field]: msg }));

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
        if (!value) return 'No se encontraron las coordenadas. Usa el botón para buscarlas o completa la dirección.';
        {
          const latN = Number(value.lat);
          const lngN = Number(value.lng);
          if (!isFinite(latN) || !isFinite(lngN)) return 'Coordenadas inválidas.';
          if (latN === 0 && lngN === 0) return 'Coordenadas inválidas.';
          return '';
        }
      default:
        return '';
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!role) {
      setError('Por favor selecciona qué tipo de cuenta quieres crear.');
      return;
    }
    setError('');
    setIsFading(true);
    setTimeout(() => { setStep(2); setIsFading(false); }, 300);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      // Validaciones básicas
      const vEmail = validateField('email', email);
      const vPass = validateField('password', password);
      if (vEmail || vPass) {
        setFieldError('email', vEmail);
        setFieldError('password', vPass);
        return;
      }
      // Evitar duplicados evidentes
      const methods = await fetchSignInMethodsForEmail(auth, String(email).toLowerCase());
      const emailExistsInAuth = methods && methods.length > 0;
      const emailExistsInDb = await isEmailRegisteredInDb(email);
      if (emailExistsInAuth || emailExistsInDb) {
        setFieldError('email', 'Ese correo ya está registrado.');
        return;
      }
      if (role === 'Usuario' && validateField('dni', dni)) {
        setFieldError('dni', validateField('dni', dni));
        return;
      }
      if (role === 'Usuario') {
        const dniTaken = await isDniRegistered(dni);
        if (dniTaken) {
          setFieldError('dni', 'Ese DNI ya está registrado.');
          return;
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, String(email).toLowerCase(), password);
      const user = userCredential.user;

      let userData = { email: String(email).toLowerCase(), role };
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
          direccion,
          latitud: lat,
          longitud: lng
        };
      } else if (role === 'Farmacia') {
        userData = {
          ...userData,
          nombreFarmacia,
          direccionFarmacia,
          latitud: latFarmacia,
          longitud: lngFarmacia,
          contactoFarmacia,
          obrasSocialesAceptadas,
          horarios
        };
      } else if (role === 'Distribuidor') {
        userData = {
          ...userData,
          dni: dniDelivery,
          fechaNacimiento,
          contacto: contactoDelivery,
          deliveryVerification: { status: 'pendiente' },
          dinero: 0
        };
      }

      await set(ref(db, 'users/' + user.uid), userData);
      setSuccess('Usuario registrado correctamente');
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      console.error(err);
      setError('No pudimos registrar tu cuenta. Revisa los datos e intenta nuevamente.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <img src="/icons/RecetApp.png" alt="RecetApp" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 10 }} />
      <h2 style={{ textAlign: 'center' }}>Registro</h2>
      {step === 1 && (
        <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '300px', gap: '10px', background: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <label style={{ textAlign: 'center' }}>Tipo de usuario:</label>
          <select value={role} onChange={e => setRole(e.target.value)} required style={{ width: '100%' }}>
            <option value="">Selecciona...</option>
            <option value="Usuario">Usuario</option>
            <option value="Farmacia">Farmacia</option>
            <option value="Distribuidor">Delivery/Repartidor</option>
          </select>
          <div style={{ width: '100%', textAlign: 'right' }}>
            <button type="button" onClick={() => setShowFormat(v => !v)} style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer' }}>
              ¿Ver ejemplos de formato?
            </button>
          </div>
          {showFormat && (
            <div style={{ width: '100%', background: '#f8f8f8', padding: 12, borderRadius: 8, textAlign: 'left' }}>
              {role === 'Usuario' && (
                <div>
                  <p>- Email: ejemplo <em>nombre@ejemplo.com</em>. Usa minúsculas y sin espacios.</p>
                  <p>- Contraseña: mínimo 8 caracteres. Evita usar contraseñas obvias.</p>
                  <p>- DNI: solo números, entre 6 y 10 dígitos.</p>
                  <p>- Dirección: escribe la calle y número. Luego presiona “Obtener latitud y longitud”.</p>
                </div>
              )}
              {role === 'Farmacia' && (
                <div>
                  <p>- Nombre: nombre comercial de la farmacia.</p>
                  <p>- Dirección: escribe la dirección exacta y usa “Obtener latitud y longitud”.</p>
                  <p>- Horarios: apertura y cierre por día (ej. 09:00 - 20:00). La apertura debe ser antes del cierre.</p>
                </div>
              )}
              {role === 'Distribuidor' && (
                <div>
                  <p>- Email: ejemplo <em>nombre@ejemplo.com</em>. Usa minúsculas y sin espacios.</p>
                  <p>- Contraseña: mínimo 8 caracteres. Evita usar contraseñas obvias.</p>
                  <p>- DNI: solo números, entre 6 y 10 dígitos.</p>
                  <p>- Contacto: número de teléfono para que podamos coordinar entregas.</p>
                </div>
              )}
              {!role && (
                <div>Selecciona un rol para ver ejemplos claros de formato.</div>
              )}
            </div>
          )}
          <button type="submit" style={{ width: '100%' }}>Siguiente</button>
          {error && <p style={{ color: 'red', textAlign: 'center', width: '100%' }}>{error}</p>}
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '300px', gap: '10px', background: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => { setEmail(e.target.value); setFieldError('email',''); }} onBlur={e => setFieldError('email', validateField('email', e.target.value))} required style={{ width: '100%' }} />
          {errors.email && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.email}</div>}
          <input type="password" placeholder="Contraseña" value={password} onChange={e => { setPassword(e.target.value); setFieldError('password',''); }} onBlur={e => setFieldError('password', validateField('password', e.target.value))} required style={{ width: '100%' }} />
          {errors.password && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.password}</div>}

          {role === 'Usuario' && (
            <>
              <input type="text" placeholder="DNI" value={dni} onChange={e => { setDni(e.target.value); setFieldError('dni',''); }} onBlur={e => setFieldError('dni', validateField('dni', e.target.value))} required style={{ width: '100%' }} />
              {errors.dni && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.dni}</div>}

              <input type="text" placeholder="Nombre" value={nombre} onChange={e => { setNombre(e.target.value); setFieldError('nombre',''); }} onBlur={e => setFieldError('nombre', validateField('nombre', e.target.value))} required style={{ width: '100%' }} />
              {errors.nombre && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.nombre}</div>}

              <input type="text" placeholder="Apellido" value={apellido} onChange={e => { setApellido(e.target.value); setFieldError('apellido',''); }} onBlur={e => setFieldError('apellido', validateField('apellido', e.target.value))} required style={{ width: '100%' }} />
              {errors.apellido && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.apellido}</div>}

              <input type="date" placeholder="Fecha de nacimiento" value={fechaNacimiento} onChange={e => { setFechaNacimiento(e.target.value); setFieldError('fechaNacimiento',''); }} onBlur={e => setFieldError('fechaNacimiento', validateField('fechaNacimiento', e.target.value))} required style={{ width: '100%' }} />
              {errors.fechaNacimiento && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.fechaNacimiento}</div>}

              <input type="text" placeholder="Obra Social" value={obraSocial} onChange={e => { setObraSocial(e.target.value); setFieldError('obraSocial',''); }} onBlur={e => setFieldError('obraSocial', validateField('obraSocial', e.target.value))} required style={{ width: '100%' }} />
              {errors.obraSocial && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.obraSocial}</div>}

              <input type="text" placeholder="Nro. Afiliado" value={nroAfiliado} onChange={e => { setNroAfiliado(e.target.value); setFieldError('nroAfiliado',''); }} onBlur={e => setFieldError('nroAfiliado', validateField('nroAfiliado', e.target.value))} required style={{ width: '100%' }} />
              {errors.nroAfiliado && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.nroAfiliado}</div>}

              <input type="date" placeholder="Vencimiento" value={vencimiento} onChange={e => { setVencimiento(e.target.value); setFieldError('vencimiento',''); }} onBlur={e => setFieldError('vencimiento', validateField('vencimiento', e.target.value))} required style={{ width: '100%' }} />
              {errors.vencimiento && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.vencimiento}</div>}

              <input type="text" placeholder="Cobertura" value={cobertura} onChange={e => { setCobertura(e.target.value); setFieldError('cobertura',''); }} onBlur={e => setFieldError('cobertura', validateField('cobertura', e.target.value))} required style={{ width: '100%' }} />
              {errors.cobertura && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.cobertura}</div>}

              <input type="text" placeholder="Tarjeta de crédito/débito (opcional)" value={tarjeta} onChange={e => { setTarjeta(e.target.value); setFieldError('tarjeta',''); }} onBlur={e => setFieldError('tarjeta', validateField('tarjeta', e.target.value))} style={{ width: '100%' }} />
              {errors.tarjeta && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.tarjeta}</div>}

              <input type="text" placeholder="Código (CVV)" value={codigoTarjeta} onChange={e => { setCodigoTarjeta(e.target.value); setFieldError('codigoTarjeta',''); }} onBlur={e => setFieldError('codigoTarjeta', validateField('codigoTarjeta', e.target.value))} style={{ width: '100%' }} />
              {errors.codigoTarjeta && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.codigoTarjeta}</div>}

              <input type="text" placeholder="Dirección completa" value={direccion} onChange={e => { setDireccion(e.target.value); setFieldError('direccion',''); }} onBlur={e => setFieldError('direccion', validateField('direccion', e.target.value))} required style={{ width: '100%' }} />
              {errors.direccion && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.direccion}</div>}

              <button type="button" style={{ marginBottom: '10px', width: '100%', padding: '8px' }}
                onClick={async () => {
                  setCoordStatus(null);
                  if (!direccion) return;
                  try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`);
                    const data = await response.json();
                    if (data && data.length > 0) {
                      setLat(data[0].lat);
                      setLng(data[0].lon);
                      setCoordStatus('ok');
                      setFieldError('coords','');
                    } else {
                      setLat(''); setLng(''); setCoordStatus('fail'); setFieldError('coords','Coordenadas no encontradas');
                    }
                  } catch {
                    setLat(''); setLng(''); setCoordStatus('fail');
                  }
                }}
              >Obtener latitud y longitud</button>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {coordStatus === 'ok' && (<span style={{ color: 'green', fontSize: '1.5em' }}>✔️</span>)}
                {coordStatus === 'fail' && (<span style={{ color: 'red', fontSize: '1.5em' }}>❌</span>)}
                {lat && lng && coordStatus === 'ok' && (<span><strong>Latitud:</strong> {lat} <strong>Longitud:</strong> {lng}</span>)}
                {coordStatus === 'fail' && (<span>No se encontró la dirección.</span>)}
              </div>
            </>
          )}

          {role === 'Farmacia' && (
            <>
              <input type="text" placeholder="Nombre de la farmacia" value={nombreFarmacia} onChange={e => { setNombreFarmacia(e.target.value); setFieldError('nombreFarmacia',''); }} onBlur={e => setFieldError('nombreFarmacia', e.target.value ? '' : 'Nombre de farmacia vacío')} required style={{ width: '100%' }} />
              {errors.nombreFarmacia && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.nombreFarmacia}</div>}

              <input type="text" placeholder="Dirección completa" value={direccionFarmacia} onChange={e => { setDireccionFarmacia(e.target.value); setFieldError('direccionFarmacia',''); }} onBlur={e => setFieldError('direccionFarmacia', validateField('direccion', e.target.value))} required style={{ width: '100%' }} />
              {errors.direccionFarmacia && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.direccionFarmacia}</div>}

              <button type="button" style={{ marginBottom: '10px', width: '100%', padding: '8px' }}
                onClick={async () => {
                  setCoordStatusFarmacia(null);
                  if (!direccionFarmacia) return;
                  try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccionFarmacia)}`);
                    const data = await response.json();
                    if (data && data.length > 0) {
                      setLatFarmacia(data[0].lat);
                      setLngFarmacia(data[0].lon);
                      setCoordStatusFarmacia('ok');
                    } else {
                      setLatFarmacia(''); setLngFarmacia(''); setCoordStatusFarmacia('fail');
                    }
                  } catch {
                    setLatFarmacia(''); setLngFarmacia(''); setCoordStatusFarmacia('fail');
                  }
                }}
              >Obtener latitud y longitud</button>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {coordStatusFarmacia === 'ok' && (<span style={{ color: 'green', fontSize: '1.5em' }}>✔️</span>)}
                {coordStatusFarmacia === 'fail' && (<span style={{ color: 'red', fontSize: '1.5em' }}>❌</span>)}
                {latFarmacia && lngFarmacia && coordStatusFarmacia === 'ok' && (<span><strong>Latitud:</strong> {latFarmacia} <strong>Longitud:</strong> {lngFarmacia}</span>)}
                {coordStatusFarmacia === 'fail' && (<span>No se encontró la dirección.</span>)}
              </div>

              <input type="text" placeholder="Contacto" value={contactoFarmacia} onChange={e => setContactoFarmacia(e.target.value)} required style={{ width: '100%' }} />

              <div style={{ width: '100%' }}>
                <label>Obras sociales aceptadas:</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" placeholder="Agregar obra social" value={obraSocialInput} onChange={e => setObraSocialInput(e.target.value)} style={{ flex: 1 }} />
                  <button type="button" onClick={() => {
                    if (obraSocialInput.trim() && !obrasSocialesAceptadas.includes(obraSocialInput.trim())) {
                      setObrasSocialesAceptadas([...obrasSocialesAceptadas, obraSocialInput.trim()]);
                      setObraSocialInput('');
                    }
                  }} style={{ padding: '8px' }}>Agregar</button>
                </div>
                <ul style={{ paddingLeft: '20px', marginBottom: '8px' }}>
                  {obrasSocialesAceptadas.map((obra, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {obra}
                      <button type="button" style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => {
                        setObrasSocialesAceptadas(obrasSocialesAceptadas.filter((_, i) => i !== idx));
                      }}>✖</button>
                    </li>
                  ))}
                </ul>
              </div>

              <HorariosFarmacia horarios={horarios} setHorarios={setHorarios} />
            </>
          )}

          {role === 'Distribuidor' && (
            <>
              <input type="text" placeholder="DNI" value={dniDelivery} onChange={e => { setDniDelivery(e.target.value); setFieldError('dniDelivery',''); }} onBlur={e => setFieldError('dniDelivery', validateField('dni', e.target.value))} required style={{ width: '100%' }} />
              {errors.dniDelivery && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.dniDelivery}</div>}

              <input type="date" placeholder="Fecha de nacimiento" value={fechaNacimiento} onChange={e => { setFechaNacimiento(e.target.value); setFieldError('fechaNacimiento',''); }} onBlur={e => setFieldError('fechaNacimiento', validateField('fechaNacimiento', e.target.value))} required style={{ width: '100%' }} />
              {errors.fechaNacimiento && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.fechaNacimiento}</div>}

              <input type="text" placeholder="Datos de contacto" value={contactoDelivery} onChange={e => setContactoDelivery(e.target.value)} required style={{ width: '100%' }} />

              {/* Subida de imágenes frente / reverso (validación básica de tipo) */}
              <div style={{ width: '100%', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label>Imagen del frente del documento</label>
                  <button type="button" onClick={() => setShowHelpDelivery(s => !s)} style={{ padding: '4px 8px' }}>?</button>
                </div>
                <input type="file" accept="image/*" onChange={e => {
                  const f = e.target.files && e.target.files[0];
                  if (f) {
                    const name = String(f.name || '').toLowerCase();
                    const isImageByType = f.type && f.type.startsWith('image/');
                    const isImageByExt = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.heic') || name.endsWith('.heif');
                    if (isImageByType || isImageByExt) {
                      setFrontImageFile(f);
                      setFrontPreview(URL.createObjectURL(f));
                      setFieldError('frontImage','');
                    } else {
                      setFrontImageFile(null);
                      setFrontPreview(null);
                      setFieldError('frontImage','Lo que estás cargando no parece una foto. Por favor subí una foto en JPG o PNG.');
                    }
                  }
                }} />
                {showHelpDelivery && (<div style={{ background: '#f9f9f9', padding: 8, borderRadius: 6, marginTop: 8 }}>{acceptedFormatsText}</div>)}
                {errors.frontImage && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.frontImage}</div>}
                {frontPreview && <img src={frontPreview} alt="Frente" style={{ width: '100%', marginTop: 8, borderRadius: 6 }} />}

                <label style={{ marginTop: 10 }}>Imagen del reverso del documento</label>
                <input type="file" accept="image/*" onChange={e => {
                  const f = e.target.files && e.target.files[0];
                  if (f) {
                    const name = String(f.name || '').toLowerCase();
                    const isImageByType = f.type && f.type.startsWith('image/');
                    const isImageByExt = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.heic') || name.endsWith('.heif');
                    if (isImageByType || isImageByExt) {
                      setBackImageFile(f);
                      setBackPreview(URL.createObjectURL(f));
                      setFieldError('backImage','');
                    } else {
                      setBackImageFile(null);
                      setBackPreview(null);
                      setFieldError('backImage','Lo que estás cargando no parece una foto. Por favor subí una foto en JPG o PNG.');
                    }
                  }
                }} />
                {errors.backImage && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.backImage}</div>}
                {backPreview && <img src={backPreview} alt="Reverso" style={{ width: '100%', marginTop: 8, borderRadius: 6 }} />}
              </div>
            </>
          )}

          <button type="submit" style={{ width: '100%' }}>Registrar</button>
          {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
          {success && <p style={{ color: 'green', textAlign: 'center' }}>{success}</p>}
        </form>
      )}
    </div>
  );
};

export default Register;
