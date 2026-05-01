import { z } from "zod";
import { getSlidesClient, getDriveClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";
import { extractFieldsDescription } from "./extract-fields.js";

const ef = z.string().optional().describe(extractFieldsDescription);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Execute a presentations.batchUpdate with one or more requests */
async function batchUpdatePresentation(
  presentationId: string,
  requests: Record<string, unknown>[],
) {
  const slides = getSlidesClient();
  const response = await slides.presentations.batchUpdate({
    presentationId,
    requestBody: { requests },
  });
  return response.data.replies ?? [];
}

/** Convert hex color (#RRGGBB) to Slides API RgbColor (0-1 floats) */
function hexToRgbColor(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.substring(0, 2), 16) / 255,
    green: parseInt(h.substring(2, 4), 16) / 255,
    blue: parseInt(h.substring(4, 6), 16) / 255,
  };
}

/** Convert points to EMU (English Metric Units). 1 pt = 12700 EMU */
function emuFromPt(pt: number): number {
  return Math.round(pt * 12700);
}

/** Generate a simple random objectId for new slide elements */
function generateObjectId(): string {
  return "obj_" + Math.random().toString(36).substring(2, 15);
}

// ── slides-get-presentation ────────────────────────────────────────────────

export const getSlidesPresentationSchema = z.object({
  presentationId: z.string().describe("The ID of the Google Slides presentation"),
  extractFields: ef,
});

export async function getSlidesPresentation(
  params: z.infer<typeof getSlidesPresentationSchema>,
) {
  const slides = getSlidesClient();
  const response = await slides.presentations.get({
    presentationId: params.presentationId,
  });

  const p = response.data;
  return {
    presentationId: p.presentationId,
    title: p.title,
    pageSize: p.pageSize,
    locale: p.locale,
    slidesCount: p.slides?.length ?? 0,
    slides: p.slides?.map((s) => ({
      objectId: s.objectId,
      pageElements: s.pageElements?.length ?? 0,
    })),
    masters: p.masters?.map((m) => ({
      objectId: m.objectId,
    })),
    layouts: p.layouts?.map((l) => ({
      objectId: l.objectId,
      layoutProperties: l.layoutProperties,
    })),
  };
}

// ── slides-create-presentation ─────────────────────────────────────────────

export const createPresentationSchema = z.object({
  title: z.string().describe("Title of the new presentation"),
  parentFolderId: z
    .string()
    .optional()
    .describe("Drive folder ID to create the presentation in. Default: root"),
});

export async function createPresentation(
  params: z.infer<typeof createPresentationSchema>,
) {
  assertWriteAllowed();
  const slides = getSlidesClient();

  const response = await slides.presentations.create({
    requestBody: { title: params.title },
  });

  const presentationId = response.data.presentationId!;

  // Move to parent folder if specified
  if (params.parentFolderId) {
    const drive = getDriveClient();
    await drive.files.update({
      fileId: presentationId,
      addParents: params.parentFolderId,
      removeParents: "root",
      supportsAllDrives: true,
    });
  }

  return {
    presentationId,
    title: response.data.title,
    slidesCount: response.data.slides?.length ?? 0,
  };
}

// ── slides-duplicate-presentation ──────────────────────────────────────────

export const duplicatePresentationSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation to duplicate"),
  name: z.string().optional().describe("Name for the duplicated presentation. Default: 'Copy of <original>'"),
  parentFolderId: z.string().optional().describe("Drive folder ID to place the copy in"),
});

export async function duplicatePresentation(
  params: z.infer<typeof duplicatePresentationSchema>,
) {
  assertWriteAllowed();
  const drive = getDriveClient();

  const response = await drive.files.copy({
    fileId: params.presentationId,
    requestBody: {
      name: params.name,
      parents: params.parentFolderId ? [params.parentFolderId] : undefined,
    },
    supportsAllDrives: true,
  });

  return {
    fileId: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
  };
}

// ── slides-get-slide ───────────────────────────────────────────────────────

export const getSlideSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectId: z.string().describe("The objectId of the slide to retrieve"),
});

