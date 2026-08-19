import { auth } from "@/app/utils/auth";
import About from "@/components/prefabs/About"

export default async function AboutPage() {
    const session = await auth();
    return (
        <About isNeo={session?.user?.role === "NEO"} />
    )
}