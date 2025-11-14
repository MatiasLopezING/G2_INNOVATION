import React, { useState } from 'react';

/**
 * Componente para mostrar y gestionar los horarios de la farmacia.
 * Props:
 *   - horarios: objeto con los horarios de la farmacia
 *   - onChange: función para actualizar los horarios
 */
const HorariosFarmacia = ({ horarios, setHorarios }) => {
  // Estado para mostrar/ocultar el formulario de edición
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

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
  const resumenHorarios = () => {
    return diasSemana.map(dia => {
      const horario = horariosPorDia[dia];
      if (!horario.abierto) {
        return `${dia}: Cerrado`;
      }
      return `${dia}: ${horario.apertura} - ${horario.cierre}`;
    }).join(', ');
  };

  // Render principal
  return (
    <div style={{ width: '100%', marginBottom: '10px' }}>
      <label>Horarios de atención:</label>
      {/* Resumen visual de horarios */}
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '4px', 
        padding: '8px', 
        marginBottom: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {resumenHorarios()}
          </span>
          <button
            type="button"
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid #007bff',
              backgroundColor: '#007bff',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {mostrarFormulario ? 'Ocultar' : 'Editar horarios'}
          </button>
        </div>
      </div>

      {/* Formulario de edición de horarios por día */}
      {mostrarFormulario && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '4px', 
          padding: '15px', 
          backgroundColor: '#fff',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Configurar horarios por día</h4>
          {diasSemana.map(dia => (
            <div key={dia} style={{ 
              marginBottom: '12px', 
              padding: '8px', 
              border: '1px solid #eee', 
              borderRadius: '4px',
              backgroundColor: '#fafafa'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label htmlFor={`dia-${dia}`} style={{ fontWeight: 'bold', fontSize: '14px' }}>{dia}:</label>
                <button
                  type="button"
                  onClick={() => copiarHorarioATodos(dia)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    border: '1px solid #28a745',
                    backgroundColor: '#28a745',
                    color: 'white',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Copiar a todos
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    id={`abierto-${dia}`}
                    type="checkbox"
                    checked={horariosPorDia[dia].abierto}
                    onChange={(e) => actualizarHorarioDia(dia, 'abierto', e.target.checked)}
                  />
                  <span style={{ fontSize: '12px' }}>Abierto</span>
                </label>
                {horariosPorDia[dia].abierto && (
                  <>
                    <label style={{ fontSize: '12px' }}>
                      Apertura:
                      <input
                        id={`apertura-${dia}`}
                        type="time"
                        value={horariosPorDia[dia].apertura}
                        onChange={(e) => actualizarHorarioDia(dia, 'apertura', e.target.value)}
                        style={{ marginLeft: '4px', fontSize: '12px' }}
                      />
                    </label>
                    <label style={{ fontSize: '12px' }}>
                      Cierre:
                      <input
                        id={`cierre-${dia}`}
                        type="time"
                        value={horariosPorDia[dia].cierre}
                        onChange={(e) => actualizarHorarioDia(dia, 'cierre', e.target.value)}
                        style={{ marginLeft: '4px', fontSize: '12px' }}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          ))}
          <div style={{ 
            marginTop: '15px', 
            padding: '8px', 
            backgroundColor: '#e7f3ff', 
            borderRadius: '4px',
            fontSize: '12px',
            color: '#0066cc'
          }}>
            💡 Tip: Puedes usar "Copiar a todos" para aplicar el mismo horario a todos los días
          </div>
        </div>
      )}
    </div>
  );
};

export default HorariosFarmacia;

