import React, { useMemo, useState } from 'react';

import { Button as UiButton } from './ui/button';
import { Badge } from './ui/badge';

/**
 * Componente para mostrar y gestionar los horarios de la farmacia.
 * Props:
 *   - horarios: objeto con los horarios de la farmacia
 *   - onChange: función para actualizar los horarios
 */
const HorariosFarmacia = ({ horarios, setHorarios, embedded = false, defaultOpen = false }) => {
  // Estado para mostrar/ocultar el formulario de edición
  const [mostrarFormulario, setMostrarFormulario] = useState(Boolean(defaultOpen));

  // Días de la semana
  const diasSemana = [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
  ];

  // Inicializa los horarios para cada día (sin mutar props)
  const horariosPorDia = diasSemana.reduce((acc, dia) => {
    acc[dia] = horarios && horarios[dia]
      ? { ...horarios[dia] }
      : { abierto: true, apertura: '08:00', cierre: '20:00' };
    return acc;
  }, {});

  const resumen = useMemo(() => {
    return diasSemana
      .map((dia) => {
        const h = horariosPorDia[dia];
        if (!h.abierto) return `${dia}: Cerrado`;
        return `${dia}: ${h.apertura} - ${h.cierre}`;
      })
      .join(' · ');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarios]);

  /**
   * Actualiza el horario de un día específico
   * Realiza validación de horas y actualiza el estado global
   */
  const actualizarHorarioDia = (dia, campo, valor) => {
    // Clona todos los horarios actuales
    const nuevosHorarios = diasSemana.reduce((acc, d) => {
      acc[d] = { ...horariosPorDia[d] };
      return acc;
    }, {});
    // Actualiza el campo correspondiente
    if (campo === 'abierto') {
      nuevosHorarios[dia].abierto = valor;
    } else if (campo === 'apertura') {
      nuevosHorarios[dia].apertura = valor;
    } else if (campo === 'cierre') {
      nuevosHorarios[dia].cierre = valor;
    }
    // Validación: cierre debe ser mayor que apertura
    if (
      nuevosHorarios[dia].abierto &&
      nuevosHorarios[dia].apertura >= nuevosHorarios[dia].cierre
    ) {
      alert('La hora de cierre debe ser después de la de apertura. Por favor corrige la hora.');
      return;
    }
    setHorarios(nuevosHorarios);
  };

  /**
   * Copia el horario de un día a todos los días
   */
  const copiarHorarioATodos = (diaOrigen) => {
    const horarioOrigen = { ...horariosPorDia[diaOrigen] };
    const nuevosHorarios = diasSemana.reduce((acc, dia) => {
      acc[dia] = { ...horarioOrigen };
      return acc;
    }, {});
    setHorarios(nuevosHorarios);
  };

  /**
   * Formatea los horarios para mostrar como texto resumido
   */
  // Render principal
  return (
    <div className={embedded ? 'w-full' : 'w-full'}>
      {!embedded && (
        <div className="mb-2 text-sm font-medium text-slate-700">Horarios de atención</div>
      )}

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-slate-600">
            <div className="text-xs text-slate-500 mb-1">Resumen</div>
            <div className="leading-relaxed">{resumen}</div>
          </div>
          <UiButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
          >
            {mostrarFormulario ? 'Ocultar' : 'Editar'}
          </UiButton>
        </div>
      </div>

      {mostrarFormulario && (
        <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 max-h-[320px] overflow-auto">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-sm font-semibold text-slate-900">Configurar horarios por día</div>
            <Badge>Tip: “Copiar a todos” aplica el mismo horario</Badge>
          </div>

          <div className="space-y-3">
            {diasSemana.map((dia) => (
              <div key={dia} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">{dia}</div>
                  <UiButton type="button" variant="outline" size="sm" onClick={() => copiarHorarioATodos(dia)}>
                    Copiar a todos
                  </UiButton>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={horariosPorDia[dia].abierto}
                      onChange={(e) => actualizarHorarioDia(dia, 'abierto', e.target.checked)}
                    />
                    Abierto
                  </label>

                  {horariosPorDia[dia].abierto ? (
                    <>
                      <label className="text-sm text-slate-700 inline-flex items-center gap-2">
                        Apertura
                        <input
                          type="time"
                          value={horariosPorDia[dia].apertura}
                          onChange={(e) => actualizarHorarioDia(dia, 'apertura', e.target.value)}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        />
                      </label>
                      <label className="text-sm text-slate-700 inline-flex items-center gap-2">
                        Cierre
                        <input
                          type="time"
                          value={horariosPorDia[dia].cierre}
                          onChange={(e) => actualizarHorarioDia(dia, 'cierre', e.target.value)}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        />
                      </label>
                    </>
                  ) : (
                    <span className="text-sm text-slate-500">Cerrado</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HorariosFarmacia;

