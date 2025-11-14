/**
 * Componente para agregar productos a la farmacia.
 * Permite registrar nombre, precio, stock y si requiere receta médica.
 *
 * No recibe props. Utiliza Firebase para guardar productos.
 */
import React, { useState, useEffect } from 'react';
import InstructionModal from './InstructionModal';
import { ref, push, onValue, remove, update, get, set, runTransaction, query as dbQuery, orderByChild, equalTo } from 'firebase/database';
import { db, auth } from '../firebase';

const FarmaciaProductos = () => {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [principioActivo, setPrincipioActivo] = useState('');
  const [dosis, setDosis] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [codigoNacional, setCodigoNacional] = useState('');
  const [requiereReceta, setRequiereReceta] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [productos, setProductos] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageType, setMessageType] = useState(''); // 'error' | 'success'
  const [editingStockId, setEditingStockId] = useState(null);
  const [editingStockValue, setEditingStockValue] = useState('');
  // estados para ayuda/instrucciones
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState('');

  // Envía el producto a la base de datos
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setErrors({});
    setMessageType('');
    // prevenir envíos repetidos
    if (isSubmitting) return;
    const user = auth.currentUser;
    if (!user) {
      setMensaje('Debes iniciar sesión como farmacia.');
      return;
    }
  // validaciones cliente (campos obligatorios según Trello)
    const newErrors = {};
    if (!nombre || !String(nombre).trim()) newErrors.nombre = 'Nombre es obligatorio.';
    // precio: número > 0
    const precioNum = Number(String(precio).replace(',', '.'));
    if (precio === '' || !isFinite(precioNum)) newErrors.precio = 'Precio inválido.';
    else if (precioNum <= 0) newErrors.precio = 'El precio debe ser mayor a 0.';
  // stock: entero > 0 (no se permite 0 ni negativos)
  const stockNum = Number(stock);
  if (stock === '' || !/^-?\d+$/.test(String(stock))) newErrors.stock = 'Stock debe ser un número entero.';
  else if (Number(stockNum) <= 0) newErrors.stock = 'El stock debe ser mayor a 0 (usa eliminar si querés quitar el producto).';
    // campos nuevos obligatorios
    if (!principioActivo || !String(principioActivo).trim()) newErrors.principioActivo = 'Principio activo es obligatorio.';
    if (!dosis || !String(dosis).trim()) newErrors.dosis = 'Dosis es obligatoria.';
    if (!fechaVencimiento) newErrors.fechaVencimiento = 'Fecha de vencimiento es obligatoria.';
    else {
      // Validación estricta YYYY-MM-DD: evitar que JS corrija fechas inválidas (ej. 2026-02-31)
      const parts = String(fechaVencimiento).split('-').map(p => Number(p));
      const [y, m, d] = parts;
      const isValidParts = parts.length === 3 && Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d);
      if (!isValidParts) {
        newErrors.fechaVencimiento = 'La fecha ingresada no es válida.';
      } else {
        const venc = new Date(y, m - 1, d);
        if (venc.getFullYear() !== y || (venc.getMonth() + 1) !== m || venc.getDate() !== d) {
          newErrors.fechaVencimiento = 'La fecha ingresada no es válida.';
        } else {
          // normalizar a 00:00 para comparar fecha
          const hoy = new Date(); hoy.setHours(0,0,0,0);
          venc.setHours(0,0,0,0);
          if (venc <= hoy) newErrors.fechaVencimiento = 'La fecha de vencimiento debe ser futura.';
          // límite aceptable: no más de 10 años en el futuro
          const max = new Date(); max.setFullYear(max.getFullYear() + 10); max.setHours(0,0,0,0);
          if (venc > max) newErrors.fechaVencimiento = 'La fecha de vencimiento es demasiado lejana. Verifica.';
        }
      }
    }
    if (!codigoNacional || !String(codigoNacional).trim()) newErrors.codigoNacional = 'Código nacional (CNM) es obligatorio.';

  // Verificar duplicado por CNM en los productos cargados por esta farmacia (cliente-side)
  const existing = productos.find(p => p.codigoNacional && String(p.codigoNacional).trim().toLowerCase() === String(codigoNacional).trim().toLowerCase() && Number(p.stock) > 0);
  if (existing) newErrors.codigoNacional = 'Ya existe un producto con ese código nacional.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setMensaje(Object.values(newErrors)[0]);
      setMessageType('error');
      return;
    }

  // Verificación adicional en DB para evitar duplicados por NOMBRE y por CNM antes del push
    // Primero: chequeo local por NOMBRE (case-insensitive) para dar feedback instantáneo
    try {
      const trimmedName = String(nombre).trim();
      // considerar solo productos activos (stock > 0) al chequear por nombre localmente
      const nameExistsLocal = productos.find(p => p.nombre && String(p.nombre).trim().toLowerCase() === trimmedName.toLowerCase() && Number(p.stock) > 0);
      if (nameExistsLocal) {
        const errMsg = 'Ya existe un producto con ese nombre en tu farmacia.';
        setErrors(prev => ({ ...prev, nombre: errMsg }));
        setMensaje(errMsg);
        setMessageType('error');
        return;
      }
    } catch (err) {
      console.error('Error comprobando nombre local:', err);
      // no bloquear por error local inesperado, continuamos al check DB
    }

    // Luego: comprobación en DB por nombre exacto (evita condiciones de carrera menores)
    try {
      const trimmedName = String(nombre).trim();
      const nameQuery = dbQuery(ref(db, 'productos'), orderByChild('nombre'), equalTo(trimmedName));
      const nameSnap = await get(nameQuery);
      if (nameSnap && nameSnap.exists()) {
        const data = nameSnap.val();
        // Only treat as conflict if there's an existing product for this farm with stock > 0
        const found = Object.entries(data).find(([k, v]) => v && v.farmaciaId === user.uid && Number(v.stock) > 0);
        if (found) {
          const errMsg = 'Ya existe un producto con ese nombre en tu farmacia.';
          setErrors(prev => ({ ...prev, nombre: errMsg }));
          setMensaje(errMsg);
          setMessageType('error');
          return;
        }
      }

      // Verificación por CNM (códigoNacional) como antes
      const dupQuery = dbQuery(ref(db, 'productos'), orderByChild('codigoNacional'), equalTo(String(codigoNacional).trim()));
      const dupSnap = await get(dupQuery);
      if (dupSnap && dupSnap.exists()) {
        const data = dupSnap.val();
        const foundCnm = Object.entries(data).find(([k, v]) => v && v.farmaciaId === user.uid);
        if (foundCnm) {
          const errMsg = 'Ya existe un producto con ese código nacional en tu farmacia.';
          setErrors(prev => ({ ...prev, codigoNacional: errMsg }));
          setMensaje(errMsg);
          setMessageType('error');
          return;
        }
      }
    } catch (err) {
      console.error('Error comprobando duplicados:', err);
      setMensaje('No se pudo verificar si el producto ya existe. Intenta nuevamente.');
      setMessageType('error');
      return;
    }

    // Implementación sencilla y atómica usando índices por farmacia para evitar duplicados
    setIsSubmitting(true);
    const normalizedName = String(nombre).trim();
    const normalizedNameKey = normalizedName.toLowerCase().replace(/\s+/g, '_');
    const normalizedCnm = String(codigoNacional).trim().toLowerCase().replace(/\s+/g, '_');
    const nameIndexRef = ref(db, `productosByFarm/${user.uid}/name_${normalizedNameKey}`);
    const cnmIndexRef = ref(db, `productosByFarm/${user.uid}/cnm_${normalizedCnm}`);
    // reservar clave push antes
    const newProdRef = push(ref(db, 'productos'));
    const newKey = newProdRef.key;
    let reservedName = false;
    let reservedCnm = false;
    try {
      // reservar nombre
      // Antes de reservar el índice, comprobar si está reservado por un producto con stock 0
      const nameIndexSnap = await get(nameIndexRef);
      if (nameIndexSnap && nameIndexSnap.exists()) {
        const existingKey = nameIndexSnap.val();
        try {
          const prodSnap = await get(ref(db, `productos/${existingKey}`));
          const prodVal = prodSnap && prodSnap.val();
          if (prodVal && Number(prodVal.stock) <= 0) {
            // liberar índice para permitir reusar el mismo nombre
            await set(nameIndexRef, null);
          }
        } catch (e) {
          console.warn('No se pudo validar producto indexado por nombre', e);
        }
      }

      const nameTx = await runTransaction(nameIndexRef, (current) => {
        if (current === null) return newKey;
        return; // abort
      });
      if (!nameTx.committed) {
        const errMsg = 'Ya existe un producto con ese nombre en tu farmacia.';
        setErrors(prev => ({ ...prev, nombre: errMsg }));
        setMensaje(errMsg);
        setMessageType('error');
        return;
      }
      reservedName = true;

      // reservar CNM
      const cnmTx = await runTransaction(cnmIndexRef, (current) => {
        if (current === null) return newKey;
        return;
      });
      if (!cnmTx.committed) {
        // liberar nombre
        try { await set(nameIndexRef, null); } catch (e) { console.warn('Rollback name failed', e); }
        const errMsg = 'Ya existe un producto con ese código nacional en tu farmacia.';
        setErrors(prev => ({ ...prev, codigoNacional: errMsg }));
        setMensaje(errMsg);
        setMessageType('error');
        return;
      }
      reservedCnm = true;

      // escribir producto
      await set(newProdRef, {
        nombre: String(nombre).trim(),
        precio: precioNum,
        stock: Number(stockNum),
        requiereReceta,
        principioActivo: String(principioActivo).trim(),
        dosis: String(dosis).trim(),
        fechaVencimiento,
        codigoNacional: String(codigoNacional).trim(),
        farmaciaId: user.uid,
        estado: 'por_comprar'
      });

      setMensaje('Producto agregado correctamente.');
      // limpiar campos
      setNombre('');
      setPrecio('');
      setStock('');
      setPrincipioActivo('');
      setDosis('');
      setFechaVencimiento('');
      setCodigoNacional('');
      setRequiereReceta(false);
    } catch (err) {
      console.error('Error agregando producto:', err);
      setMensaje('No se pudo agregar el producto. Intenta nuevamente.');
      setMessageType('error');
      // rollback si se reservaron índices
      try { if (reservedCnm) await set(cnmIndexRef, null); } catch (e) { console.warn(e); }
      try { if (reservedName) await set(nameIndexRef, null); } catch (e) { console.warn(e); }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validación por campo (similar a Register.js behavior)
  const validateProductField = (field, value) => {
    const v = value === undefined || value === null ? '' : String(value).trim();
    switch (field) {
      case 'nombre':
        if (!v) return 'Nombre es obligatorio.';
        if (v.length > 200) return 'Nombre demasiado largo.';
        return '';
      case 'precio': {
        const num = Number(v.replace(',', '.'));
        if (v === '') return 'Precio inválido.';
        if (!isFinite(num)) return 'Precio inválido.';
        if (num <= 0) return 'El precio debe ser mayor a 0.';
        return '';
      }
      case 'stock':
        if (v === '') return 'Stock es obligatorio.';
        if (!/^-?\d+$/.test(v)) return 'Stock debe ser un número entero.';
        if (Number(v) <= 0) return 'El stock debe ser mayor a 0.';
        return '';
      case 'principioActivo':
        if (!v) return 'Principio activo es obligatorio.';
        return '';
      case 'dosis':
        if (!v) return 'Dosis es obligatoria.';
        return '';
      case 'fechaVencimiento': {
        if (!v) return 'Fecha de vencimiento es obligatoria.';
        const parts = v.split('-').map(p => Number(p));
        const [y, m, d] = parts;
        if (parts.length !== 3 || !Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return 'La fecha ingresada no es válida.';
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || (dt.getMonth() + 1) !== m || dt.getDate() !== d) return 'La fecha ingresada no es válida.';
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        dt.setHours(0,0,0,0);
        if (dt <= hoy) return 'La fecha de vencimiento debe ser futura.';
        const max = new Date(); max.setFullYear(max.getFullYear() + 10); max.setHours(0,0,0,0);
        if (dt > max) return 'La fecha de vencimiento es demasiado lejana. Verifica.';
        return '';
      }
      case 'codigoNacional':
        if (!v) return 'Código nacional (CNM) es obligatorio.';
        return '';
      default:
        return '';
    }
  };

  const setFieldError = (field, msg) => {
    setErrors(prev => ({ ...prev, [field]: msg }));
  };

  // Cargar productos de la farmacia actual
  useEffect(() => {
    // Suscribirnos al estado de auth para garantizar que cuando el usuario inicie sesión
    // nos suscribimos al nodo de productos de esa farmacia. Esto permite recarga continua
    // sin tener que reingresar a la página.
    let off = null;
    const authUnsub = auth.onAuthStateChanged((user) => {
      // limpiar lista si no hay usuario
      if (!user) {
        setProductos([]);
        if (off) { off(); off = null; }
        return;
      }
      // crear query filtrada por farmaciaId
      const q = dbQuery(ref(db, 'productos'), orderByChild('farmaciaId'), equalTo(user.uid));
      // si ya teníamos un listener, quitarlo
      if (off) { off(); off = null; }
      off = onValue(q, (snapshot) => {
        const data = snapshot.val() || {};
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setProductos(list);
      }, (err) => {
        console.error(err);
        setMensaje('No se pudieron cargar los productos. Actualiza la página o intenta más tarde.');
        setMessageType('error');
      });
    });
    return () => {
      try { authUnsub(); } catch (e) {}
      try { if (off) off(); } catch (e) {}
    };
  }, []);

  const openHelp = (topic) => {
    setHelpTopic(topic);
    setHelpOpen(true);
  };

  const closeHelp = () => {
    setHelpOpen(false);
    setHelpTopic('');
  };

  const getHelpContent = (topic) => {
    switch (topic) {
      case 'nombre':
        return (
          <div>
            <p><strong>¿Cómo ingresar el nombre?</strong></p>
            <ul>
              <li>Escribe el nombre comercial del medicamento tal como figura en el envase.</li>
              <li>Evita caracteres innecesarios (ej: ********). Máx 200 caracteres.</li>
              <li>Ejemplo: <em>Paracetamol 500 mg - Tabletas</em></li>
            </ul>
          </div>
        );
      case 'precio':
        return (
          <div>
            <p><strong>Ingresar el precio</strong></p>
            <ul>
              <li>Ingrese un número mayor a 0. Puede usar decimales con punto o coma (p. ej. 12.50 o 12,50).</li>
              <li>No incluya el símbolo $. Solo el valor numérico.</li>
              <li>Ejemplo: <em>1250</em> (para $1250) o <em>12.50</em> (para $12.50).</li>
            </ul>
          </div>
        );
      case 'fecha':
        return (
          <div>
            <p><strong>Fecha de vencimiento</strong></p>
            <ul>
              <li>Seleccione la fecha en formato AÑO-MES-DÍA. Debe ser una fecha futura.</li>
              <li>No ingrese fechas inválidas (por ejemplo 2026-02-31). Si no está seguro, revise el envase del producto.</li>
              <li>Ejemplo: <em>2026-08-15</em></li>
            </ul>
          </div>
        );
      case 'codigoNacional':
        return (
          <div>
            <p><strong>Código nacional (CNM)</strong></p>
            <ul>
              <li>Este código identifica al producto a nivel nacional. Suele encontrarse en el envase o ficha técnica.</li>
              <li>Es obligatorio y ayuda a evitar duplicados. Escribirlo tal como figura, sin espacios frontales ni finales.</li>
              <li>Ejemplo: <em>CNM-123456</em> o solo <em>123456</em>, según el formato del envase.</li>
            </ul>
          </div>
        );
      default:
        return (
          <div>
            <p><strong>Guía para cargar un producto</strong></p>
            <ol>
              <li>Completar el <em>Nombre</em> con el texto del envase.</li>
              <li>Ingresar el <em>Precio</em> en número (mayor a 0).</li>
              <li>Colocar el <em>Stock</em> como entero mayor a 0.</li>
              <li>Completar <em>Principio activo</em> y <em>Dosis</em> tal como figura en la caja o prospecto.</li>
              <li>Seleccionar una <em>Fecha de vencimiento</em> válida y futura.</li>
              <li>Ingresar el <em>Código nacional</em> (CNM) para evitar duplicados.</li>
              <li>Marcar si <em>requiere receta médica</em> si aplica.</li>
            </ol>
            <p>Si tenés dudas, usá los botones <strong>?</strong> junto a cada campo para ver un ejemplo.</p>
          </div>
        );
    }
  };

  const handleDelete = async (id) => {
    try {
      // Antes de eliminar, verificar si existen compras asociadas que no estén finalizadas
      try {
        const comprasSnap = await get(ref(db, 'compras'));
        const comprasData = comprasSnap && comprasSnap.val();
        const pendientes = [];
        if (comprasData) {
          Object.entries(comprasData).forEach(([uid, comprasUsuario]) => {
            if (!comprasUsuario) return;
            Object.entries(comprasUsuario).forEach(([compraId, compra]) => {
              if (!compra) return;
              if (compra.productoId === id) {
                const estado = compra.estado || '';
                // considerar pendientes todos los pedidos que no estén entregados o ya cancelados
                if (estado !== 'recibido' && estado !== 'cancelado') {
                  pendientes.push({ uid, compraId, compra });
                }
              }
            });
          });
        }

        if (pendientes.length > 0) {
          const confirmMsg = `Este producto tiene ${pendientes.length} pedido(s) pendientes. Si lo eliminas, esos pedidos serán cancelados y los compradores notificados. ¿Deseas continuar?`;
          const ok = window.confirm(confirmMsg);
          if (!ok) return; // no eliminar si el usuario cancela

          // Cancelar cada compra pendiente y crear una notificación para el comprador
          for (const p of pendientes) {
            try {
              await update(ref(db, `compras/${p.uid}/${p.compraId}`), { estado: 'cancelado', motivo: 'producto_eliminado_por_farmacia' });
              // notificaciones por usuario (creamos nodo si no existe)
              const notifRef = push(ref(db, `notificaciones/${p.uid}`));
              await set(notifRef, {
                tipo: 'pedido_cancelado',
                mensaje: `Tu pedido ${p.compraId} fue cancelado porque el producto ya no está disponible.`,
                productoId: id,
                compraId: p.compraId,
                fecha: Date.now()
              });
            } catch (e) {
              console.warn('No se pudo actualizar/cancelar la compra', p, e);
            }
          }
        }
      } catch (e) {
        console.warn('Error comprobando compras asociadas al producto', e);
      }

      // intentar eliminar índices asociados (nombre/CNM) si existen
      try {
        const prodSnap = await get(ref(db, 'productos/' + id));
        const prod = prodSnap && prodSnap.val();
        if (prod && prod.farmaciaId) {
          const farmId = prod.farmaciaId;
          if (prod.nombre) {
            const nameKey = String(prod.nombre).trim().toLowerCase().replace(/\s+/g, '_');
            await set(ref(db, `productosByFarm/${farmId}/name_${nameKey}`), null);
          }
          if (prod.codigoNacional) {
            const cnmKey = String(prod.codigoNacional).trim().toLowerCase().replace(/\s+/g, '_');
            await set(ref(db, `productosByFarm/${farmId}/cnm_${cnmKey}`), null);
          }
        }
      } catch (e) {
        console.warn('No se pudieron eliminar índices asociados al producto', e);
      }

      await remove(ref(db, 'productos/' + id));
      setMensaje('Producto eliminado.');
    } catch (err) {
      console.error(err);
      setMensaje('No se pudo eliminar el producto. Intenta nuevamente.');
    }
  };

  const startEditStock = (id, currentStock) => {
    setEditingStockId(id);
    setEditingStockValue(String(currentStock ?? ''));
  };

  const cancelEditStock = () => {
    setEditingStockId(null);
    setEditingStockValue('');
  };

  const saveStock = async (id) => {
    // Validar antes de guardar: entero > 0
    const v = String(editingStockValue).trim();
    if (v === '') {
      setMensaje('Ingresa un valor de stock válido.');
      setErrors(prev => ({ ...prev, editingStock: 'Stock es obligatorio.' }));
      return;
    }
    if (!/^-?\d+$/.test(v)) {
      setMensaje('El stock debe ser un número entero.');
      setErrors(prev => ({ ...prev, editingStock: 'Stock debe ser un número entero.' }));
      return;
    }
    const num = Number(v);
    if (num <= 0) {
      setMensaje('El stock debe ser mayor a 0. Si querés quitar el producto, usá Eliminar.');
      setErrors(prev => ({ ...prev, editingStock: 'Stock debe ser mayor a 0.' }));
      return;
    }
    try {
      await update(ref(db, 'productos/' + id), { stock: num });
      setMensaje('Stock actualizado.');
      setErrors(prev => ({ ...prev, editingStock: '' }));
      cancelEditStock();
    } catch (err) {
      console.error(err);
      setMensaje('No se pudo actualizar el stock. Intenta nuevamente.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '20px' }}>
      <h2>Agregar Producto</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Nombre:
            <button type="button" onClick={() => openHelp('nombre')} aria-label="Ayuda nombre" title="Cómo completar nombre" style={{ border: 'none', background: '#eee', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>?</button>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setFieldError('nombre', ''); }}
            onBlur={e => setFieldError('nombre', validateProductField('nombre', e.target.value))}
            required
            style={{ width: '100%', marginBottom: '10px' }}
          />
          {errors.nombre && <div style={{ color: 'red', marginBottom: '8px' }}>{errors.nombre}</div>}
        </div>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Precio:
            <button type="button" onClick={() => openHelp('precio')} aria-label="Ayuda precio" title="Cómo completar precio" style={{ border: 'none', background: '#eee', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>?</button>
          </label>
          <input
            type="number"
            value={precio}
            onChange={e => { setPrecio(e.target.value); setFieldError('precio', ''); }}
            onBlur={e => setFieldError('precio', validateProductField('precio', e.target.value))}
            required
            style={{ width: '100%', marginBottom: '10px' }}
          />
          {errors.precio && <div style={{ color: 'red', marginBottom: '8px' }}>{errors.precio}</div>}
        </div>
        <div>
          <label>Stock:</label>
          <input
            type="number"
            value={stock}
            onChange={e => { setStock(e.target.value); setFieldError('stock', ''); }}
            onBlur={e => setFieldError('stock', validateProductField('stock', e.target.value))}
            required
            style={{ width: '100%', marginBottom: '10px' }}
          />
          {errors.stock && <div style={{ color: 'red', marginBottom: '8px' }}>{errors.stock}</div>}
        </div>
        <div>
          <label>Principio activo:</label>
          <input
            type="text"
            value={principioActivo}
            onChange={e => { setPrincipioActivo(e.target.value); setFieldError('principioActivo', ''); }}
            onBlur={e => setFieldError('principioActivo', validateProductField('principioActivo', e.target.value))}
            required
            style={{ width: '100%', marginBottom: '10px' }}
          />
          {errors.principioActivo && <div style={{ color: 'red', marginBottom: '8px' }}>{errors.principioActivo}</div>}
        </div>
        <div>
          <label>Dosis:</label>
          <input
            type="text"
            value={dosis}
            onChange={e => { setDosis(e.target.value); setFieldError('dosis', ''); }}
            onBlur={e => setFieldError('dosis', validateProductField('dosis', e.target.value))}
            required
            style={{ width: '100%', marginBottom: '10px' }}
          />
          {errors.dosis && <div style={{ color: 'red', marginBottom: '8px' }}>{errors.dosis}</div>}
        </div>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Fecha de vencimiento:
            <button type="button" onClick={() => openHelp('fecha')} aria-label="Ayuda fecha" title="Cómo completar fecha" style={{ border: 'none', background: '#eee', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>?</button>
          </label>
          <input
            type="date"
            value={fechaVencimiento}
            onChange={e => { setFechaVencimiento(e.target.value); setFieldError('fechaVencimiento', ''); }}
            onBlur={e => setFieldError('fechaVencimiento', validateProductField('fechaVencimiento', e.target.value))}
            required
            style={{ width: '100%', marginBottom: '10px' }}
          />
          {errors.fechaVencimiento && <div style={{ color: 'red', marginBottom: '8px' }}>{errors.fechaVencimiento}</div>}
        </div>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Código nacional (CNM):
            <button type="button" onClick={() => openHelp('codigoNacional')} aria-label="Ayuda código nacional" title="Cómo completar código nacional" style={{ border: 'none', background: '#eee', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>?</button>
          </label>
          <input
            type="text"
            value={codigoNacional}
            onChange={e => { setCodigoNacional(e.target.value); setFieldError('codigoNacional', ''); }}
            onBlur={e => setFieldError('codigoNacional', validateProductField('codigoNacional', e.target.value))}
            required
            style={{ width: '100%', marginBottom: '10px' }}
          />
          {errors.codigoNacional && <div style={{ color: 'red', marginBottom: '8px' }}>{errors.codigoNacional}</div>}
        </div>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={requiereReceta}
              onChange={e => setRequiereReceta(e.target.checked)}
            />
            Requiere receta médica
          </label>
        </div>
        <button type="submit" style={{ marginTop: '12px' }} disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Agregar'}</button>
      </form>
      <InstructionModal open={helpOpen} onClose={closeHelp} title={helpTopic ? `Ayuda: ${helpTopic}` : 'Ayuda para agregar producto'}>
        {getHelpContent(helpTopic)}
      </InstructionModal>
  {mensaje && <p style={{ color: messageType === 'error' ? 'red' : 'green' }}>{mensaje}</p>}

        <div style={{ marginTop: '20px' }}>
          <h3>Mis Productos</h3>
          {/* Solo mostrar productos con stock mayor a 0 */}
          {productos.filter(p => Number(p.stock) > 0).length === 0 && <p>No hay productos con stock disponible.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {productos.filter(p => Number(p.stock) > 0).map(prod => (
              <li key={prod.id} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '8px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{prod.nombre}</strong>
                    <div>Precio: ${prod.precio}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      <div>Stock: {prod.stock}</div>
                      <button
                        type="button"
                        onClick={() => startEditStock(prod.id, prod.stock)}
                        title="Editar stock"
                        style={{ padding: '4px 8px', fontSize: '0.9em' }}
                      >
                        Editar stock
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {editingStockId === prod.id ? (
                    <>
                      <input type="number" value={editingStockValue} onChange={e => { setEditingStockValue(e.target.value); setErrors(prev => ({ ...prev, editingStock: '' })); }} style={{ flex: 1 }} />
                      {errors.editingStock && <div style={{ color: 'red', marginTop: 6 }}>{errors.editingStock}</div>}
                      <button type="button" onClick={() => saveStock(prod.id)}>Guardar</button>
                      <button type="button" onClick={cancelEditStock}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEditStock(prod.id, prod.stock)}>Modificar stock</button>
                      <button type="button" onClick={() => handleDelete(prod.id)} style={{ background: '#ffdddd' }}>Eliminar</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
    </div>
  );
};

export default FarmaciaProductos;
