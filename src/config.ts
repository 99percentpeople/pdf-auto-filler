import { PDFDocument } from "@cantoo/pdf-lib";

export type FieldItem = {
  value: string;
  name?: string;
};

export type AppOptions = {
  // 数据索引开始
  start?: number;
  end?: number;
  // 导出文件名跟随列
  exportFileName?: string;
  // 批量生成时忽略错误，继续生成
  skipError?: boolean;
  // 导出时扁平化form表单
  flattern?: boolean;
};

export type XlsxData = {
  file: File | Blob;
  headers: string[];
  data: Record<string, string>[];
};

export type PdfData = {
  file: File | Blob;
  doc: PDFDocument;
};

export type AppData = {
  font: File | null;
  xlsxData: XlsxData | null;
  pdfData: PdfData | null;
  workDir: FileSystemDirectoryHandle | null;
  imgDir: FileSystemDirectoryHandle | null;
};

export type AppInfo = {
  loading: boolean;
  uploadEnable: boolean;
  rangeEnable: boolean;
  selectColumnEnable: boolean;
  generateEnable: boolean;
};

export async function verifyPermission(
  fileHandle:
    | FileSystemFileHandle
    | FileSystemDirectoryHandle,
  withWrite: boolean,
): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = {};
  if (withWrite) {
    opts.mode = "readwrite";
  }
  if (
    (await fileHandle.queryPermission(opts)) === "granted"
  ) {
    return true;
  }
  if (
    (await fileHandle.requestPermission(opts)) === "granted"
  ) {
    return true;
  }
  return false;
}
