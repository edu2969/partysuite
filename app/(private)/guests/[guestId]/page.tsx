import AccountForm from "@/components/accounts/AccountForm";
import QueryProvider from "@/app/providers/QueryProvider";
import { auth } from "@/app/utils/auth";
import GuestForm from "@/components/guests/GuestForm";
import { FaRoadLock } from "react-icons/fa6";

export default async function GuestFormPage({
  params,
}: {
  params: Promise<{ guestId: string }>;
}) {
  const session = await auth();
  const { guestId } = await params;

  const userRole = session?.user?.role || "EMBAJADOR";

  if (userRole !== "ADMINISTRADOR" && userRole !== "NEO") {
    return (
      <div className="flex w-full h-screen items-center justify-center text-4xl space-x-4">
        <div>
            <FaRoadLock size={82} className="mx-auto" />
            <p>No autorizado.</p>
        </div>
      </div>
    );
  }
    return (
        <QueryProvider>
            <GuestForm guestId={guestId} role={userRole} />
        </QueryProvider>
    );
}