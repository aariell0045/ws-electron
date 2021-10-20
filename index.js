const electron = require("electron");
const { app, BrowserWindow } = electron;
const { ipcMain, ipcRenderer } = require("electron");
const mongoose = require("mongoose");
const User = require("./Schema/User");
require("chromedriver").path;
const { Builder, By, Key, until, Capabilities } = require("selenium-webdriver");
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
  console.log("this is the message:", message);
  console.log("this is the name:", name);
  message = message.replaceAll(`( שם פרטי )`, name);
  return message;
}

ipcMain.on("start", async (event, item) => {
  const { caps, forBrowser, userId } = item.elementsSelectores;

  const { currentMessage, currentGroup, elementsSelectores } = item;
  console.log(currentGroup);
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
        newMessage = insertNameToMessage(
          currentMessage.contentMessage[messageIndex].contentField,
          currentGroup.contacts[i].contactProfile.contactFirstName
            ? currentGroup.contacts[i].contactProfile.contactFirstName
            : ""
        );
      }

      // currentMessage.contentMessage[0].contentField;

      for (
        let messageIndex = 0;
        messageIndex < currentMessage.contentMessage.length;
        messageIndex++
      ) {
        try {
          let messageFormat = "";
          for (let char of newMessage) {
            if (char === "\n") {
              char = `${Key.SHIFT + Key.ENTER}`;
            }
            messageFormat += char;
          }
          const messageInput = await driver.wait(
            until.elementsLocated(By.className("p3_M1")),
            10000,
            "MessageInput",
            2000
          );

          do {
            await messageInput[0].sendKeys(messageFormat);
            sendButton = await driver.findElements(By.className("_4sWnG"));
          } while (!sendButton[0]);

          await sendButton[0].click();

          let sandTimer = null;

          do {
            sandTimer = await driver.findElements(
              By.css(elementsSelectores.sandClock)
            );

            await driver.sleep(1000);
          } while (sandTimer[0]);
        } catch (err) {
          console.log(err);
        }
      }
      let sendedToArcive = null;

      while (!sendedToArcive) {
        const findChatInputs = await driver.wait(
          until.elementsLocated(By.className("_13NKt")),
          10000,
          "catch array of inputs",
          3000
        );

        await findChatInputs[0].sendKeys(
          currentGroup.contacts[i].phoneNumber,
          Key.ENTER
        );

        const contactBox = await driver.wait(
          until.elementsLocated(By.className("_2_TVt")),
          10000,
          "find contact box that on focos"
        );

        await actions.contextClick(contactBox[0]).perform();

        await driver.sleep(1000);
        const contactMenu = await driver.wait(
          until.elementsLocated(By.className("_2oldI")),
          10000,
          "send contact box to the archive"
        );
        await contactMenu[0].click();
        await driver.sleep(500);
        sendedToArcive = await driver.findElements(By.className("_1Ftww"));
        await driver.sleep(1000);
      }

      let time = new Date();
      let year = time.getFullYear();
      let month = time.getMonth();
      let day = time.getDate() + 1;
      const currentDate = `${year}/${month}/${day}`;
      const newHistoryItem = {
        messageName: currentMessage.messageName,
        groupName: currentGroup.groupName,
        sendDate: currentDate,
      };
      await User.findByIdAndUpdate(
        { _id: userId },
        {
          $set: {
            history: [...currentUser.history, newHistoryItem],
          },
        }
      );
    } catch (err) {
      console.log(err.message);
      if (err.message.includes("initial-program-start-working")) {
        console.log("initial-program-start-working");
        i--;
      }
    }
  }
  await driver.quit();
});
