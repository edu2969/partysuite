import AccountForm from "@/components/accounts/AccountForm";
import QueryProvider from "@/app/providers/QueryProvider";
import { auth } from "@/app/utils/auth";

export default async function AccountFormPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const session = await auth();
  const { accountId } = await params; // ✅ await directo, sin use()

  const userRole = session?.user?.role;

  if (userRole !== "ADMINISTRADOR" && userRole !== "NEO") {
    return (
      <div className="text-center text-red-500">
        No tienes permiso para acceder a esta página.
      </div>
    );
  }
    return (
        <QueryProvider>
            <AccountForm accountId={accountId} roleSelected={"LISTERO"} />
        </QueryProvider>
    );
}