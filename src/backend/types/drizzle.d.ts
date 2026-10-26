declare module 'drizzle-orm/pg-core' {
  export function pgTable(name: string, columns: any, extraConfig?: (table: any) => any): any;
  export function uuid(name: string): any;
  export function varchar(name: string, options?: { length: number }): any;
  export function timestamp(name: string, options?: { withTimezone?: boolean }): any;
  export function pgEnum(name: string, values: [string, ...string[]]): any;
  export function index(name: string): any;
}

declare module 'drizzle-orm' {
  export const sql: any;
}
