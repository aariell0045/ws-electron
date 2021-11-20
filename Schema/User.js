const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
	userName: { type: String },
	password: { type: String },
	validPhones: [],
	messagesStatus: { type: Number },
	groups: [],
	tasks: [],
	events: [],
	messages: [],
	history: [
		{
			messageName: String,
			contentMessage: [
				{
					contentField: String,
					mediaSrc: String,
				},
			],
			groupName: String,
			sendDate: String,
			startPoint: Number,
			currentPoint: Number,
		},
	],
});

const User = mongoose.model("users", userSchema);
module.exports = User;
