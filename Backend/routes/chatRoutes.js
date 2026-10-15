import express from "express";

import Chat from "../models/Chat.js";
import { protect } from "../middleware/auth.js";
import { generate } from "../../tools/app.js";

const router = express.Router();


// ===============================
// CREATE / UPDATE CHAT
// ===============================

router.post("/", protect, async (req, res) => {
  try {
    const {
      chatId,
      messages,
      documentId,
    } = req.body;

    if (!messages || messages.length === 0) {
      return res.status(400).json({
        message: "Messages are required",
      });
    }

    // Convert frontend messages to Groq format
    const formattedMessages = messages.map(
      (message) => ({
        role:
          message.sender === "user"
            ? "user"
            : "assistant",

        content: message.text,
      })
    );

    // Generate AI response
    const result = await generate(
      formattedMessages,
      documentId
    );

    const updatedMessages = [
      ...messages,
      {
        sender: "assistant",
        text: result,
      },
    ];

    let chat;

    // Existing chat
    if (chatId) {
      chat = await Chat.findOne({
        _id: chatId,
        user: req.userId,
      });

      if (chat) {
        chat.messages = updatedMessages;
        chat.documentId = documentId || null;

        await chat.save();
      }
    }

    // New chat
    if (!chat) {
      const firstUserMessage =
        updatedMessages.find(
          (message) =>
            message.sender === "user"
        )?.text || "New Chat";

      chat = await Chat.create({
        user: req.userId,

        title:
          firstUserMessage.length > 40
            ? firstUserMessage.substring(0, 40) + "..."
            : firstUserMessage,

        messages: updatedMessages,

        documentId:
          documentId || null,
      });
    }

    res.json({
      message: result,
      chatId: chat._id,
    });

  } catch (error) {
    console.error(
      "CHAT ERROR:",
      error
    );

    res.status(500).json({
      message: "Something went wrong",
    });
  }
});


// ===============================
// GET USER'S CHATS
// ===============================

router.get("/", protect, async (req, res) => {
  try {
    const chats = await Chat.find({
      user: req.userId,
    }).sort({
      updatedAt: -1,
    });
    res.json(chats);
  } catch (error) {
    console.error(
      "GET CHATS ERROR:",
      error
    );
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});


// ===============================
// DELETE CHAT
// ===============================

router.delete(
  "/:chatId",
  protect,
  async (req, res) => {
    try {
      const { chatId } = req.params;

      const deletedChat =
        await Chat.findOneAndDelete({
          _id: chatId,
          user: req.userId,
        });
      if (!deletedChat) {
        return res.status(404).json({
          message: "Chat not found",
        });
      }
      res.json({
        message:
          "Chat deleted successfully",
      });

    } catch (error) {
      console.error(
        "DELETE CHAT ERROR:",
        error
      );

      res.status(500).json({
        message: "Something went wrong",
      });
    }
  }
);


export default router;