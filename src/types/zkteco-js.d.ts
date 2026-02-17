declare module "zkteco-js" {
    class ZKLib {
        constructor(ip: string, port: number, timeout?: number, inport?: number);
        createSocket(): Promise<void>;
        disconnect(): Promise<void>;
        getInfo(): Promise<Record<string, unknown>>;
        getUsers(): Promise<unknown[] | { data: unknown[] }>;
        getAttendances(): Promise<unknown[] | { data: unknown[] }>;
    }
    export default ZKLib;
    export { ZKLib };
}
