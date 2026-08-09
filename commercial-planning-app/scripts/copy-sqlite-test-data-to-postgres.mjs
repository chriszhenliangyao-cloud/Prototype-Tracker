import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const scalarTypes = new Set([
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes"
]);
const schemaPath = resolve("prisma/schema.prisma");
const sourcePath = resolve(
  process.env.SOURCE_SQLITE_PATH || "prisma/dev.db"
);
const models = parseModels(readFileSync(schemaPath, "utf8"));
const source = new DatabaseSync(sourcePath, { readOnly: true });
const target = new PrismaClient();

try {
  const populatedTargets = [];
  for (const model of models) {
    const count = await target[delegateName(model.name)].count();
    if (count > 0) populatedTargets.push(`${model.tableName}:${count}`);
  }

  if (populatedTargets.length > 0) {
    throw new Error(
      `Target copy aborted because tables are not empty: ${populatedTargets.join(", ")}`
    );
  }

  const copied = await target.$transaction(
    async (transaction) => {
      const result = [];
      for (const model of models) {
        const rows = source
          .prepare(`SELECT * FROM ${quoteSqliteIdentifier(model.tableName)}`)
          .all()
          .map((row) => normalizeRow(row, model.fields));
        if (rows.length > 0) {
          await transaction[delegateName(model.name)].createMany({ data: rows });
        }
        result.push({ table: model.tableName, rows: rows.length });
      }
      return result;
    },
    { maxWait: 30_000, timeout: 180_000 }
  );

  console.log(JSON.stringify({ sourcePath, copied }, null, 2));
} finally {
  source.close();
  await target.$disconnect();
}

function parseModels(schema) {
  const enumNames = new Set(
    [...schema.matchAll(/\benum\s+(\w+)\s*\{/g)].map((match) => match[1])
  );
  return [...schema.matchAll(/\bmodel\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].map(
    ([, name, body]) => {
      const tableName = body.match(/@@map\("([^"]+)"\)/)?.[1];
      if (!tableName) throw new Error(`Model ${name} is missing @@map`);
      const fields = new Map();
      for (const rawLine of body.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
        const match = line.match(/^(\w+)\s+(\w+)([?\[\]]*)\s*/);
        if (!match) continue;
        const [, fieldName, fieldType, modifier] = match;
        if (modifier.includes("[]")) continue;
        if (!scalarTypes.has(fieldType) && !enumNames.has(fieldType)) continue;
        fields.set(fieldName, fieldType);
      }
      return { name, tableName, fields };
    }
  );
}

function normalizeRow(row, fields) {
  return Object.fromEntries(
    Object.entries(row).map(([fieldName, value]) => {
      const fieldType = fields.get(fieldName);
      if (value === null || value === undefined) return [fieldName, null];
      if (fieldType === "DateTime") return [fieldName, new Date(Number(value))];
      if (fieldType === "Boolean") return [fieldName, Boolean(value)];
      if (fieldType === "BigInt") return [fieldName, BigInt(value)];
      if (fieldType === "Bytes") return [fieldName, Buffer.from(value)];
      if (fieldType === "Json" && typeof value === "string") {
        return [fieldName, JSON.parse(value)];
      }
      return [fieldName, value];
    })
  );
}

function delegateName(modelName) {
  return `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`;
}

function quoteSqliteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
