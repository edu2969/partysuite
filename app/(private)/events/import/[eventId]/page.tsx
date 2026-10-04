import QueryProvider from "@/app/providers/QueryProvider";
import AttendersImport from "@/components/events/AttendersImport";
import { auth } from "@/app/utils/auth";

export default async function EventGuestImport({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {    
  const session = await auth();

  return (<QueryProvider>
      <AttendersImport
        eventId={(await params).eventId}
        isPro={session?.user?.role === "LISTERO_PRO"}
      />
    </QueryProvider>
  );
}