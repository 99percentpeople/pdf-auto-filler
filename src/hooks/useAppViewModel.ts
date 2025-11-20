import {
  createEffect,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { makePersisted } from "@solid-primitives/storage";
import { get, set } from "idb-keyval";
import { read, utils } from "xlsx";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFCheckBox,
  PDFDocument,
  PDFFont,
  PDFSignature,
  PDFTextField,
} from "@cantoo/pdf-lib";
import {
  AppData,
  AppInfo,
  AppOptions,
  verifyPermission,
} from "@/config";
import {
  fillCheckBox,
  fillSignature,
  fillTextField,
  getFieldTypeName,
} from "@/libs/pdf";
import {
  compact,
  consume,
  mapConcurrent,
  pipe,
} from "@/utils/iter-tools";
import { toast } from "solid-sonner";

interface GenStats {
  total: number;
  generatedOk: number;
  generatedErr: number;
  writtenOk: number;
  writtenErr: number;
  skippedGen: number;
  skippedWrite: number;
  startAt: number;
  endAt?: number;
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function useAppViewModel() {
  const [appData, setAppData] = createStore<AppData>({
    font: null,
    xlsxData: null,
    pdfData: null,
    workDir: null,
    imgDir: null,
  });
  const [error, setError] = createSignal<string | null>(
    null,
  );
  const [customFontFile, setCustomFontFile] =
    createSignal<File | null>(null);
  const [info, setInfo] = createStore<AppInfo>({
    loading: false,
    uploadEnable: true,
    rangeEnable: false,
    selectColumnEnable: false,
    generateEnable: false,
  });
  const [option, setOption] = makePersisted(
    createStore<AppOptions>({
      start: 0,
      flattern: false,
      exportFileName: "default",
    }),
    { storage: sessionStorage, name: "options" },
  );

  const [genStats, setGenStats] = createStore<GenStats>({
    total: 0,
    generatedOk: 0,
    generatedErr: 0,
    writtenOk: 0,
    writtenErr: 0,
    skippedGen: 0,
    skippedWrite: 0,
    startAt: 0,
    endAt: undefined,
  });
  function resetGenStats(total: number) {
    setGenStats(
      reconcile({
        total,
        generatedOk: 0,
        generatedErr: 0,
        writtenOk: 0,
        writtenErr: 0,
        skippedGen: 0,
        skippedWrite: 0,
        startAt: Date.now(),
        endAt: undefined,
      } satisfies GenStats),
    );
  }

  onMount(async () => {
    const workDirHandle =
      await get<FileSystemDirectoryHandle>("work_dir");
    if (workDirHandle) {
      try {
        if (await verifyPermission(workDirHandle, true))
          setAppData("workDir", workDirHandle);
      } catch (err) {}
    }
    createEffect(async () => {
      await set("work_dir", appData.workDir);
    });

    createEffect(() => {
      const errMsg = error();
      if (errMsg) {
        toast.error(errMsg);
        setError(null);
      }
    });

    const imgDirHandle =
      await get<FileSystemDirectoryHandle>("img_dir");
    if (imgDirHandle) {
      try {
        if (await verifyPermission(imgDirHandle, false))
          setAppData("imgDir", imgDirHandle);
      } catch (err) {}
    }
    createEffect(async () => {
      await set("img_dir", appData.imgDir);
    });

    const font = await get<File>("font");
    if (font) setCustomFontFile(font);
    createEffect(async () => {
      const f = customFontFile();
      await set("font", f);
    });
  });

  createEffect(() => {
    const data = appData.xlsxData?.data;
    setInfo("rangeEnable", !!data && !info.loading);
    setInfo("selectColumnEnable", !!data && !info.loading);
  });

  createEffect(() => {
    const handle = appData.workDir;
    setInfo(
      "generateEnable",
      !info.loading &&
        !!handle &&
        !!appData.xlsxData?.data &&
        !!appData.pdfData,
    );
  });

  async function generateFile(
    pdfBuf: ArrayBuffer,
    data: Record<string, string>,
  ) {
    const font = customFontFile();
    const pdfDoc = await PDFDocument.load(pdfBuf);
    const form = pdfDoc.getForm();
    let customFont: PDFFont | null = null;
    pdfDoc.registerFontkit(fontkit);
    if (font) {
      const embedFont = await pdfDoc.embedFont(
        await font.arrayBuffer(),
        { subset: true },
      );
      customFont = embedFont;
      const rawUpdateFieldAppearances =
        form.updateFieldAppearances.bind(form);
      form.updateFieldAppearances = function () {
        return rawUpdateFieldAppearances(embedFont);
      };
    }
    for (const field of form.getFields()) {
      const text = data[field.getName()];
      if (!text) continue;
      try {
        switch (getFieldTypeName(field)) {
          case "PDFTextField": {
            fillTextField(field as PDFTextField, text);
            break;
          }
          case "PDFSignature": {
            await fillSignature(
              field as PDFSignature,
              text,
              appData.imgDir,
              customFont,
            );
            break;
          }
          case "PDFCheckBox": {
            fillCheckBox(field as PDFCheckBox, text);
            break;
          }
        }
      } catch (err) {
        throw err as any;
      }
    }
    if (option.flattern) {
      try {
        form.flatten();
      } catch (err) {
        throw err as any;
      }
    }
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
    });
    return pdfBytes;
  }

  async function* enumerateCandidates(
    data: Record<string, string>[],
  ): AsyncGenerator<[string, Record<string, string>]> {
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      let name: string;
      if (
        option.exportFileName &&
        option.exportFileName !== "default"
      )
        name = `${d[option.exportFileName]}.pdf`;
      else name = `${i + 1}.pdf`;
      yield [name, d];
    }
  }

  async function writeToNewFile(
    dirHandle: FileSystemDirectoryHandle,
    name: string,
    bytes: Uint8Array,
  ) {
    const fileHandle = await dirHandle.getFileHandle(name, {
      create: true,
    });
    const writableStream =
      await fileHandle.createWritable();
    // @ts-ignore
    await writableStream.write(bytes);
    await writableStream.close();
  }

  const [openLogger, setOpenLogger] = createSignal(false);

  function loadingWrapper<
    T extends any | ((...args: any[]) => void),
  >(fn: T): T {
    return async function (
      this: any,
      ...args: any
    ): Promise<T> {
      setInfo("loading", true);
      try {
        const result = (fn as any).apply(this, args);
        return await Promise.resolve(result);
      } finally {
        setInfo("loading", false);
      }
    } as T;
  }

  const availableExportNames = createMemo(() => {
    return [
      { name: "默认（索引）", value: "default" },
      ...(appData.xlsxData?.headers?.map((h) => ({
        name: h,
        value: h,
      })) ?? []),
    ];
  });

  const handleGenerate = loadingWrapper(
    async (startIndex?: number, endIndex?: number) => {
      const GEN_LIMIT = 4;
      const WRITE_LIMIT = 4;
      setOpenLogger(true);
      const pdfFile = appData.pdfData?.file;
      const dirHandle = appData.workDir;
      let data = appData.xlsxData?.data;
      if (!pdfFile || !data || !dirHandle) return;
      if (!startIndex) startIndex = 0;
      if (!endIndex) endIndex = data.length;
      if (startIndex < 0 || endIndex > data.length) return;
      data = data.slice(startIndex, endIndex);
      resetGenStats(data.length);
      console.info(
        `[生成] 开始生成，共 ${data.length} 个文件；配置：生成并发=${GEN_LIMIT}，写入并发=${WRITE_LIMIT}，错误跳过=${!!option.skipError}，扁平化=${!!option.flattern}`,
      );
      const pdfBuf = await pdfFile.arrayBuffer();

      const generateDocument = mapConcurrent(
        GEN_LIMIT,
        async ([name, data]: [
          string,
          Record<string, string>,
        ]) => {
          try {
            console.info(`[生成] 文档生成开始: "${name}"`);
            const pdfBytes = await generateFile(
              pdfBuf,
              data,
            );
            setGenStats(
              "generatedOk",
              genStats.generatedOk + 1,
            );
            return [name, pdfBytes] as [string, Uint8Array];
          } catch (err: any) {
            console.error(
              `[生成] 文档生成失败: "${name}"，错误信息: ${err.message}`,
            );
            setGenStats(
              "generatedErr",
              genStats.generatedErr + 1,
            );
            if (!option.skipError) throw err;
            setGenStats(
              "skippedGen",
              genStats.skippedGen + 1,
            );
            console.warn(
              `[生成] 跳过该文件（生成失败）: "${name}"`,
            );
            return null;
          }
        },
      );

      const writeFile = mapConcurrent(
        WRITE_LIMIT,
        async ([name, bytes]: [string, Uint8Array]) => {
          try {
            await writeToNewFile(dirHandle, name, bytes);
            setGenStats(
              "writtenOk",
              genStats.writtenOk + 1,
            );
          } catch (err: any) {
            setGenStats(
              "writtenErr",
              genStats.writtenErr + 1,
            );
            console.error(
              `[写入] 写入失败: "${name}" -> ${
                err instanceof Error
                  ? err.message
                  : "unknown error"
              }`,
            );
            if (!option.skipError) throw err;
            setGenStats(
              "skippedWrite",
              genStats.skippedWrite + 1,
            );
            console.warn(
              `[生成] 跳过写入（错误被忽略）: "${name}"`,
            );
          }
        },
      );

      try {
        await consume(
          pipe<
            [string, Record<string, string>],
            [string, Uint8Array] | null
          >(
            generateDocument,
            compact<[string, Uint8Array]>(),
            writeFile,
          )(enumerateCandidates(data)),
        );
        const endedAt = Date.now();
        setGenStats("endAt", endedAt);
        const elapsed = formatDuration(
          endedAt - genStats.startAt,
        );
        console.info(
          `[生成] 完成 | 总计 ${genStats.total} | 生成 成功:${genStats.generatedOk} 失败:${genStats.generatedErr} 跳过:${genStats.skippedGen} | 写入 成功:${genStats.writtenOk} 失败:${genStats.writtenErr} 跳过:${genStats.skippedWrite} | 用时 ${elapsed}`,
        );
      } catch (err) {
        setGenStats("endAt", Date.now());
        console.error(
          `[生成] 批量生成过程中断`,
          err instanceof Error
            ? err.message
            : "unknown error",
        );
      }
    },
  );

  const processXlsx = loadingWrapper(
    async (xlsx: File | Blob) => {
      const ab = await xlsx.arrayBuffer();
      const workbook = read(ab);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const range = utils.decode_range(
        sheet["!ref"] ?? "A1",
      );
      const headers: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = utils.encode_cell({ r: range.s.r, c });
        const cell = sheet[addr];
        const text = cell
          ? (utils.format_cell(cell) ??
            (cell as any).v ??
            "")
          : "";
        headers.push(text || utils.encode_col(c));
      }
      const data = utils.sheet_to_json<
        Record<string, string>
      >(sheet, {
        header: headers,
        range: {
          s: { r: range.s.r + 1, c: range.s.c },
          e: { r: range.e.r, c: range.e.c },
        },
        raw: false,
        defval: "",
        blankrows: false,
      });
      setAppData("xlsxData", { file: xlsx, headers, data });
    },
  );

  const onXlsxUpload = loadingWrapper(
    async (
      e: Event & {
        currentTarget: HTMLInputElement;
        target: HTMLInputElement;
      },
    ) => {
      const file = e.currentTarget.files?.item(0);
      if (!file) return;
      await processXlsx(file);
    },
  );

  const processPdf = loadingWrapper(
    async (pdf: File | Blob) => {
      try {
        const pdfDoc = await PDFDocument.load(
          await pdf.arrayBuffer(),
        );
        setAppData("pdfData", { file: pdf, doc: pdfDoc });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "unknown error",
        );
      }
    },
  );

  const onPdfUpload = loadingWrapper(
    async (
      e: Event & { currentTarget: HTMLInputElement },
    ) => {
      const file = e.currentTarget.files?.item(0);
      if (!file) return;
      await processPdf(file);
    },
  );

  const onSelectWorkDir = loadingWrapper(async () => {
    try {
      const handle = await (
        window as any
      ).showDirectoryPicker({
        startIn: "documents",
        mode: "readwrite",
      });
      setAppData("workDir", handle);
    } catch (err) {}
  });

  const onDropWorkDir = loadingWrapper(
    async (ev: DragEvent) => {
      ev.preventDefault();
      if (!ev.dataTransfer) return;
      for (const item of ev.dataTransfer.items) {
        if (item.kind !== "file") continue;
        const handle = await (
          item as any
        ).getAsFileSystemHandle();
        if (handle?.kind !== "directory") continue;
        const dirHandle =
          handle as FileSystemDirectoryHandle;
        if (await verifyPermission(dirHandle, true)) {
          setAppData("workDir", dirHandle);
          break;
        }
      }
    },
  );

  const onSelectImgDir = loadingWrapper(async () => {
    try {
      const handle = await (
        window as any
      ).showDirectoryPicker({
        startIn: "pictures",
        mode: "read",
      });
      setAppData("imgDir", handle);
    } catch (err) {}
  });

  const onDropImgDir = loadingWrapper(
    async (ev: DragEvent) => {
      ev.preventDefault();
      if (!ev.dataTransfer) return;
      for (const item of ev.dataTransfer.items) {
        if (item.kind !== "file") continue;
        const handle = await (
          item as any
        ).getAsFileSystemHandle();
        if (handle?.kind !== "directory") continue;
        const dirHandle =
          handle as FileSystemDirectoryHandle;
        if (await verifyPermission(dirHandle, false)) {
          setAppData("imgDir", dirHandle);
          break;
        }
      }
    },
  );
  if (import.meta.env.DEV)
    onMount(async () => {
      try {
        if (appData.pdfData) return;
        const url = `${import.meta.env.BASE_URL}EDIT%20OoPdfFormExample.pdf`;
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        const file = new File(
          [blob],
          "EDIT OoPdfFormExample.pdf",
          {
            type: "application/pdf",
          },
        );
        await processPdf(file);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "unknown error",
        );
      }
    });

  return {
    appData,
    setAppData,
    customFontFile,
    setCustomFontFile,
    info,
    setInfo,
    option,
    setOption,
    genStats,
    resetGenStats,
    openLogger,
    setOpenLogger,
    handleGenerate,
    processXlsx,
    onXlsxUpload,
    processPdf,
    onPdfUpload,
    onSelectWorkDir,
    onDropWorkDir,
    onSelectImgDir,
    onDropImgDir,
    availableExportNames,
  };
}

export type { GenStats };
