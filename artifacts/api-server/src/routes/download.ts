import { Router, type Request, type Response } from "express";
import fs from "fs";
import { getPdfOutputPath } from "../lib/generateManualPdf";

const router = Router();

router.get("/download/manual", (_req: Request, res: Response) => {
  const PDF_OUTPUT_PATH = getPdfOutputPath();
  if (!fs.existsSync(PDF_OUTPUT_PATH)) {
    res.status(503).json({ error: "PDF 文件尚未生成，请稍后再试" });
    return;
  }

  const stat = fs.statSync(PDF_OUTPUT_PATH);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=\"OPC-manual.pdf\"; filename*=UTF-8''OPC%E6%93%8D%E4%BD%9C%E6%89%8B%E5%86%8C.pdf",
  );
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Cache-Control", "public, max-age=3600");

  const stream = fs.createReadStream(PDF_OUTPUT_PATH);
  stream.pipe(res);
});

export default router;
