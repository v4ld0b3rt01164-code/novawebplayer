/**
 * Custom error class for API errors with HTTP status codes.
 */
export declare class ApiError extends Error {
    status: number;
    constructor(status: number, message: string);
}
//# sourceMappingURL=errors.d.ts.map