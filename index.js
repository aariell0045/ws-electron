const electron = require("electron");
const { app, BrowserWindow } = electron;
const { ipcMain, ipcRenderer } = require("electron");
const { Builder, By, Key, until, Capabilities } = require("selenium-webdriver");
require("chromedriver").path;
const mongoose = require("mongoose");
const User = require("./Schema/User");
const { insertNameToMessage } = require("./handlers/message-handlers");

const path = require("path");
const {
  updateUserHistory,
} = require("./handlers/user-async-functions-handlers");
const { createFullDateWidthCurrentTime } = require("./handlers/date-handlers");
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
  const endPoint = elementsSelectores.endIndex;
  const currentUser = await getUser(userId);
  const currentDate = createFullDateWidthCurrentTime();
  const newHistory = {
    messageName: currentMessage.messageName,
    contentMessage: currentMessage.contentMessage,
    groupName: currentGroup.groupName,
    sendDate: currentDate,
    startPoint: +startPoint,
    currentPoint: +startPoint,
  };

  await User.findByIdAndUpdate(
    { _id: userId },
    {
      $push: {
        history: newHistory,
      },
    }
  );
  console.log(startPoint, endPoint);
  for (let i = +startPoint; i < +endPoint; i++) {
    const DRIVER_GET_URL = (updateCurrentGroup.currentGroupIndex = i);
    await User.findByIdAndUpdate(
      { _id: userId },
      {
        $set: {
          currentGroup: updateCurrentGroup,
        },
      }
    );

    const newHistory = {
      messageName: currentMessage.messageName,
      contentMessage: currentMessage.contentMessage,
      groupName: currentGroup.groupName,
      sendDate: currentDate,
      startPoint: +startPoint,
      currentPoint: i + 1,
    };
    currentUser.history[currentUser.history.length - 1] = newHistory;

    updateUserHistory(currentUser.history);

    let newMessage = "";
    let sendButton = null;
    let messageInput = null;
    const actions = driver.actions({ async: true });
    try {
      await driver.get();

      await driver.wait(
        until.elementLocated(By.id(elementsSelectores.whatsappSideBar)),
        1000000,
        "initial-program-start-working"
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
            char = `\\n`;
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
      let updateCurrentGroup = {
        ...currentUser.currentGroup,
        currentGroupIndex: i,
      };
      let newCurrentGroup = updateCurrentGroup;
      console.log(updateCurrentGroup);
      await User.findByIdAndUpdate(
        { _id: userId },
        {
          $set: {
            currentGroup: newCurrentGroup,
          },
        }
      );
      await User.findByIdAndUpdate(
        { _id: userId },
        {
          $inc: {
            messagesStatus: -1,
          },
        }
      );

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
    } catch (err) {
      console.log("err.message:", err.message);
      if (err.message.includes("(setting 'innerText')")) {
        i--;
        console.log("Error : innerText");
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
