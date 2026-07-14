import { z } from "zod";

export const identifierSchema = z.string().trim().min(1).max(200);
export const nonEmptyTextSchema = z.string().trim().min(1);
export const positiveIntegerSchema = z.number().int().positive();
export const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const timestampSchema = z.iso.datetime({ offset: true });
export const jsonObjectSchema = z.record(z.string(), z.json());

export type JsonObject = z.infer<typeof jsonObjectSchema>;
