/**
 * Custom error class for API errors with HTTP status codes.
 */
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}
//# sourceMappingURL=errors.js.map