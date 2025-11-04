import { PDFButton, PDFCheckBox, PDFDropdown, PDFField, PDFOptionList, PDFRadioGroup, PDFSignature, PDFTextField } from "pdf-lib";

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

export type AppData = {
    font: File | null;
    pdf: File | null;
    fillData: Record<string, string>[] | null;
    headers: string[] | null;
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

export function getFieldTypeName(field: PDFField): string | undefined {
    if (field instanceof PDFTextField) {
        return "PDFTextField";
    } else if (field instanceof PDFSignature) {
        return "PDFSignature";
    } else if (field instanceof PDFCheckBox) {
        return "PDFCheckBox";
    } else if (field instanceof PDFButton) {
        return "PDFButton";
    } else if (field instanceof PDFOptionList) {
        return "PDFOptionList";
    } else if (field instanceof PDFRadioGroup) {
        return "PDFRadioGroup";
    } else if (field instanceof PDFDropdown) {
        return "PDFDropdown";
    } else {
        return undefined;
    }
}