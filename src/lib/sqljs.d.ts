/**
 * sql.js 官方包不带 TypeScript 类型声明（package.json 里没有 types 字段），
 * 这里手写一份最小可用的环境声明，避免整个项目被类型报错卡住。
 * 只声明我们实际用到的 API，保持精简。
 */
declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null;

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export interface Statement {
    bind(params?: SqlValue[] | Record<string, SqlValue>): boolean;
    step(): boolean;
    getAsObject(params?: SqlValue[] | Record<string, SqlValue>): Record<string, SqlValue>;
    getColumnNames(): string[];
    free(): boolean;
  }

  export interface Database {
    exec(sql: string, params?: SqlValue[]): QueryExecResult[];
    prepare(sql: string): Statement;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | ArrayBuffer | null) => Database;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string, prefix: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
