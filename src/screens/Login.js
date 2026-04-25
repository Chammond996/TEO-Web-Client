import { networkManager } from "../index.js";
import { Packet } from "../Packet.js";

const FIELDS = [
    { id: "login-account-name", label: "Account Name", type: "text" },
    { id: "login-password", label: "Password", type: "password" },
];

function buildForm(menu) {
    const form = document.createElement("form");
    form.className = "ca-form";
    form.noValidate = true;

    const title = document.createElement("h2");
    title.className = "ca-title";
    title.textContent = "Login";
    form.appendChild(title);

    for (const field of FIELDS) {
        const label = document.createElement("label");
        label.htmlFor = field.id;
        label.className = "ca-label";
        label.textContent = field.label;

        const input = document.createElement("input");
        input.type = field.type;
        input.id = field.id;
        input.name = field.id;
        input.className = "ca-input";
        input.required = true;

        form.appendChild(label);
        form.appendChild(input);
    }

    const actions = document.createElement("div");
    actions.className = "ca-actions";

    const loginBtn = document.createElement("button");
    loginBtn.type = "submit";
    loginBtn.className = "ca-btn ca-btn-connect";
    loginBtn.setAttribute("aria-label", "Login");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ca-btn ca-btn-cancel";
    cancelBtn.setAttribute("aria-label", "Cancel");
    cancelBtn.addEventListener("click", () => {
        form.remove();
        menu.style.display = "";
    });

    actions.appendChild(loginBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(actions);

    return form;
}

export function show(menu) {
    menu.style.display = "none";

    const form = buildForm(menu);
    document.body.appendChild(form);

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const els = e.target.elements;
        const username = els["login-account-name"].value.trim();
        const password = els["login-password"].value;

        // Send login request to server
        const packet = new Packet(Packet.PacketFamily.LOGIN, Packet.PacketAction.REQUEST);
        packet.addString(username);
        packet.addString(password);
        networkManager.send(packet);
        console.log("Login request sent");
    });
}
