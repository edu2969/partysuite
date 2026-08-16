import AttendersImport from "@/components/events/AttendersImport"

export default async function EventGuestImport({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {    
  return (
    <AttendersImport eventId={(await params).eventId} />
  );
}