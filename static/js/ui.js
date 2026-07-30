const ui = {
    showModal(modalId) {
        this.hideModals();
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add("modal-overlay--open");
    },

    hideModals() {
        document.querySelectorAll(".modal-overlay").forEach(el => el.classList.remove("modal-overlay--open"));
        // Clear all error messages
        document.querySelectorAll(".modal__err").forEach(el => el.style.display = "none");
    },

    toggleSidebar() {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.toggle("sidebar--collapsed");
    },

    toggleCalendar() {
        const heroRow = document.getElementById("hero-row");
        if (heroRow) heroRow.classList.toggle("hero--expanded");
    },

    switchTab(tabId, btnElement) {
        document.querySelectorAll(".tab-pane").forEach(el => el.classList.remove("tab-pane--active"));
        document.querySelectorAll(".nav__link").forEach(el => el.classList.remove("nav__link--active"));
        
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.add("tab-pane--active");
        
        if (btnElement) btnElement.classList.add("nav__link--active");
        
        const pageTitle = document.getElementById("page-title");
        if (pageTitle) {
            pageTitle.textContent = tabId === "tab-overview" ? "Executive Overview" : "Transactions";
        }
    },

    confirmRetroactive(balance) {
        return new Promise((resolve) => {
            const modal = document.getElementById("m-retro");
            if (!modal) return resolve(false);

            const msg = document.getElementById("retro-msg");
            if (msg) msg.textContent = `You have ${balance.toLocaleString()} RWF in General. Would you like to retroactively apply this new rule to that existing money?`;

            const btnYes = document.getElementById("retro-yes");
            const btnNo = document.getElementById("retro-no");

            const cleanup = () => {
                if (btnYes) btnYes.onclick = null;
                if (btnNo) btnNo.onclick = null;
                ui.hideModals();
            };

            if (btnYes) btnYes.onclick = () => { cleanup(); resolve(true); };
            if (btnNo) btnNo.onclick = () => { cleanup(); resolve(false); };

            ui.showModal("m-retro");
        });
    }
};

// Close modals when clicking outside
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
        ui.hideModals();
    }
});
