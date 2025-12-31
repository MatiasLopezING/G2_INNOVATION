/**
 * Componente para login de usuario.
 * Props:
 *   - botonMargin: margen inferior del botón de login
 *   - botonRegistro: función para mostrar registro
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from '../firebase';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import GoogleIcon from "@mui/icons-material/Google";

export default function Login({ botonMargin = 10, botonRegistro }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const navigate = useNavigate();

  const isEmailValid = useMemo(() => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setResetMsg("");
    if (!email || !password) return;
    if (!isEmailValid) {
      setError("Email inválido");
      return;
    }

    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userRef = ref(db, 'users/' + user.uid);
      const snapshot = await get(userRef);
      if (!snapshot.exists()) {
        setError('No encontramos tu perfil. Por favor registrate nuevamente.');
        await signOut(auth);
        return;
      }
      const userData = snapshot.val();
      if (userData.role === 'Distribuidor') {
        // Permitir acceso SIEMPRE. El gating para recibir trabajos se hace en el panel.
        navigate('/distribuidor');
        return;
      }
      if (userData.role === 'Farmacia') {
        navigate('/farmacia');
        return;
      }
      navigate('/usuario');
    } catch (err) {
      let friendlyMsg = '';
      switch (err.code) {
        case 'auth/user-not-found':
          friendlyMsg = 'Email no registrado';
          break;
        case 'auth/wrong-password':
          friendlyMsg = 'Clave incorrecta';
          break;
        case 'auth/invalid-email':
          friendlyMsg = 'Email inválido';
          break;
        case 'auth/too-many-requests':
          friendlyMsg = 'Demasiados intentos, intenta más tarde';
          break;
        case 'auth/invalid-credential':
          friendlyMsg = 'Email o contraseña incorrecta';
          break;
        default:
          friendlyMsg = 'Error de autenticación. Intenta nuevamente';
          break;
      }
      setError(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setResetMsg("");
    if (!email) {
      setError("Ingresa tu email para recuperar la contraseña");
      return;
    }
    if (!isEmailValid) {
      setError("Email inválido");
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMsg("Te enviamos un email para restablecer tu contraseña");
    } catch (err) {
      let friendlyMsg = "No pudimos enviar el email de recuperación";
      switch (err.code) {
        case "auth/user-not-found":
          friendlyMsg = "Email no registrado";
          break;
        case "auth/invalid-email":
          friendlyMsg = "Email inválido";
          break;
        case "auth/too-many-requests":
          friendlyMsg = "Demasiados intentos, intenta más tarde";
          break;
        default:
          break;
      }
      setError(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper
      elevation={10}
      sx={{
        width: "100%",
        maxWidth: 420,
        p: { xs: 3, sm: 4 },
        borderRadius: 3,
        backdropFilter: "blur(6px)",
        animation: "g2-fade-slide-in 520ms ease forwards",
        "@keyframes g2-fade-slide-in": {
          from: { opacity: 0, transform: "translateY(18px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700} align="center">
          Bienvenido
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Inicia sesión para continuar
        </Typography>
      </Box>

      <Box component="form" onSubmit={handleLogin} sx={{ display: "grid", gap: 2 }}>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          fullWidth
          required
          error={!isEmailValid}
          helperText={!isEmailValid ? "Ingresa un email válido" : " "}
          disabled={isSubmitting}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          fullWidth
          required
          disabled={isSubmitting}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: -1, mb: 0.5 }}>
          <Link
            component="button"
            type="button"
            onClick={handlePasswordReset}
            disabled={isSubmitting}
            underline="hover"
            sx={{
              fontSize: 13,
              color: "text.secondary",
              transition: "color 200ms ease",
              "&:hover": { color: "primary.main" },
            }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </Box>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={isSubmitting}
          sx={{
            mb: `${botonMargin}px`,
            py: 1.2,
            color: "#fff",
            transition:
              "transform 120ms ease, background-color 300ms ease, color 300ms ease",
            "&:hover": { transform: "translateY(-1px)" },
          }}
          startIcon={
            isSubmitting ? <CircularProgress color="inherit" size={18} /> : null
          }
        >
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </Button>

        <Divider
          sx={{
            my: 0.5,
            color: "#9ca3af",
            "&::before, &::after": { borderColor: "#e5e7eb" },
          }}
        >
          <Typography variant="caption" sx={{ color: "#9ca3af" }}>
            O continuar con
          </Typography>
        </Divider>

        <Button
          type="button"
          variant="outlined"
          size="large"
          fullWidth
          startIcon={<GoogleIcon />}
          disabled
          sx={{
            py: 1.2,
            borderColor: "#e5e7eb",
            color: "text.primary",
            backgroundColor: "rgba(255,255,255,0.55)",
            transition:
              "transform 120ms ease, background-color 300ms ease, color 300ms ease, border-color 300ms ease",
            "&:hover": { transform: "translateY(-1px)" },
          }}
        >
          Continuar con Google (próximamente)
        </Button>

        {botonRegistro && (
          <Button
            type="button"
            variant="outlined"
            size="large"
            fullWidth
            onClick={botonRegistro}
            disabled={isSubmitting}
            sx={{
              py: 1.2,
              transition:
                "transform 120ms ease, background-color 300ms ease, color 300ms ease, border-color 300ms ease",
              "&:hover": { transform: "translateY(-1px)" },
            }}
          >
            Registrarse
          </Button>
        )}

        {resetMsg && (
          <Alert severity="success" sx={{ mt: 1 }}>
            {resetMsg}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </Box>
    </Paper>
  );
}
