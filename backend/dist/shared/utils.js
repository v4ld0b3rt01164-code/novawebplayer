/**
 * Utility functions for security and logging.
 */
/**
 * Masks the password segment in an IPTV upstream URL.
 *
 * Input:  "https://server.com/live/user123/mySecretPass/12345.ts"
 * Output: "https://server.com/live/user123/****/ 12345.;
ts;
"
    *
    * The;
URL;
format;
is: {
    baseUrl;
}
/{type}/;
{
    username;
}
/{password}/;
{
    file;
}
    * We;
mask;
the;
password;
segment(4, th, path, segment, after, base).
    * /;
export function maskUrl(url) {
    return url.replace(/(\/[^/]+\/[^/]+\/[^/]+\/)[^/]+(\/)/, '$1****$2');
}
//# sourceMappingURL=utils.js.map