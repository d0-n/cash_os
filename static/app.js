// Cash OS - Frontend logic

function getToken() {
    return localStorage.getItem("cashos_token");
}

function logout() {
    localStorage.removeItem("cashos_token");
    localStorage.removeItem("cashos_user");
    window.location.href = "/";
}

function formatMoney(amount) {
    return new Intl.NumberFormat("en-US").format(Math.round(amount)) + " RWF";
}

async function api(method, path, body) {
    var token = getToken();
    if (!token) {
        window.location.href = "/";
        return;
    }

    var opts = {method: method, headers: {"Authorization": "Bearer " + token}};
    if (body) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
    }

    var resp = await fetch(path, opts);
    if (resp.status === 401) {
        logout();
        return;
    }

    if (!resp.ok) {
        var err = await resp.json().catch(function () {
            return {detail: "Request failed."};
        });
        throw new Error(err.detail || "Request failed.");
    }
    return resp.json();
}

var txSort = {by: "created_at", order: "desc"};
var goalChart = null;


// Envelopes

async function loadEnvelopes() {
    try {
        var envelopes = await api("GET", "/api/envelopes");
        renderEnvelopes(envelopes);
        updateRuleEnvelopeSelect(envelopes);
        updateTotalBalance(envelopes);
    } catch (e) {
        document.getElementById("envelope-grid").innerHTML =
            '<div class="error-msg">' + e.message + "</div>";
    }
}

function renderEnvelopes(envelopes) {
    var grid = document.getElementById("envelope-grid");
    if (envelopes.length === 0) {
        grid.innerHTML = '<div class="empty">No envelopes created yet.</div>';
        return;
    }

    var html = "";
    for (var i = 0; i < envelopes.length; i++) {
        var env = envelopes[i];
        var isGeneral = env.name === "General";
        var deleteBtn = isGeneral
            ? ""
            : '<button class="delete-btn" onclick="deleteEnvelope(' + env.id + ')">&times;</button>';

        var goalInfo = "";
        if (env.goal) {
            var progress = env.goal > 0 ? Math.min(100, Math.round((env.balance / env.goal) * 100)) : 0;
            goalInfo =
                '<div class="goal-info">' +
                formatMoney(env.balance) + " / " + formatMoney(env.goal) +
                " (" + progress + "%)" +
                "</div>" +
                '<div class="progress-bar"><div class="fill" style="width:' + progress + '%; background:' + env.color + '"></div></div>';
        }

        html +=
            '<div class="envelope-card" style="border-top: 3px solid ' + env.color + ';">' +
            deleteBtn +
            '<div class="name">' + env.name + "</div>" +
            '<div class="balance">' + formatMoney(env.balance) + "</div>" +
            goalInfo +
            "</div>";
    }

    grid.innerHTML = html;
}

function updateTotalBalance(envelopes) {
    var total = 0;
    for (var i = 0; i < envelopes.length; i++) {
        total += envelopes[i].balance;
    }
    document.getElementById("balance-rwf").textContent = formatMoney(total);
}

function updateRuleEnvelopeSelect(envelopes) {
    var select = document.getElementById("rule-envelope");
    if (!select) return;
    select.innerHTML = "";
    for (var i = 0; i < envelopes.length; i++) {
        var opt = document.createElement("option");
        opt.value = envelopes[i].id;
        opt.textContent = envelopes[i].name;
        select.appendChild(opt);
    }
}


// Exchange Rate

async function loadExchangeRate() {
    try {
        var data = await api("GET", "/api/exchange-rate");
        if (data && data.rates && data.rates.USD) {
            var rwfEl = document.getElementById("balance-rwf");
            var rawText = rwfEl.textContent.replace(/[^0-9]/g, "");
            var rwfAmount = parseFloat(rawText) || 0;
            var usdAmount = rwfAmount * data.rates.USD;
            document.getElementById("balance-usd").textContent =
                " ≈ $" + usdAmount.toFixed(2) + " USD";
        }
    } catch (e) {
        // Silent fail for non-critical exchange rates
    }
}


// Deposit

