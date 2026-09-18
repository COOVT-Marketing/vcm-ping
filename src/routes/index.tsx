import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { sendPing, type PingResult } from "@/lib/ping.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Get DID" },
      {
        name: "description",
        content: "Enter phone, state & zip to receive Bid, Buffer and DID",
      },
      { property: "og:title", content: "Get DID" },
      {
        property: "og:description",
        content: "Enter phone, state & zip to receive Bid, Buffer and DID",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PingPage,
});

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

type Errors = Partial<Record<"phone" | "state" | "zip", string>>;

function PingPage() {
  const ping = useServerFn(sendPing);
  const [form, setForm] = useState({ phone: "", state: "", zip: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<PingResult | null>(null);

  const mutation = useMutation({
    mutationFn: (values: typeof form) => ping({ data: values }),
    onSuccess: (data) => setResult(data),
    onError: () =>
      setResult({
        ok: false,
        did: null,
        buffer: null,
        payout: null,
        leadId: null,
        message: "Something went wrong submitting this lead. Please check the details and retry.",
        raw: "",
      }),
  });

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 11) next.phone = "Enter a valid 10-digit phone number";
    if (!/^[A-Za-z]{2}$/.test(form.state.trim())) next.state = "Use a 2-letter state code";
    if (!/^\d{5}$/.test(form.zip.trim())) next.zip = "Enter a 5-digit ZIP code";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (!validate()) return;
    mutation.mutate(form);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4 py-6">
      <div className="w-full max-w-[420px]">
        <div className="rounded-[10px] border border-[#e3e6ea] bg-white p-7 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_16px_rgba(16,24,40,0.06)] sm:p-8">
          {/* Header */}
          <header className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-[#1a1d23]">
              Get DID
            </h1>
            <p className="mt-1.5 text-[14.5px] leading-snug text-[#6b7280]">
              Enter phone, state & zip to receive Bid, Buffer and DID
            </p>
          </header>

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone" className="text-[13.5px] font-semibold text-[#1a1d23]">
                Phone <span className="text-[#dc2626]">*</span>
              </Label>
              <Input
                id="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="4155552671"
                maxLength={20}
                value={form.phone}
                onChange={(e) => update("phone")(e.target.value.replace(/\D/g, "").slice(0, 11))}
                className={`h-11 rounded-lg border-[#e3e6ea] text-[15px] focus-visible:border-[#2563eb] focus-visible:ring-[#2563eb]/20 ${
                  errors.phone ? "border-[#dc2626]" : ""
                }`}
              />
              {errors.phone && (
                <p className="min-h-4 text-[12.5px] text-[#dc2626]">{errors.phone}</p>
              )}
            </div>

            {/* State + Zip row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="state" className="text-[13.5px] font-semibold text-[#1a1d23]">
                  State <span className="text-[#dc2626]">*</span>
                </Label>
                <Input
                  id="state"
                  list="us-states"
                  placeholder="CA"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => update("state")(e.target.value.toUpperCase())}
                  className={`h-11 rounded-lg border-[#e3e6ea] text-[15px] focus-visible:border-[#2563eb] focus-visible:ring-[#2563eb]/20 ${
                    errors.state ? "border-[#dc2626]" : ""
                  }`}
                />
                <datalist id="us-states">
                  {US_STATES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                {errors.state && (
                  <p className="min-h-4 text-[12.5px] text-[#dc2626]">{errors.state}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="zip" className="text-[13.5px] font-semibold text-[#1a1d23]">
                  Zip Code <span className="text-[#dc2626]">*</span>
                </Label>
                <Input
                  id="zip"
                  inputMode="numeric"
                  placeholder="94105"
                  maxLength={5}
                  value={form.zip}
                  onChange={(e) => update("zip")(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  className={`h-11 rounded-lg border-[#e3e6ea] text-[15px] focus-visible:border-[#2563eb] focus-visible:ring-[#2563eb]/20 ${
                    errors.zip ? "border-[#dc2626]" : ""
                  }`}
                />
                {errors.zip && (
                  <p className="min-h-4 text-[12.5px] text-[#dc2626]">{errors.zip}</p>
                )}
              </div>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="mt-2 h-12 w-full rounded-lg bg-[#2563eb] text-[15.5px] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-70"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Getting DID…
                </>
              ) : (
                "Get DID"
              )}
            </Button>
          </form>

          {/* Status message */}
          {result && (
            <p
              className={`mt-3 text-center text-sm font-medium ${
                result.ok ? "text-[#16a34a]" : "text-[#dc2626]"
              }`}
            >
              {result.ok
                ? "Success – DID received"
                : result.message || "Response received"}
            </p>
          )}

          {/* Results box */}
          {result?.ok && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#bae6fd] bg-[#f0f9ff] p-4">
              <div className="text-[15px]">
                <strong className="inline-block w-[70px]">Bid:</strong>{" "}
                {result.payout ? `$${result.payout}` : "—"}
              </div>
              <div className="text-[15px]">
                <strong className="inline-block w-[70px]">Buffer:</strong>{" "}
                {result.buffer ? `${result.buffer}s` : "—"}
              </div>
              <div className="text-[15px]">
                <strong className="inline-block w-[70px]">DID:</strong>{" "}
                {result.did || "—"}
              </div>
            </div>
          )}

          {/* Raw response */}
          {result && !result.ok && result.raw && (
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3.5 font-mono text-[13px] text-[#334155] whitespace-pre-wrap break-all">
              {result.raw}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
