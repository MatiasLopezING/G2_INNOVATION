import React, { useMemo, useState } from 'react';
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { Button as UiButton } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Spinner } from './ui/spinner';

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function LocationPicker({
  idPrefix = 'loc',
  title,
  addressLabel = 'Dirección',
  addressPlaceholder = 'Calle Falsa 123, Ciudad',
  addressValue,
  onAddressChange,
  latValue,
  lngValue,
  onCoordsChange,
  coordStatus,
  onCoordStatusChange,
  onError,
  showGeocodeHelp = true,
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const latN = useMemo(() => toNumberOrNull(latValue), [latValue]);
  const lngN = useMemo(() => toNumberOrNull(lngValue), [lngValue]);
  const hasCoords = latN !== null && lngN !== null;

  const setCoords = (lat, lng) => {
    onCoordsChange?.(lat, lng);
  };

  const setStatus = (s) => {
    onCoordStatusChange?.(s);
  };

  const handleDetectMyLocation = () => {
    setStatus(null);
    onError?.('');

    if (!window.isSecureContext) {
      setStatus('fail');
      onError?.('La geolocalización requiere HTTPS o abrir la app en http://localhost:3000.');
      return;
    }

    if (!navigator.geolocation) {
      setStatus('fail');
      onError?.('Tu navegador no soporta geolocalización.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setCoords(lat, lng);
          setStatus('ok');
        } else {
          setStatus('fail');
          onError?.('No pudimos leer coordenadas válidas.');
        }
        setIsLocating(false);
      },
      (err) => {
        setStatus('fail');
        setIsLocating(false);
        if (err && err.code === 1) {
          onError?.('Permiso de ubicación denegado. Habilítalo para este sitio y vuelve a intentar.');
        } else if (err && err.code === 2) {
          onError?.('No se pudo determinar tu ubicación (señal GPS/red no disponible).');
        } else if (err && err.code === 3) {
          onError?.('La ubicación tardó demasiado (timeout). Intenta nuevamente.');
        } else {
          onError?.('No pudimos obtener tu ubicación. Verifica permisos del navegador.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleGeocode = async () => {
    setStatus(null);
    onError?.('');

    const addr = String(addressValue || '').trim();
    if (!addr) {
      onError?.('Ingresa una dirección para buscar coordenadas.');
      return;
    }

    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = Number(data[0].lat);
        const lng = Number(data[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setCoords(lat, lng);
          setStatus('ok');
        } else {
          setStatus('fail');
          onError?.('Coordenadas inválidas devueltas por el servicio.');
        }
      } else {
        setStatus('fail');
        onError?.('No se encontró esa dirección. Prueba agregando ciudad y provincia.');
      }
    } catch {
      setStatus('fail');
      onError?.('No pudimos buscar coordenadas desde la dirección. Intenta nuevamente.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const showGeocodeLink = showGeocodeHelp && (!hasCoords || coordStatus === 'fail');

  return (
    <div className="space-y-4">
      {title ? <div className="text-sm font-semibold text-slate-900">{title}</div> : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}_address`}>{addressLabel}</Label>
        <Input
          id={`${idPrefix}_address`}
          placeholder={addressPlaceholder}
          value={addressValue}
          onChange={(e) => onAddressChange?.(e.target.value)}
        />
      </div>

      <UiButton
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleDetectMyLocation}
        disabled={isLocating}
      >
        {isLocating ? <Spinner /> : <MyLocationOutlinedIcon fontSize="small" />}
        Detectar mi ubicación
      </UiButton>

      {showGeocodeLink ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <span>¿No funciona?</span>
          <UiButton
            type="button"
            variant="ghost"
            className="h-auto px-0 py-0 underline underline-offset-4 text-slate-600 hover:text-slate-900"
            onClick={handleGeocode}
            disabled={isGeocoding}
          >
            {isGeocoding ? <Spinner /> : null}
            Buscar por dirección
          </UiButton>
        </div>
      ) : null}

      {hasCoords ? (
        <div className="mt-1 p-3 bg-teal-50 border border-teal-200 rounded-md flex items-start gap-3 text-teal-700">
          <CheckCircleOutlineIcon fontSize="small" />
          <div>
            <div className="font-medium text-sm">¡Ubicación confirmada!</div>
            <div className="text-xs opacity-80">Coordenadas guardadas correctamente.</div>
          </div>
        </div>
      ) : coordStatus === 'fail' ? (
        <div className="text-sm text-red-600">No pudimos obtener coordenadas.</div>
      ) : null}
    </div>
  );
}