async function handleDeposit(e) {
    e.preventDefault();
    var amount = parseFloat(document.getElementById("dep-amount").value);
    var label = document.getElementById("dep-label").value;
    var note = document.getElementById("dep-note").value.trim();

    try {
        var res = await api("POST", "/api/deposit", {
            amount: amount,
            label: label,
            note: note || null,
        });

        document.getElementById("dep-amount").value = "";
        document.getElementById("dep-note").value = "";

        var summary = "Allocated " + formatMoney(res.amount) + ": ";
        for (var i = 0; i < res.allocations.length; i++) {
            summary += res.allocations[i].envelope + " (" + formatMoney(res.allocations[i].amount) + ")";
            if (i < res.allocations.length - 1) summary += ", ";
        }
        document.getElementById("deposit-result").innerHTML =
            '<div class="success-msg">' + summary + "</div>";

        loadEnvelopes();
        loadTransactions();
        loadGoal();
    } catch (err) {
        document.getElementById("deposit-result").innerHTML =
            '<div class="error-msg">' + err.message + "</div>";
    }
}


// Rules

async function loadRules() {
    try {
        var rules = await api("GET", "/api/rules");
        renderRules(rules);
    } catch (e) {
        document.getElementById("rules-list").innerHTML =
            '<div class="error-msg">' + e.message + "</div>";
    }
}

function renderRules(rules) {
    var list = document.getElementById("rules-list");
    if (rules.length === 0) {
        list.innerHTML = '<div class="empty">No rules yet. Add one to automate your deposits.</div>';
        return;
    }

    var html = "";
    for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        var valStr = r.type === "percentage" ? r.value + "%" : formatMoney(r.value);
        var labelStr = r.label === "any" ? "Any deposit" : "Income = " + r.label;

        html +=
            '<div class="rule-item">' +
            '<div class="rule-info">' +
            '<span>When <strong>' + labelStr + "</strong></span> &rarr; " +
            "<span>Send <strong>" + valStr + "</strong> to <strong>" + r.envelope_name + "</strong></span>" +
            "</div>" +
            '<button class="delete-btn" onclick="deleteRule(' + r.id + ')">&times;</button>' +
            "</div>";
    }

    list.innerHTML = html;
}


// Transactions

async function loadTransactions() {
    var filter = document.getElementById("tx-filter").value;
    var search = document.getElementById("tx-search").value.trim();

    var path = "/api/transactions?sort_by=" + txSort.by + "&sort_order=" + txSort.order;
    if (filter !== "all") path += "&label=" + encodeURIComponent(filter);
    if (search) path += "&search=" + encodeURIComponent(search);

    try {
        var txs = await api("GET", path);
        renderTransactions(txs);
    } catch (e) {
        document.getElementById("tx-rows").innerHTML =
            '<tr><td colspan="5" class="error-msg">' + e.message + "</td></tr>";
    }
}

function renderTransactions(txs) {
    var tbody = document.getElementById("tx-rows");
    if (!tbody) return;

    if (txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No transactions found.</td></tr>';
        return;
    }

    var html = "";
    for (var i = 0; i < txs.length; i++) {
        var tx = txs[i];
        var dateStr = tx.created_at ? tx.created_at.split(" ")[0] : "-";

        var breakdownHtml = "";
        if (tx.breakdown && tx.breakdown.length > 0) {
            for (var j = 0; j < tx.breakdown.length; j++) {
                var b = tx.breakdown[j];
                breakdownHtml += b.envelope + ": " + formatMoney(b.amount);
                if (j < tx.breakdown.length - 1) breakdownHtml += ", ";
            }
        }

        html +=
            "<tr>" +
            "<td>" + dateStr + "</td>" +
            "<td>" + formatMoney(tx.amount) + "</td>" +
            '<td><span class="tx-label">' + tx.label + "</span></td>" +
            '<td><span class="tx-breakdown">' + breakdownHtml + "</span></td>" +
            "<td>" + (tx.note ? tx.note : "") + "</td>" +
            "</tr>";
    }

    tbody.innerHTML = html;
}

function handleSort(e) {
    var th = e.target.closest("th");
    if (!th || !th.dataset.sort) return;

    var col = th.dataset.sort;
    txSort.order = (txSort.by === col && txSort.order === "desc") ? "asc" : "desc";
    txSort.by = col;

    var allTh = document.querySelectorAll("thead th");
    for (var i = 0; i < allTh.length; i++) {
        allTh[i].classList.remove("active-sort");
    }
    th.classList.add("active-sort");
    loadTransactions();
}


// Goal Progress & Target CRUD

async function loadGoal() {
    try {
        var data = await api("GET", "/api/goal");
        renderGoal(data);
    } catch (e) {
        document.getElementById("goal-summary").innerHTML =
            '<div class="error-msg">' + e.message + "</div>";
    }
}

