import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    text: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const chatSchema = new mongoose.Schema(
  {
    // User who owns this chat
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",//This ObjectId refers to a document from the User model.
      required: true,
    },
    //Create a field called user. It stores the MongoDB ID of a User, and this field is mandatory.

    title: {
      type: String,
      default: "New Chat",
    },

    messages: {
      type: [messageSchema],
      default: [],
    },

    documentId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
//LOGIN
 // ↓
//JWT contains userId
//  ↓
//protect()
//  ↓
//req.userId
//  ↓
//Chat.create({
//    user: req.userId
//  })
//  ↓
//MongoDB
//"Give me only the chats belonging to this logged-in user."