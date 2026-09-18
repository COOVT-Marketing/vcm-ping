import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PING_URL = "https://track.edmleadnetwork.com/call-preping.do";
const CAMPAIGN_ID = "6aa835da3fc9a";
const CAMPAIGN_KEY = "gcYBjGnzt4LMqXQwPdFf";

// Your Logger Web App URL
const LOG_URL =
  "https://script.google.com/macros/s/AKfycbz8rXnY50yFqHa4_x_nYEa9YVcs_CiaCPL1munRPaeOIfAU9ZMZCoco7oIA7-6YFBAjCg/exec";

const pingSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || v.length === 11, {
      message: "Enter a valid 10-digit US phone number",
    }),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, { message: "Use the 2-letter state code" })
    .transform((v) => v.toUpperCase()),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, { message: "Enter a 5-digit ZIP code" }),
});

export type PingInput = z.input<typeof pingSchema>;

export type PingResult = {
  ok: boolean;
  did: string | null;
  buffer: string | null;
  payout: string | null;
  leadId: string | null;
  message: string | null;
  raw: string;
};

function pick(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(source)) {
      if (
        k.toLowerCase().replace(/[^a-z]/g, "") === key &&
        v !== null &&
        v !== ""
      ) {
        return String(v);
      }
    }
  }
  return null;
}

function flatten(
  value: unknown,
  out: Record<string, unknown> = {}
): Record<string, unknown> {
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v && typeof v === "object") flatten(v, out);
      else out[k] = v;
    }
  }
  return out;
}

function parseXml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const re =
    /<([A-Za-z0-9_:-]+)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const inner = m[2] ?? "";
    if (!/<[A-Za-z]/.test(inner)) out[m[1] as string] = inner.trim();
  }
  return out;
}

async function logToSheet(payload: Record<string, unknown>) {
  try {
    await fetch(LOG_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to log to Google Sheet", err);
  }
}

export const sendPing = createServerFn({ method: "POST" })
  .validator((input: PingInput) => pingSchema.parse(input))
  .handler(async ({ data }): Promise<PingResult> => {
    const body = new URLSearchParams({
      lp_campaign_id: CAMPAIGN_ID,
      lp_campaign_key: CAMPAIGN_KEY,
      lp_response: "JSON",
      phone_home: data.phone,
      state: data.state,
      zip_code: data.zip,
    });

    let text = "";
    try {
      const res = await fetch(PING_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json, text/xml;q=0.9, */*;q=0.8",
        },
        body: body.toString(),
      });
      text = await res.text();
    } catch (err) {
      console.error("ping request failed", err);

      const failResult: PingResult = {
        ok: false,
        did: null,
        buffer: null,
        payout: null,
        leadId: null,
        message: "Could not reach the tracking service. Please try again.",
        raw: "",
      };

      await logToSheet({
        phone: data.phone,
        state: data.state,
        zip: data.zip,
        ...failResult,
      });

      return failResult;
    }

    let flat: Record<string, unknown> = {};
    try {
      flat = flatten(JSON.parse(text));
    } catch {
      flat = parseXml(text);
    }

    const status = pick(flat, ["success", "status", "result", "response"]);
    const did = pick(flat, [
      "did",
      "number",
      "phonenumber",
      "callcenternumber",
      "transfernumber",
    ]);
    const buffer = pick(flat, [
      "buffer",
      "duration",
      "buffertime",
      "bufferseconds",
    ]);
    const payout = pick(flat, ["payout", "price", "bidamount", "amount"]);
    const leadId = pick(flat, ["pingid", "leadid", "id"]);
    const message = pick(flat, ["message", "errors", "error", "msg"]);

    const normalized = (status ?? "").toLowerCase();
    const ok =
      did !== null ||
      normalized === "true" ||
      normalized === "success" ||
      normalized === "accepted";

    const result: PingResult = {
      ok,
      did,
      buffer,
      payout,
      leadId,
      message:
        message ?? (ok ? null : "No matching buyer returned for this lead."),
      raw: text.slice(0, 4000),
    };

    // Log every response to Google Sheet
    await logToSheet({
      phone: data.phone,
      state: data.state,
      zip: data.zip,
      ...result,
    });

    return result;
  });