function renderGoal(data) {
    var pct = data.target > 0 ? ((data.total / data.target) * 100).toFixed(1) : 0;

    document.getElementById("goal-summary").innerHTML =
        '<span class="goal-current">' + formatMoney(data.total) + "</span> " +
        '<span class="goal-target">of ' + formatMoney(data.target) + "</span> " +
        '<span class="goal-pct">(' + pct + "%)</span>";

    renderGoalChart(data);
}

function renderGoalChart(data) {
    var canvas = document.getElementById("goal-chart");
    if (!canvas) return;

    if (goalChart) {
        goalChart.destroy();
    }

    var container = document.getElementById("goal-chart-container");
    if (!data.history || data.history.length === 0) {
        container.innerHTML = '<div class="empty">Make some deposits to see your progress over time.</div>';
        return;
    }

    if (!container.querySelector("canvas")) {
        container.innerHTML = '<canvas id="goal-chart"></canvas>';
        canvas = document.getElementById("goal-chart");
    }

    var labels = [];
    var balances = [];
    var targetLine = [];

    for (var i = 0; i < data.history.length; i++) {
        labels.push(data.history[i].date);
        balances.push(data.history[i].balance);
        targetLine.push(data.target);
    }

    goalChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Your Balance",
                    data: balances,
                    borderColor: "#2c6fce",
                    backgroundColor: "rgba(44, 111, 206, 0.08)",
                    fill: true,
                    tension: 0.2,
                    pointRadius: 3,
                    pointBackgroundColor: "#2c6fce",
                    borderWidth: 2,
                },
                {
                    label: "Target (" + formatMoney(data.target) + ")",
                    data: targetLine,
                    borderColor: "#8896a7",
                    borderDash: [6, 4],
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "bottom",
                    labels: { font: {size: 11} },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (val) {
                            return formatMoney(val);
                        },
                    },
                },
            },
        },
    });
}

async function handleUpdateGoal(e) {
    e.preventDefault();
    var input = document.getElementById("goal-target-input");
    var amount = parseFloat(input.value);

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid target amount.");
        return;
    }

    try {
        await api("PUT", "/api/goal", { target_amount: amount });
        input.value = "";
        var details = document.getElementById("goal-edit-details");
        if (details) details.removeAttribute("open");
        loadGoal();
    } catch (err) {
        alert(err.message);
    }
}


// Event Listeners and Actions

async function handleCreateEnvelope(e) {
    e.preventDefault();
    var name = document.getElementById("env-name").value.trim();
    var goalVal = parseFloat(document.getElementById("env-goal").value);
    var dateVal = document.getElementById("env-date").value;
    var colorVal = document.getElementById("env-color").value;

    try {
        await api("POST", "/api/envelopes", {
            name: name,
            goal: isNaN(goalVal) ? null : goalVal,
            goal_date: dateVal || null,
            color: colorVal,
        });

        document.getElementById("env-name").value = "";
        document.getElementById("env-goal").value = "";
        document.getElementById("env-date").value = "";
        loadEnvelopes();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteEnvelope(id) {
    if (!confirm("Delete this envelope?")) return;
    try {
        await api("DELETE", "/api/envelopes/" + id);
        loadEnvelopes();
    } catch (err) {
        alert(err.message);
    }
}

async function handleCreateRule(e) {
    e.preventDefault();
    var label = document.getElementById("rule-label").value;
    var envelopeId = parseInt(document.getElementById("rule-envelope").value, 10);
    var type = document.getElementById("rule-type").value;
    var value = parseFloat(document.getElementById("rule-value").value);

    try {
        await api("POST", "/api/rules", {
            label: label,
            envelope_id: envelopeId,
            type: type,
            value: value,
        });
        document.getElementById("rule-value").value = "";
        loadRules();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteRule(id) {
    try {
        await api("DELETE", "/api/rules/" + id);
        loadRules();
    } catch (err) {
        alert(err.message);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    if (!getToken()) {
        window.location.href = "/";
        return;
    }

    loadEnvelopes();
    loadRules();
    loadTransactions();
    loadGoal();
    loadExchangeRate();

    document.getElementById("deposit-form").addEventListener("submit", handleDeposit);
    document.getElementById("envelope-form").addEventListener("submit", handleCreateEnvelope);
    document.getElementById("rule-form").addEventListener("submit", handleCreateRule);

    var goalForm = document.getElementById("goal-form");
    if (goalForm) goalForm.addEventListener("submit", handleUpdateGoal);

    document.getElementById("tx-filter").addEventListener("change", loadTransactions);
    document.getElementById("tx-search").addEventListener("input", loadTransactions);
    document.querySelector("thead").addEventListener("click", handleSort);
});
