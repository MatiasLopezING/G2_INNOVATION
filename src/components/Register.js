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

  return (
    <div className="min-h-screen bg-slate-50/60 flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-xl">
        <div className="flex justify-center mb-4">
          <img
            src="/icons/RecetApp.png"
            alt="RecetApp"
            className="h-16 w-16 object-contain"
          />
        </div>

        <div className="w-full bg-white/80 backdrop-blur-md border border-slate-100 rounded-xl shadow-sm p-6 sm:p-8">
          {step === 1 && (
            <div className="mb-5">
              <div className="text-xs text-slate-500">
                Paso {step} de {totalSteps}
              </div>
              <Progress value={progressValue} className="mt-2" />
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-5">
              <div className="text-center">
                <h2 className="text-2xl font-extrabold text-slate-900">Crear cuenta</h2>
                <p className="mt-1 text-sm text-slate-600">Selecciona tu tipo de perfil para comenzar</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {roleOptions.map((opt) => {
                  const active = role === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setRole(opt.value);
                        setError('');
                        setUsuarioStep(1);
                        setCoordStatusUsuario(null);
                        usuarioForm.reset();
                      }}
                      className={cn(
                        'rounded-xl border-2 p-4 text-left transition',
                        'hover:-translate-y-0.5 hover:border-teal-500',
                        active
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-slate-200 bg-white'
                      )}
                    >
                      <div className={cn('mb-2', active ? 'text-teal-600' : 'text-slate-500')}>
                        {opt.icon}
                      </div>
                      <div className="font-extrabold text-slate-900">{opt.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{opt.description}</div>
                    </button>
                  );
                })}
              </div>

              {error && <UiAlert variant="error">{error}</UiAlert>}

              <UiButton type="submit" className="w-full" size="lg">
                Continuar
              </UiButton>

              <UiButton type="button" variant="ghost" className="w-full underline underline-offset-4" onClick={() => navigate('/')}
              >
                Volver al login
              </UiButton>
            </form>
          )}

          {step === 2 && role === 'Usuario' && (
            <form
              onSubmit={usuarioForm.handleSubmit(handleRegisterUsuario)}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-2xl font-extrabold text-slate-900">Crea tu cuenta</h2>
                <p className="mt-1 text-sm text-slate-600">Paso {usuarioStep} de {usuarioTotalSteps}</p>
              </div>

              <Progress value={usuarioProgressValue} />

              {error && <UiAlert variant="error">{error}</UiAlert>}
              {success && <UiAlert variant="success">{success}</UiAlert>}

              {/* Paso 1: Credenciales */}
              {usuarioStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="u_email">Email</Label>
                    <Input
                      id="u_email"
                      type="email"
                      placeholder="nombre@ejemplo.com"
                      {...usuarioForm.register('email')}
                    />
                    {usuarioForm.formState.errors.email?.message && (
                      <div className="text-sm text-red-600">{usuarioForm.formState.errors.email.message}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="u_password">Contraseña</Label>
                    <Input id="u_password" type="password" {...usuarioForm.register('password')} />
                    {usuarioForm.formState.errors.password?.message && (
                      <div className="text-sm text-red-600">{usuarioForm.formState.errors.password.message}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="u_confirm">Confirmar contraseña</Label>
                    <Input id="u_confirm" type="password" {...usuarioForm.register('confirmPassword')} />
                    {usuarioForm.formState.errors.confirmPassword?.message && (
                      <div className="text-sm text-red-600">{usuarioForm.formState.errors.confirmPassword.message}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Paso 2: Identidad */}
              {usuarioStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="u_nombre">Nombre</Label>
                      <Input id="u_nombre" {...usuarioForm.register('nombre')} />
                      {usuarioForm.formState.errors.nombre?.message && (
                        <div className="text-sm text-red-600">{usuarioForm.formState.errors.nombre.message}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="u_apellido">Apellido</Label>
                      <Input id="u_apellido" {...usuarioForm.register('apellido')} />
                      {usuarioForm.formState.errors.apellido?.message && (
                        <div className="text-sm text-red-600">{usuarioForm.formState.errors.apellido.message}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="u_dni">DNI</Label>
                      <Input id="u_dni" inputMode="numeric" {...usuarioForm.register('dni')} />
                      {usuarioForm.formState.errors.dni?.message && (
                        <div className="text-sm text-red-600">{usuarioForm.formState.errors.dni.message}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="u_fn">Fecha de nacimiento</Label>
                      <Input id="u_fn" type="date" {...usuarioForm.register('fechaNacimiento')} />
                      {usuarioForm.formState.errors.fechaNacimiento?.message && (
                        <div className="text-sm text-red-600">{usuarioForm.formState.errors.fechaNacimiento.message}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 3: Cobertura */}
              {usuarioStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="u_os">Obra social</Label>
                    <Input id="u_os" {...usuarioForm.register('obraSocial')} />
                    {usuarioForm.formState.errors.obraSocial?.message && (
                      <div className="text-sm text-red-600">{usuarioForm.formState.errors.obraSocial.message}</div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="u_af">Nro. afiliado</Label>
                      <Input id="u_af" {...usuarioForm.register('nroAfiliado')} />
                      {usuarioForm.formState.errors.nroAfiliado?.message && (
                        <div className="text-sm text-red-600">{usuarioForm.formState.errors.nroAfiliado.message}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="u_ven">Vencimiento</Label>
                      <Input id="u_ven" type="date" {...usuarioForm.register('vencimiento')} />
                      {usuarioForm.formState.errors.vencimiento?.message && (
                        <div className="text-sm text-red-600">{usuarioForm.formState.errors.vencimiento.message}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="u_cob">Cobertura</Label>
                    <Input id="u_cob" {...usuarioForm.register('cobertura')} />
                    {usuarioForm.formState.errors.cobertura?.message && (
                      <div className="text-sm text-red-600">{usuarioForm.formState.errors.cobertura.message}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Paso 4: Ubicación */}
              {usuarioStep === 4 && (
                <div className="space-y-4">
                  <LocationPicker
                    idPrefix="u"
                    addressPlaceholder="Calle Falsa 123, La Plata"
                    addressValue={usuarioForm.watch('direccion')}
                    onAddressChange={(v) => usuarioForm.setValue('direccion', v, { shouldDirty: true })}
                    latValue={usuarioForm.watch('lat')}
                    lngValue={usuarioForm.watch('lng')}
                    onCoordsChange={(latN, lngN) => {
                      usuarioForm.setValue('lat', latN, { shouldDirty: true });
                      usuarioForm.setValue('lng', lngN, { shouldDirty: true });
                    }}
                    coordStatus={coordStatusUsuario}
                    onCoordStatusChange={setCoordStatusUsuario}
                    onError={(msg) => {
                      setUsuarioLocError(msg || '');
                      if (msg) setError(msg);
                    }}
                  />
                  {usuarioLocError && !error && (
                    <div className="text-sm text-red-600">{usuarioLocError}</div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <UiButton
                  type="button"
                  variant="ghost"
                  onClick={usuarioStep === 1 ? () => { setStep(1); setError(''); setSuccess(''); } : handleUsuarioBack}
                >
                  ← Volver
                </UiButton>

                {usuarioStep < usuarioTotalSteps ? (
                  <UiButton type="button" onClick={handleUsuarioNext}>
                    Siguiente
                  </UiButton>
                ) : (
                  <UiButton type="submit">Finalizar</UiButton>
                )}
              </div>
            </form>
          )}

          {step === 2 && role === 'Farmacia' && (
            <form onSubmit={handleSubmitFarmacia} className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-extrabold text-slate-900">Registra tu Farmacia</h2>
                <p className="mt-1 text-sm text-slate-600">Paso {farmaciaStep} de {farmaciaTotalSteps}</p>
              </div>

              <Progress value={farmaciaProgressValue} />

              {error && <UiAlert variant="error">{error}</UiAlert>}
              {success && <UiAlert variant="success">{success}</UiAlert>}

              {farmaciaStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="f_nombre">Nombre de la farmacia</Label>
                    <Input
                      id="f_nombre"
                      value={nombreFarmacia}
                      onChange={(e) => {
                        setNombreFarmacia(e.target.value);
                        setFieldError('nombreFarmacia', '');
                      }}
                      onBlur={(e) => setFieldError('nombreFarmacia', e.target.value ? '' : 'Nombre de farmacia vacío')}
                      placeholder="Farmacia Central"
                    />
                    {errors.nombreFarmacia && <div className="text-sm text-red-600">{errors.nombreFarmacia}</div>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="f_email">Email</Label>
                    <Input
                      id="f_email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldError('email', '');
                      }}
                      onBlur={(e) => setFieldError('email', validateField('email', e.target.value))}
                      placeholder="farmacia@ejemplo.com"
                    />
                    {errors.email && <div className="text-sm text-red-600">{errors.email}</div>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="f_pass">Contraseña</Label>
                    <Input
                      id="f_pass"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldError('password', '');
                      }}
                      onBlur={(e) => setFieldError('password', validateField('password', e.target.value))}
                    />
                    {errors.password && <div className="text-sm text-red-600">{errors.password}</div>}
                  </div>
                </div>
              )}

              {farmaciaStep === 2 && (
                <div className="space-y-4">
                  <LocationPicker
                    idPrefix="f"
                    addressLabel="Dirección"
                    addressPlaceholder="Av. Siempre Viva 742, Ciudad"
                    addressValue={direccionFarmacia}
                    onAddressChange={(v) => {
                      setDireccionFarmacia(v);
                      setFieldError('direccionFarmacia', '');
                    }}
                    latValue={latFarmacia}
                    lngValue={lngFarmacia}
                    onCoordsChange={(latN, lngN) => {
                      setLatFarmacia(String(latN));
                      setLngFarmacia(String(lngN));
                    }}
                    coordStatus={coordStatusFarmacia}
                    onCoordStatusChange={setCoordStatusFarmacia}
                    onError={(msg) => {
                      setFarmaciaLocError(msg || '');
                      if (msg) setError(msg);
                    }}
                  />
                  {errors.direccionFarmacia && <div className="text-sm text-red-600">{errors.direccionFarmacia}</div>}
                  {farmaciaLocError && !error && <div className="text-sm text-red-600">{farmaciaLocError}</div>}

                  <div className="space-y-2">
                    <Label htmlFor="f_contacto">Teléfono / WhatsApp</Label>
                    <Input
                      id="f_contacto"
                      value={contactoFarmacia}
                      onChange={(e) => {
                        setContactoFarmacia(e.target.value);
                        setFieldError('contactoFarmacia', '');
                      }}
                      placeholder="Ej: +54 221 555-1234"
                    />
                    {errors.contactoFarmacia && <div className="text-sm text-red-600">{errors.contactoFarmacia}</div>}
                  </div>
                </div>
              )}

              {farmaciaStep === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Obras sociales aceptadas</Label>
                    <div className="flex gap-2">
                      <Input
                        value={obraSocialInput}
                        onChange={(e) => setObraSocialInput(e.target.value)}
                        placeholder="Escribe una obra social (ej: IOMA)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddObraSocial();
                          }
                        }}
                      />
                      <UiButton
                        type="button"
                        variant="outline"
                        onClick={handleAddObraSocial}
                        aria-label="Agregar obra social"
                      >
                        <AddIcon fontSize="small" />
                      </UiButton>
                    </div>

                    {obrasSocialesAceptadas.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {obrasSocialesAceptadas.map((obra) => (
                          <Badge key={obra} className="bg-white">
                            {obra}
                            <button
                              type="button"
                              onClick={() => handleRemoveObraSocial(obra)}
                              className="ml-1 text-slate-500 hover:text-slate-900"
                              aria-label={`Quitar ${obra}`}
                            >
                              <CloseIcon fontSize="inherit" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Horarios</Label>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
                      <div className="text-sm text-slate-600">
                        Configura los horarios de atención.
                      </div>
                      <UiButton type="button" variant="outline" size="sm" onClick={() => setIsHorariosOpen(true)}>
                        Editar
                      </UiButton>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <UiButton
                  type="button"
                  variant="ghost"
                  onClick={farmaciaStep === 1 ? () => { setStep(1); setError(''); setSuccess(''); } : handleFarmaciaBack}
                >
                  ← Volver al inicio
                </UiButton>

                {farmaciaStep < farmaciaTotalSteps ? (
                  <UiButton type="button" onClick={handleFarmaciaNext}>
                    Siguiente
                  </UiButton>
                ) : (
                  <UiButton type="submit">Registrar</UiButton>
                )}
              </div>

              <Modal open={isHorariosOpen} title="Editar horarios" onClose={() => setIsHorariosOpen(false)}>
                <HorariosFarmacia horarios={horarios} setHorarios={setHorarios} embedded defaultOpen />
              </Modal>
            </form>
          )}

          {step === 2 && role === 'Distribuidor' && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Registro de Delivery</h2>
                <p className="mt-1 text-sm text-slate-600">Completa tus datos para habilitarte.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-600">Paso {deliveryStep} de {deliveryTotalSteps}</p>
                <Progress value={deliveryProgressValue} />
              </div>

              {deliveryStep === 1 && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="d_email">Email</Label>
                    <Input
                      id="d_email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldError('email', '');
                      }}
                      onBlur={(e) => setFieldError('email', validateField('email', e.target.value))}
                      placeholder="delivery@ejemplo.com"
                    />
                    {errors.email && <div className="text-sm text-red-600">{errors.email}</div>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="d_pass">Contraseña</Label>
                    <Input
                      id="d_pass"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldError('password', '');
                      }}
                      onBlur={(e) => setFieldError('password', validateField('password', e.target.value))}
                    />
                    {errors.password && <div className="text-sm text-red-600">{errors.password}</div>}
                  </div>
                </div>
              )}

              {deliveryStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="d_nombre">Nombre</Label>
                      <Input
                        id="d_nombre"
                        value={nombreDelivery}
                        onChange={(e) => {
                          setNombreDelivery(e.target.value);
                          setFieldError('nombreDelivery', '');
                        }}
                        placeholder="Tu nombre"
                      />
                      {errors.nombreDelivery && <div className="text-sm text-red-600">{errors.nombreDelivery}</div>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="d_apellido">Apellido</Label>
                      <Input
                        id="d_apellido"
                        value={apellidoDelivery}
                        onChange={(e) => {
                          setApellidoDelivery(e.target.value);
                          setFieldError('apellidoDelivery', '');
                        }}
                        placeholder="Tu apellido"
                      />
                      {errors.apellidoDelivery && <div className="text-sm text-red-600">{errors.apellidoDelivery}</div>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="d_fn">Fecha de nacimiento</Label>
                      <Input
                        id="d_fn"
                        type="date"
                        value={fechaNacimiento}
                        onChange={(e) => {
                          setFechaNacimiento(e.target.value);
                          setFieldError('fechaNacimiento', '');
                        }}
                        onBlur={(e) => setFieldError('fechaNacimiento', validateField('fechaNacimiento', e.target.value))}
                      />
                      {errors.fechaNacimiento && <div className="text-sm text-red-600">{errors.fechaNacimiento}</div>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="d_cel">Número de celular</Label>
                      <Input
                        id="d_cel"
                        value={contactoDelivery}
                        onChange={(e) => {
                          setContactoDelivery(e.target.value);
                          setFieldError('contactoDelivery', '');
                        }}
                        inputMode="tel"
                        placeholder="Ej: +54 11 5555-1234"
                      />
                      {errors.contactoDelivery && (
                        <div className="text-sm text-red-600">{errors.contactoDelivery}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="d_dni">DNI</Label>
                    <Input
                      id="d_dni"
                      value={dniDelivery}
                      onChange={(e) => {
                        setDniDelivery(e.target.value);
                        setFieldError('dniDelivery', '');
                      }}
                      onBlur={(e) => setFieldError('dniDelivery', validateField('dni', e.target.value))}
                      placeholder="Ej: 40123456"
                    />
                    {errors.dniDelivery && <div className="text-sm text-red-600">{errors.dniDelivery}</div>}
                  </div>
                </div>
              )}

              {deliveryStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Verifica tu identidad</div>
                    <div className="mt-1 text-sm text-slate-600">Necesitamos una foto de tu DNI para habilitarte.</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FileDropzone
                      id="dni_frente"
                      title="DNI frente"
                      value={frontImageFile}
                      error={errors.frontImage || ''}
                      onChange={(file, msg) => {
                        setFrontImageFile(file);
                        setFieldError('frontImage', msg || '');
                      }}
                    />
                    <FileDropzone
                      id="dni_dorso"
                      title="DNI dorso"
                      value={backImageFile}
                      error={errors.backImage || ''}
                      onChange={(file, msg) => {
                        setBackImageFile(file);
                        setFieldError('backImage', msg || '');
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <UiButton
                  type="button"
                  variant="ghost"
                  onClick={deliveryStep === 1 ? () => { setStep(1); setError(''); setSuccess(''); } : handleDeliveryBack}
                >
                  ← Volver
                </UiButton>

                {deliveryStep < deliveryTotalSteps ? (
                  <UiButton type="button" onClick={handleDeliveryNext}>
                    Siguiente
                  </UiButton>
                ) : (
                  <UiButton
                    type="submit"
                    onClick={() => {
                      if (!frontImageFile) setFieldError('frontImage', 'Sube la foto del frente del DNI.');
                      if (!backImageFile) setFieldError('backImage', 'Sube la foto del dorso del DNI.');
                    }}
                  >
                    Finalizar registro
                  </UiButton>
                )}
              </div>

              {error && <UiAlert variant="destructive">{error}</UiAlert>}
              {success && <UiAlert variant="success">{success}</UiAlert>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
