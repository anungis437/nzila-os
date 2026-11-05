export type Ok<T> = { readonly ok: true; readonly value: T; readonly created: boolean };
export type Err<C extends string = string> = {
  readonly ok: false;
  readonly code: C;
  readonly message: string;
};
export type Result<T, C extends string = string> = Ok<T> | Err<C>;

export const ok = <T>(value: T, created = true): Ok<T> => ({ ok: true, value, created });
export const err = <C extends string>(code: C, message: string): Err<C> => ({ ok: false, code, message });
