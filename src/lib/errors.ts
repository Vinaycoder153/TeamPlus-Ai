/**
 * Shared error utilities for API routes.
 */

import { NextResponse } from "next/server"
import { ZodError } from "zod"

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message)
    this.name = "AppError"
  }
}

/**
 * Format a ZodError into a human-readable message string.
 */
export function formatZodError(err: ZodError): string {
  return err.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
}

/**
 * Converts any thrown error into a structured NextResponse.
 * Use this as a catch-all in API route try/catch blocks.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: formatZodError(error) },
      { status: 400 }
    )
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred"

  console.error("[API Error]", error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
