/**
 * Componente para registro de usuarios, farmacias y deliverys.
 * Versión avanzada: validaciones por campo, ayudas de formato,
 * geocodificación de direcciones y (para delivery) validación de imágenes.
 * No usa ningún fondo de video.
 */

import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, get, push } from 'firebase/database';
import { auth, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import HorariosFarmacia from './HorariosFarmacia';
import { isDniRegistered, isEmailRegisteredInDb } from '../utils/firebaseUtils';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button as UiButton } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert as UiAlert } from './ui/alert';
import { Progress } from './ui/progress';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';
import { Modal } from './ui/modal';
import { LocationPicker } from './LocationPicker';
import { FileDropzone } from './FileDropzone';

import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LocalPharmacyOutlinedIcon from '@mui/icons-material/LocalPharmacyOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

const usuarioSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirma tu contraseña.'),
    nombre: z.string().trim().min(1, 'Por favor completa tu nombre.'),
    apellido: z.string().trim().min(1, 'Por favor completa tu apellido.'),
    dni: z
      .string()
      .trim()
      .regex(/^\d+$/, 'El DNI solo debe tener números.')
      .min(6, 'El DNI parece tener una longitud incorrecta.')
      .max(10, 'El DNI parece tener una longitud incorrecta.'),
    fechaNacimiento: z.string().min(1, 'Selecciona tu fecha de nacimiento.'),
    obraSocial: z.string().trim().min(1, 'Indica tu obra social.'),
    nroAfiliado: z.string().trim().min(1, 'Ingresa tu número de afiliado.'),
    vencimiento: z.string().min(1, 'Selecciona el vencimiento.'),
    cobertura: z.string().trim().min(1, 'Indica tu cobertura.'),
    direccion: z.string().trim().min(1, 'Ingresa tu dirección.'),
    lat: z.number().finite().optional(),
    lng: z.number().finite().optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });

