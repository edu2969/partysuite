import { NextResponse } from 'next/server'
import moment from 'moment'
import { connectMongoDB } from '@/lib/mongodb'
import Event from '@/models/event'

// La respuesta depende de la hora actual del request, así que no debe
// cachearse ni pre-renderizarse estáticamente.
export const dynamic = 'force-dynamic'

// Antes de esta hora se considera que todavía es "el evento de ayer" (la
// fiesta que arrancó anoche y sigue funcionando pasada la medianoche).
const HORA_CORTE_MADRUGADA = 5

export async function GET() {
  await connectMongoDB()

  // OJO: moment() usa la hora LOCAL DEL SERVIDOR. Si el server no corre en
  // horario de Chile (típico en hosting con TZ=UTC), el corte de las 5am
  // va a quedar desfasado. Si es el caso, instalen moment-timezone y usen
  // moment().tz('America/Santiago') en vez de moment() a secas.
  const ahora = moment()

  const diaDelEvento =
    ahora.hour() < HORA_CORTE_MADRUGADA
      ? ahora.clone().subtract(1, 'day')
      : ahora.clone()

  // 00:00:00 del día que corresponde (hoy o ayer, según la hora actual)
  const inicioDelDia = diaDelEvento.startOf('day').toDate()

  // Eventos desde ese día en adelante ($gte, sin tope superior); se ordena
  // ascendente y se toma el primero, o sea el más cercano a ese punto de
  // partida. Si no hay evento para hoy/ayer, esto devolverá el próximo
  // evento futuro que exista en la base — si prefieren null en ese caso en
  // vez del próximo evento, hay que agregar también un $lt con el fin de
  // ese mismo día.
  const eventSelected = await Event.findOne({
    date: { $gte: inicioDelDia },
  })
    .sort({ date: 1 })
    .lean<{ date: Date, closedAt: Date }>()

  if(!eventSelected) {
    return NextResponse.json({ ok: true, event: null }, { status: 200 })
  }

  const cierre = moment(eventSelected.date).add(1, "day").hour(5).minute(0);
  if(cierre.isBefore(moment())) {
    return NextResponse.json({ ok: true, event: null }, { status: 200 })
  }

  return NextResponse.json({ ok: true, event: eventSelected }, { status: 200 })
}