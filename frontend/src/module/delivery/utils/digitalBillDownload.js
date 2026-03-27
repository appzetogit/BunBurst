import { API_BASE_URL, deliveryAPI } from "@/lib/api";

const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, "");

function buildAbsoluteBillUrl(billUrl) {
  if (!billUrl) return "";
  if (/^https?:\/\//i.test(billUrl)) return billUrl;
  return `${API_ROOT_URL}${billUrl.startsWith("/") ? billUrl : `/${billUrl}`}`;
}

function buildBillFileName(orderId, billUrl) {
  const urlTail = (billUrl || "").split("/").pop() || "";
  const normalizedOrderId = String(orderId || "order").trim() || "order";

  if (urlTail.toLowerCase().endsWith(".pdf")) {
    return urlTail;
  }

  return `Bill-${normalizedOrderId}.pdf`;
}

function triggerLinkDownload(href, fileName, target = "") {
  const link = document.createElement("a");
  link.href = href;
  if (fileName) {
    link.download = fileName;
  }
  if (target) {
    link.target = target;
    link.rel = "noopener noreferrer";
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function getDeliveryBillMeta(orderId) {
  const response = await deliveryAPI.getOrderBill(orderId);
  const billUrl = response.data?.data?.billUrl || response.data?.billUrl;

  if (!billUrl) {
    throw new Error("Bill URL not received");
  }

  return {
    billUrl,
    fullUrl: buildAbsoluteBillUrl(billUrl),
    fileName: buildBillFileName(orderId, billUrl),
  };
}

export async function openDeliveryBill(orderId) {
  const { fullUrl } = await getDeliveryBillMeta(orderId);
  triggerLinkDownload(fullUrl, "", "_blank");
  return { fullUrl };
}

export async function downloadDeliveryBill(orderId) {
  const { fullUrl, fileName } = await getDeliveryBillMeta(orderId);

  try {
    const response = await fetch(fullUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bill file: ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    try {
      triggerLinkDownload(objectUrl, fileName);
    } finally {
      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 1000);
    }

    return {
      fileName,
      fullUrl,
      usedFallback: false,
    };
  } catch (error) {
    triggerLinkDownload(fullUrl, fileName, "_blank");
    return {
      fileName,
      fullUrl,
      usedFallback: true,
    };
  }
}
