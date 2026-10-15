import express from "express";
import cors from "cors";
import multer from "multer";
import cloudinary from "./config/cloudinary.js";
import { connectDB } from "./db.js";
import { processDocument } from "../RAG/index.js";
import { randomUUID } from "crypto";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { protect } from "./middleware/auth.js";
import resumeRoutes from "./routes/resumeRoutes.js";
const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
});

connectDB();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/resume", resumeRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to ChatBot!");
});

app.post(
  "/upload-document",protect,
  upload.single("document"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Document is required",
        });
      }

      const documentId = randomUUID();

      console.log(
        "Uploading:",
        req.file.originalname
      );

      // Upload PDF to Cloudinary
      const result = await new Promise(
        (resolve, reject) => {

          const stream =
            cloudinary.uploader.upload_stream(
              {
                resource_type: "raw",
                folder: "nexora/documents",
              },

              (error, result) => {

                if (error) {
                  reject(error);
                } else {
                  resolve(result);
                }

              }
            );

          stream.end(req.file.buffer);
        }
      );

      console.log(
        "Cloudinary upload successful!"
      );

      console.log(
        "URL:",
        result.secure_url
      );


      // Process PDF and store it in Pinecone
      const ragResult =
        await processDocument(
          req.file.buffer,
          req.file.originalname,
          documentId
        );

      console.log(
        "PDF indexed successfully!"
      );


      res.json({
        message:
          "Document uploaded and indexed successfully",

        fileName:
          req.file.originalname,

        url:
          result.secure_url,

        publicId:
          result.public_id,

        documentId:
          documentId,

        pages:
          ragResult.pages,

        chunks:
          ragResult.chunks,
      });

    } catch (error) {

      console.error(
        "UPLOAD ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Failed to upload document",
      });

    }
  }
);


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Server is running on port ${PORT}`
  );
});