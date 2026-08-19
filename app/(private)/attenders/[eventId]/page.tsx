import AttenderList from "@/components/events/AttenderList";

export default async function AttendersPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
    return <AttenderList eventId={(await params).eventId} />
}