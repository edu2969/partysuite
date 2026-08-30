import QueryProvider from "@/app/providers/QueryProvider";
import { auth } from "@/app/utils/auth";
import AccountForm from "@/components/accounts/AccountForm";

export default async function AccountFormPage() {
    const session = await auth();
    const userRole = session?.user?.role;
    if (userRole !== "ADMINISTRADOR" && userRole !== "NEO") {
        return <div className="text-center text-red-500">No tienes permiso para acceder a esta página.</div>;
    }
    return <QueryProvider>
        <AccountForm roleSelected={"LISTERO"} />
    </QueryProvider>;
}