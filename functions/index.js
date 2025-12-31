const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK once per instance
try {
  admin.initializeApp();
} catch (e) {
  // no-op if already initialized in emulator
}

// Callable function to delete an Auth user by UID.
// Authorization: must be authenticated and have role 'Farmacia' or 'Admin' in RTDB at users/{uid}/role
exports.deleteUserByUid = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión para ejecutar esta acción.');
  }

  const requesterUid = context.auth.uid;
  const targetUid = (data && typeof data.uid === 'string') ? data.uid.trim() : '';
  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Parámetro "uid" es requerido.');
  }

  // Check requester role in Realtime Database
  let role;
  try {
    const snap = await admin.database().ref(`users/${requesterUid}/role`).get();
    role = snap.val();
  } catch (e) {
    throw new functions.https.HttpsError('internal', 'No se pudo verificar el rol del solicitante.');
  }

  if (role !== 'Farmacia' && role !== 'Admin') {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para eliminar usuarios.');
  }

  // Attempt to delete the target user from Firebase Authentication
  try {
    await admin.auth().deleteUser(targetUid);
    return { status: 'deleted' };
  } catch (e) {
    // If the user is already gone, treat as success to unblock re-registro
    const code = e && (e.code || e.errorInfo?.code);
    if (code === 'auth/user-not-found') {
      return { status: 'not-found-treated-as-success' };
    }
    throw new functions.https.HttpsError('internal', 'No se pudo eliminar el usuario de Authentication.', { code });
  }
});

// Callable: Farmacia crea un usuario Distribuidor sin perder su sesión.
// Requiere que quien llama tenga rol 'Farmacia' o 'Admin'.
// data: { email, password, dni, fechaNacimiento, contacto, frente, reverso }
exports.farmaciaCreateDistribuidor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const requesterUid = context.auth.uid;
  // Verificar rol del solicitante
  let role;
  try {
    const snap = await admin.database().ref(`users/${requesterUid}/role`).get();
    role = snap.val();
  } catch (e) {
    throw new functions.https.HttpsError('internal', 'No se pudo verificar el rol.');
  }

  if (role !== 'Farmacia' && role !== 'Admin') {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para crear repartidores.');
  }

  const email = (data?.email || '').toString().trim().toLowerCase();
  const password = (data?.password || '').toString();
  const dni = (data?.dni || '').toString().trim();
  const fechaNacimiento = (data?.fechaNacimiento || '').toString();
  const contacto = (data?.contacto || '').toString();
  const frente = (data?.frente || '').toString();
  const reverso = (data?.reverso || '').toString();

  if (!email || !password || !dni) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos requeridos (email, password, dni).');
  }

  try {
    // Crear usuario en Auth
    const userRecord = await admin.auth().createUser({ email, password });
    const uid = userRecord.uid;

    // Datos de distribuidor
    const userData = {
      email,
      role: 'Distribuidor',
      dni,
      fechaNacimiento,
      contacto,
      deliveryVerification: { status: 'pendiente', frente, reverso },
      dinero: 0
    };

    // Guardar perfil
    await admin.database().ref(`users/${uid}`).set(userData);

    // Notificar a todas las farmacias
    try {
      const allUsersSnap = await admin.database().ref('users').get();
      const allUsers = allUsersSnap.val() || {};
      const updates = {};
      const now = Date.now();
      Object.entries(allUsers).forEach(([uidFarmacia, u]) => {
        if (u && u.role === 'Farmacia') {
          const newKey = admin.database().ref().child(`notificaciones/${uidFarmacia}`).push().key;
          updates[`notificaciones/${uidFarmacia}/${newKey}`] = {
            tipo: 'delivery_registro',
            deliveryUid: uid,
            deliveryEmail: email,
            frente,
            reverso,
            fecha: now,
            estado: 'pendiente'
          };
        }
      });
      if (Object.keys(updates).length > 0) {
        await admin.database().ref().update(updates);
      }
    } catch (e) {
      // No bloquear por fallo de notificaciones
      console.warn('No se pudieron crear notificaciones de delivery:', e);
    }

    return { status: 'ok', uid };
  } catch (e) {
    const code = e && (e.code || e.errorInfo?.code);
    throw new functions.https.HttpsError('internal', 'No se pudo crear el distribuidor.', { code });
  }
});