const Register = () => {
  const [step, setStep] = useState(1);
  const [show, setShow] = useState(false);
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const totalSteps = 2;
  const progressValue = useMemo(() => (step / totalSteps) * 100, [step]);

  // Wizard Usuario (4 pasos) con RHF + Zod
  const [usuarioStep, setUsuarioStep] = useState(1);
  const usuarioTotalSteps = 4;
  const usuarioProgressValue = useMemo(
    () => (usuarioStep / usuarioTotalSteps) * 100,
    [usuarioStep]
  );

  const usuarioForm = useForm({
    resolver: zodResolver(usuarioSchema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      nombre: '',
      apellido: '',
      dni: '',
      fechaNacimiento: '',
      obraSocial: '',
      nroAfiliado: '',
      vencimiento: '',
      cobertura: '',
      direccion: '',
    },
  });

  const [coordStatusUsuario, setCoordStatusUsuario] = useState(null); // null | 'ok' | 'fail'
  const [usuarioLocError, setUsuarioLocError] = useState('');

  const usuarioStepFields = useMemo(
    () => ({
      1: ['email', 'password', 'confirmPassword'],
      2: ['nombre', 'apellido', 'dni', 'fechaNacimiento'],
      3: ['obraSocial', 'nroAfiliado', 'vencimiento', 'cobertura'],
      4: ['direccion'],
    }),
    []
  );

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

  // Usuario: se gestiona con React Hook Form (usuarioForm)
  const [fechaNacimiento, setFechaNacimiento] = useState('');

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
  const [nombreDelivery, setNombreDelivery] = useState('');
  const [apellidoDelivery, setApellidoDelivery] = useState('');
  const [dniDelivery, setDniDelivery] = useState('');
  const [contactoDelivery, setContactoDelivery] = useState('');
  const [frontImageFile, setFrontImageFile] = useState(null);
  const [backImageFile, setBackImageFile] = useState(null);

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
    setSuccess('');
    if (role === 'Usuario') setUsuarioStep(1);
    if (role === 'Farmacia') setFarmaciaStep(1);
    if (role === 'Distribuidor') setDeliveryStep(1);
    setStep(2);
  };

  const handleUsuarioNext = async () => {
    setError('');
    setSuccess('');

    const fields = usuarioStepFields[usuarioStep] || [];
    const ok = await usuarioForm.trigger(fields);
    if (!ok) return;
    if (usuarioStep < usuarioTotalSteps) setUsuarioStep((s) => s + 1);
  };

  const handleUsuarioBack = () => {
    setError('');
    setSuccess('');
    setUsuarioStep((s) => Math.max(1, s - 1));
  };

  // Delivery wizard (3 pasos)
  const [deliveryStep, setDeliveryStep] = useState(1);
  const deliveryTotalSteps = 3;
  const deliveryProgressValue = useMemo(
    () => (deliveryStep / deliveryTotalSteps) * 100,
    [deliveryStep]
  );

  const handleDeliveryNext = () => {
    setError('');
    setSuccess('');

    if (deliveryStep === 1) {
      const vEmail = validateField('email', email);
      const vPass = validateField('password', password);
      if (vEmail || vPass) {
        setFieldError('email', vEmail);
        setFieldError('password', vPass);
        return;
      }
      setDeliveryStep(2);
      return;
    }

    if (deliveryStep === 2) {
      const vNombre = validateField('nombre', nombreDelivery);
      if (vNombre) {
        setFieldError('nombreDelivery', vNombre);
        return;
      }
      const vApellido = validateField('apellido', apellidoDelivery);
      if (vApellido) {
        setFieldError('apellidoDelivery', vApellido);
        return;
      }

      const vDni = validateField('dni', dniDelivery);
      if (vDni) {
        setFieldError('dniDelivery', vDni);
        return;
      }

      const vFn = validateField('fechaNacimiento', fechaNacimiento);
      if (vFn) {
        setFieldError('fechaNacimiento', vFn);
        return;
      }

      const digits = String(contactoDelivery || '').replace(/\D/g, '');
      if (!digits) {
        setFieldError('contactoDelivery', 'Por favor ingresa tu número de celular.');
        return;
      }
      if (digits.length < 7) {
        setFieldError('contactoDelivery', 'El número de celular parece incompleto.');
        return;
      }

      setDeliveryStep(3);
    }
  };

  const handleDeliveryBack = () => {
    setError('');
    setSuccess('');
    setDeliveryStep((s) => Math.max(1, s - 1));
  };

  // Farmacia wizard (3 pasos)
  const [farmaciaStep, setFarmaciaStep] = useState(1);
  const farmaciaTotalSteps = 3;
  const farmaciaProgressValue = useMemo(
    () => (farmaciaStep / farmaciaTotalSteps) * 100,
    [farmaciaStep]
  );
  const [farmaciaLocError, setFarmaciaLocError] = useState('');
  const [isHorariosOpen, setIsHorariosOpen] = useState(false);

  const ensureDefaultHorarios = () => {
    if (horarios) return horarios;
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const base = { abierto: true, apertura: '08:00', cierre: '20:00' };
    const obj = diasSemana.reduce((acc, d) => {
      acc[d] = { ...base };
      return acc;
    }, {});
    setHorarios(obj);
    return obj;
  };

  const handleAddObraSocial = () => {
    const v = String(obraSocialInput || '').trim();
    if (!v) return;
    if (obrasSocialesAceptadas.includes(v)) {
      setObraSocialInput('');
      return;
    }
    setObrasSocialesAceptadas([...obrasSocialesAceptadas, v]);
    setObraSocialInput('');
  };

  const handleRemoveObraSocial = (obra) => {
    setObrasSocialesAceptadas(obrasSocialesAceptadas.filter((o) => o !== obra));
  };

  const handleFarmaciaNext = () => {
    setError('');
    setSuccess('');
    setFarmaciaLocError('');

    if (farmaciaStep === 1) {
      if (!String(nombreFarmacia || '').trim()) {
        setFieldError('nombreFarmacia', 'Nombre de farmacia vacío');
        return;
      }
      const vEmail = validateField('email', email);
      const vPass = validateField('password', password);
      if (vEmail || vPass) {
        setFieldError('email', vEmail);
        setFieldError('password', vPass);
        return;
      }
      setFarmaciaStep(2);
      return;
    }

    if (farmaciaStep === 2) {
      const vDir = validateField('direccion', direccionFarmacia);
      if (vDir) {
        setFieldError('direccionFarmacia', vDir);
        return;
      }
      const latN = Number(latFarmacia);
      const lngN = Number(lngFarmacia);
      if (!isFinite(latN) || !isFinite(lngN)) {
        setCoordStatusFarmacia('fail');
        setFarmaciaLocError('Obtén las coordenadas para continuar.');
        return;
      }
      if (!String(contactoFarmacia || '').trim()) {
        setFieldError('contactoFarmacia', 'Por favor ingresa un contacto (teléfono/WhatsApp).');
        return;
      }
      setFarmaciaStep(3);
    }
  };

  const handleFarmaciaBack = () => {
    setError('');
    setSuccess('');
    setFarmaciaLocError('');
    setFarmaciaStep((s) => Math.max(1, s - 1));
  };

  const handleSubmitFarmacia = async (e) => {
    e.preventDefault();
    ensureDefaultHorarios();
    await handleRegister(e);
  };

  const handleRegisterUsuario = async (values) => {
    setError('');
    setSuccess('');

    // Requerimos coords para finalizar (feedback pro + evita errores de ubicación)
    const latN = values.lat;
    const lngN = values.lng;
    if (!isFinite(latN) || !isFinite(lngN)) {
      setCoordStatusUsuario('fail');
      setError('Detecta tu ubicación para finalizar el registro.');
      setUsuarioStep(4);
      return;
    }

    try {
      const emailExistsInDb = await isEmailRegisteredInDb(values.email);
      if (emailExistsInDb) {
        usuarioForm.setError('email', { type: 'manual', message: 'Ese correo ya está en uso actualmente.' });
        setUsuarioStep(1);
        return;
      }

      const dniTaken = await isDniRegistered(values.dni);
      if (dniTaken) {
        usuarioForm.setError('dni', { type: 'manual', message: 'Ese DNI ya está registrado.' });
        setUsuarioStep(2);
        return;
      }

      const emailLower = String(values.email).toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, emailLower, values.password);
      const user = userCredential.user;

      const userData = {
        email: emailLower,
        role: 'Usuario',
        dni: values.dni,
        nombre: values.nombre,
        apellido: values.apellido,
        fechaNacimiento: values.fechaNacimiento,
        obraSocial: values.obraSocial,
        nroAfiliado: values.nroAfiliado,
        vencimiento: values.vencimiento,
        cobertura: values.cobertura,
        direccion: values.direccion,
        latitud: String(latN),
        longitud: String(lngN),
      };

      await set(ref(db, 'users/' + user.uid), userData);
      setSuccess('Usuario registrado correctamente');
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      console.error(err);
      setError('No pudimos registrar tu cuenta. Revisa los datos e intenta nuevamente.');
    }
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
      // Validación y duplicado de DNI para Distribuidor (Usuario se registra con handleRegisterUsuario)
      if (role === 'Distribuidor') {
        const vDni = validateField('dni', dniDelivery);
        if (vDni) {
          setFieldError('dniDelivery', vDni);
          return;
        }
        const dniTaken = await isDniRegistered(dniDelivery);
        if (dniTaken) {
          setFieldError('dniDelivery', 'Ese DNI ya está registrado.');
          return;
        }
      }

      if (role === 'Distribuidor') {
        const vNombre = validateField('nombre', nombreDelivery);
        if (vNombre) {
          setFieldError('nombreDelivery', vNombre);
          return;
        }
        const vApellido = validateField('apellido', apellidoDelivery);
        if (vApellido) {
          setFieldError('apellidoDelivery', vApellido);
          return;
        }
        if (!frontImageFile) {
          setFieldError('frontImage', 'Sube la foto del frente del DNI.');
          return;
        }
        if (!backImageFile) {
          setFieldError('backImage', 'Sube la foto del dorso del DNI.');
          return;
        }
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
          nombre: nombreDelivery,
          apellido: apellidoDelivery,
          dni: dniDelivery,
          fechaNacimiento,
          contacto: contactoDelivery,
          frente: frenteUrl,
          reverso: reversoUrl
        });
        setSuccess('Delivery registrado y notificado a farmacias.');
        // Limpiar formulario delivery y permanecer en sesión de farmacia
        setNombreDelivery(''); setApellidoDelivery(''); setDniDelivery(''); setContactoDelivery(''); setFrontImageFile(null); setBackImageFile(null);
        setEmail(''); setPassword('');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, emailLower, password);
      const user = userCredential.user;

      let userData = { email: String(email).toLowerCase(), role };
      if (role === 'Farmacia') {
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
          nombre: String(nombreDelivery || '').trim(),
          apellido: String(apellidoDelivery || '').trim(),
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

  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  return (
  <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(120deg, #f2e9e4 0%, #e0ecfc 100%)' }}>
      {step === 1 && (
        <div
          style={{
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.97)",
            transition: "all 0.5s cubic-bezier(.4,2,.3,1)",
            background: "rgba(255,255,255,0.98)",
            borderRadius: 28,
            boxShadow: "0 2px 12px #22223b11",
            padding: "12px 24px 24px 24px",
            width: "100%",
            maxWidth: 350,
            minWidth: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              opacity: 1,
              transform: "scale(1)",
              transition: "all 0.5s cubic-bezier(.4,2,.3,1)",
              background: "rgba(255,255,255,0.98)",
              borderRadius: 28,
              boxShadow: "0 2px 12px #22223b11",
              padding: 24,
              width: "100%",
              maxWidth: 350,
              minWidth: 280,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Logo de la empresa */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, marginTop: 0 }}>
              <img
                src={"/RecetAppSinFondo.png"}
                alt="Logo empresa"
                style={{ width: 250, height: 250, objectFit: "contain", marginTop: 0 }}
              />
            </div>
            <h2
              style={{
                textAlign: "center",
                marginTop: 0,
                marginBottom: 12,
                color: "#22223b",
                fontWeight: 900,
                fontSize: 32,
                letterSpacing: 1.2,
                textShadow: "0 2px 8px #4ea8de22",
                fontFamily: "Nunito Sans, Inter, Poppins, Arial, sans-serif",
              }}
            >
              Registro
            </h2>
            <form onSubmit={handleNext} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <label
                style={{
                  fontWeight: 700,
                  color: "#22223b",
                  width: "100%",
                  maxWidth: 400,
                  textAlign: "left",
                  marginBottom: 5,
                  letterSpacing: 0.5,
                  fontSize: 16,
                }}
              >
                Tipo de usuario:
              </label>
              <Select
                options={[
                  { value: '', label: 'Selecciona...' },
                  { value: 'Usuario', label: 'Usuario' },
                  { value: 'Farmacia', label: 'Farmacia' },
                  { value: 'Distribuidor', label: 'Delivery/Repartidor' }
                ]}
                value={{ value: role, label: role ? (role === 'Distribuidor' ? 'Delivery/Repartidor' : role) : 'Selecciona...' }}
                onChange={option => setRole(option.value)}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    width: 240,
                    minWidth: 240,
                    maxWidth: 240,
                    paddingLeft: 2,
                    borderRadius: 18,
                    border: '1.5px solid #b5b5c3',
                    fontSize: 17,
                    background: 'rgba(255,255,255,0.97)',
                    boxShadow: state.isFocused ? '0 0 0 2px #4ea8de55' : '0 2px 12px #22223b11',
                    fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif',
                    outline: 'none',
                    cursor: 'pointer',
                    borderColor: '#b5b5c3',
                  }),
                  option: (base, state) => ({
                    ...base,
                    borderRadius: 14,
                    backgroundColor: state.isSelected ? '#4ea8de' : state.isFocused ? '#e0ecfc' : 'rgba(255,255,255,0.97)',
                    color: state.isSelected ? '#fff' : '#22223b',
                    fontWeight: state.isSelected ? 700 : 500,
                    fontSize: 17,
                    fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif',
                    padding: '12px 18px',
                    cursor: 'pointer',
                  }),
                  menu: base => ({
                    ...base,
                    width: 240,
                    minWidth: 240,
                    maxWidth: 240,
                    borderRadius: 18,
                    boxShadow: '0 2px 12px #22223b22',
                    background: 'rgba(255,255,255,0.98)',
                  }),
                  singleValue: base => ({
                    ...base,
                    color: '#22223b',
                    fontWeight: 700,
                  }),
                  placeholder: base => ({
                    ...base,
                    color: '#b5b5c3',
                  })
                }}
                placeholder="Selecciona..."
                isSearchable={false}
              />
              <button type="submit" style={{ width: "100%", maxWidth: 400, borderRadius: 18, fontWeight: 800, fontSize: 19, padding: "15px 0", cursor: "pointer", letterSpacing: 1, fontFamily: "Nunito Sans, Inter, Poppins, Arial, sans-serif", boxShadow: "0 2px 16px #22223b22", border: "none", background: "linear-gradient(90deg, #4361ee 0%, #4ea8de 100%)", color: "#fff" }}>Siguiente</button>
              {error && <p style={{color:'#e63946', textAlign:'center', marginTop: 20, fontWeight: 700, background: "rgba(255,255,255,0.97)", borderRadius: 14, padding: "12px 0", boxShadow: "0 1px 8px #e6394622", fontFamily: "Nunito Sans, Inter, Poppins, Arial, sans-serif", border: `1.5px solid #e6394622`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, animation: "shake 0.3s" }}><span style={{fontWeight:900, fontSize:18, marginRight:6}}>!</span> {error}</p>}
            </form>
          </div>
        </div>
      )}
      {step === 2 && (
        <div
          style={{
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.97)",
            transition: "all 0.5s cubic-bezier(.4,2,.3,1)",
            background: "rgba(255,255,255,0.98)",
            borderRadius: 28,
            boxShadow: "0 2px 12px #22223b11",
            padding: "12px 24px 24px 24px",
            width: "100%",
            maxWidth: 350,
            minWidth: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginTop: 0,
              marginBottom: 12,
              color: "#22223b",
              fontWeight: 900,
              fontSize: 32,
              letterSpacing: 1.2,
              textShadow: "0 2px 8px #4ea8de22",
              fontFamily: "Nunito Sans, Inter, Poppins, Arial, sans-serif",
            }}
          >
            Registro
          </h2>
          <form onSubmit={handleRegister} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
            {role === 'Usuario' && (
              <>
                <input type="text" placeholder="DNI" value={dni} onChange={e => setDni(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="text" placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="text" placeholder="Obra Social" value={obraSocial} onChange={e => setObraSocial(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="text" placeholder="Nro. Afiliado" value={nroAfiliado} onChange={e => setNroAfiliado(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="date" placeholder="Vencimiento" value={vencimiento} onChange={e => setVencimiento(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="text" placeholder="Cobertura" value={cobertura} onChange={e => setCobertura(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="text" placeholder="Dirección completa" value={direccion} onChange={e => setDireccion(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <button
                  type="button"
                  style={{ marginBottom: "10px", width: "100%", padding: "8px", borderRadius: 18, fontWeight: 700, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', background: "linear-gradient(90deg, #4361ee 0%, #4ea8de 100%)", color: "#fff", border: "none", boxShadow: "0 2px 8px #22223b22" }}
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
                      } else {
                        setLat("");
                        setLng("");
                        setCoordStatus('fail');
                      }
                    } catch {
                      setLat("");
                      setLng("");
                      setCoordStatus('fail');
                    }
                  }}
                >Obtener latitud y longitud</button>
                <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {coordStatus === 'ok' && (
                    <span style={{ color: 'green', fontSize: '1.5em' }}>✔️</span>
                  )}
                  {coordStatus === 'fail' && (
                    <span style={{ color: 'red', fontSize: '1.5em' }}>❌</span>
                  )}
                  {lat && lng && coordStatus === 'ok' && (
                    <span><strong>Latitud:</strong> {lat} <strong>Longitud:</strong> {lng}</span>
                  )}
                  {coordStatus === 'fail' && (
                    <span>No se encontró la dirección.</span>
                  )}
                </div>
              </>
            )}
            {role === 'Farmacia' && (
              <>
                <input type="text" placeholder="Nombre de la farmacia" value={nombreFarmacia} onChange={e => setNombreFarmacia(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="text" placeholder="Dirección completa" value={direccionFarmacia} onChange={e => setDireccionFarmacia(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <button
                  type="button"
                  style={{ marginBottom: "10px", width: "100%", padding: "8px", borderRadius: 18, fontWeight: 700, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', background: "linear-gradient(90deg, #4361ee 0%, #4ea8de 100%)", color: "#fff", border: "none", boxShadow: "0 2px 8px #22223b22" }}
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
                        setLatFarmacia("");
                        setLngFarmacia("");
                        setCoordStatusFarmacia('fail');
                      }
                    } catch {
                      setLatFarmacia("");
                      setLngFarmacia("");
                      setCoordStatusFarmacia('fail');
                    }
                  }}
                >Obtener latitud y longitud</button>
                <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {coordStatusFarmacia === 'ok' && (
                    <span style={{ color: 'green', fontSize: '1.5em' }}>✔️</span>
                  )}
                  {coordStatusFarmacia === 'fail' && (
                    <span style={{ color: 'red', fontSize: '1.5em' }}>❌</span>
                  )}
                  {latFarmacia && lngFarmacia && coordStatusFarmacia === 'ok' && (
                    <span><strong>Latitud:</strong> {latFarmacia} <strong>Longitud:</strong> {lngFarmacia}</span>
                  )}
                  {coordStatusFarmacia === 'fail' && (
                    <span>No se encontró la dirección.</span>
                  )}
                </div>
                <input type="text" placeholder="Contacto" value={contactoFarmacia} onChange={e => setContactoFarmacia(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <div style={{ width: '100%' }}>
                  <label style={{ fontWeight: 700, color: '#22223b', fontSize: 16, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', marginBottom: 5 }}>Obras sociales aceptadas:</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Agregar obra social"
                      value={obraSocialInput}
                      onChange={e => setObraSocialInput(e.target.value)}
                      style={{ flex: 1, borderRadius: 14, fontSize: 16, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '8px 12px' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (obraSocialInput.trim() && !obrasSocialesAceptadas.includes(obraSocialInput.trim())) {
                          setObrasSocialesAceptadas([...obrasSocialesAceptadas, obraSocialInput.trim()]);
                          setObraSocialInput('');
                        }
                      }}
                      style={{ padding: '8px', borderRadius: 14, fontWeight: 700, fontSize: 15, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', background: "linear-gradient(90deg, #4361ee 0%, #4ea8de 100%)", color: "#fff", border: "none", boxShadow: "0 2px 8px #22223b22" }}
                    >Agregar</button>
                  </div>
                  <ul style={{ paddingLeft: '20px', marginBottom: '8px' }}>
                    {obrasSocialesAceptadas.map((obra, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', fontSize: 15 }}>
                        {obra}
                        <button type="button" style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }} onClick={() => {
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
                <input type="text" placeholder="DNI" value={dniDelivery} onChange={e => setDniDelivery(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
                <input type="text" placeholder="Datos de contacto" value={contactoDelivery} onChange={e => setContactoDelivery(e.target.value)} required style={{ width: '100%', borderRadius: 18, fontSize: 17, fontFamily: 'Nunito Sans, Inter, Poppins, Arial, sans-serif', border: '1.5px solid #b5b5c3', padding: '12px 14px', marginBottom: 8 }} />
              </>
            )}
            <button type="submit" style={{ width: "100%", maxWidth: 400, borderRadius: 18, fontWeight: 800, fontSize: 19, padding: "15px 0", cursor: "pointer", letterSpacing: 1, fontFamily: "Nunito Sans, Inter, Poppins, Arial, sans-serif", boxShadow: "0 2px 16px #22223b22", border: "none", background: "linear-gradient(90deg, #4361ee 0%, #4ea8de 100%)", color: "#fff", marginTop: 10 }}>Registrar</button>
            {error && <p style={{color:'#e63946', textAlign:'center', marginTop: 20, fontWeight: 700, background: "rgba(255,255,255,0.97)", borderRadius: 14, padding: "12px 0", boxShadow: "0 1px 8px #e6394622", fontFamily: "Nunito Sans, Inter, Poppins, Arial, sans-serif", border: `1.5px solid #e6394622`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, animation: "shake 0.3s" }}><span style={{fontWeight:900, fontSize:18, marginRight:6}}>!</span> {error}</p>}
            {success && <p style={{color:'green', textAlign:'center', marginTop: 20, fontWeight: 700, background: "rgba(255,255,255,0.97)", borderRadius: 14, padding: "12px 0", boxShadow: "0 1px 8px #4ea8de22", fontFamily: "Nunito Sans, Inter, Poppins, Arial, sans-serif", border: `1.5px solid #4ea8de22`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><span style={{fontWeight:900, fontSize:18, marginRight:6}}>✔</span> {success}</p>}
          </form>
        </div>
  )}
    </div>
  );
};

export default Register;
