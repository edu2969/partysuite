import EventForm from "@/components/events/EventForm"

export default async function EventFormPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  return (
    <EventForm eventId={(await params).eventId} />
  );
}