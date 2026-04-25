import { networkManager } from "../index.js";
import { Packet } from "../Packet.js";

const FIELDS = [
    { id: "ca-account-name",     label: "Account Name",    type: "text" },
    { id: "ca-password",         label: "Password",        type: "password" },
    { id: "ca-confirm-password", label: "Confirm Password", type: "password" },
    { id: "ca-email",            label: "Email",           type: "email" },
    { id: "ca-name",             label: "Name",            type: "text" },
];

function buildForm(menu) {
    const form = document.createElement("form");
    form.className = "ca-form";
    form.noValidate = true;

    const title = document.createElement("h2");
    title.className = "ca-title";
    title.textContent = "Create Account";
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

    const createBtn = document.createElement("button");
    createBtn.type = "submit";
    createBtn.className = "ca-btn ca-btn-create";
    createBtn.setAttribute("aria-label", "Create");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ca-btn ca-btn-cancel";
    cancelBtn.setAttribute("aria-label", "Cancel");
    cancelBtn.addEventListener("click", () => {
        form.remove();
        menu.style.display = "";
    });

    actions.appendChild(createBtn);
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
        const username        = els["ca-account-name"].value.trim();
        const password        = els["ca-password"].value;
        const confirmPassword = els["ca-confirm-password"].value;
        const email           = els["ca-email"].value.trim();
        const name            = els["ca-name"].value.trim();

        // Send account creation request to server
        const packet = new Packet(Packet.PacketFamily.ACCOUNT, Packet.PacketAction.CREATE);
        packet.addString(username);
        packet.addString(password);
        packet.addString(confirmPassword);
        packet.addString(email);
        packet.addString(name);
        networkManager.send(packet);
        console.log("Account creation request sent user:", username, "email:", email, "name:", name);
    });
}
