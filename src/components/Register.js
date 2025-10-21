/**
 * Componente para registro de usuarios, farmacias y deliverys.
 * No recibe props. Utiliza pasos y formularios según el rol seleccionado.
 */

import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../firebase';
import { useNavigate } from "react-router-dom";
import HorariosFarmacia from './HorariosFarmacia';

const Register = () => {
  const [step, setStep] = useState(1);
  const [show, setShow] = useState(false);
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
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [coordStatus, setCoordStatus] = useState(null); // null, 'ok', 'fail'

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
            latitud: lat,
            longitud: lng
        };
      } else if (role === 'Farmacia') {
        userData = {
          ...userData,
          nombreFarmacia,
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
                <input type="text" placeholder="Dirección completa" value={direccion} onChange={e => setDireccion(e.target.value)} required style={{ width: '100%' }} />
                <button
                  type="button"
                  style={{ marginBottom: "10px", width: "100%", padding: "8px" }}
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
              <input type="text" placeholder="Nombre de la farmacia" value={nombreFarmacia} onChange={e => setNombreFarmacia(e.target.value)} required style={{ width: '100%' }} />
              <input type="text" placeholder="Dirección completa" value={direccionFarmacia} onChange={e => setDireccionFarmacia(e.target.value)} required style={{ width: '100%' }} />
              <button
                type="button"
                style={{ marginBottom: "10px", width: "100%", padding: "8px" }}
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
              <input type="text" placeholder="Contacto" value={contactoFarmacia} onChange={e => setContactoFarmacia(e.target.value)} required style={{ width: '100%' }} />
              <div style={{ width: '100%' }}>
                <label>Obras sociales aceptadas:</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Agregar obra social"
                    value={obraSocialInput}
                    onChange={e => setObraSocialInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (obraSocialInput.trim() && !obrasSocialesAceptadas.includes(obraSocialInput.trim())) {
                        setObrasSocialesAceptadas([...obrasSocialesAceptadas, obraSocialInput.trim()]);
                        setObraSocialInput('');
                      }
                    }}
                    style={{ padding: '8px' }}
                  >Agregar</button>
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