export async function getSlide(
  params: z.infer<typeof getSlideSchema>,
) {
  const slides = getSlidesClient();
  const response = await slides.presentations.pages.get({
    presentationId: params.presentationId,
    pageObjectId: params.slideObjectId,
  });

  const page = response.data;
  return {
    objectId: page.objectId,
    pageType: page.pageType,
    pageElements: page.pageElements?.map((el) => ({
      objectId: el.objectId,
      size: el.size,
      transform: el.transform,
      shape: el.shape
        ? {
            shapeType: el.shape.shapeType,
            text: el.shape.text?.textElements?.map((te) => ({
              textRun: te.textRun
                ? { content: te.textRun.content, style: te.textRun.style }
                : undefined,
              paragraphMarker: te.paragraphMarker ? true : undefined,
            })),
          }
        : undefined,
      image: el.image
        ? { contentUrl: el.image.contentUrl, sourceUrl: el.image.sourceUrl }
        : undefined,
      table: el.table
        ? { rows: el.table.rows, columns: el.table.columns }
        : undefined,
      elementGroup: el.elementGroup ? { childrenCount: el.elementGroup.children?.length ?? 0 } : undefined,
    })),
    slideProperties: page.slideProperties,
  };
}

// ── slides-add-slide ───────────────────────────────────────────────────────

export const addSlideSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  insertionIndex: z.coerce
    .number()
    .optional()
    .describe("Zero-based index where to insert the slide. Default: end of presentation"),
  layoutId: z.string().optional().describe("The objectId of the layout to use for the new slide"),
  predefinedLayout: z
    .enum([
      "BLANK",
      "CAPTION_ONLY",
      "TITLE",
      "TITLE_AND_BODY",
      "TITLE_AND_TWO_COLUMNS",
      "TITLE_ONLY",
      "SECTION_HEADER",
      "SECTION_TITLE_AND_DESCRIPTION",
      "ONE_COLUMN_TEXT",
      "MAIN_POINT",
      "BIG_NUMBER",
    ])
    .optional()
    .describe("Predefined layout type. Used only when layoutId is not provided"),
});

export async function addSlide(
  params: z.infer<typeof addSlideSchema>,
) {
  assertWriteAllowed();

  const newSlideId = generateObjectId();
  const request: Record<string, unknown> = {
    createSlide: {
      objectId: newSlideId,
      insertionIndex: params.insertionIndex,
      slideLayoutReference: params.layoutId
        ? { layoutId: params.layoutId }
        : params.predefinedLayout
          ? { predefinedLayout: params.predefinedLayout }
          : { predefinedLayout: "BLANK" },
    },
  };

  const replies = await batchUpdatePresentation(params.presentationId, [request]);
  return {
    slideObjectId: replies[0]?.createSlide?.objectId ?? newSlideId,
  };
}

// ── slides-delete-slide ────────────────────────────────────────────────────

export const deleteSlideSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectId: z.string().describe("The objectId of the slide to delete"),
});

export async function deleteSlide(
  params: z.infer<typeof deleteSlideSchema>,
) {
  assertWriteAllowed();
  await batchUpdatePresentation(params.presentationId, [
    { deleteObject: { objectId: params.slideObjectId } },
  ]);
  return { deleted: params.slideObjectId };
}

// ── slides-move-slide ──────────────────────────────────────────────────────

export const moveSlideSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectIds: z.array(z.string()).describe("Array of slide objectIds to move (maintains relative order)"),
  insertionIndex: z.coerce.number().describe("Zero-based index where slides should be moved to"),
});

export async function moveSlide(
  params: z.infer<typeof moveSlideSchema>,
) {
  assertWriteAllowed();
  await batchUpdatePresentation(params.presentationId, [
    {
      updateSlidesPosition: {
        slideObjectIds: params.slideObjectIds,
        insertionIndex: params.insertionIndex,
      },
    },
  ]);
  return { moved: params.slideObjectIds, insertionIndex: params.insertionIndex };
}

// ── slides-duplicate-slide ─────────────────────────────────────────────────

export const duplicateSlideSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectId: z.string().describe("The objectId of the slide to duplicate"),
});

