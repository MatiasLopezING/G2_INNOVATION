import React, { useState } from 'react';

const HorariosFarmacia = ({ horarios, setHorarios }) => {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  const diasSemana = [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
  ];

  // Inicializar horarios si no existen
  const horariosIniciales = horarios || {};
  diasSemana.forEach(dia => {
    if (!horariosIniciales[dia]) {
      horariosIniciales[dia] = { abierto: true, apertura: '08:00', cierre: '20:00' };
    }
  });

  const handleCambiarDia = (dia, campo, valor) => {
    const nuevosHorarios = { ...horariosIniciales };
    if (campo === 'abierto') {
      nuevosHorarios[dia].abierto = valor;
    } else if (campo === 'apertura') {
      nuevosHorarios[dia].apertura = valor;
    } else if (campo === 'cierre') {
      nuevosHorarios[dia].cierre = valor;
    }
    setHorarios(nuevosHorarios);
  };

  const handleCopiarHorarios = (diaOrigen) => {
    const nuevosHorarios = { ...horariosIniciales };
    const horarioOrigen = nuevosHorarios[diaOrigen];
    
    diasSemana.forEach(dia => {
      if (dia !== diaOrigen) {
        nuevosHorarios[dia] = { ...horarioOrigen };
      }
    });
    
    setHorarios(nuevosHorarios);
  };

  const formatearHorariosParaTexto = () => {
    return diasSemana.map(dia => {
      const horario = horariosIniciales[dia];
      if (!horario.abierto) {
        return `${dia}: Cerrado`;
      }
      return `${dia}: ${horario.apertura} - ${horario.cierre}`;
    }).join(', ');
  };

  return (
    <div style={{ width: '100%', marginBottom: '10px' }}>
      <label>Horarios de atención:</label>
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '4px', 
        padding: '8px', 
        marginBottom: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {formatearHorariosParaTexto()}
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
                <label style={{ fontWeight: 'bold', fontSize: '14px' }}>{dia}:</label>
                <button
                  type="button"
                  onClick={() => handleCopiarHorarios(dia)}
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
                    type="checkbox"
                    checked={horariosIniciales[dia].abierto}
                    onChange={(e) => handleCambiarDia(dia, 'abierto', e.target.checked)}
                  />
                  <span style={{ fontSize: '12px' }}>Abierto</span>
                </label>
                
                {horariosIniciales[dia].abierto && (
                  <>
                    <label style={{ fontSize: '12px' }}>
                      Apertura:
                      <input
                        type="time"
                        value={horariosIniciales[dia].apertura}
                        onChange={(e) => handleCambiarDia(dia, 'apertura', e.target.value)}
                        style={{ marginLeft: '4px', fontSize: '12px' }}
                      />
                    </label>
                    
                    <label style={{ fontSize: '12px' }}>
                      Cierre:
                      <input
                        type="time"
                        value={horariosIniciales[dia].cierre}
                        onChange={(e) => handleCambiarDia(dia, 'cierre', e.target.value)}
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

