const insertNameToMessage = (message, name) => {
  message = message.replaceAll(`( שם פרטי )`, name);
  return message;
};

const messageFormater = (message) => {
  let newMessage = "";
  for (let char of message) {
    if (char === "\n") {
      char = `\\n`;
    }
    newMessage += char;
  }
  return newMessage;
};

module.exports = { insertNameToMessage, messageFormater };
