const electron = require("electron");
const { app, BrowserWindow } = electron;
const { ipcMain, ipcRenderer } = require("electron");
const mongoose = require("mongoose");
const User = require("./Schema/User");
require("chromedriver").path;
const {
  Builder,
  By,
  Key,
  until,
  Capabilities,
  Actions,
} = require("selenium-webdriver");
const path = require("path");
let mainWindow;
const env = process.env.Path;
let newPathArray = env.split(";");
const path1 = path.join(
  __dirname +
    `../../app.asar.unpacked\\node_modules\\chromedriver\\lib\\chromedriver`
);
newPathArray.push(path1);
newPathArray = newPathArray.filter((path) => path !== "");
let newPath = newPathArray.join(";");
process.env.Path = newPath;

app.on("ready", () => {
  mongoose.connect("mongodb://localhost/wsDB", {
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
  mainWindow.loadURL(`http://localhost:3000`);
  //http://localhost:3000
});

function insertNameToMessage(message, name) {
  message = message.replaceAll(`( שם פרטי )`, name);

  return message;
}

ipcMain.on("start", async (event, item) => {
  const { caps, forBrowser, userId } = item.elementsSelectores;

  const { currentMessage, currentGroup, elementsSelectores } = item;

  const caps_ = new Capabilities();
  caps_.setPageLoadStrategy(caps.setPageLoadStrategy);
  caps_.setAlertBehavior(caps.setAlertBehavior);

  let driver = await new Builder()
    .withCapabilities(caps_)
    .forBrowser(forBrowser)
    .build();

  await driver.get("https://web.whatsapp.com/"); // return null

  await driver.wait(
    until.elementLocated(By.id(elementsSelectores.whatsappSideBar)),
    100000,
    "initial-program-start-working",
    5000
  );

  //=======================================
  /*checking if this user is valid to send messages */
  //=======================================

  let updateCurrentGroup = { ...currentGroup, currentGroupIndex: 0 };
  await User.findByIdAndUpdate(
    { _id: userId },
    {
      $set: {
        currentGroup: updateCurrentGroup,
      },
    }
  );

  const startPoint = elementsSelectores.starterIndex;

  for (let i = startPoint; i < currentGroup.contacts.length; i++) {
    updateCurrentGroup.currentGroupIndex = i;
    await User.findByIdAndUpdate(
      { _id: userId },
      {
        $set: {
          currentGroup: updateCurrentGroup,
        },
      }
    );

    const currentUser = await User.findById({ _id: userId });
    let newMessage = "";
    let sendButton = null;
    let messageInput = null;
    const actions = driver.actions({ async: true });
    try {
      await driver.get(
        `https://web.whatsapp.com/send?phone=${currentGroup.contacts[i].phoneNumber}`
      );

      await driver.wait(
        until.elementLocated(By.id(elementsSelectores.whatsappSideBar)),
        100000,
        "initial-program-start-working",
        5000
      );

      for (
        let messageIndex = 0;
        messageIndex < currentMessage.contentMessage.length;
        messageIndex++
      ) {
        let contactFirstName = currentGroup.contacts[i].contactProfile
          .contactFirstName
          ? currentGroup.contacts[i].contactProfile.contactFirstName
          : "";
        newMessage = insertNameToMessage(
          currentMessage.contentMessage[messageIndex].contentField,
          contactFirstName
        );
        if (
          !currentMessage.contentMessage[messageIndex].mediaSrc &&
          !currentMessage.contentMessage[messageIndex].contentField
        ) {
          continue;
        }

        let messageFormat = "";
        for (let char of newMessage) {
          if (char === "\n") {
            char = `${Key.SHIFT + Key.ENTER}`;
          }

          messageFormat += char;
        }

        await driver.executeScript(
          `const inputs = document.getElementsByClassName('${elementsSelectores.messageInput}'); inputs[1].innerText = '${messageFormat}';`
        );

        do {
          messageInput = await driver.wait(
            until.elementsLocated(
              By.className(elementsSelectores.messageInput)
            ),
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
            const inputFile = await driver.wait(
              until.elementLocated(By.css(elementsSelectores.inputFile)),
              10000
            );
            await inputFile.sendKeys(mediaSrc);
            sendButton = await driver.wait(
              until.elementsLocated(
                By.className(elementsSelectores.sendButtonWidthMedia)
              ),
              10000
            );
          } else {
            sendButton = await driver.findElements(
              By.className(elementsSelectores.sendButton)
            );
          }
        } while (!sendButton[0]);

        await sendButton[0].click();

        let sandTimer = null;

        do {
          await driver.sleep(1000);
          sandTimer = await driver.findElements(
            By.css(elementsSelectores.sandClock)
          );
          console.log("sandTimer:", sandTimer);
        } while (sandTimer[0]);
        await driver.sleep(1000);
      }

      let sendedToArcive = [];
      let counter = 0;
      while (!sendedToArcive.length && counter < 2) {
        const findChatInputs = await driver.wait(
          until.elementsLocated(By.className(elementsSelectores.messageInput)),
          10000,
          "catch array of inputs",
          3000
        );

        await findChatInputs[0].sendKeys(
          currentGroup.contacts[i].phoneNumber,
          Key.ENTER
        );

        const contactBox = await driver.findElements(
          By.className(elementsSelectores.contactBox)
        );

        if (contactBox.length) {
          await actions.contextClick(contactBox[0]).perform();

          const contactMenu = await driver.wait(
            until.elementsLocated(By.className(elementsSelectores.contactMenu)),
            10000,
            "send contact box to the archive"
          );
          await contactMenu[0].click();
          await driver.sleep(500);
          sendedToArcive = await driver.findElements(
            By.className(elementsSelectores.sendedToArcive)
          );
          await driver.sleep(1000);
        } else {
          await driver.sleep(1000);
          counter++;
        }
      }

      let time = new Date();
      let year = time.getFullYear();
      let month = time.getMonth() + 1;
      let day = time.getDate();
      let hour = time.getHours();
      let min = time.getMinutes();
      const currentDate = `${day}/${month}/${year} ${hour}:${min}`;
      const newHistoryItem = {
        messageName: currentMessage.messageName,
        contentMessage: currentMessage.contentMessage,
        groupName: currentGroup.groupName,
        sendDate: currentDate,
      };
      await User.findByIdAndUpdate(
        { _id: userId },
        {
          $set: {
            history: [newHistoryItem, ...currentUser.history],
          },
        }
      );
    } catch (err) {
      console.log("err.message:", err.message);
      if (err.message.includes("initial-program-start-working")) {
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
        const body = await driver.wait(
          until.elementLocated(By.tagName("body")),
          3000
        );
        body.sendKeys(Key.ENTER);
      }

      if (err.message.includes("Message-Input")) {
        continue;
      }
    }
  }
  await driver.quit();
});
