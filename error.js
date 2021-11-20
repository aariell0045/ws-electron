const { ipcRenderer } = require("electron");

const button = document.querySelector("button");

button.addEventListener("click", function (event) {
	console.log("helk");
	ipcRenderer.send("close", "");
});
