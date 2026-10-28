export type MpesaPaymentRequest = {
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDescription: string;
};

export type MpesaPaymentResult = {
  providerReference: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  status: "initiated" | "pending" | "confirmed" | "failed";
};

export interface MpesaPaymentAdapter {
  initiate(request: MpesaPaymentRequest): Promise<MpesaPaymentResult>;
  verify(providerReference: string): Promise<MpesaPaymentResult>;
}

export type DarajaEnvironment = "sandbox" | "production";

export type DarajaConfig = {
  enabled: boolean;
  environment: DarajaEnvironment;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  transactionType: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
};

export function getDarajaConfig(env: NodeJS.ProcessEnv = process.env): DarajaConfig {
  const environment: DarajaEnvironment = env.MPESA_ENVIRONMENT === "production" ? "production" : "sandbox";
  return {
    enabled: env.MPESA_ENABLED === "true",
    environment,
    consumerKey: env.MPESA_CONSUMER_KEY?.trim() ?? "",
    consumerSecret: env.MPESA_CONSUMER_SECRET?.trim() ?? "",
    shortcode: env.MPESA_SHORTCODE?.trim() ?? "",
    passkey: env.MPESA_PASSKEY?.trim() ?? "",
    callbackUrl: env.MPESA_CALLBACK_URL?.trim() ?? "",
    transactionType: env.MPESA_TRANSACTION_TYPE === "CustomerBuyGoodsOnline" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
  };
}

export function isValidDarajaCallbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const token = url.pathname.split("/").at(-1) ?? "";
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && /^\/api\/mpesa\/stk-callback\/[A-Za-z0-9_-]{43,128}$/.test(url.pathname)
      && token.length >= 43;
  } catch {
    return false;
  }
}

export function isDarajaCheckoutEnabled(config: DarajaConfig, nodeEnv = process.env.NODE_ENV): boolean {
  const credentialsPresent = Boolean(config.consumerKey && config.consumerSecret && config.shortcode && config.passkey);
  const correctEnvironment = nodeEnv === "production" ? config.environment === "production" : config.environment === "sandbox";
  return config.enabled && credentialsPresent && correctEnvironment && isValidDarajaCallbackUrl(config.callbackUrl);
}

export function normalizeKenyanPhoneNumber(input: string): string {
  const compact = input.trim().replace(/[\s()-]/g, "").replace(/^\+/, "");
  const normalized = /^0[17]\d{8}$/.test(compact)
    ? `254${compact.slice(1)}`
    : /^[17]\d{8}$/.test(compact)
      ? `254${compact}`
      : compact;
  if (!/^254[17]\d{8}$/.test(normalized)) {
    throw new Error("Enter a valid Kenyan M-Pesa mobile number, for example 0712 345 678.");
  }
  return normalized;
}

export function classifyDarajaCallback(input: {
  merchantRequestMatches: boolean;
  resultCode: number;
  expectedAmount: number;
  callbackAmount: number;
  expectedPhoneNumber: string;
  callbackPhoneNumber: string;
  receiptNumber: string;
}): "succeeded" | "failed" | "review_required" {
  if (!input.merchantRequestMatches) return "review_required";
  if (input.resultCode !== 0) return "failed";
  if (input.callbackAmount !== input.expectedAmount
    || input.callbackPhoneNumber !== input.expectedPhoneNumber
    || !input.receiptNumber) return "review_required";
  return "succeeded";
}

export function darajaTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

export function darajaPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

export class DarajaRequestError extends Error {
  constructor(message: string, readonly retrySafe: boolean) {
    super(message);
    this.name = "DarajaRequestError";
  }
}

type DarajaJson = Record<string, unknown>;
type Fetcher = typeof fetch;

