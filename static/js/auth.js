const auth = {
    init() {
        if (localStorage.getItem("cashos_token")) {
            document.getElementById("view-landing").style.display = "none";
            document.getElementById("view-dashboard").style.display = "flex";
            const userName = localStorage.getItem("cashos_user") || "User";
            const displayEl = document.getElementById("user-name-display");
            if (displayEl) displayEl.textContent = userName;
            
            // Only initialize dashboard if app module exists and is loaded
            if (typeof app !== 'undefined' && app.init) {
                app.init();
            }
        } else {
            document.getElementById("view-landing").style.display = "block";
            document.getElementById("view-dashboard").style.display = "none";
        }
    },

    async login(e) {
        e.preventDefault();
        const errEl = document.getElementById("l-err");
        errEl.style.display = "none";
        try {
            const r = await fetch("/api/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    username: document.getElementById("l-user").value.trim(),
                    password: document.getElementById("l-pass").value,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.detail || "Login failed.");
            
            localStorage.setItem("cashos_token", data.token);
            localStorage.setItem("cashos_user", data.username);
            
            ui.hideModals();
            this.init();
        } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = "block";
        }
    },

    async signup(e) {
        e.preventDefault();
        const errEl = document.getElementById("s-err");
        errEl.style.display = "none";
        try {
            const r = await fetch("/api/register", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    username: document.getElementById("s-user").value.trim(),
                    password: document.getElementById("s-pass").value,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.detail || "Registration failed.");
            
            localStorage.setItem("cashos_token", data.token);
            localStorage.setItem("cashos_user", data.username);
            
            ui.hideModals();
            this.init();
        } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = "block";
        }
    },

    logout() {
        localStorage.removeItem("cashos_token");
        localStorage.removeItem("cashos_user");
        this.init();
    }
};

// Initialize view state on load
document.addEventListener("DOMContentLoaded", () => auth.init());
