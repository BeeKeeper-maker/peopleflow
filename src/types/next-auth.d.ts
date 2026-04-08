import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: string
            organizationId?: string
        } & DefaultSession["user"]
    }

    interface User {
        id: string
        role: string
        organizationId?: string
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        id: string
        role: string
        organizationId?: string
    }
}
