const app = {
    state: {
        envelopes: [],
        rules: [],
        goals: [],
        transactions: [],
        transactions: [],
        summary: {},
        chartInstance: null,
        timeFilter: 'Yearly'
    },

    async init() {
        if (!localStorage.getItem("cashos_token")) return;
        try {
            await Promise.all([
                this.fetchSummary(),
                this.fetchEnvelopes(),
                this.fetchRules(),
                this.fetchGoals(),
                this.fetchTransactions()
            ]);
            this.renderAll();
        } catch (e) {
            console.error("Dashboard Init Error:", e);
        }
    },

    setTimeFilter(filter) {
        if (filter === 'Range') {
            ui.showModal('m-range');
            return;
        }
        
        this.state.timeFilter = filter;
        this.state.dateRange = null;
        
        // Update UI buttons
        document.querySelectorAll(".filter-group__btn").forEach(btn => btn.classList.remove("filter-group__btn--active"));
        const btn = document.getElementById(`tf-${filter}`);
        if (btn) btn.classList.add("filter-group__btn--active");
        
        this.renderChart();
    },

    applyDateRange(e) {
        e.preventDefault();
        const start = document.getElementById("range-start").value;
        const end = document.getElementById("range-end").value;
        if (!start || !end) return;

        this.state.timeFilter = 'Range';
        this.state.dateRange = { start, end };
        
        document.querySelectorAll(".filter-group__btn").forEach(btn => btn.classList.remove("filter-group__btn--active"));
        document.getElementById(`tf-Range`).classList.add("filter-group__btn--active");
        
        ui.hideModals();
        this.renderChart();
    },

    async fetchSummary() {
        this.state.summary = await api.getSummary();
    },

    async fetchEnvelopes() {
        this.state.envelopes = await api.getEnvelopes();
    },

    async fetchRules() {
        this.state.rules = await api.getRules();
    },

    async fetchGoals() {
        this.state.goals = await api.getGoals();
    },

    async fetchTransactions(filter = null) {
        const f = filter || document.getElementById("tx-filter")?.value || "all";
        this.state.transactions = await api.getTransactions(f);
        this.renderTransactions();
    },

    renderAll() {
        this.renderSummary();
        this.renderEnvelopes();
        this.renderRules();
        this.renderGoals();
        this.renderChart();
        this.renderCalendar();
    },

    renderCalendar() {
        const grid = document.getElementById("mini-calendar");
        if (!grid) return;
        
        let html = `
            <div style="font-weight:bold; color:#888; font-size:11px;">M</div><div style="font-weight:bold; color:#888; font-size:11px;">T</div><div style="font-weight:bold; color:#888; font-size:11px;">W</div>
            <div style="font-weight:bold; color:#888; font-size:11px;">T</div><div style="font-weight:bold; color:#888; font-size:11px;">F</div><div style="font-weight:bold; color:#888; font-size:11px;">S</div><div style="font-weight:bold; color:#888; font-size:11px;">S</div>
        `;
        
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        let startDay = start.getDay() || 7;
        
        for (let i = 1; i < startDay; i++) {
            html += `<div></div>`;
        }
        
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === now.getDate();
            const bg = isToday ? '#000' : 'transparent';
            const color = isToday ? '#fff' : '#000';
            html += `<div style="display:flex; align-items:center; justify-content:center; border-radius:4px; width:28px; height:28px; background:${bg}; color:${color}; font-size:12px;">${i}</div>`;
        }
        
        grid.innerHTML = html;
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(7, 1fr)";
        grid.style.gap = "4px";
        grid.style.textAlign = "center";
        grid.style.padding = "12px 0";
    },

    renderSummary() {
        const s = this.state.summary;
        const total = Number(s.total_balance || 0);
        document.getElementById("total-balance").textContent = total.toLocaleString() + " RWF";
        
        const usdRate = s.usd_rate || 0.00074;
        const usd = (total * usdRate).toFixed(2);
        document.getElementById("usd-equivalent").textContent = `($${usd})`;
    },

    renderEnvelopes() {
        const dashboardList = document.getElementById("envelopes-list");
        const tabList = document.getElementById("envelopes-list-tab");
        
        // Render Dashboard list (progress bars style)
        if (dashboardList) {
            let html = "";
            this.state.envelopes.forEach(env => {
                const bal = Number(env.balance);
                const goal = Number(env.goal || 0);
                const pct = goal > 0 ? Math.min(100, (bal / goal) * 100) : 0;
                const sub = goal > 0 ? `Target: ${goal.toLocaleString()}` : "No Target";
                
                html += `
                    <div class="envelope-item">
                        <div class="envelope-item__left">
                            <div class="envelope-item__color" style="background:${env.color}"></div>
                            <div class="envelope-item__name">${env.name}</div>
                        </div>
                        <div class="envelope-item__center">
                            <div class="envelope-item__track">
                                <div class="envelope-item__fill" style="width:${pct}%; background:${env.color}"></div>
                            </div>
                        </div>
                        <div class="envelope-item__right" style="text-align:right;">
                            <div class="envelope-item__bal">${bal.toLocaleString()}</div>
                            <div class="envelope-item__sub">${sub}</div>
                        </div>
                    </div>
                `;
            });
            dashboardList.innerHTML = html;
        }
        
        // Render Full Tab Grid (Table rows style)
        if (tabList) {
            let tabHtml = "";
            this.state.envelopes.forEach(e => {
                tabHtml += `
                    <tr>
                        <td>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <div style="width:12px; height:12px; border-radius:50%; background:${e.color || '#000'};"></div>
                                <span style="font-weight:600;">${e.name}</span>
                            </div>
                        </td>
                        <td><strong>${Number(e.balance).toLocaleString()} RWF</strong></td>
                        <td style="color:#666;">${e.goal > 0 ? e.goal.toLocaleString() + ' RWF' : '-'}</td>
                        <td style="color:#666;">${e.goal_date || '-'}</td>
                        <td style="text-align:right;">
                            ${e.name !== 'General' ? `<button class="btn btn--danger-sm" onclick="app.handleDeleteEnvelope(${e.id})">Delete</button>` : ''}
                        </td>
                    </tr>
                `;
            });
            tabList.innerHTML = tabHtml;
        }
        
        // Populate modal selects
        let options = '<option value="">Select Envelope</option>';
        this.state.envelopes.forEach(e => {
            options += `<option value="${e.id}">${e.name}</option>`;
        });
        document.getElementById("rule-envelope").innerHTML = options;
        document.getElementById("withdraw-envelope").innerHTML = options;

        // Also update allocation bar based on rules
        this.renderAllocationBar();
    },

    renderAllocationBar() {
        const bar = document.getElementById("alloc-bar");
        const list = document.getElementById("alloc-list");
        if (!bar || !list) return;
        
        bar.innerHTML = "";
        list.innerHTML = "";
        
        let totalPct = 0;
        this.state.rules.forEach(r => {
            if (r.type === "percentage") {
                const env = this.state.envelopes.find(e => e.id === r.envelope_id);
                const color = env ? env.color : "#000";
                totalPct += r.value;
                
                bar.insertAdjacentHTML("beforeend", `<div class="stacked-bar__segment" style="width:${r.value}%; background:${color};" title="${r.label}: ${r.value}%"></div>`);
                list.insertAdjacentHTML("beforeend", `
                    <div class="allocation-item">
                        <div class="allocation-item__left">
                            <div style="width:8px; height:8px; background:${color}; border-radius:2px;"></div>
                            <span><strong>${r.envelope_name}</strong> &middot; ${r.label}</span>
                        </div>
                        <div>${r.value}%</div>
                    </div>
                `);
            }
        });
        
        if (totalPct < 100) {
            const rem = 100 - totalPct;
            bar.insertAdjacentHTML("beforeend", `<div class="stacked-bar__segment" style="width:${rem}%; background:#cccccc;" title="Unallocated: ${rem}%"></div>`);
            list.insertAdjacentHTML("beforeend", `
                <div class="allocation-item">
                    <div class="allocation-item__left">
                        <div style="width:8px; height:8px; background:#ccc; border-radius:2px;"></div>
                        <span><strong>General</strong> &middot; Remaining</span>
                    </div>
                    <div>${rem}%</div>
                </div>
            `);
        }
    },

    renderRules() {
        const tabList = document.getElementById("rules-list-tab");
        if (!tabList) return;
        
        let html = "";
        if (this.state.rules.length === 0) {
            html = `<tr><td colspan="5" style="text-align:center; color:#888;">No active rules.</td></tr>`;
        } else {
            this.state.rules.forEach(r => {
                const isPct = r.type === "percentage";
                html += `
                    <tr>
                        <td style="font-weight:600;">${r.label.toUpperCase()}</td>
                        <td><span class="tx-badge" style="background:#f1f5f9; color:#475569;">${r.envelope_name}</span></td>
                        <td>${r.type}</td>
                        <td><strong>${isPct ? r.value + '%' : r.value.toLocaleString() + ' RWF'}</strong></td>
                        <td style="text-align:right;">
                            <button class="btn btn--danger-sm" onclick="app.handleDeleteRule(${r.id})">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
        tabList.innerHTML = html;
    },

    renderGoals() {
        const container = document.getElementById("goals-list");
        if (!container) return;
        container.innerHTML = "";
        
        this.state.goals.forEach(g => {
            const bal = Number(g.current_balance || 0);
            const target = Number(g.target_amount || 1);
            const pct = Math.min(100, (bal / target) * 100);
            
            const html = `
                <div class="goal-item">
                    <div class="goal-item__header">
                        <span>${g.title}</span>
                        <span class="goal-item__amount">${bal.toLocaleString()} / ${target.toLocaleString()}</span>
                    </div>
                    <div class="goal-item__track">
                        <div class="goal-item__fill" style="width:${pct}%"></div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", html);
        });
    },

    renderTransactions() {
        const tbody = document.getElementById("tx-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        let q = (document.getElementById("tx-search")?.value || "").toLowerCase();
        let filtered = this.state.transactions.filter(t => 
            t.label.toLowerCase().includes(q) || (t.note && t.note.toLowerCase().includes(q))
        );

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No transactions found.</td></tr>';
            return;
        }

        const usdRate = this.state.summary?.usd_rate || 0.00074;

        filtered.forEach(tx => {
            const date = new Date(tx.created_at).toLocaleString();
            const amt = Number(tx.amount);
            const isWithdraw = amt < 0 || tx.label === "withdrawal";
            const usd = (Math.abs(amt) * usdRate).toFixed(2);
            
            let badgeCls = "tx-badge--other";
            if (tx.label === "salary") badgeCls = "tx-badge--salary";
            else if (tx.label === "gig") badgeCls = "tx-badge--gig";

            tbody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td>#${tx.id}</td>
                    <td>${date}</td>
                    <td><strong>${tx.note || tx.label.toUpperCase()}</strong></td>
                    <td><span class="tx-badge ${badgeCls}">${tx.label}</span></td>
                    <td style="color:${isWithdraw ? '#ef4444' : '#137333'}; font-weight:bold;">
                        ${isWithdraw ? '' : '+'}${amt.toLocaleString()} RWF
                    </td>
                    <td style="color:#666;">$${usd}</td>
                </tr>
            `);
        });
    },

    renderChart() {
        const ctx = document.getElementById("mainChart");
        if (!ctx) return;
        
        let sorted = [...this.state.transactions].sort((a,b) => new Date(a.created_at.replace(" ", "T")) - new Date(b.created_at.replace(" ", "T")));
        
        const now = new Date();
        if (this.state.timeFilter === 'Weekly') {
            sorted = sorted.filter(t => (now - new Date(t.created_at.replace(" ", "T"))) <= 7*24*60*60*1000);
        } else if (this.state.timeFilter === 'Monthly') {
            sorted = sorted.filter(t => (now - new Date(t.created_at.replace(" ", "T"))) <= 30*24*60*60*1000);
        } else if (this.state.timeFilter === 'Yearly') {
            sorted = sorted.filter(t => new Date(t.created_at.replace(" ", "T")).getFullYear() === now.getFullYear());
        } else if (this.state.timeFilter === 'Range' && this.state.dateRange) {
            const start = new Date(this.state.dateRange.start);
            const end = new Date(this.state.dateRange.end);
            end.setHours(23, 59, 59, 999);
            sorted = sorted.filter(t => {
                const d = new Date(t.created_at.replace(" ", "T"));
                return d >= start && d <= end;
            });
        }

        let labels = [];
        let dataTotal = [];
        
        let envData = {};
        const chartEnvelopes = this.state.envelopes;
        chartEnvelopes.forEach(e => {
            envData[e.name] = { run: 0, data: [], color: e.color || "#000" };
        });

        let runTotal = 0;
        
        sorted.forEach(t => {
            runTotal += Number(t.amount);
            labels.push(new Date(t.created_at.replace(" ", "T")).toLocaleDateString());
            dataTotal.push(runTotal);
            
            if (t.breakdown && t.breakdown.length > 0) {
                t.breakdown.forEach(b => {
                    if (envData[b.envelope]) {
                        envData[b.envelope].run += Number(b.amount);
                    }
                });
            }
            
            chartEnvelopes.forEach(e => {
                envData[e.name].data.push(envData[e.name].run);
            });
        });
        
        if (labels.length === 0) {
            labels = ["No Data"];
            dataTotal = [0];
            chartEnvelopes.forEach(e => envData[e.name].data = [0]);
        }

        const datasets = [{
            label: "Total Balance",
            data: dataTotal,
            borderColor: "#000000",
            backgroundColor: "rgba(0,0,0,0.05)",
            fill: true,
            tension: 0.3,
            pointRadius: 2
        }];

        chartEnvelopes.forEach(e => {
            datasets.push({
                label: e.name,
                data: envData[e.name].data,
                borderColor: envData[e.name].color,
                backgroundColor: "transparent",
                borderDash: [5, 5],
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                pointRadius: 0
            });
        });

        if (this.state.chartInstance) {
            this.state.chartInstance.destroy();
        }

        this.state.chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } },
                scales: {
                    x: { display: false },
                    y: { 
                        display: true, 
                        border: { display: false },
                        grid: { color: "#f0f0ea" }
                    }
                }
            }
        });
    },

    async handleDeposit(e) {
        e.preventDefault();
        const amt = Number(document.getElementById("dep-amount").value);
        const lbl = document.getElementById("dep-label").value;
        const nte = document.getElementById("dep-note").value;
        try {
            await api.request("/api/deposit", "POST", { amount: amt, label: lbl, note: nte });
            ui.hideModals();
            this.init();
        } catch(err) {
            alert(err.message);
        }
    },

    updateWithdrawLimits() {
        const select = document.getElementById("withdraw-envelope");
        const display = document.getElementById("w-balance-display");
        const input = document.getElementById("withdraw-amount");
        
        const envId = Number(select.value);
        const env = this.state.envelopes.find(e => e.id === envId);
        if (env) {
            display.textContent = `Max: ${env.balance.toLocaleString()} RWF`;
            input.max = env.balance;
        } else {
            display.textContent = "Max: 0";
            input.removeAttribute("max");
        }
    },

    setWithdrawMax() {
        const select = document.getElementById("withdraw-envelope");
        const input = document.getElementById("withdraw-amount");
        const envId = Number(select.value);
        const env = this.state.envelopes.find(e => e.id === envId);
        if (env && env.balance > 0) {
            input.value = env.balance;
        }
    },

    async handleWithdraw(e) {
        e.preventDefault();
        const envId = Number(document.getElementById("withdraw-envelope").value);
        const amt = Number(document.getElementById("withdraw-amount").value);
        const nte = document.getElementById("withdraw-note").value;
        try {
            await api.request("/api/withdraw", "POST", { envelope_id: envId, amount: amt, note: nte });
            ui.hideModals();
            this.init();
        } catch(err) {
            alert(err.message);
        }
    },

    async handleCreateEnvelope(e) {
        e.preventDefault();
        const name = document.getElementById("env-name").value;
        const goal = document.getElementById("env-goal").value;
        const date = document.getElementById("env-date").value;
        const color = document.getElementById("env-color").value;
        try {
            await api.request("/api/envelopes", "POST", {
                name: name,
                goal: goal ? Number(goal) : null,
                goal_date: date || null,
                color: color
            });
            ui.hideModals();
            this.init();
        } catch(err) {
            alert(err.message);
        }
    },

    async handleDeleteEnvelope(id) {
        if (!confirm("Delete this envelope?")) return;
        try {
            await api.request(`/api/envelopes/${id}`, "DELETE");
            this.init();
        } catch(err) {
            alert(err.message);
        }
    },

    async handleDeleteRule(id) {
        if (!confirm("Delete this rule?")) return;
        try {
            await api.request(`/api/rules/${id}`, "DELETE");
            this.init();
        } catch(err) {
            alert(err.message);
        }
    },

    async handleCreateRule(e) {
        e.preventDefault();
        const label = document.getElementById("rule-label").value;
        const env = document.getElementById("rule-envelope").value;
        const type = document.getElementById("rule-type").value;
        const val = document.getElementById("rule-value").value;
        try {
            const res = await api.request("/api/rules", "POST", {
                label: label,
                envelope_id: Number(env),
                type: type,
                value: Number(val)
            });
            ui.hideModals();
            
            // Retroactive Prompt
            const generalEnv = this.state.envelopes.find(x => x.name === "General");
            if (generalEnv && generalEnv.balance > 0) {
                const wantsRetro = await ui.confirmRetroactive(generalEnv.balance);
                if (wantsRetro) {
                    try {
                        await api.request(`/api/rules/${res.id}/apply_retroactive`, "POST");
                    } catch (retroErr) {
                        alert("Rule saved, but retroactive apply failed: " + retroErr.message);
                    }
                }
            }
            
            this.init();
        } catch(err) {
            alert(err.message);
        }
    },

    async handleCreateGoal(e) {
        e.preventDefault();
        const title = document.getElementById("goal-title-input").value;
        const amount = Number(document.getElementById("goal-amount-input").value);
        try {
            await api.request("/api/goals", "POST", { title: title, target_amount: amount });
            ui.hideModals();
            this.init();
        } catch(err) {
            alert(err.message);
        }
    },

    setTimeFilter(filter) {
        this.state.timeFilter = filter;
        document.querySelectorAll(".filter-group__btn").forEach(b => b.classList.remove("filter-group__btn--active"));
        const btn = document.getElementById("tf-" + filter);
        if (btn) btn.classList.add("filter-group__btn--active");
        this.renderChart();
    }
};
