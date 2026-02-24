import en from './messages/en-CA.json';

type Messages = typeof en;

declare module '@sendgrid/mail' {
  const sgMail: {
    setApiKey(key: string): void;
    send(msg: Record<string, unknown>): Promise<unknown>;
  };
  export default sgMail;
}

declare global {
  // Use type safe message keys with `next-intl`
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
