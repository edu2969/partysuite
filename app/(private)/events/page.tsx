import { redirect } from "next/navigation";
import EventsList from "@/components/events/EventList";
import { auth } from "@/app/utils/auth";

export default async function EventsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <EventsList
      user={{
        role: session.user.role,
        isRPAdmin: session.user.role === "EMBAJADOR"
      }}
    />
  );
}