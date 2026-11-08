import { randomUUID } from "node:crypto";

import {
  OperationNodeTransformer,
  PrimitiveValueListNode,
  type KyselyPlugin,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
  type ValueNode,
} from "kysely";

import type { SqlDialectName } from "@repo/backend-sql/migrations";

// Postgres and SQLite store some values differently. Writes go through ValuesPlugin, reads
// through bool() / json(), so the query code is identical for both.

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

// true/false from Postgres, 1/0 from SQLite.
export function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "t";
}

// Parsed jsonb from Postgres, text from SQLite.
export function json<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      // Not JSON (shouldn't happen): use the fallback rather than break the page.
      return fallback;
    }
  }
  return value as T;
}

// Timestamps as ISO strings whatever the driver returns.
export function iso(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return text.includes("T") ? text : new Date(text.replace(" ", "T")).toISOString();
}

function toParameter(value: unknown, dialect: SqlDialectName): unknown {
  if (typeof value === "boolean") return dialect === "sqlite" ? (value ? 1 : 0) : value;
  if (value instanceof Date) return value.toISOString();
  // Objects and arrays go to json/jsonb columns: always as JSON text (pg would turn a JS array
  // into a Postgres array, SQLite can't bind objects at all).
  if (value !== null && typeof value === "object" && !(value instanceof Uint8Array)) return JSON.stringify(value);
  return value;
}

class ValuesTransformer extends OperationNodeTransformer {
  constructor(private readonly dialect: SqlDialectName) {
    super();
  }

  protected override transformValue(node: ValueNode): ValueNode {
    return { ...super.transformValue(node), value: toParameter(node.value, this.dialect) };
  }

  protected override transformPrimitiveValueList(node: PrimitiveValueListNode): PrimitiveValueListNode {
    return PrimitiveValueListNode.create(node.values.map((value) => toParameter(value, this.dialect)));
  }
}

export class ValuesPlugin implements KyselyPlugin {
  private readonly transformer: ValuesTransformer;

  constructor(dialect: SqlDialectName) {
    this.transformer = new ValuesTransformer(dialect);
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.transformer.transformNode(args.node);
  }

  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return args.result;
  }
}
