const electron = require("electron");
const { app, BrowserWindow } = electron;
const { ipcMain, ipcRenderer } = require("electron");
const mongoose = require("mongoose");
const User = require("./Schema/User");
require("chromedriver").path;
const { Builder, By, Key, until, Capabilities, Actions } = require("selenium-webdriver");
const path = require("path");
const packageJson = require("./package.json");

const { createFullDateWidthCurrentTime } = require("./handlers/date-handlers");
let mainWindow;
let uploadWindow;
let errorWindow;
const env = process.env.Path;
let newPathArray = env.split(";");
const path1 = path.join(__dirname + `../../app.asar.unpacked\\node_modules\\chromedriver\\lib\\chromedriver;`);

newPathArray.push(path1);
newPathArray = newPathArray.filter((path) => path !== "");
newPathArray.splice(0, 1);
let newPath = newPathArray.join(";");
process.env.Path = newPath;

app.on("ready", async () => {
	const mongooseURI = "mongodb+srv://toam:123987456tofo@ws.ppnha.mongodb.net/ws";
	mongoose.connect(mongooseURI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	});
	mainWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	mainWindow.on("closed", () => app.quit());
	await mainWindow.loadURL(`https://ws-we-send-client-cloud.herokuapp.com/`);
	// https://we-send-client-cloud.herokuapp.com/
	// https://we-send-client-cloud.herokuapp.com/
	// http://localhost:3000
});

function insertNameToMessage(message, name) {
	message = message.replaceAll(`( שם פרטי )`, name);

	return message;
}

ipcMain.on("upload:file", async (event, props) => {
	uploadWindow = new BrowserWindow({
		width: 500,
		height: 500,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});
	uploadWindow.menuBarVisible = false;
	uploadWindow.resizable = false;
	await uploadWindow.loadFile("./index.html");
	uploadWindow.webContents.send("fetch:data-table", props);
});

ipcMain.on("check:version", (event, version) => {
	if (packageJson.version !== version) {
		app.quit();
	}
});

ipcMain.on("upload-finish", (event, dataTable) => {
	mainWindow.webContents.send("data-table", dataTable);
});

ipcMain.on("close", () => {
	errorWindow.close();
});

ipcMain.on("finish:uploadFile", () => {
	uploadWindow.close();
});

