export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function toErrorResponse(error) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: error.message,
        details: error.details,
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: "Internal server error",
    },
  };
}
