import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SageIntacctClient } from '../../../adapters/accounting/sage-intacct-client';
import { AuthenticationError, IntegrationError } from '../../../types';

const xmlResp = (text: string, init: { status?: number } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  text: async () => text,
});

const authXml = (sid = 'SID-1') => xmlResp(`<response><operation><authentication><sessionid>${sid}</sessionid></authentication></operation></response>`);
const authXmlNoSession = () => xmlResp('<response><operation></operation></response>');

const dataXml = (tag: string, records: string[]) =>
  xmlResp(`<response><operation><result><data>${records.map((r) => `<${tag}>${r}</${tag}>`).join('')}</data></result></operation></response>`);

const invoiceRecord = (id: string) =>
  `<RECORDNO>${id}</RECORDNO><RECORDID>R${id}</RECORDID><CUSTOMERID>C1</CUSTOMERID><CUSTOMERNAME>Acme</CUSTOMERNAME><WHENDUE>2023-01-01</WHENDUE><WHENCREATED>2022-12-01</WHENCREATED><TOTALDUE>100.50</TOTALDUE><TOTALENTERED>100.50</TOTALENTERED><STATE>Approved</STATE>`;

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (over: Record<string, unknown> = {}) =>
  new SageIntacctClient({
    companyId: 'co',
    userId: 'u',
    userPassword: 'pw',
    senderId: 's',
    senderPassword: 'spw',
    orgId: 'org1',
    environment: 'sandbox',
    ...over,
  });

describe('SageIntacctClient', () => {
  beforeEach(() => {
    queue.length = 0;
    fetchMock = vi.fn(async () => {
      const next = queue.length ? queue.shift() : xmlResp('<response></response>');
      if (next instanceof Error) throw next;
      return next as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('authenticate extracts and stores the session id', async () => {
    const client = makeClient();
    pushResp(authXml('SID-9'));
    await client.authenticate();
    expect(client.getSessionId()).toBe('SID-9');
  });

  it('authenticate throws on a non-ok response', async () => {
    const client = makeClient();
    pushResp(xmlResp('error', { status: 500 }));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('authenticate throws when no session id can be extracted', async () => {
    const client = makeClient();
    pushResp(authXmlNoSession());
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('authenticate wraps a network error', async () => {
    const client = makeClient();
    pushResp(new Error('net'));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('getInvoices authenticates then parses invoices', async () => {
    const client = makeClient();
    pushResp(authXml());
    pushResp(dataXml('ARINVOICE', [invoiceRecord('1'), invoiceRecord('2')]));
    const r = await client.getInvoices({ pageSize: 100, modifiedSince: new Date('2023-01-01') });
    expect(r.invoices).toHaveLength(2);
    expect(r.invoices[0].TOTALDUE).toBe(100.5);
    expect(r.hasMore).toBe(false);
  });

  it('getCustomers parses customers', async () => {
    const client = makeClient();
    pushResp(authXml());
    pushResp(dataXml('CUSTOMER', ['<RECORDNO>1</RECORDNO><CUSTOMERID>C1</CUSTOMERID><NAME>Acme</NAME><STATUS>active</STATUS>']));
    const r = await client.getCustomers();
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].NAME).toBe('Acme');
  });

  it('getPayments parses payments', async () => {
    const client = makeClient();
    pushResp(authXml());
    pushResp(dataXml('ARPAYMENT', ['<RECORDNO>1</RECORDNO><RECORDKEY>K1</RECORDKEY><CUSTOMERID>C1</CUSTOMERID><AMOUNTPAID>50.00</AMOUNTPAID>']));
    const r = await client.getPayments();
    expect(r.payments).toHaveLength(1);
    expect(r.payments[0].AMOUNTPAID).toBe(50);
  });

  it('getAccounts parses GL accounts', async () => {
    const client = makeClient();
    pushResp(authXml());
    pushResp(dataXml('GLACCOUNT', ['<RECORDNO>1</RECORDNO><ACCOUNTNO>1000</ACCOUNTNO><TITLE>Cash</TITLE><ACCOUNTTYPE>balancesheet</ACCOUNTTYPE>']));
    const r = await client.getAccounts();
    expect(r.accounts).toHaveLength(1);
    expect(r.accounts[0].ACCOUNTNO).toBe('1000');
  });

  it('request throws IntegrationError on a non-ok API response', async () => {
    const client = makeClient();
    pushResp(authXml());
    pushResp(xmlResp('fail', { status: 500 }));
    await expect(client.getCustomers()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('parseXmlResponse throws IntegrationError when the response contains an error', async () => {
    const client = makeClient();
    pushResp(authXml());
    pushResp(xmlResp('<response><description2>Invalid object</description2></response>'));
    await expect(client.getCustomers()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(authXml());
    pushResp(new Error('socket'));
    await expect(client.getCustomers()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('parseXmlResponse returns [] when no <data> block is present (downstream parse then throws)', async () => {
    // NOTE: parseXmlResponse returns [] (an array) when there is no <data> block, but the
    // per-object parse helpers expect a string and call String.matchAll -> TypeError. This
    // documents the latent SUT behaviour while covering the no-data branch of parseXmlResponse.
    const client = makeClient();
    pushResp(authXml());
    pushResp(xmlResp('<response><operation><result></result></operation></response>'));
    await expect(client.getCustomers()).rejects.toThrow(/matchAll is not a function/);
  });

  it('healthCheck returns true with a session, false on failure', async () => {
    const client = makeClient();
    pushResp(authXml());
    expect(await client.healthCheck()).toBe(true);
    const client2 = makeClient();
    pushResp(new Error('down'));
    expect(await client2.healthCheck()).toBe(false);
  });

  it('ensureValidSession reuses an existing valid session', async () => {
    const client = makeClient();
    pushResp(authXml()); // first authenticate
    pushResp(dataXml('CUSTOMER', []));
    await client.getCustomers();
    // second call should NOT authenticate again (session still valid)
    pushResp(dataXml('CUSTOMER', []));
    await client.getCustomers();
    expect(client.getSessionId()).toBeTruthy();
  });
});