export async function duplicateSlide(
  params: z.infer<typeof duplicateSlideSchema>,
) {
  assertWriteAllowed();

  const newSlideId = generateObjectId();
  const replies = await batchUpdatePresentation(params.presentationId, [
    {
      duplicateObject: {
        objectId: params.slideObjectId,
        objectIds: { [params.slideObjectId]: newSlideId },
      },
    },
  ]);
  return {
    newSlideObjectId: replies[0]?.duplicateObject?.objectId ?? newSlideId,
  };
}

// ── slides-insert-text ─────────────────────────────────────────────────────

export const insertTextSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  objectId: z.string().describe("The objectId of the text box or shape to insert text into"),
  text: z.string().describe("The text to insert"),
  insertionIndex: z.coerce
    .number()
    .optional()
    .default(0)
    .describe("Character index to insert at. 0 = beginning. Default: 0"),
});

export async function insertText(
  params: z.infer<typeof insertTextSchema>,
) {
  assertWriteAllowed();
  await batchUpdatePresentation(params.presentationId, [
    {
      insertText: {
        objectId: params.objectId,
        text: params.text,
        insertionIndex: params.insertionIndex,
      },
    },
  ]);
  return { objectId: params.objectId, insertedText: params.text };
}

// ── slides-replace-text ────────────────────────────────────────────────────

export const replaceTextSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  findText: z.string().describe("The text to search for"),
  replaceText: z.string().describe("The text to replace matches with"),
  matchCase: z.boolean().optional().default(false).describe("Whether the search is case-sensitive. Default: false"),
  pageObjectIds: z
    .array(z.string())
    .optional()
    .describe("Limit replacement to specific slides by objectId. Default: all slides"),
});

export async function replaceAllText(
  params: z.infer<typeof replaceTextSchema>,
) {
  assertWriteAllowed();

  const request: Record<string, unknown> = {
    replaceAllText: {
      containsText: {
        text: params.findText,
        matchCase: params.matchCase,
      },
      replaceText: params.replaceText,
      pageObjectIds: params.pageObjectIds,
    },
  };

  const replies = await batchUpdatePresentation(params.presentationId, [request]);
  return {
    occurrencesChanged: replies[0]?.replaceAllText?.occurrencesChanged ?? 0,
  };
}

// ── slides-insert-text-box ─────────────────────────────────────────────────

export const insertTextBoxSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectId: z.string().describe("The objectId of the slide to add the text box to"),
  text: z.string().describe("The text content for the text box"),
  x: z.coerce.number().describe("X position in points from the top-left corner"),
  y: z.coerce.number().describe("Y position in points from the top-left corner"),
  width: z.coerce.number().describe("Width in points"),
  height: z.coerce.number().describe("Height in points"),
});

export async function insertTextBox(
  params: z.infer<typeof insertTextBoxSchema>,
) {
  assertWriteAllowed();

  const boxId = generateObjectId();
  const requests: Record<string, unknown>[] = [
    {
      createShape: {
        objectId: boxId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: params.slideObjectId,
          size: {
            width: { magnitude: emuFromPt(params.width), unit: "EMU" },
            height: { magnitude: emuFromPt(params.height), unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: emuFromPt(params.x),
            translateY: emuFromPt(params.y),
            unit: "EMU",
          },
        },
      },
    },
    {
      insertText: {
        objectId: boxId,
        text: params.text,
        insertionIndex: 0,
      },
    },
  ];

  await batchUpdatePresentation(params.presentationId, requests);
  return { objectId: boxId, text: params.text };
}

// ── slides-insert-image ────────────────────────────────────────────────────

export const insertImageSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectId: z.string().describe("The objectId of the slide to insert the image on"),
  imageUrl: z.string().describe("Public URL of the image to insert"),
  x: z.coerce.number().optional().default(100).describe("X position in points. Default: 100"),
  y: z.coerce.number().optional().default(100).describe("Y position in points. Default: 100"),
  width: z.coerce.number().optional().default(300).describe("Width in points. Default: 300"),
  height: z.coerce.number().optional().default(200).describe("Height in points. Default: 200"),
});

