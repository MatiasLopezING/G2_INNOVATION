import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../firebase';
import { useNavigate } from "react-router-dom";

const Register = () => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Usuario
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [obraSocial, setObraSocial] = useState('');
  const [nroAfiliado, setNroAfiliado] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [cobertura, setCobertura] = useState('');
  const [calle1, setCalle1] = useState('');
  const [calle2, setCalle2] = useState('');

  // Farmacia
  const [nombreFarmacia, setNombreFarmacia] = useState('');
  const [calle1Farmacia, setCalle1Farmacia] = useState('');
  const [calle2Farmacia, setCalle2Farmacia] = useState('');
  const [contactoFarmacia, setContactoFarmacia] = useState('');
  const [obrasSocialesAceptadas, setObrasSocialesAceptadas] = useState('');
  const [horarios, setHorarios] = useState('');

  // Delivery
  const [dniDelivery, setDniDelivery] = useState('');
  const [contactoDelivery, setContactoDelivery] = useState('');

  const handleNext = (e) => {
    e.preventDefault();
    if (!role) {
      setError('Selecciona un tipo de usuario');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      let userData = { email, role };
      if (role === 'Usuario') {
        userData = {
          ...userData,
          dni,
          nombre,
          apellido,
          obraSocial,
          nroAfiliado,
          vencimiento,
          cobertura,
          calle1,
          calle2
        };
      } else if (role === 'Farmacia') {
        userData = {
          ...userData,
          nombreFarmacia,
          calle1: calle1Farmacia,
          calle2: calle2Farmacia,
          contactoFarmacia,
          obrasSocialesAceptadas,
          horarios
        };
      } else if (role === 'Distribuidor') {
        userData = {
          ...userData,
          dni: dniDelivery,
          contacto: contactoDelivery,
          dinero: 0
        };
      }
      await set(ref(db, 'users/' + user.uid), userData);
      setSuccess('Usuario registrado correctamente');
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
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
          <button type="submit" style={{ width: '100%' }}>Siguiente</button>
          {error && <p style={{color:'red', textAlign:'center'}}>{error}</p>}
        </form>
      )}
      {step === 2 && (
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '300px', gap: '10px', background: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%' }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%' }} />
          {role === 'Usuario' && (
            <>
              <input type="text" placeholder="DNI" value={dni} onChange={e => setDni(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Obra Social" value={obraSocial} onChange={e => setObraSocial(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Nro. Afiliado" value={nroAfiliado} onChange={e => setNroAfiliado(e.target.value)} required style={{ width: '100%' }} />
              <input type="date" placeholder="Vencimiento" value={vencimiento} onChange={e => setVencimiento(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Cobertura" value={cobertura} onChange={e => setCobertura(e.target.value)} required style={{ width: '100%' }} />
              <input type="number" placeholder="Calle 1" value={calle1} onChange={e => setCalle1(e.target.value)} required style={{ width: '100%' }} />
              <input type="number" placeholder="Calle 2" value={calle2} onChange={e => setCalle2(e.target.value)} required style={{ width: '100%' }} />
            </>
          )}
          {role === 'Farmacia' && (
            <>
              <input type="text" placeholder="Nombre de la farmacia" value={nombreFarmacia} onChange={e => setNombreFarmacia(e.target.value)} required style={{ width: '100%' }} />
              <input type="number" placeholder="Calle 1" value={calle1Farmacia} onChange={e => setCalle1Farmacia(e.target.value)} required style={{ width: '100%' }} />
              <input type="number" placeholder="Calle 2" value={calle2Farmacia} onChange={e => setCalle2Farmacia(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Contacto" value={contactoFarmacia} onChange={e => setContactoFarmacia(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Obras sociales aceptadas" value={obrasSocialesAceptadas} onChange={e => setObrasSocialesAceptadas(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Horarios" value={horarios} onChange={e => setHorarios(e.target.value)} required style={{ width: '100%' }} />
            </>
          )}
          {role === 'Distribuidor' && (
            <>
              <input type="text" placeholder="DNI" value={dniDelivery} onChange={e => setDniDelivery(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Datos de contacto" value={contactoDelivery} onChange={e => setContactoDelivery(e.target.value)} required style={{ width: '100%' }} />
            </>
          )}
          <button type="submit" style={{ width: '100%' }}>Registrar</button>
          {error && <p style={{color:'red', textAlign:'center'}}>{error}</p>}
          {success && <p style={{color:'green', textAlign:'center'}}>{success}</p>}
        </form>
      )}
    </div>
  );
};

export default Register;
