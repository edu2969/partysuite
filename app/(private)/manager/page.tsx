import QueryProvider from "@/app/providers/QueryProvider";
import AccountsList from "@/components/accounts/AccountsList";

export default function ManagerPage() {
    return <QueryProvider>
        <AccountsList />
    </QueryProvider>
}