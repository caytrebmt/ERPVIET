export function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Generates standardized ERP voucher codes:
 * - PN-YYMMDD-001 (Stock In)
 * - PX-YYMMDD-001 (Stock Out)
 * - BG-YYMMDD-01 (Quotation)
 * - WEB-YYMMDD-001 (Web Order)
 */
export function generateERPCode(
  prefix: "PN" | "PX" | "BG" | "WEB",
  index: number = 1,
  dateInput: Date | string = new Date()
): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateStr = `${yy}${mm}${dd}`;

  if (prefix === "BG") {
    const padIndex = String(index).padStart(2, "0");
    return `BG-${dateStr}-${padIndex}`;
  } else {
    const padIndex = String(index).padStart(3, "0");
    return `${prefix}-${dateStr}-${padIndex}`;
  }
}

/**
 * Smart SKU Generator
 * Creates intelligent SKUs like 'LAP-DELL-001' or 'GEAR-LOGI-005'
 */
export function generateSmartSKU(
  categoryCode: string = "SP",
  brandName: string = "GEN",
  productName: string = "",
  sequence: number = 1
): string {
  const cat = (categoryCode || "SP").trim().toUpperCase().slice(0, 4);
  const cleanBrand = brandName
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4) || "GEN";
  const seq = String(sequence).padStart(3, "0");

  if (productName) {
    const words = productName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    
    if (words.length >= 2) {
      const pAbbr = (words[0].slice(0, 2) + words[1].slice(0, 2)).toUpperCase();
      return `${cat}-${cleanBrand}-${pAbbr}${seq}`;
    }
  }

  return `${cat}-${cleanBrand}-${seq}`;
}

/**
 * Reads Vietnamese currency numbers in words
 * Example: 19800000 -> "Mười chín triệu tám trăm nghìn đồng chẵn."
 */
export function readVietnameseNumber(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "Không đồng";
  }

  const roundedAmount = Math.round(Math.abs(amount));
  if (roundedAmount === 0) {
    return "Không đồng";
  }

  const defaultNumbers = [
    "không",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
  ];

  function readThreeDigits(threeDigits: number, showZeroHundred: boolean): string {
    let hundred = Math.floor(threeDigits / 100);
    let ten = Math.floor((threeDigits % 100) / 10);
    let unit = threeDigits % 10;
    let result = "";

    if (hundred > 0 || showZeroHundred) {
      result += defaultNumbers[hundred] + " trăm ";
    }

    if (ten > 1) {
      result += defaultNumbers[ten] + " mươi ";
      if (unit === 1) {
        result += "mốt ";
      } else if (unit === 5) {
        result += "lăm ";
      } else if (unit > 0) {
        result += defaultNumbers[unit] + " ";
      }
    } else if (ten === 1) {
      result += "mười ";
      if (unit === 1) {
        result += "một ";
      } else if (unit === 5) {
        result += "lăm ";
      } else if (unit > 0) {
        result += defaultNumbers[unit] + " ";
      }
    } else if (ten === 0 && unit > 0) {
      if (hundred > 0 || showZeroHundred) {
        result += "lẻ ";
      }
      if (unit === 5 && (hundred > 0 || showZeroHundred)) {
        result += "năm ";
      } else {
        result += defaultNumbers[unit] + " ";
      }
    }

    return result;
  }

  const units = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
  let strAmount = roundedAmount.toString();
  let groups: number[] = [];

  while (strAmount.length > 0) {
    let len = strAmount.length;
    let take = len >= 3 ? 3 : len;
    let part = parseInt(strAmount.slice(len - take), 10);
    groups.push(part);
    strAmount = strAmount.slice(0, len - take);
  }

  let resultWords = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    let num = groups[i];
    if (num > 0) {
      let showZeroHundred = i < groups.length - 1;
      let partText = readThreeDigits(num, showZeroHundred);
      resultWords += partText + units[i] + " ";
    }
  }

  resultWords = resultWords.trim();
  if (!resultWords) return "Không đồng";

  // Capitalize first letter
  let capitalized = resultWords.charAt(0).toUpperCase() + resultWords.slice(1);
  return `${capitalized} đồng chẵn.`;
}
