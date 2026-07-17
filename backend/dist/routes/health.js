const healthRoutes = async (app) => {
    app.get('/health', async () => ({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now(),
    }));
};
export default healthRoutes;
export { healthRoutes };
//# sourceMappingURL=health.js.map