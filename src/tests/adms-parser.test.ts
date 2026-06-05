import { describe, expect, it } from "vitest";
import { parseAdmsAttendanceLogs } from "@/lib/biometric/adms";

describe("ADMS attendance parser", () => {
    it("parses ZKTeco tab-separated ATTLOG rows", () => {
        const records = parseAdmsAttendanceLogs(
            [
                "12\t2026-06-05 09:01:02\t0\t1\t0",
                "12\t2026-06-05 18:03:44\t1\t1\t0",
                "bad row",
            ].join("\n"),
            "FQQ2251600165"
        );

        expect(records).toHaveLength(2);
        expect(records[0]).toMatchObject({
            userId: "12",
            type: 0,
            state: 1,
            serialNumber: "FQQ2251600165",
        });
        expect(new Date(records[0].timestamp).toISOString()).toBe("2026-06-05T03:01:02.000Z");
        expect(records[1].type).toBe(1);
    });

    it("ignores rows without a valid user or timestamp", () => {
        const records = parseAdmsAttendanceLogs("\t2026-06-05 09:01:02\n12\tnot-a-date\n", "SN1");
        expect(records).toEqual([]);
    });
});
