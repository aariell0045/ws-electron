const { ipcRenderer } = require("electron");
const path = require("path");
const button = document.querySelector("button");

button.addEventListener("click", () => {
	const path1 = path.join(
		__dirname + `../../app.asar.unpacked\\node_modules\\chromedriver\\lib\\chromedriver`
	);
	console.log("__dirname:", `${path1}`);
	ipcRenderer.send("start", "we need to start now!");
});
