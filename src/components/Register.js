import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../firebase';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Distribuidor');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await set(ref(db, 'users/' + user.uid), {
        email,
        role
      });
      setSuccess('Usuario registrado correctamente');
      setEmail('');
      setPassword('');
      setRole('Distribuidor');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Registro</h2>
      <form onSubmit={handleRegister}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
        <select value={role} onChange={e => setRole(e.target.value)} required>
          <option value="Distribuidor">Distribuidor</option>
          <option value="Farmacia">Farmacia</option>
          <option value="Usuario">Usuario</option>
        </select>
        <button type="submit">Registrar</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      {success && <p style={{color:'green'}}>{success}</p>}
    </div>
  );
};

export default Register;