export async function insertImage(
  params: z.infer<typeof insertImageSchema>,
) {
  assertWriteAllowed();

  const imageId = generateObjectId();
  await batchUpdatePresentation(params.presentationId, [
    {
      createImage: {
        objectId: imageId,
        url: params.imageUrl,
        elementProperties: {
          pageObjectId: params.slideObjectId,
          size: {
            width: { magnitude: emuFromPt(params.width), unit: "EMU" },
            height: { magnitude: emuFromPt(params.height), unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: emuFromPt(params.x),
            translateY: emuFromPt(params.y),
            unit: "EMU",
          },
        },
      },
    },
  ]);
  return { objectId: imageId };
}

// ── slides-insert-table ────────────────────────────────────────────────────

export const insertTableSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectId: z.string().describe("The objectId of the slide to insert the table on"),
  rows: z.coerce.number().describe("Number of rows"),
  columns: z.coerce.number().describe("Number of columns"),
  x: z.coerce.number().optional().default(100).describe("X position in points. Default: 100"),
  y: z.coerce.number().optional().default(100).describe("Y position in points. Default: 100"),
  width: z.coerce.number().optional().default(400).describe("Width in points. Default: 400"),
  height: z.coerce.number().optional().default(200).describe("Height in points. Default: 200"),
});

export async function insertTable(
  params: z.infer<typeof insertTableSchema>,
) {
  assertWriteAllowed();

  const tableId = generateObjectId();
  await batchUpdatePresentation(params.presentationId, [
    {
      createTable: {
        objectId: tableId,
        rows: params.rows,
        columns: params.columns,
        elementProperties: {
          pageObjectId: params.slideObjectId,
          size: {
            width: { magnitude: emuFromPt(params.width), unit: "EMU" },
            height: { magnitude: emuFromPt(params.height), unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: emuFromPt(params.x),
            translateY: emuFromPt(params.y),
            unit: "EMU",
          },
        },
      },
    },
  ]);
  return { objectId: tableId, rows: params.rows, columns: params.columns };
}

// ── slides-update-table-cell ───────────────────────────────────────────────

export const updateTableCellSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  tableObjectId: z.string().describe("The objectId of the table"),
  rowIndex: z.coerce.number().describe("Zero-based row index"),
  columnIndex: z.coerce.number().describe("Zero-based column index"),
  text: z.string().describe("The text to set in the cell (replaces existing text)"),
});

export async function updateTableCell(
  params: z.infer<typeof updateTableCellSchema>,
) {
  assertWriteAllowed();

  // First delete existing text, then insert new text
  const requests: Record<string, unknown>[] = [
    {
      deleteText: {
        objectId: params.tableObjectId,
        cellLocation: {
          rowIndex: params.rowIndex,
          columnIndex: params.columnIndex,
        },
        textRange: { type: "ALL" },
      },
    },
    {
      insertText: {
        objectId: params.tableObjectId,
        cellLocation: {
          rowIndex: params.rowIndex,
          columnIndex: params.columnIndex,
        },
        text: params.text,
        insertionIndex: 0,
      },
    },
  ];

  await batchUpdatePresentation(params.presentationId, requests);
  return {
    tableObjectId: params.tableObjectId,
    rowIndex: params.rowIndex,
    columnIndex: params.columnIndex,
    text: params.text,
  };
}

// ── slides-insert-shape ────────────────────────────────────────────────────

export const insertShapeSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectId: z.string().describe("The objectId of the slide"),
  shapeType: z
    .string()
    .describe("Shape type (e.g., RECTANGLE, ELLIPSE, ROUND_RECTANGLE, STAR_5, ARROW_LEFT, HEART, etc.)"),
  x: z.coerce.number().describe("X position in points"),
  y: z.coerce.number().describe("Y position in points"),
  width: z.coerce.number().describe("Width in points"),
  height: z.coerce.number().describe("Height in points"),
});

