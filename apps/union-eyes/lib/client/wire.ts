/** What a value is once a route has sent it as JSON: a Date is its ISO string, at any depth. A column the route leaves out is absent, which the type of the route's answer says. */
export type Wire<T> = T extends Date ? string : T extends readonly (infer Item)[] ? Wire<Item>[] : T extends object ? { [Key in keyof T]: Wire<T[Key]> } : T
