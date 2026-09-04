import QueryProvider from "@/app/providers/QueryProvider";
import AttendersImport from "@/components/events/AttendersImport"

export default async function EventGuestImport({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {    
  return (<QueryProvider>
      <AttendersImport eventId={(await params).eventId} />
    </QueryProvider>
  );
}