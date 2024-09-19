import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import {
  readExistingData,
  readExistingLinks,
  saveFileExcel,
} from "./file/save-file";

const TIMEOUT = 5000; // in milliseconds
const FILE_PATH = "./file-local/merged_data.xlsx";

async function fetchHrefs(url: string): Promise<string[]> {
  try {
    const { data } = await axios.get(url, { timeout: TIMEOUT });
    const $ = cheerio.load(data);
    return $("a.image_thumb")
      .map((_, element) => $(element).attr("href"))
      .get()
      .filter((href): href is string => !!href);
  } catch (error) {
    console.error("Error fetching data:", url, error.message);
    return [];
  }
}

async function fetchElementContent(
  url: string,
  index: number
): Promise<{ brand: string; data: string[][] } | null> {
  try {
    const { data } = await axios.get(url, { timeout: TIMEOUT });
    const $ = cheerio.load(data);
    const content = $(`#tab_thong_so tbody tr`);
    const title = $(`.breadcrumb`).find("li").last().text().trim();
    const brand = $(`.inventory_quantity .a-vendor`).text().trim();
    const price = $(`.price-box .bk-product-price`)
      .text()
      .trim()
      .replace(/[.\\₫]/g, "");
    const priceOld = $(`.price-box .product-price-old`)
      .text()
      .trim()
      .replace(/[.\\₫]/g, "");

    if (content.length === 0) {
      console.error(`--- Not data ${url}`);
      return null;
    } else {
      console.log(`Fetched ${url}`);
    }

    let indexData = 1;
    const dataInfo = [
      ["", "STT", index.toString()],
      [(indexData++).toString(), "Link", url],
      [(indexData++).toString(), "Brand", brand],
      [(indexData++).toString(), "Product", title],
      [(indexData++).toString(), "Price", price],
      [(indexData++).toString(), "List price", priceOld],
    ];
    const tableData: string[][] = content
      .map((_, element) => [
        [
          (indexData++).toString(), // Just to make the array unique
          $(element).find("td").first().text().trim().replace(":", ""),
          $(element).find("td").last().text().trim().replace(",", ";"),
        ],
      ])
      .get();

    const combinedData = [...dataInfo, ...tableData];
    return { brand, data: combinedData };
  } catch (error) {
    console.error("??? Error fetching data:", url, error.message);
    return null;
  }
}

export const initCrawler = async (): Promise<void> => {
  const dataByBrand: Record<string, string[][]> = {};
  let indexLink = 0;

  const existingLinks = readExistingLinks(FILE_PATH);
  const existingData = readExistingData(FILE_PATH);

  console.log("Existing links:", existingLinks.size);

  const fetchLinks = async (page: number) => {
    return await fetchHrefs(
      `https://shopvnb.com/vot-cau-long.html?page=${page}`
    );
  };

  const fetchData = async (link: string) => {
    if (existingLinks.has(link)) {
      console.log(`Skipping existing link: ${link}`);
      return null;
    }
    return await fetchElementContent(
      `https://shopvnb.com/${link}`,
      indexLink++
    );
  };

  const pages = new Array(30).fill(0).map((_, index) => index + 1);
  const links = (await Promise.all(pages.map(fetchLinks))).flat();

  const dataPromises = links.map(fetchData);
  const dataResults = await Promise.all(dataPromises);

  dataResults.forEach((result) => {
    if (result) {
      const { brand, data } = result;
      if (!dataByBrand[brand]) {
        dataByBrand[brand] = [];
      }
      dataByBrand[brand].push(...data);
      dataByBrand[brand].push([]); // Add an empty row after each data set
    }
  });

  // Merge existing data with new data
  for (const [brand, data] of Object.entries(existingData)) {
    if (!dataByBrand[brand]) {
      dataByBrand[brand] = [];
    }
    dataByBrand[brand].unshift(...data);
  }

  saveFileExcel(dataByBrand, FILE_PATH);

  // save json
  const json = JSON.stringify(dataByBrand);
  fs.writeFile("./file-local/data.json", json, "utf8", () => {
    console.log("File json saved");
  });
};
