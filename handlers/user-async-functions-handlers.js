const User = require("../Schema/User");

const updateUserHistory = async (history, userId) => {
  await User.findByIdAndUpdate(
    { _id: userId },
    {
      $set: {
        history: history,
      },
    }
  );
};

const pushToUserHistory = async (newHistory, userId) => {
  await User.findByIdAndUpdate(
    { _id: userId },
    {
      $push: {
        history: newHistory,
      },
    }
  );
};

const updateMessagesStatus = async (userId) => {
  await User.findByIdAndUpdate(
    { _id: userId },
    {
      $inc: {
        messagesStatus: -1,
      },
    }
  );
};

const getUser = async (userId) => {
  const currentUser = await User.findById({ _id: userId });
  return currentUser;
};

module.exports = {
  updateUserHistory,
  pushToUserHistory,
  getUser,
  updateMessagesStatus,
};
