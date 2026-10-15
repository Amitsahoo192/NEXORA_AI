import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";
import { analyzeResume } from "../../tools/app.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post(
  "/analyze",
  protect,
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Resume PDF is required",
        });
      }

      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({
          message: "Only PDF files are supported",
        });
      }

      console.log(
        "Resume received:",
        req.file.originalname
      );

      const { PDFParse } = await import("pdf-parse");

      const parser = new PDFParse({
        data: req.file.buffer,
      });

      const pdfData = await parser.getText();

      await parser.destroy();

      const resumeText = pdfData.text;

      if (!resumeText.trim()) {
        return res.status(400).json({
          message:
            "Could not extract text from the PDF",
        });
      }

      console.log(
        "Resume text extracted successfully"
      );

      const analysis =
        await analyzeResume(resumeText);

      res.json({
        message: "Resume analyzed successfully",
        fileName: req.file.originalname,
        analysis,
      });
    } catch (error) {
      console.error(
        "RESUME ANALYSIS ERROR:",
        error
      );

      res.status(500).json({
        message: "Failed to analyze resume",
      });
    }
  }
);

export default router;