import { redirect } from "next/navigation";
import GuestForm from "@/components/guests/GuestForm";
import { auth } from "@/app/utils/auth";

interface PageProps {
  params: Promise<{
    guestId: string;
  }>;
}

export default async function GuestEditPage({
  params,
}: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const { guestId } = await params;

  return (
    <GuestForm
      guestId={guestId}
      user={{
        role: session.user.role,
        isRPAdmin: session.user.role === "EMBAJADOR",
      }}
    />
  );
}