import { describe, expect, it, vi } from "vitest";
import {
  createDarajaAdapter,
  classifyDarajaCallback,
  darajaPassword,
  darajaTimestamp,
  DarajaRequestError,
  isDarajaCheckoutEnabled,
  isValidDarajaCallbackUrl,
  normalizeKenyanPhoneNumber,
  type DarajaConfig,
} from "./mpesa";

const config: DarajaConfig = {
  enabled: true,
  environment: "sandbox",
  consumerKey: "consumer-key",
  consumerSecret: "consumer-secret",
  shortcode: "174379",
  passkey: "test-passkey",
  callbackUrl: `https://school.example.com/api/mpesa/stk-callback/${"a".repeat(48)}`,
  transactionType: "CustomerPayBillOnline",
};

describe("Daraja M-Pesa integration helpers", () => {
  it("normalizes Kenyan mobile number formats to the Safaricom API format", () => {
    expect(normalizeKenyanPhoneNumber("0712 345 678")).toBe("254712345678");
    expect(normalizeKenyanPhoneNumber("+254 112 345 678")).toBe("254112345678");
    expect(normalizeKenyanPhoneNumber("712345678")).toBe("254712345678");
  });

  it("rejects non-Kenyan or malformed phone numbers", () => {
    expect(() => normalizeKenyanPhoneNumber("12345")).toThrow(/valid Kenyan M-Pesa/);
    expect(() => normalizeKenyanPhoneNumber("25471234567")).toThrow(/valid Kenyan M-Pesa/);
  });

  it("requires a complete exact-match success callback before activation", () => {
    const valid = {
      merchantRequestMatches: true,
      resultCode: 0,
      expectedAmount: 3_999,
      callbackAmount: 3_999,
      expectedPhoneNumber: "254712345678",
      callbackPhoneNumber: "254712345678",
      receiptNumber: "NLJ7RT61SV",
    };
    expect(classifyDarajaCallback(valid)).toBe("succeeded");
    expect(classifyDarajaCallback({ ...valid, callbackAmount: 4_000 })).toBe("review_required");
    expect(classifyDarajaCallback({ ...valid, callbackPhoneNumber: "254712345679" })).toBe("review_required");
    expect(classifyDarajaCallback({ ...valid, receiptNumber: "" })).toBe("review_required");
    expect(classifyDarajaCallback({ ...valid, merchantRequestMatches: false })).toBe("review_required");
    expect(classifyDarajaCallback({ ...valid, resultCode: 1032 })).toBe("failed");
  });

  it("requires production environment, credentials, and a tokenized HTTPS callback URL before enabling production checkout", () => {
    expect(isValidDarajaCallbackUrl(config.callbackUrl)).toBe(true);
    expect(isValidDarajaCallbackUrl("http://school.example.com/api/mpesa/stk-callback/" + "a".repeat(48))).toBe(false);
    expect(isValidDarajaCallbackUrl(`https://school.example.com/api/mpesa/stk-callback/${"a".repeat(42)}`)).toBe(false);
    expect(isDarajaCheckoutEnabled({ ...config, environment: "sandbox" }, "production")).toBe(false);
    expect(isDarajaCheckoutEnabled({ ...config, environment: "production" }, "production")).toBe(true);
    expect(isDarajaCheckoutEnabled({ ...config, environment: "production" }, "development")).toBe(false);
    expect(isDarajaCheckoutEnabled(config, "development")).toBe(true);
    expect(isDarajaCheckoutEnabled({ ...config, passkey: "" }, "production")).toBe(false);
  });

  it("creates the Nairobi timestamp and Daraja password format", () => {
    expect(darajaTimestamp(new Date("2026-01-01T00:00:00.000Z"))).toBe("20260101030000");
    expect(darajaPassword("174379", "passkey", "20260101030000")).toBe(Buffer.from("174379passkey20260101030000").toString("base64"));
  });

  it("requests an access token and sends the fixed server-provided amount in the STK Push", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("oauth/v1/generate")) return new Response(JSON.stringify({ access_token: "daraja-token", expires_in: "3599" }), { status: 200 });
      return new Response(JSON.stringify({ ResponseCode: "0", MerchantRequestID: "merchant-1", CheckoutRequestID: "checkout-1" }), { status: 200 });
    });
    const adapter = createDarajaAdapter(config, fetcher as typeof fetch);
    const result = await adapter.initiate({ amount: 3_999, phoneNumber: "254712345678", accountReference: "SCH123", transactionDescription: "School plan" });

    expect(calls[0]?.url).toBe("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials");
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("consumer-key:consumer-secret").toString("base64")}` });
    expect(calls[1]?.url).toBe("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
    const requestBody = JSON.parse(String(calls[1]?.init?.body));
    expect(requestBody).toMatchObject({
      BusinessShortCode: "174379",
      TransactionType: "CustomerPayBillOnline",
      Amount: 3_999,
      PartyA: "254712345678",
      PhoneNumber: "254712345678",
      AccountReference: "SCH123",
    });
    expect(result).toMatchObject({ status: "initiated", providerReference: "checkout-1", checkoutRequestId: "checkout-1", merchantRequestId: "merchant-1" });
  });

  it("marks an ambiguous STK network failure as unsafe to retry", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("oauth/v1/generate")) return new Response(JSON.stringify({ access_token: "daraja-token" }), { status: 200 });
      throw new Error("network timeout");
    });
    const adapter = createDarajaAdapter(config, fetcher as typeof fetch);
    await expect(adapter.initiate({ amount: 3_999, phoneNumber: "254712345678", accountReference: "SCH123", transactionDescription: "School plan" }))
      .rejects.toMatchObject({ name: "DarajaRequestError", retrySafe: false } satisfies Partial<DarajaRequestError>);
  });

  it("treats STK server errors as ambiguous but client rejections as retry-safe", async () => {
    const makeFetcher = (status: number) => vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("oauth/v1/generate")) return new Response(JSON.stringify({ access_token: "daraja-token" }), { status: 200 });
      return new Response(JSON.stringify({ errorMessage: "provider response" }), { status });
    });
    const request = { amount: 3_999, phoneNumber: "254712345678", accountReference: "SCH123", transactionDescription: "School plan" };
    await expect(createDarajaAdapter(config, makeFetcher(500) as typeof fetch).initiate(request))
      .rejects.toMatchObject({ name: "DarajaRequestError", retrySafe: false } satisfies Partial<DarajaRequestError>);
    await expect(createDarajaAdapter(config, makeFetcher(400) as typeof fetch).initiate(request))
      .rejects.toMatchObject({ name: "DarajaRequestError", retrySafe: true } satisfies Partial<DarajaRequestError>);
  });

  it("does not confuse a rejected status query with a definitively failed payment", async () => {
    const makeFetcher = (queryResponse: Record<string, unknown>) => vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("oauth/v1/generate")) return new Response(JSON.stringify({ access_token: "daraja-token" }), { status: 200 });
      return new Response(JSON.stringify(queryResponse), { status: 200 });
    });
    const confirmedFailure = await createDarajaAdapter(config, makeFetcher({ ResponseCode: "0", ResultCode: "1032" }) as typeof fetch).verify("checkout-1");
    expect(confirmedFailure.status).toBe("failed");
    const stillPending = await createDarajaAdapter(config, makeFetcher({ ResponseCode: "0" }) as typeof fetch).verify("checkout-1");
    expect(stillPending.status).toBe("pending");
    await expect(createDarajaAdapter(config, makeFetcher({ ResponseCode: "1", errorMessage: "query failed" }) as typeof fetch).verify("checkout-1"))
      .rejects.toMatchObject({ name: "DarajaRequestError" });
  });
});
