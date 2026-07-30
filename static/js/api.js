const api = {
    headers: () => ({
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("cashos_token")
    }),

    async request(endpoint, method = "GET", body = null) {
        const options = { method, headers: this.headers() };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(endpoint, options);
        if (res.status === 401) {
            auth.logout();
            throw new Error("Session expired.");
        }
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "API Error");
        return data;
    },

    getSummary: () => api.request("/api/summary"),
    getEnvelopes: () => api.request("/api/envelopes"),
    getRules: () => api.request("/api/rules"),
    getGoals: () => api.request("/api/goals"),
    getTransactions: (filter = "all") => api.request(`/api/transactions?label=${filter}`)
};
