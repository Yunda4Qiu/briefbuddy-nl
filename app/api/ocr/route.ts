type AzureAnalyzeResponse = {
  status?: "notStarted" | "running" | "succeeded" | "failed" | "canceled";
  analyzeResult?: {
    content?: string;
    pages?: {
      pageNumber?: number;
      lines?: {
        content?: string;
      }[];
    }[];
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export const runtime = "nodejs";

const API_VERSION = "2024-11-30";
const MODEL_ID = "prebuilt-layout";
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, "");
}

function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function isSupportedFile(file: File) {
  const supportedMimeTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/bmp",
    "image/tiff",
    "image/heif",
    "image/heic",
    "image/webp",
  ]);

  const supportedExtensions = new Set([
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "bmp",
    "tif",
    "tiff",
    "heif",
    "heic",
    "webp",
  ]);

  return (
    supportedMimeTypes.has(file.type) ||
    supportedExtensions.has(getFileExtension(file.name))
  );
}

function getContentType(file: File) {
  if (file.type) return file.type;

  const extension = getFileExtension(file.name);

  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "bmp") return "image/bmp";
  if (extension === "tif" || extension === "tiff") return "image/tiff";
  if (extension === "heif") return "image/heif";
  if (extension === "heic") return "image/heic";
  if (extension === "webp") return "image/webp";

  return "application/octet-stream";
}

function extractTextFromAnalyzeResult(data: AzureAnalyzeResponse) {
  const content = data.analyzeResult?.content?.trim();

  if (content) return content;

  const pageText =
    data.analyzeResult?.pages
      ?.map((page) =>
        page.lines
          ?.map((line) => line.content || "")
          .filter(Boolean)
          .join("\n")
      )
      .filter(Boolean)
      .join("\n\n") || "";

  return pageText.trim();
}

function getAzureErrorMessage(data: AzureAnalyzeResponse) {
  if (data.error?.message) return data.error.message;
  if (data.error?.code) return data.error.code;
  return "Azure Document Intelligence failed to analyze the document.";
}

export async function POST(req: Request) {
  try {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

    if (!endpoint || !key) {
      return Response.json(
        {
          error:
            "Missing AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or AZURE_DOCUMENT_INTELLIGENCE_KEY in environment variables.",
        },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Please upload an image or PDF file." },
        { status: 400 }
      );
    }

    if (!isSupportedFile(file)) {
      return Response.json(
        {
          error:
            "Unsupported file type. Please upload a PDF or image file such as JPG, PNG, WEBP, HEIC, or TIFF.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        {
          error: `File is too large. Please upload a file smaller than ${MAX_FILE_SIZE_MB} MB.`,
        },
        { status: 400 }
      );
    }

    const normalizedEndpoint = normalizeEndpoint(endpoint);

    const analyzeUrl = `${normalizedEndpoint}/documentintelligence/documentModels/${MODEL_ID}:analyze?api-version=${API_VERSION}&outputContentFormat=text`;

    const fileBuffer = await file.arrayBuffer();

    const analyzeResponse = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": getContentType(file),
      },
      body: fileBuffer,
    });

    if (analyzeResponse.status !== 202) {
      let errorMessage = "Azure Document Intelligence request failed.";

      try {
        const errorData = (await analyzeResponse.json()) as AzureAnalyzeResponse;
        errorMessage = getAzureErrorMessage(errorData);
      } catch {
        const errorText = await analyzeResponse.text();
        if (errorText) errorMessage = errorText;
      }

      return Response.json(
        { error: errorMessage },
        { status: analyzeResponse.status }
      );
    }

    const operationLocation = analyzeResponse.headers.get("operation-location");

    if (!operationLocation) {
      return Response.json(
        {
          error:
            "Azure did not return an operation-location header for polling the OCR result.",
        },
        { status: 500 }
      );
    }

    let finalResult: AzureAnalyzeResponse | null = null;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const resultResponse = await fetch(operationLocation, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
        },
      });

      const resultData = (await resultResponse.json()) as AzureAnalyzeResponse;

      if (!resultResponse.ok) {
        return Response.json(
          { error: getAzureErrorMessage(resultData) },
          { status: resultResponse.status }
        );
      }

      if (resultData.status === "succeeded") {
        finalResult = resultData;
        break;
      }

      if (resultData.status === "failed" || resultData.status === "canceled") {
        return Response.json(
          { error: getAzureErrorMessage(resultData) },
          { status: 422 }
        );
      }
    }

    if (!finalResult) {
      return Response.json(
        {
          error:
            "OCR timed out. Try a smaller image/PDF or a clearer document.",
        },
        { status: 504 }
      );
    }

    const extractedText = extractTextFromAnalyzeResult(finalResult);

    if (!extractedText) {
      return Response.json(
        {
          error:
            "No text could be extracted. Try a clearer, well-lit photo or a higher-quality PDF.",
        },
        { status: 422 }
      );
    }

    return Response.json({
      text: extractedText,
      source: "azure-document-intelligence",
      fileType: file.type || getFileExtension(file.name),
      fileName: file.name,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          "Something went wrong while extracting text from the image or PDF.",
      },
      { status: 500 }
    );
  }
}