ipcMain.on("start", async (event, item) => {
	const { caps, forBrowser, userId } = item.elementsSelectores;

	const { currentMessage, currentGroup, elementsSelectores } = item;

	const caps_ = new Capabilities();
	caps_.setPageLoadStrategy(caps.setPageLoadStrategy);
	caps_.setAlertBehavior(caps.setAlertBehavior);

	let driver = await new Builder().withCapabilities(caps_).forBrowser(forBrowser).build();
	await driver.get("https://web.whatsapp.com/"); // return null

	await driver.wait(
		until.elementLocated(By.id(elementsSelectores.whatsappSideBar)),
		100000,
		"initial-program-start-working",
		5000
	);

	const startPoint = elementsSelectores.starterIndex;
	const endPoint = elementsSelectores.endIndex;
	let currentUser;
	try {
		currentUser = await User.findById({ _id: userId });
		console.log(currentUser["validPhones"]);
		const local = await driver.executeScript(`return window.localStorage;`);
		if (currentUser["validPhones"]) {
			let validPhone;
			for (let phone of currentUser["validPhones"]) {
				validPhone = local["last-wid"].includes(phone);
				if (validPhone) {
					break;
				}
			}

			if (!validPhone) {
				await driver.quit();
				errorWindow = new BrowserWindow({
					webPreferences: {
						nodeIntegration: true,
						contextIsolation: false,
					},
					width: 400,
					height: 250,
				});
				errorWindow.menuBarVisible = false;
				errorWindow.resizable = false;

				errorWindow.loadFile("./error.html");
				return;
			}
		} else {
			await driver.quit();
			errorWindow = new BrowserWindow({
				webPreferences: {
					nodeIntegration: true,
					contextIsolation: false,
				},
				width: 400,
				height: 250,
			});
			errorWindow.menuBarVisible = false;
			errorWindow.resizable = false;

			errorWindow.loadFile("./error.html");
			return;
		}
	} catch (err) {
		console.log("CURRENTUSER:", err);
	}

	const currentDate = createFullDateWidthCurrentTime();
	const newHistory = {
		messageName: currentMessage.messageName,
		contentMessage: currentMessage.contentMessage,
		groupName: currentGroup.groupName,
		sendDate: currentDate,
		startPoint: +startPoint,
		currentPoint: +startPoint,
	};
	currentUser.history.push(newHistory);

	console.log("start:", startPoint);
	console.log("end:", endPoint);

	let massagesCounter = 0;
	for (let i = +startPoint; i < +endPoint; i++) {
		const DRIVER_GET_URL = `https://web.whatsapp.com/send?phone=${currentGroup.contacts[i].phoneNumber}`;
		const newHistory = {
			messageName: currentMessage.messageName,
			contentMessage: currentMessage.contentMessage,
			groupName: currentGroup.groupName,
			sendDate: currentDate,
			startPoint: +startPoint,
			currentPoint: i + 1,
		};
		currentUser.history[currentUser.history.length - 1] = newHistory;
		try {
			await User.findByIdAndUpdate(
				{ _id: userId },
				{
					$set: {
						history: currentUser.history,
					},
				}
			);
		} catch (err) {
			console.log("UPTADE HISTORY", err);
		}

		let newMessage = "";
		let sendButton = null;
		let messageInput = null;
		const actions = driver.actions({ async: true });
		try {
			await driver.get(DRIVER_GET_URL);

			await driver.wait(
				until.elementLocated(By.id(elementsSelectores.whatsappSideBar)),
				40000,
				"initial-program-start-working"
			);
			let inputs,
				inputsCounter = 0;
			do {
				inputs = await driver.findElements(By.className(elementsSelectores.messageInput));
				console.log(inputs.length);
				inputsCounter++;
				await driver.sleep(2500);
			} while (inputs.length < 2 && inputsCounter < 5);
			if (inputs.length < 2 || inputsCounter === 5) {
				continue;
			}
			console.log(inputsCounter);

			for (let messageIndex = 0; massagesCounter < currentMessage.contentMessage.length; messageIndex++) {
				let contactFirstName = currentGroup.contacts[i].contactProfile.contactFirstName
					? currentGroup.contacts[i].contactProfile.contactFirstName
					: "";
				newMessage = insertNameToMessage(currentMessage.contentMessage[messageIndex].contentField, contactFirstName);
				if (
					!currentMessage.contentMessage[messageIndex].mediaSrc &&
					!currentMessage.contentMessage[messageIndex].contentField
				) {
					continue;
				}

				let messageFormat = "";
				for (let char of newMessage) {
					if (char === "\n") {
						char = `\\n`;
					}

					messageFormat += char;
				}

				await driver.sleep(500);
				await driver.executeScript(
					`const inputs = document.getElementsByClassName('${elementsSelectores.messageInput}'); inputs[1].innerText = '${messageFormat}';`
				);
				massagesCounter++;

				do {
					messageInput = await driver.wait(
						until.elementsLocated(By.className(elementsSelectores.messageInput)),
						4000,
						"Message-Input"
					);

					await messageInput[1].sendKeys(".", Key.BACK_SPACE);
					const mediaSrc = currentMessage.contentMessage[messageIndex].mediaSrc;
					console.log(mediaSrc);
					if (mediaSrc) {
						const openMediaSpan = await driver.wait(
							until.elementLocated(By.css(elementsSelectores.openMediaSpan)),
							10000
						);
						await openMediaSpan.click();
						await driver.sleep(1000);
						const inputFile = await driver.wait(until.elementLocated(By.css(elementsSelectores.inputFile)), 10000);
						await inputFile.sendKeys(mediaSrc);
						sendButton = await driver.wait(
							until.elementsLocated(By.className(elementsSelectores.sendButtonWidthMedia)),
							10000
						);
					} else {
						sendButton = await driver.findElements(By.className(elementsSelectores.sendButton));
					}
				} while (!sendButton[0]);

				await sendButton[0].click();

				let sandTimer = null;

				do {
					await driver.sleep(500);
					sandTimer = await driver.findElements(By.css(elementsSelectores.sandClock));
				} while (sandTimer[0]);
				await driver.sleep(1000);
			}

			massagesCounter = 0;
			try {
				await User.findByIdAndUpdate(
					{ _id: userId },
					{
						$inc: {
							messagesStatus: -1,
						},
					}
				);
			} catch (err) {
				console.log("MESSAGES STATUS:", err);
			}

			let sendedToArcive = [];
			let counter = 0;
			while (!sendedToArcive.length && counter < 3) {
				const findChatInputs = await driver.wait(
					until.elementsLocated(By.className(elementsSelectores.messageInput)),
					10000,
					"catch array of inputs",
					3000
				);

				await findChatInputs[0].sendKeys(currentGroup.contacts[i].phoneNumber, Key.ENTER);

				const contactBox = await driver.findElements(By.className(elementsSelectores.contactBox));

				if (contactBox.length) {
					await actions.contextClick(contactBox[0]).perform();

					const contactMenu = await driver.wait(
						until.elementsLocated(By.className(elementsSelectores.contactMenu)),
						10000,
						"send contact box to the archive"
					);
					await contactMenu[0].click();
					sendedToArcive = await driver.findElements(By.className(elementsSelectores.sendedToArcive));
					await driver.sleep(1000);
				} else {
					await driver.sleep(1000);
				}
				counter++;
			}
		} catch (err) {
			console.log("err.message:", err.message);
			if (err.message.includes("(setting 'innerText')")) {
				console.log("Error : innerText");
				i--;
			}
			if (err.message.includes("initial-program-start-working")) {
				i--;
				console.log("initial-program-start-working");
			}
			if (err.message.includes("element not interactable")) {
				console.log("element not interactable");
				await driver.navigate().refresh();
			}
			if (err.message.includes("chrome not reachable")) {
				await driver.navigate().refresh();
			}
			if (err.message.includes("unexpected alert open")) {
				console.log("unexpected alert open");
				const body = await driver.wait(until.elementLocated(By.tagName("body")), 3000);
				body.sendKeys(Key.ENTER);
			}

			if (err.message.includes("Message-Input")) {
				continue;
			}
		}
	}
	await driver.quit();
	driver = null;
});