export async function insertShape(
  params: z.infer<typeof insertShapeSchema>,
) {
  assertWriteAllowed();

  const shapeId = generateObjectId();
  await batchUpdatePresentation(params.presentationId, [
    {
      createShape: {
        objectId: shapeId,
        shapeType: params.shapeType,
        elementProperties: {
          pageObjectId: params.slideObjectId,
          size: {
            width: { magnitude: emuFromPt(params.width), unit: "EMU" },
            height: { magnitude: emuFromPt(params.height), unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: emuFromPt(params.x),
            translateY: emuFromPt(params.y),
            unit: "EMU",
          },
        },
      },
    },
  ]);
  return { objectId: shapeId, shapeType: params.shapeType };
}

// ── slides-format-text ─────────────────────────────────────────────────────

export const formatTextSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  objectId: z.string().describe("The objectId of the shape or text box containing the text"),
  startIndex: z.coerce.number().optional().describe("Start character index (inclusive). Omit to format all text"),
  endIndex: z.coerce.number().optional().describe("End character index (exclusive). Omit to format all text"),
  bold: z.boolean().optional().describe("Set bold"),
  italic: z.boolean().optional().describe("Set italic"),
  underline: z.boolean().optional().describe("Set underline"),
  fontFamily: z.string().optional().describe("Font family name (e.g., 'Arial', 'Roboto')"),
  fontSize: z.coerce.number().optional().describe("Font size in points"),
  foregroundColor: z.string().optional().describe("Text color as hex (#RRGGBB)"),
});

export async function formatText(
  params: z.infer<typeof formatTextSchema>,
) {
  assertWriteAllowed();

  const style: Record<string, unknown> = {};
  const fields: string[] = [];

  if (params.bold !== undefined) {
    style.bold = params.bold;
    fields.push("bold");
  }
  if (params.italic !== undefined) {
    style.italic = params.italic;
    fields.push("italic");
  }
  if (params.underline !== undefined) {
    style.underline = params.underline;
    fields.push("underline");
  }
  if (params.fontFamily) {
    style.fontFamily = params.fontFamily;
    fields.push("fontFamily");
  }
  if (params.fontSize !== undefined) {
    style.fontSize = { magnitude: params.fontSize, unit: "PT" };
    fields.push("fontSize");
  }
  if (params.foregroundColor) {
    style.foregroundColor = {
      opaqueColor: { rgbColor: hexToRgbColor(params.foregroundColor) },
    };
    fields.push("foregroundColor");
  }

  const textRange =
    params.startIndex !== undefined && params.endIndex !== undefined
      ? { type: "FIXED_RANGE", startIndex: params.startIndex, endIndex: params.endIndex }
      : { type: "ALL" };

  await batchUpdatePresentation(params.presentationId, [
    {
      updateTextStyle: {
        objectId: params.objectId,
        textRange,
        style,
        fields: fields.join(","),
      },
    },
  ]);
  return { objectId: params.objectId, fieldsUpdated: fields };
}

// ── slides-format-shape ────────────────────────────────────────────────────

export const formatShapeSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  objectId: z.string().describe("The objectId of the shape to format"),
  fillColor: z.string().optional().describe("Shape fill color as hex (#RRGGBB)"),
  borderColor: z.string().optional().describe("Border color as hex (#RRGGBB)"),
  borderWeight: z.coerce.number().optional().describe("Border weight in points"),
});

export async function formatShape(
  params: z.infer<typeof formatShapeSchema>,
) {
  assertWriteAllowed();

  const properties: Record<string, unknown> = {};
  const fields: string[] = [];

  if (params.fillColor) {
    properties.shapeBackgroundFill = {
      solidFill: {
        color: { rgbColor: hexToRgbColor(params.fillColor) },
      },
    };
    fields.push("shapeBackgroundFill.solidFill.color");
  }

  if (params.borderColor || params.borderWeight !== undefined) {
    const outline: Record<string, unknown> = {};
    if (params.borderColor) {
      outline.outlineFill = {
        solidFill: {
          color: { rgbColor: hexToRgbColor(params.borderColor) },
        },
      };
      fields.push("outline.outlineFill.solidFill.color");
    }
    if (params.borderWeight !== undefined) {
      outline.weight = { magnitude: params.borderWeight, unit: "PT" };
      fields.push("outline.weight");
    }
    properties.outline = outline;
  }

  await batchUpdatePresentation(params.presentationId, [
    {
      updateShapeProperties: {
        objectId: params.objectId,
        shapeProperties: properties,
        fields: fields.join(","),
      },
    },
  ]);
  return { objectId: params.objectId, fieldsUpdated: fields };
}

