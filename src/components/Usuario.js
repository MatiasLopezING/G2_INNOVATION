
import React, { useEffect, useState } from 'react';
import ListaProductos from './ListaProductos';
import HistorialCompras from './HistorialCompras';
import MapaUsuario from './MapaUsuario';
import Notificaciones from './Notificaciones';
import { ref, onValue } from "firebase/database";
import { db, auth } from "../firebase";
import { useNavigate } from 'react-router-dom';
import { Button as UiButton } from './ui/button';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';

const Usuario = () => {
  const navigate = useNavigate();
  // Estado del usuario actual y farmacias abiertas
  const [usuario, setUsuario] = useState(null);
  const [farmacias, setFarmacias] = useState([]);

  useEffect(() => {
    // Suscripción en tiempo real para usuario actual y listado de farmacias
    const user = auth.currentUser;
    let unsubUser;
    let unsubFarmacias;
    if (user) {
      const userRef = ref(db, `users/${user.uid}`);
      unsubUser = onValue(userRef, (snapshot) => {
        setUsuario(snapshot.val());
      });
    }
    const farmaciasRef = ref(db, "users");
    unsubFarmacias = onValue(farmaciasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Tomar todas las farmacias (abiertas/cerradas) y dejar que el mapa muestre el estado
        const todasFarmacias = Object.entries(data)
          .map(([id, u]) => ({ id, ...u }))
          .filter(u => u.role === "Farmacia");
        setFarmacias(todasFarmacias);
      } else {
        setFarmacias([]);
      }
    });
    return () => {
      try { if (typeof unsubUser === 'function') unsubUser(); } catch {}
      try { if (typeof unsubFarmacias === 'function') unsubFarmacias(); } catch {}
    };
  }, []);

  // Estado para mostrar/ocultar secciones
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [highlightedFarmaciaId, setHighlightedFarmaciaId] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch {}
    navigate('/');
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50">
      <div className="flex h-full flex-col lg:flex-row">
        {/* COLUMNA IZQUIERDA: LISTA */}
        <aside className="w-full lg:w-5/12 xl:w-2/5 h-full overflow-hidden bg-white border-r border-slate-200">
          {/* Navbar (sticky, delgada) */}
          <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src="/icons/recetapp.png" alt="RecetApp" className="h-8 w-8 object-contain" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">Explorar</div>
                  <div className="text-xs text-slate-500 truncate">Encontrá medicamentos cerca tuyo</div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <UiButton
                  type="button"
                  variant={mostrarNotificaciones ? 'outline' : 'ghost'}
                  size="sm"
                  className="h-10 w-10 px-0"
                  onClick={() => {
                    setMostrarNotificaciones((v) => !v);
                    setMostrarCarrito(false);
                  }}
                  aria-label="Notificaciones"
                >
                  <NotificationsNoneOutlinedIcon fontSize="small" />
                </UiButton>

                {!mostrarNotificaciones && (
                  <div className="relative">
                    <UiButton
                      type="button"
                      variant={mostrarCarrito ? 'outline' : 'ghost'}
                      size="sm"
                      className="h-10 w-10 px-0"
                      onClick={() => setMostrarCarrito((v) => !v)}
                      aria-label="Carrito"
                    >
                      <ShoppingCartOutlinedIcon fontSize="small" />
                    </UiButton>
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </div>
                )}

                <UiButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 px-0"
                  onClick={handleLogout}
                  aria-label="Cerrar sesión"
                >
                  <LogoutOutlinedIcon fontSize="small" />
                </UiButton>
              </div>
            </div>
          </div>

          <div className="h-[calc(100%-56px)] overflow-y-auto p-4">
            {mostrarNotificaciones ? (
              <Notificaciones />
            ) : (
              <>
                <ListaProductos
                  mostrarCarrito={mostrarCarrito}
                  highlightedFarmaciaId={highlightedFarmaciaId}
                  onHoverFarmaciaId={setHighlightedFarmaciaId}
                  onCartCountChange={setCartCount}
                />

                <div className="pt-8">
                  <HistorialCompras />
                </div>
              </>
            )}
          </div>
        </aside>

        {/* COLUMNA DERECHA: MAPA (sticky) */}
        <main className="flex-1 h-full bg-slate-50">
          <div className="h-[45vh] lg:h-full lg:sticky lg:top-0">
            <MapaUsuario
              className="h-full w-full"
              usuario={usuario}
              farmacias={farmacias}
              highlightedFarmaciaId={highlightedFarmaciaId}
              onHoverFarmaciaId={setHighlightedFarmaciaId}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Usuario;