export function createDarajaAdapter(config: DarajaConfig, fetcher: Fetcher = fetch): MpesaPaymentAdapter {
  const baseUrl = config.environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  let cachedToken: string | null = null;
  let tokenExpiresAt = 0;
  let tokenRequest: Promise<string> | null = null;

  const accessToken = async () => {
    if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken;
    if (tokenRequest) return tokenRequest;
    tokenRequest = (async () => {
      let response: Response;
      try {
        response = await fetcher(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: { Authorization: `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64")}` },
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        throw new DarajaRequestError("M-Pesa authentication could not be reached. No payment prompt was sent.", true);
      }
      if (!response.ok) throw new DarajaRequestError("M-Pesa authentication was rejected. Check the Daraja environment and credentials.", true);
      let payload: DarajaJson;
      try {
        payload = await response.json() as DarajaJson;
      } catch {
        throw new DarajaRequestError("M-Pesa authentication returned an unreadable response. No payment prompt was sent.", true);
      }
      const token = typeof payload.access_token === "string" ? payload.access_token : "";
      if (!token) throw new DarajaRequestError("M-Pesa authentication did not return an access token. No payment prompt was sent.", true);
      const lifetimeSeconds = Number(payload.expires_in) || 3_500;
      cachedToken = token;
      tokenExpiresAt = Date.now() + lifetimeSeconds * 1_000;
      return token;
    })();
    try {
      return await tokenRequest;
    } finally {
      tokenRequest = null;
    }
  };

  const post = async (path: string, body: Record<string, string | number>, ambiguousOnNetworkFailure: boolean) => {
    const token = await accessToken();
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new DarajaRequestError(
        ambiguousOnNetworkFailure
          ? "We could not confirm whether Safaricom accepted the payment prompt. Check the phone and do not retry yet."
          : "The M-Pesa status request could not be reached.",
        !ambiguousOnNetworkFailure,
      );
    }
    if (!response.ok) {
      const retrySafe = !ambiguousOnNetworkFailure || (response.status >= 400 && response.status < 500);
      throw new DarajaRequestError(
        retrySafe
          ? `Safaricom rejected the request (HTTP ${response.status}).`
          : `Safaricom returned HTTP ${response.status}; the payment prompt may have been accepted. Check the phone and do not retry yet.`,
        retrySafe,
      );
    }
    try {
      return await response.json() as DarajaJson;
    } catch {
      throw new DarajaRequestError(
        ambiguousOnNetworkFailure
          ? "Safaricom may have accepted the payment prompt, but its response could not be read. Check the phone and do not retry yet."
          : "Safaricom returned an unreadable status response.",
        !ambiguousOnNetworkFailure,
      );
    }
  };

  return {
    async initiate(request) {
      const timestamp = darajaTimestamp();
      const payload = await post("/mpesa/stkpush/v1/processrequest", {
        BusinessShortCode: config.shortcode,
        Password: darajaPassword(config.shortcode, config.passkey, timestamp),
        Timestamp: timestamp,
        TransactionType: config.transactionType,
        Amount: request.amount,
        PartyA: request.phoneNumber,
        PartyB: config.shortcode,
        PhoneNumber: request.phoneNumber,
        CallBackURL: config.callbackUrl,
        AccountReference: request.accountReference.slice(0, 12),
        TransactionDesc: request.transactionDescription.slice(0, 13),
      }, true);
      const responseCode = String(payload.ResponseCode ?? "");
      if (responseCode !== "0") {
        throw new DarajaRequestError("Safaricom did not accept the M-Pesa payment prompt. No subscription was changed.", true);
      }
      const checkoutRequestId = typeof payload.CheckoutRequestID === "string" ? payload.CheckoutRequestID : "";
      const merchantRequestId = typeof payload.MerchantRequestID === "string" ? payload.MerchantRequestID : "";
      if (!checkoutRequestId || !merchantRequestId) {
        throw new DarajaRequestError("Safaricom accepted the prompt but returned incomplete reference IDs. Check the phone and contact support before retrying.", false);
      }
      return { providerReference: checkoutRequestId, checkoutRequestId, merchantRequestId, status: "initiated" };
    },
    async verify(providerReference) {
      const timestamp = darajaTimestamp();
      const payload = await post("/mpesa/stkpushquery/v1/query", {
        BusinessShortCode: config.shortcode,
        Password: darajaPassword(config.shortcode, config.passkey, timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: providerReference,
      }, false);
      const responseCode = String(payload.ResponseCode ?? "");
      if (responseCode !== "0") throw new DarajaRequestError("Safaricom could not verify the payment outcome with a status query.", true);
      const resultCode = payload.ResultCode === undefined || payload.ResultCode === null ? null : String(payload.ResultCode);
      const status = resultCode === null ? "pending" : resultCode === "0" ? "confirmed" : "failed";
      return { providerReference, checkoutRequestId: providerReference, status };
    },
  };
}
