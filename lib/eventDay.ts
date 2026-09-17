import moment from 'moment'

// Antes de esta hora se considera que todavía es "el evento de ayer" (la
// fiesta que arrancó anoche y sigue funcionando pasada la medianoche).
// Vive en un solo lugar porque tanto GET /api/events/current (qué evento
// mostrar) como POST /api/events/check-in (a qué evento se le hace
// check-in) necesitan exactamente la misma regla — si un día cambia el
// corte de las 5am, solo hay que tocarlo acá.
export const HORA_CORTE_MADRUGADA = 5

interface EventoConHorario {
  date: Date
  closedAt: Date
}

function diaDelEvento() {
  const ahora = moment()
  return ahora.hour() < HORA_CORTE_MADRUGADA
    ? ahora.clone().subtract(1, 'day')
    : ahora.clone()
}

// 00:00:00 del día que corresponde al evento actual (hoy o ayer, según la
// regla de la madrugada). Sirve para consultas $gte sin límite superior.
export function getEventDayStart(): Date {
  return diaDelEvento().startOf('day').toDate()
}

// Rango [00:00:00, 00:00:00 del día siguiente) del día que corresponde al
// evento actual. Sirve para acotar una búsqueda a un solo día concreto
// (por ejemplo, a qué evento le corresponde hacerle check-in a alguien).
export function getEventDayRange(): { desde: Date; hasta: Date } {
  const dia = diaDelEvento()
  const desde = dia.clone().startOf('day').toDate()
  const hasta = dia.clone().add(1, 'day').startOf('day').add(5, 'hour').toDate()
  return { desde, hasta }
}

export function listaCerrada(evento: EventoConHorario): boolean {
  return moment().isAfter(evento.closedAt)
}
