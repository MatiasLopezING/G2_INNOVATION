// Utilidad para validar si una farmacia está abierta según su horario

// Función de debug para diagnosticar problemas
export const debugHorarios = (horarios) => {
  const ahora = new Date();
  const diaSemana = ahora.getDay();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaActual = diasSemana[diaSemana];
  
  console.log('=== DEBUG HORARIOS ===');
  console.log('Fecha actual:', ahora);
  console.log('Día de la semana (0-6):', diaSemana);
  console.log('Día actual:', diaActual);
  console.log('Hora actual (minutos):', horaActual);
  console.log('Horarios recibidos:', horarios);
  
  if (horarios) {
    const horarioDia = horarios[diaActual];
    console.log('Horario del día actual:', horarioDia);
    
    if (horarioDia && horarioDia.abierto) {
      const horaApertura = parseHoraAMinutos(horarioDia.apertura);
      const horaCierre = parseHoraAMinutos(horarioDia.cierre);
      console.log('Hora apertura (minutos):', horaApertura);
      console.log('Hora cierre (minutos):', horaCierre);
      console.log('¿Está abierta?', horaActual >= horaApertura && horaActual <= horaCierre);
    } else {
      console.log('Farmacia cerrada este día');
    }
  } else {
    console.log('No hay horarios configurados');
  }
  console.log('=====================');
};

export const isFarmaciaAbierta = (horarios) => {
  if (!horarios) return false;
  
  const ahora = new Date();
  const diaSemana = ahora.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes(); // Minutos desde medianoche
  
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaActual = diasSemana[diaSemana];
  
  const horarioDia = horarios[diaActual];
  if (!horarioDia || !horarioDia.abierto) {
    return false;
  }
  
  const horaApertura = parseHoraAMinutos(horarioDia.apertura);
  const horaCierre = parseHoraAMinutos(horarioDia.cierre);
  
  return horaActual >= horaApertura && horaActual <= horaCierre;
};

export const getEstadoFarmacia = (horarios) => {
  if (!horarios) return { abierta: false, mensaje: 'Horarios no configurados' };
  
  const ahora = new Date();
  const diaSemana = ahora.getDay();
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaActual = diasSemana[diaSemana];
  
  const horarioDia = horarios[diaActual];
  if (!horarioDia || !horarioDia.abierto) {
    return { 
      abierta: false, 
      mensaje: `Cerrado (${diaActual})`,
      proximaApertura: getProximaApertura(horarios, diaSemana, diasSemana)
    };
  }
  
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  const horaApertura = parseHoraAMinutos(horarioDia.apertura);
  const horaCierre = parseHoraAMinutos(horarioDia.cierre);
  
  if (horaActual < horaApertura) {
    return {
      abierta: false,
      mensaje: `Abre a las ${horarioDia.apertura}`,
      proximaApertura: `${diaActual} a las ${horarioDia.apertura}`
    };
  } else if (horaActual > horaCierre) {
    return {
      abierta: false,
      mensaje: `Cierra a las ${horarioDia.cierre}`,
      proximaApertura: getProximaApertura(horarios, diaSemana, diasSemana)
    };
  } else {
    return {
      abierta: true,
      mensaje: `Abierto hasta las ${horarioDia.cierre}`,
      proximaApertura: null
    };
  }
};

const parseHoraAMinutos = (hora) => {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
};

const getProximaApertura = (horarios, diaActual, diasSemana) => {
  // Buscar el próximo día que esté abierto
  for (let i = 1; i <= 7; i++) {
    const proximoDiaIndex = (diaActual + i) % 7;
    const proximoDia = diasSemana[proximoDiaIndex];
    const horarioProximoDia = horarios[proximoDia];
    
    if (horarioProximoDia && horarioProximoDia.abierto) {
      const diasParaProximoDia = i === 1 ? 'mañana' : `en ${i} días`;
      return `${proximoDia} a las ${horarioProximoDia.apertura} (${diasParaProximoDia})`;
    }
  }
  
  return 'No hay horarios configurados';
};

export const formatearHorariosTexto = (horarios) => {
  if (!horarios) return 'Horarios no configurados';
  
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  
  return diasSemana.map(dia => {
    const horario = horarios[dia];
    if (!horario || !horario.abierto) {
      return `${dia}: Cerrado`;
    }
    return `${dia}: ${horario.apertura} - ${horario.cierre}`;
  }).join(', ');
};