import fs from "fs";
import * as xlsx from "xlsx";

export const readExistingData = (
  filePath: string
): Record<string, string[][]> => {
  const dataByBrand: Record<string, string[][]> = {};

  if (fs.existsSync(filePath)) {
    const workbook = xlsx.readFile(filePath);
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      dataByBrand[sheetName] = data;
    });
  }

  return dataByBrand;
};

export const readExistingLinks = (filePath: string): Set<string> => {
  const existingLinks = new Set<string>();

  if (fs.existsSync(filePath)) {
    const workbook = xlsx.readFile(filePath);
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      data.forEach((row) => {
        const linkCell = row.find((cell) => cell === "Link");
        if (linkCell) {
          const linkIndex = row.indexOf(linkCell) + 1;
          const link = row[linkIndex];
          if (link) {
            existingLinks.add(link);
          }
        }
      });
    });
  }

  return existingLinks;
};

export const saveFileExcel = (
  dataByBrand: Record<string, string[][]>,
  fileName: string
): void => {
  const wb: xlsx.WorkBook = xlsx.utils.book_new();

  for (const [brand, data] of Object.entries(dataByBrand)) {
    const ws: xlsx.WorkSheet = xlsx.utils.aoa_to_sheet(data);

    // Reset STT for each brand
    let stt = 1;
    data.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell === "STT") {
          const cellAddress = xlsx.utils.encode_cell({
            r: rowIndex,
            c: colIndex + 1,
          });
          ws[cellAddress].v = stt.toString();
          stt++;
        }
      });
    });

    xlsx.utils.book_append_sheet(wb, ws, brand);
  }

  // Remove existing Summary sheet if it exists
  if (wb.SheetNames.includes("Summary")) {
    delete wb.Sheets["Summary"];
    wb.SheetNames = wb.SheetNames.filter((name) => name !== "Summary");
  }

  // Remove existing Sheet1 if it exists
  if (wb.SheetNames.includes("Sheet1")) {
    delete wb.Sheets["Sheet1"];
    wb.SheetNames = wb.SheetNames.filter((name) => name !== "Sheet1");
  }

  // Create summary sheet
  const totalProducts = Object.values(dataByBrand).flat().length;
  const summaryData = [["Brand", "Product Count"]];
  for (const [brand, data] of Object.entries(dataByBrand)) {
    const productCount = data.filter((row) => row.includes("Product")).length;
    summaryData.push([brand, productCount.toString()]);
  }
  summaryData.push(["Total Brand", Object.keys(dataByBrand).length.toString()]);
  summaryData.push(["Total Product", totalProducts.toString()]);

  const summarySheet = xlsx.utils.aoa_to_sheet(summaryData);
  xlsx.utils.book_append_sheet(wb, summarySheet, "Summary");

  xlsx.writeFile(wb, fileName);
  console.log("File saved:", fileName);
};
