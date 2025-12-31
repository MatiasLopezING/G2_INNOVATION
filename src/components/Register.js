/**
 * Componente para registro de usuarios, farmacias y deliverys.
 * Versión avanzada: validaciones por campo, ayudas de formato,
 * geocodificación de direcciones y (para delivery) validación de imágenes.
 * No usa ningún fondo de video.
 */

import React, { useMemo, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, get, push } from 'firebase/database';
import { auth, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import HorariosFarmacia from './HorariosFarmacia';
import { isDniRegistered, isEmailRegisteredInDb } from '../utils/firebaseUtils';

import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LocalPharmacyOutlinedIcon from '@mui/icons-material/LocalPharmacyOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';

const Register = () => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  // Ayuda contextual por campo
  const [help, setHelp] = useState({});
  const toggleHelp = (key) => setHelp(prev => ({ ...prev, [key]: !prev[key] }));
  const [isFading, setIsFading] = useState(false);
  const navigate = useNavigate();

  const totalSteps = 2;
  const progressValue = useMemo(() => (step / totalSteps) * 100, [step]);

  const roleOptions = useMemo(() => ([
    {
      value: 'Usuario',
      title: 'Usuario',
      description: 'Para cargar recetas y comprar medicamentos.',
      icon: <PersonOutlineIcon fontSize="large" />,
    },
    {
      value: 'Farmacia',
      title: 'Farmacia',
      description: 'Para gestionar ventas, recetas y deliverys.',
      icon: <LocalPharmacyOutlinedIcon fontSize="large" />,
    },
    {
      value: 'Distribuidor',
      title: 'Delivery',
      description: 'Para recibir y entregar pedidos.',
      icon: <LocalShippingOutlinedIcon fontSize="large" />,
    },
  ]), []);
  // Utilidad: convierte un File a data URL (Base64) para almacenar como texto
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } catch (e) {
      reject(e);
    }
  });

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
        if (!v) return 'Por favor ingresa el número de la tarjeta.';
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
      // Chequeo únicamente en la base (permite re-registro si Auth conserva email pero se borró el perfil)
      const emailExistsInDb = await isEmailRegisteredInDb(email);
      if (emailExistsInDb) {
        setFieldError('email', 'Ese correo ya está en uso actualmente.');
        return;
      }
      // Validación y duplicado de DNI para Usuario y Distribuidor
      if (role === 'Usuario' || role === 'Distribuidor') {
        const dniValue = role === 'Usuario' ? dni : dniDelivery;
        const dniFieldName = role === 'Usuario' ? 'dni' : 'dniDelivery';
        const vDni = validateField('dni', dniValue);
        if (vDni) { setFieldError(dniFieldName, vDni); return; }
        const dniTaken = await isDniRegistered(dniValue);
        if (dniTaken) { setFieldError(dniFieldName, 'Ese DNI ya está registrado.'); return; }
      }

      const emailLower = String(email).toLowerCase();
      // Si hay una farmacia logueada y está creando un Distribuidor, usar Cloud Function
      let requesterRole = null;
      if (auth.currentUser) {
        try {
          const roleSnap = await get(ref(db, `users/${auth.currentUser.uid}/role`));
          requesterRole = roleSnap.val();
        } catch {}
      }

      if (role === 'Distribuidor' && (requesterRole === 'Farmacia' || requesterRole === 'Admin')) {
        // Preparar imágenes (si existen) a data URL
        let frenteUrl = '';
        let reversoUrl = '';
        if (frontImageFile) frenteUrl = String(await fileToDataUrl(frontImageFile));
        if (backImageFile) reversoUrl = String(await fileToDataUrl(backImageFile));

        const createDistribuidor = httpsCallable(functions, 'farmaciaCreateDistribuidor');
        await createDistribuidor({
          email: emailLower,
          password,
          dni: dniDelivery,
          fechaNacimiento,
          contacto: contactoDelivery,
          frente: frenteUrl,
          reverso: reversoUrl
        });
        setSuccess('Delivery registrado y notificado a farmacias.');
        // Limpiar formulario delivery y permanecer en sesión de farmacia
        setDniDelivery(''); setContactoDelivery(''); setFrontImageFile(null); setBackImageFile(null); setFrontPreview(null); setBackPreview(null);
        setEmail(''); setPassword('');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, emailLower, password);
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
        // Convertir imágenes a Base64 (data URL) para almacenar como texto en la base
        let frenteUrl = '';
        let reversoUrl = '';
        if (frontImageFile) {
          frenteUrl = String(await fileToDataUrl(frontImageFile));
        }
        if (backImageFile) {
          reversoUrl = String(await fileToDataUrl(backImageFile));
        }
        userData = {
          ...userData,
          dni: dniDelivery,
          fechaNacimiento,
          contacto: contactoDelivery,
          deliveryVerification: { status: 'pendiente', frente: frenteUrl, reverso: reversoUrl },
          dinero: 0
        };
      }

      await set(ref(db, 'users/' + user.uid), userData);

      // Si es distribuidor (autoregistro), crear notificación para cada farmacia (no bloquear si falla)
      if (role === 'Distribuidor') {
        try {
          const allUsersSnap = await get(ref(db, 'users'));
          const allUsers = allUsersSnap.val() || {};
          Object.entries(allUsers).forEach(([uidFarmacia, u]) => {
            if (u && u.role === 'Farmacia') {
              push(ref(db, `notificaciones/${uidFarmacia}`), {
                tipo: 'delivery_registro',
                deliveryUid: user.uid,
                deliveryEmail: emailLower,
                frente: userData.deliveryVerification.frente || '',
                reverso: userData.deliveryVerification.reverso || '',
                fecha: Date.now(),
                estado: 'pendiente'
              }).catch(() => {});
            }
          });
        } catch (e) {
          console.warn('No se pudieron crear notificaciones para farmacias:', e);
        }
      }
      setSuccess('Usuario registrado correctamente');
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      console.error(err);
      setError('No pudimos registrar tu cuenta. Revisa los datos e intenta nuevamente.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 3,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 520 }}>
        <Box sx={{ display: 'grid', placeItems: 'center', mb: 1.5 }}>
          <img
            src="/icons/RecetApp.png"
            alt="RecetApp"
            style={{ width: 84, height: 84, objectFit: 'contain' }}
          />
        </Box>

        <Paper
          elevation={10}
          sx={{
            width: '100%',
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            backdropFilter: 'blur(6px)',
            animation: 'g2-fade-slide-in 520ms ease forwards',
            '@keyframes g2-fade-slide-in': {
              from: { opacity: 0, transform: 'translateY(18px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Paso {step} de {totalSteps}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progressValue}
              sx={{ mt: 0.75, height: 8, borderRadius: 999 }}
            />
          </Box>

          {step === 1 && (
            <Box component="form" onSubmit={handleNext} sx={{ display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="h5" fontWeight={700} align="center">
                  Crear Cuenta
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  Selecciona tu tipo de perfil para comenzar
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                  gap: 1.5,
                  mt: 1,
                }}
              >
                {roleOptions.map((opt) => {
                  const active = role === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setRole(opt.value);
                        setError('');
                      }}
                      variant="outlined"
                      sx={{
                        p: 2,
                        minHeight: 128,
                        borderRadius: 3,
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        gap: 1,
                        borderWidth: 2,
                        borderColor: active ? 'primary.main' : '#e2e8f0',
                        backgroundColor: active ? 'rgba(20,184,166,0.12)' : 'rgba(255,255,255,0.6)',
                        color: active ? 'primary.dark' : 'text.secondary',
                        transition:
                          'transform 120ms ease, background-color 200ms ease, border-color 200ms ease',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          borderColor: 'primary.main',
                          backgroundColor: 'rgba(20,184,166,0.08)',
                        },
                      }}
                    >
                      <Stack spacing={0.5} sx={{ width: '100%' }}>
                        <Box sx={{ color: active ? 'primary.main' : 'text.secondary' }}>
                          {opt.icon}
                        </Box>
                        <Typography fontWeight={800} sx={{ color: active ? 'primary.dark' : 'text.primary' }}>
                          {opt.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {opt.description}
                        </Typography>
                      </Stack>
                    </Button>
                  );
                })}
              </Box>

              {error && <Alert severity="error">{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                sx={{
                  py: 1.2,
                  color: '#fff',
                  transition: 'transform 120ms ease, background-color 300ms ease',
                  '&:hover': { transform: 'translateY(-1px)' },
                }}
              >
                Continuar
              </Button>

              <Button
                type="button"
                variant="text"
                onClick={() => navigate('/')}
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'underline',
                  textUnderlineOffset: '4px',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Volver al login
              </Button>
            </Box>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '300px', gap: '10px' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Email</label>
            <button type="button" onClick={() => toggleHelp('email')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
          </div>
          <input type="email" placeholder="Email" value={email} onChange={e => { setEmail(e.target.value); setFieldError('email',''); }} onBlur={e => setFieldError('email', validateField('email', e.target.value))} required style={{ width: '100%' }} />
          {help.email && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Escribe tu correo como nombre@ejemplo.com en minúsculas. Si no tienes correo, puedes crear uno gratis (por ejemplo, en Gmail).</div>}
          {errors.email && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.email}</div>}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Contraseña</label>
            <button type="button" onClick={() => toggleHelp('password')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
          </div>
          <input type="password" placeholder="Contraseña" value={password} onChange={e => { setPassword(e.target.value); setFieldError('password',''); }} onBlur={e => setFieldError('password', validateField('password', e.target.value))} required style={{ width: '100%' }} />
          {help.password && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Crea una clave que recuerdes con al menos 8 caracteres. Evita usar datos obvios como tu nombre o DNI.</div>}
          {errors.password && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.password}</div>}

          {role === 'Usuario' && (
            <>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>DNI</label>
                <button type="button" onClick={() => toggleHelp('dni')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="DNI" value={dni} onChange={e => { setDni(e.target.value); setFieldError('dni',''); }} onBlur={e => setFieldError('dni', validateField('dni', e.target.value))} required style={{ width: '100%' }} />
              {help.dni && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Ingresa tu número de documento sin puntos ni espacios. Solo números.</div>}
              {errors.dni && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.dni}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Nombre</label>
                <button type="button" onClick={() => toggleHelp('nombre')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Nombre" value={nombre} onChange={e => { setNombre(e.target.value); setFieldError('nombre',''); }} onBlur={e => setFieldError('nombre', validateField('nombre', e.target.value))} required style={{ width: '100%' }} />
              {help.nombre && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Escribe tu primer nombre tal como aparece en tu documento.</div>}
              {errors.nombre && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.nombre}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Apellido</label>
                <button type="button" onClick={() => toggleHelp('apellido')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Apellido" value={apellido} onChange={e => { setApellido(e.target.value); setFieldError('apellido',''); }} onBlur={e => setFieldError('apellido', validateField('apellido', e.target.value))} required style={{ width: '100%' }} />
              {help.apellido && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Escribe tu apellido tal como aparece en tu documento.</div>}
              {errors.apellido && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.apellido}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Fecha de nacimiento</label>
                <button type="button" onClick={() => toggleHelp('fechaNacimiento')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="date" placeholder="Fecha de nacimiento" value={fechaNacimiento} onChange={e => { setFechaNacimiento(e.target.value); setFieldError('fechaNacimiento',''); }} onBlur={e => setFieldError('fechaNacimiento', validateField('fechaNacimiento', e.target.value))} required style={{ width: '100%' }} />
              {help.fechaNacimiento && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Selecciona tu fecha de nacimiento usando el calendario.</div>}
              {errors.fechaNacimiento && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.fechaNacimiento}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Obra Social</label>
                <button type="button" onClick={() => toggleHelp('obraSocial')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Obra Social" value={obraSocial} onChange={e => { setObraSocial(e.target.value); setFieldError('obraSocial',''); }} onBlur={e => setFieldError('obraSocial', validateField('obraSocial', e.target.value))} required style={{ width: '100%' }} />
              {help.obraSocial && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Escribe el nombre de tu obra social (por ejemplo: PAMI, OSDE, etc.).</div>}
              {errors.obraSocial && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.obraSocial}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Nro. Afiliado</label>
                <button type="button" onClick={() => toggleHelp('nroAfiliado')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Nro. Afiliado" value={nroAfiliado} onChange={e => { setNroAfiliado(e.target.value); setFieldError('nroAfiliado',''); }} onBlur={e => setFieldError('nroAfiliado', validateField('nroAfiliado', e.target.value))} required style={{ width: '100%' }} />
              {help.nroAfiliado && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Número que figura en tu credencial de la obra social.</div>}
              {errors.nroAfiliado && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.nroAfiliado}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Vencimiento</label>
                <button type="button" onClick={() => toggleHelp('vencimiento')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="date" placeholder="Vencimiento" value={vencimiento} onChange={e => { setVencimiento(e.target.value); setFieldError('vencimiento',''); }} onBlur={e => setFieldError('vencimiento', validateField('vencimiento', e.target.value))} required style={{ width: '100%' }} />
              {help.vencimiento && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Selecciona la fecha de vencimiento de tu credencial. Debe ser una fecha futura.</div>}
              {errors.vencimiento && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.vencimiento}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Cobertura</label>
                <button type="button" onClick={() => toggleHelp('cobertura')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Cobertura" value={cobertura} onChange={e => { setCobertura(e.target.value); setFieldError('cobertura',''); }} onBlur={e => setFieldError('cobertura', validateField('cobertura', e.target.value))} required style={{ width: '100%' }} />
              {help.cobertura && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Describe qué te cubre tu obra social (por ejemplo: medicamentos, consultas, etc.).</div>}
              {errors.cobertura && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.cobertura}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Tarjeta</label>
                <button type="button" onClick={() => toggleHelp('tarjeta')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Número de tarjeta" value={tarjeta} onChange={e => { setTarjeta(e.target.value); setFieldError('tarjeta',''); }} onBlur={e => setFieldError('tarjeta', validateField('tarjeta', e.target.value))} required style={{ width: '100%' }} />
              {help.tarjeta && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Ingresa los números de tu tarjeta (sin espacios ni guiones) para poder procesar pagos.</div>}
              {errors.tarjeta && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.tarjeta}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Código (CVV)</label>
                <button type="button" onClick={() => toggleHelp('codigoTarjeta')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Código (CVV)" value={codigoTarjeta} onChange={e => { setCodigoTarjeta(e.target.value); setFieldError('codigoTarjeta',''); }} onBlur={e => setFieldError('codigoTarjeta', validateField('codigoTarjeta', e.target.value))} required style={{ width: '100%' }} />
              {/* CVV ahora obligatorio */}
              {/* Nota: No se recomienda almacenar CVV en base de datos. Solo validar y enviar a un gateway de pago seguro. */}
              
              {help.codigoTarjeta && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>El CVV es el número de 3 o 4 dígitos de seguridad de tu tarjeta.</div>}
              {errors.codigoTarjeta && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.codigoTarjeta}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Dirección</label>
                <button type="button" onClick={() => toggleHelp('direccion')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Dirección completa" value={direccion} onChange={e => { setDireccion(e.target.value); setFieldError('direccion',''); }} onBlur={e => setFieldError('direccion', validateField('direccion', e.target.value))} required style={{ width: '100%' }} />
              {help.direccion && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Escribe calle y número, por ejemplo: "Av. Siempre Viva 742, Ciudad, Provincia".</div>}
              {errors.direccion && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.direccion}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#333' }}>Coordenadas</span>
                <button type="button" onClick={() => toggleHelp('coordsInfo')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              {help.coordsInfo && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Después de escribir tu dirección, presiona el botón para buscar tu ubicación aproximada (latitud y longitud). Si no aparece, revisa la dirección.</div>}

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
                {coordStatus === 'fail' && (<span>No se encontró la dirección.</span>)}
              </div>
            </>
          )}

          {role === 'Farmacia' && (
            <>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Nombre de la farmacia</label>
                <button type="button" onClick={() => toggleHelp('nombreFarmacia')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Nombre de la farmacia" value={nombreFarmacia} onChange={e => { setNombreFarmacia(e.target.value); setFieldError('nombreFarmacia',''); }} onBlur={e => setFieldError('nombreFarmacia', e.target.value ? '' : 'Nombre de farmacia vacío')} required style={{ width: '100%' }} />
              {help.nombreFarmacia && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Escribe el nombre comercial tal como lo ven los clientes.</div>}
              {errors.nombreFarmacia && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.nombreFarmacia}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Dirección completa</label>
                <button type="button" onClick={() => toggleHelp('direccionFarmacia')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Dirección completa" value={direccionFarmacia} onChange={e => { setDireccionFarmacia(e.target.value); setFieldError('direccionFarmacia',''); }} onBlur={e => setFieldError('direccionFarmacia', validateField('direccion', e.target.value))} required style={{ width: '100%' }} />
              {help.direccionFarmacia && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Escribe la dirección exacta (calle, número, ciudad). Luego usa el botón para obtener la ubicación.</div>}
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
                {coordStatusFarmacia === 'fail' && (<span>No se encontró la dirección.</span>)}
              </div>

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Contacto</label>
                <button type="button" onClick={() => toggleHelp('contactoFarmacia')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Contacto" value={contactoFarmacia} onChange={e => setContactoFarmacia(e.target.value)} required style={{ width: '100%' }} />
              {help.contactoFarmacia && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Teléfono o WhatsApp de la farmacia para consultas o pedidos.</div>}

              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Obras sociales aceptadas</label>
                  <button type="button" onClick={() => toggleHelp('obrasSocialesAceptadas')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
                </div>
                {help.obrasSocialesAceptadas && <div style={{ width: '100%', fontSize: 13, color: '#333', marginBottom: 8 }}>Escribe una obra social y presiona "Agregar". Para quitar alguna, usa la X roja.</div>}
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
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <label>Horarios</label>
                <button type="button" onClick={() => toggleHelp('horariosFarmacia')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              {help.horariosFarmacia && <div style={{ width: '100%', fontSize: 13, color: '#333', marginBottom: 8 }}>Completa apertura y cierre por cada día (ej.: 09:00 a 20:00). Si está cerrado un día, indícalo.</div>}
              <HorariosFarmacia horarios={horarios} setHorarios={setHorarios} />
            </>
          )}

          {role === 'Distribuidor' && (
            <>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>DNI</label>
                <button type="button" onClick={() => toggleHelp('dniDelivery')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="DNI" value={dniDelivery} onChange={e => { setDniDelivery(e.target.value); setFieldError('dniDelivery',''); }} onBlur={e => setFieldError('dniDelivery', validateField('dni', e.target.value))} required style={{ width: '100%' }} />
              {help.dniDelivery && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Tu número de documento sin puntos ni espacios.</div>}
              {errors.dniDelivery && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.dniDelivery}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Fecha de nacimiento</label>
                <button type="button" onClick={() => toggleHelp('fechaNacimientoDist')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="date" placeholder="Fecha de nacimiento" value={fechaNacimiento} onChange={e => { setFechaNacimiento(e.target.value); setFieldError('fechaNacimiento',''); }} onBlur={e => setFieldError('fechaNacimiento', validateField('fechaNacimiento', e.target.value))} required style={{ width: '100%' }} />
              {help.fechaNacimientoDist && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Selecciona tu fecha de nacimiento usando el calendario.</div>}
              {errors.fechaNacimiento && <div style={{ color: 'red', width: '100%', textAlign: 'left' }}>{errors.fechaNacimiento}</div>}

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Datos de contacto</label>
                <button type="button" onClick={() => toggleHelp('contactoDelivery')} style={{ background: '#e9f1ff', border: '1px solid #b6cffb', borderRadius: 14, width: 28, height: 28, cursor: 'pointer' }}>?</button>
              </div>
              <input type="text" placeholder="Datos de contacto" value={contactoDelivery} onChange={e => setContactoDelivery(e.target.value)} required style={{ width: '100%' }} />
              {help.contactoDelivery && <div style={{ width: '100%', fontSize: 13, color: '#333' }}>Tu teléfono o WhatsApp para coordinar entregas.</div>}

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
                {frontPreview && <img src={frontPreview} alt="Frente" style={{ width: '120px', height: 'auto', marginTop: 8, borderRadius: 6, objectFit: 'cover' }} />}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <label>Imagen del reverso del documento</label>
                  <button type="button" onClick={() => setShowHelpDelivery(s => !s)} style={{ padding: '4px 8px' }}>?</button>
                </div>
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
                {backPreview && <img src={backPreview} alt="Reverso" style={{ width: '120px', height: 'auto', marginTop: 8, borderRadius: 6, objectFit: 'cover' }} />}
              </div>
            </>
          )}

          <button type="submit" style={{ width: '100%' }}>Registrar</button>
          <button
            type="button"
            onClick={() => { setStep(1); setError(''); setSuccess(''); }}
            style={{ width: '100%', background: '#f3f3f3', color: '#333', border: '1px solid #ddd', padding: '8px', borderRadius: 6 }}
          >
            Volver a elegir rol
          </button>
          {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
          {success && <p style={{ color: 'green', textAlign: 'center' }}>{success}</p>}
            </form>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default Register;
