import { handleAdmsRequest } from "@/lib/biometric/adms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    return handleAdmsRequest(req, "getrequest");
}

export async function POST(req: Request) {
    return handleAdmsRequest(req, "getrequest");
}
