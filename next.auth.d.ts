import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    role?: "ADMINISTRADOR" | "NEO" | "PORTERIA" | "EMBAJADOR" | "ELIMINADO";
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      name: string;
      email: string;
      createdAt: Date;
      role?: "ADMINISTRADOR" | "NEO" | "PORTERIA" | "EMBAJADOR" | "ELIMINADO";
    } & DefaultSession['user'];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    role?: "ADMINISTRADOR" | "NEO" | "PORTERIA" | "EMBAJADOR" | "ELIMINADO";
  }
}
