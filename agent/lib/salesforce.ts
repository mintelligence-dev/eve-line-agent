/**
 * Salesforce REST client for the writes this agent makes: a Lead per demo
 * request, then the demo fields on that Lead as sales books the demo in the
 * LINE group and the customer answers.
 *
 * It signs in with the OAuth 2.0 client credentials flow of an External
 * Client App (or Connected App) in the company org. Salesforce runs every
 * call as the app's "Run As" user, so that user needs permission to create
 * and edit Leads and nothing more. Set `SALESFORCE_LOGIN_URL` (the org's My Domain
 * URL — the flow does not work on login.salesforce.com),
 * `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET`. Without all three
 * the demo-request tool keeps requests locally instead.
 *
 * The app, the demo fields on Lead and the permission sets are in
 * `salesforce/`, ready to deploy to the org.
 */

const API_VERSION = "v62.0";
const TIMEOUT_MS = 10_000;

export interface SalesforceConfig {
  clientId: string;
  clientSecret: string;
  loginUrl: string;
}

/** Where a demo booking stands, as the `Demo_Status__c` picklist spells it. */
export type DemoStatus = "Requested" | "Scheduled" | "Confirmed" | "Reschedule Requested";

/** The demo fields this agent keeps up to date on a Lead after creating it. */
export interface DemoLeadFields {
  /** When sales booked the demo, as an ISO 8601 date-time. */
  Demo_Date__c?: string;
  /** The customer's preferred day, YYYY-MM-DD. */
  Demo_Preferred_Date__c?: string;
  Demo_Status__c?: DemoStatus;
}

/** The Lead fields this agent writes. `LastName` and `Company` are required. */
export interface LeadFields extends DemoLeadFields {
  Company: string;
  /** Unique in the org, so a second Lead with the same code is refused. */
  Demo_Reference__c: string;
  Description?: string;
  Email?: string;
  FirstName?: string;
  LastName: string;
  LeadSource?: string;
  Phone?: string;
}

export class SalesforceError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SalesforceError";
    this.status = status;
    this.code = code;
  }
}

export function salesforceConfig(): SalesforceConfig | undefined {
  const loginUrl = process.env.SALESFORCE_LOGIN_URL?.trim();
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  if (!(loginUrl && clientId && clientSecret)) {
    return undefined;
  }
  return { clientId, clientSecret, loginUrl: loginUrl.replace(/\/+$/, "") };
}

interface Session {
  accessToken: string;
  instanceUrl: string;
}

/**
 * One token per function instance. A client credentials token carries no
 * expiry: it lasts as long as the org's session timeout, so a 401 is the
 * signal to sign in again.
 */
let cached: Promise<Session> | undefined;

async function signIn(config: SalesforceConfig): Promise<Session> {
  const response = await fetch(`${config.loginUrl}/services/oauth2/token`, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
    }),
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    instance_url?: string;
  };
  if (!(response.ok && body.access_token && body.instance_url)) {
    throw new SalesforceError(
      `Salesforce sign-in failed: ${body.error_description ?? body.error ?? `HTTP ${response.status}`}`,
      response.status,
      body.error
    );
  }
  return { accessToken: body.access_token, instanceUrl: body.instance_url };
}

function session(config: SalesforceConfig, renew = false): Promise<Session> {
  if (cached && !renew) {
    return cached;
  }
  const pending = signIn(config);
  cached = pending;
  // A failed sign-in must not stick: the next request tries again.
  pending.catch(() => {
    if (cached === pending) {
      cached = undefined;
    }
  });
  return pending;
}

/**
 * Send one REST call, signing in again once if the cached token has outlived
 * the org's session timeout. A 401 means nothing was written, so the retry is
 * safe for any method.
 */
async function call(
  config: SalesforceConfig,
  method: "PATCH" | "POST",
  path: string,
  body: object,
  headers: Record<string, string> = {}
): Promise<Response> {
  const send = ({ accessToken, instanceUrl }: Session) =>
    fetch(`${instanceUrl}/services/data/${API_VERSION}${path}`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...headers,
      },
      method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  const response = await send(await session(config));
  return response.status === 401 ? send(await session(config, true)) : response;
}

/**
 * Create the Lead for a reference, once. A replayed tool call sends the same
 * reference, which the unique field turns away; that counts as saved, and
 * `created` is false.
 */
export async function createLead(
  config: SalesforceConfig,
  fields: LeadFields
): Promise<{ created: boolean; id?: string }> {
  const response = await call(config, "POST", "/sobjects/Lead", fields, {
    // Run the org's active Lead assignment rule so the Lead gets an owner.
    "Sforce-Auto-Assign": "TRUE",
    // A returning customer trips the standard Lead duplicate rule, whose
    // alert would otherwise block an API insert. Save it; the rule still
    // flags the match for sales.
    "Sforce-Duplicate-Rule-Header": "allowSave=true",
  });

  const body = (await response.json().catch(() => undefined)) as
    | { id?: string }
    | { errorCode?: string; message?: string }[]
    | undefined;
  if (response.ok && body && !Array.isArray(body) && body.id) {
    return { created: true, id: body.id };
  }
  const [error] = Array.isArray(body) ? body : [];
  // The integration user may not be able to read the Lead once assignment
  // has given it to sales, so the ID comes from the error text, not a query.
  if (
    error?.errorCode === "DUPLICATE_VALUE" &&
    error.message?.includes("Demo_Reference__c")
  ) {
    return {
      created: false,
      id: error.message.match(/record with id: (\w+)/)?.[1],
    };
  }
  throw new SalesforceError(
    `Salesforce rejected the Lead: ${error?.message ?? `HTTP ${response.status}`}`,
    response.status,
    error?.errorCode
  );
}

/**
 * Write the demo fields on a Lead this agent created.
 *
 * The Run As user must be able to edit the Lead after assignment has given it
 * to sales: with a Private Lead sharing model that takes a sharing rule (see
 * README → Demo requests go to Salesforce).
 */
export async function updateDemoFields(
  config: SalesforceConfig,
  leadId: string,
  fields: DemoLeadFields
): Promise<void> {
  const response = await call(config, "PATCH", `/sobjects/Lead/${encodeURIComponent(leadId)}`, fields);
  if (response.ok) {
    return;
  }
  const body = (await response.json().catch(() => undefined)) as
    | { errorCode?: string; message?: string }[]
    | undefined;
  const [error] = Array.isArray(body) ? body : [];
  throw new SalesforceError(
    `Salesforce rejected the Lead update: ${error?.message ?? `HTTP ${response.status}`}`,
    response.status,
    error?.errorCode
  );
}

/** The Lead's page in Lightning, on the org's My Domain. */
export function leadUrl(config: SalesforceConfig, leadId: string): string {
  return `${config.loginUrl}/lightning/r/Lead/${encodeURIComponent(leadId)}/view`;
}
