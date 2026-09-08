import jsPDF from "jspdf";
// LA-UX-REFRESH-002 G1 — html2canvas-pro, not html2canvas.
//
// This project is on Tailwind CSS v4, whose palette is emitted in the
// oklch() color space (109 occurrences in the built stylesheet).
// html2canvas@1.4.1 (unreleased since 2022) cannot parse oklch/oklab/lab/
// color-mix and throws "Attempting to parse an unsupported color function"
// as soon as it walks a styled node — which is why every PDF button in the
// app silently failed, and why the scorecard share reported "couldn't create
// the image". html2canvas-pro is the maintained fork of the same codebase
// with support for those color functions; the API is identical, so this is
// an import swap, not a rewrite.
import html2canvas from "html2canvas-pro";

export async function exportAnalyticsPdf(elementId: string, filename = "Lumen_Academy_Analytics_Report.pdf"): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found.`);
  }

  // Hide elements with 'print:hidden' class temporarily if needed or pass ignoreElements
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    ignoreElements: (el) => {
      return el.classList.contains("print:hidden") || el.getAttribute("data-pdf-ignore") === "true";
    }
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  // First page
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  // Multi-page handling if content overflows A4
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(filename);
}