// ── slides-resize-element ──────────────────────────────────────────────────

export const resizeElementSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  objectId: z.string().describe("The objectId of the element to resize/reposition"),
  x: z.coerce.number().optional().describe("New X position in points"),
  y: z.coerce.number().optional().describe("New Y position in points"),
  width: z.coerce.number().optional().describe("New width in points"),
  height: z.coerce.number().optional().describe("New height in points"),
});

export async function resizeElement(
  params: z.infer<typeof resizeElementSchema>,
) {
  assertWriteAllowed();

  // We need to get current element properties first to build the full transform
  const slides = getSlidesClient();
  const pres = await slides.presentations.get({
    presentationId: params.presentationId,
    fields: "slides(objectId,pageElements(objectId,size,transform))",
  });

  // Find the element
  let currentSize: Record<string, unknown> | undefined;
  let currentTransform: Record<string, unknown> | undefined;
  for (const slide of pres.data.slides ?? []) {
    for (const el of slide.pageElements ?? []) {
      if (el.objectId === params.objectId) {
        currentSize = el.size as Record<string, unknown>;
        currentTransform = el.transform as Record<string, unknown>;
        break;
      }
    }
    if (currentSize) break;
  }

  const requests: Record<string, unknown>[] = [];

  if (params.width !== undefined || params.height !== undefined) {
    const size: Record<string, unknown> = {};
    if (params.width !== undefined) {
      size.width = { magnitude: emuFromPt(params.width), unit: "EMU" };
    } else if (currentSize) {
      size.width = currentSize.width;
    }
    if (params.height !== undefined) {
      size.height = { magnitude: emuFromPt(params.height), unit: "EMU" };
    } else if (currentSize) {
      size.height = currentSize.height;
    }

    requests.push({
      updatePageElementsSize: {
        objectId: params.objectId,
        size,
      },
    });
  }

  if (params.x !== undefined || params.y !== undefined) {
    const translateX = params.x !== undefined ? emuFromPt(params.x) : (currentTransform?.translateX ?? 0);
    const translateY = params.y !== undefined ? emuFromPt(params.y) : (currentTransform?.translateY ?? 0);

    requests.push({
      updatePageElementTransform: {
        objectId: params.objectId,
        applyMode: "ABSOLUTE",
        transform: {
          scaleX: currentTransform?.scaleX ?? 1,
          scaleY: currentTransform?.scaleY ?? 1,
          shearX: currentTransform?.shearX ?? 0,
          shearY: currentTransform?.shearY ?? 0,
          translateX,
          translateY,
          unit: "EMU",
        },
      },
    });
  }

  if (requests.length > 0) {
    await batchUpdatePresentation(params.presentationId, requests);
  }

  return { objectId: params.objectId, updated: requests.length > 0 };
}

// ── slides-set-slide-background ────────────────────────────────────────────

export const setSlideBackgroundSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  slideObjectId: z.string().describe("The objectId of the slide"),
  color: z.string().describe("Background color as hex (#RRGGBB)"),
});

export async function setSlideBackground(
  params: z.infer<typeof setSlideBackgroundSchema>,
) {
  assertWriteAllowed();

  await batchUpdatePresentation(params.presentationId, [
    {
      updatePageProperties: {
        objectId: params.slideObjectId,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: {
              color: { rgbColor: hexToRgbColor(params.color) },
            },
          },
        },
        fields: "pageBackgroundFill.solidFill.color",
      },
    },
  ]);
  return { slideObjectId: params.slideObjectId, color: params.color };
}

// ── slides-batch-update ────────────────────────────────────────────────────

export const slidesBatchUpdateSchema = z.object({
  presentationId: z.string().describe("The ID of the presentation"),
  requests: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Array of raw Slides API batchUpdate request objects. See Google Slides API docs for the full request schema"),
});

export async function slidesBatchUpdate(
  params: z.infer<typeof slidesBatchUpdateSchema>,
) {
  assertWriteAllowed();
  const replies = await batchUpdatePresentation(
    params.presentationId,
    params.requests,
  );
  return { replies };
}
