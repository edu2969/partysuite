import AttenderList from "@/components/events/AttenderList";

export default function AttendersPage({
  params,
}: {
  params: { eventId: string };
}) {
    return <AttenderList eventId={params.eventId} />
}