import "./App.css";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
  type Component,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import {
  PDFCheckBox,
  PDFDocument,
  PDFFont,
  PDFSignature,
  PDFTextField,
} from "@cantoo/pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { read, utils } from "xlsx";
import { optional } from "./utils/helper";
import { Button } from "@/components/ui/button";
import {
  Resizable,
  ResizableHandle,
  ResizablePanel,
} from "./components/ui/resizable";
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { get, set } from "idb-keyval";
import { Input } from "./components/ui/input";
import {
  Logger,
  LoggerProvider,
  useLogger,
} from "./components/Logger";
import { Trash2 } from "lucide-solid";
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "./components/ui/switch";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "./components/ui/drawer";
import { makePersisted } from "@solid-primitives/storage";
import {
  AppData,
  AppInfo,
  AppOptions,
  FieldItem,
  verifyPermission,
} from "./config";
import { Separator } from "./components/ui/separator";
import {
  fillCheckBox,
  fillSignature,
  fillTextField,
  getFieldTypeName,
} from "./utils/pdf";
import { Badge } from "./components/ui/badge";
import {
  compact,
  consume,
  mapConcurrent,
  pipe,
} from "./utils/iter-tools";
import DualRangeSlider from "./components/extends/range-slider";
import { ButtonGroup } from "./components/ui/button-group";

const App: Component = () => {
  const [appData, setAppData] = createStore<AppData>({
    font: null,
    xlsxData: null,
    pdfData: null,
    workDir: null,
    imgDir: null,
  });

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
    {
      storage: sessionStorage,
      name: "options",
    },
  );

  onMount(async () => {
    const workDirHandle =
      await get<FileSystemDirectoryHandle>("work_dir");
    if (workDirHandle) {
      try {
        if (await verifyPermission(workDirHandle, true))
          console.log(
            `Work directory is loaded, current permission state is granted`,
          );
        else throw Error(`verifyPermission failed`);
        setAppData("workDir", workDirHandle);
      } catch (err) {
        console.error((err as Error).message);
      }
    }

    createEffect(async () => {
      await set("work_dir", appData.workDir);
    });

    const imgDirHandle =
      await get<FileSystemDirectoryHandle>("img_dir");
    if (imgDirHandle) {
      try {
        if (await verifyPermission(imgDirHandle, false))
          console.log(
            `Image directory is loaded, current permission state is granted`,
          );
        else throw Error(`verifyPermission failed`);
        setAppData("imgDir", imgDirHandle);
      } catch (err) {
        console.error((err as Error).message);
      }
    }

    createEffect(async () => {
      await set("img_dir", appData.imgDir);
    });

    const font = await get<File>("font");
    if (font) {
      setCustomFontFile(font);
    }
    createEffect(async () => {
      const font = customFontFile();
      await set("font", font);
      if (font)
        console.log(`use custom font file: ${font.name}`);
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
    data: Record<string, string>,
    pdfDoc: PDFDocument,
  ) {
    const font = customFontFile();
    const form = pdfDoc.getForm();
    let customFont: PDFFont | null = null;

    pdfDoc.registerFontkit(fontkit);
    if (font) {
      const embedFont = await pdfDoc.embedFont(
        await font.arrayBuffer(),
        {
          subset: true,
        },
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
        console.error(
          `Error filling field "${field.getName()}":`,
          err instanceof Error
            ? err.message
            : "unknown error",
        );
        throw err;
      }
    }

    if (option.flattern) {
      try {
        form.flatten();
      } catch (err) {
        console.error(
          "Error flattening form:",
          err instanceof Error
            ? err.message
            : "unknown error",
        );
        throw err;
      }
    }

    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
    });
    return pdfBytes;
  }

  type Candidate = {
    name: string;
    data: Record<string, string>;
  };

  async function* enumerateCandidates(
    data: Record<string, string>[],
  ): AsyncGenerator<Candidate> {
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      let name: string;

      if (
        option.exportFileName &&
        option.exportFileName !== "default"
      ) {
        name = `${d[option.exportFileName]}.pdf`;
      } else {
        name = `${i + 1}.pdf`;
      }

      yield { name, data: d };
    }
  }

  async function writeToNewFile(
    dirHandle: FileSystemDirectoryHandle,
    name: string,
    bytes: Uint8Array,
  ) {
    try {
      const fileHandle = await dirHandle.getFileHandle(
        name,
        { create: true },
      );
      const writableStream =
        await fileHandle.createWritable();
      // @ts-ignore
      await writableStream.write(bytes);
      await writableStream.close();
      console.log(
        `file "${name}" saved to dir "${dirHandle.name}"`,
      );
    } catch (err) {
      console.error(
        `An error occured when writing file: "${name}"`,
        err instanceof Error
          ? err.message
          : "unknown error",
      );
      throw err;
    }
  }

  async function handleGenerate(
    startIndex?: number,
    endIndex?: number,
  ) {
    setOpen(true);

    const doc = appData.pdfData?.doc;
    const dirHandle = appData.workDir;
    let data = appData.xlsxData?.data;

    if (!doc || !data || !dirHandle) return;

    if (!startIndex) startIndex = 0;
    if (!endIndex) endIndex = data.length;

    if (startIndex < 0 || endIndex > data.length) {
      console.error(
        "startIndex or endIndex is out of range",
      );
      return;
    }

    data = data.slice(startIndex, endIndex);

    console.info(`start generating ${data.length} files`);

    // 并发上限可按需调整或提到配置里
    const GEN_LIMIT = 4; // 生成 PDF 的并发
    const WRITE_LIMIT = 4; // 写文件的并发

    try {
      await consume(
        pipe<Candidate, [string, Uint8Array] | null>(
          // ① 并发生成 PDF
          mapConcurrent(
            GEN_LIMIT,
            async ({ name, data }) => {
              try {
                console.log(
                  `start generating file: "${name}"`,
                );
                const pdfBytes = await generateFile(
                  data,
                  doc,
                );
                return [name, pdfBytes] as [
                  string,
                  Uint8Array,
                ];
              } catch (err: any) {
                console.error(
                  `An error occured when generating file: "${name}"`,
                  err instanceof Error
                    ? err.message
                    : "unknown error",
                );
                if (!option.skipError) {
                  // 不跳过 → 整条管线中止
                  throw err;
                }
                console.warn(
                  "skip this file due to error.",
                );
                // 跳过：下游通过 compact 过滤
                return null;
              }
            },
          ),
          // ② 过滤掉生成失败（返回 null）的项
          compact<[string, Uint8Array]>(),
          // ③ 并发写文件
          mapConcurrent(
            WRITE_LIMIT,
            async ([name, bytes]) => {
              try {
                await writeToNewFile(
                  dirHandle,
                  name,
                  bytes,
                );
              } catch (err: any) {
                console.error(
                  `An error occured when writing file: "${name}"`,
                  err instanceof Error
                    ? err.message
                    : "unknown error",
                );
                if (!option.skipError) {
                  throw err;
                }
                console.warn(
                  "skip writing this file due to error.",
                );
              }
            },
          ),
        )(enumerateCandidates(data)),
      );

      console.info("PDF grenerate complete");
    } catch (err) {
      console.error(
        `An error occured when generating files`,
        err instanceof Error
          ? err.message
          : "unknown error",
      );
    }
  }

  const [open, setOpen] = createSignal(false);

  function loadingWrapper<
    T extends any | ((...args: any[]) => void),
  >(fn: T): T {
    return async function (
      this: any,
      ...args: any
    ): Promise<T> {
      setInfo("loading", true);

      if (typeof fn !== "function")
        throw Error(
          `Error fn type: ${typeof fn}, typeof fn should be function`,
        );
      try {
        const result = fn.apply(this, args);
        return await Promise.resolve(result);
      } catch (err) {
        throw err;
      } finally {
        setInfo("loading", false);
      }
    } as T;
  }

  const onXlsxUpload = loadingWrapper(
    async (
      e: Event & {
        currentTarget: HTMLInputElement;
        target: HTMLInputElement;
      },
    ) => {
      const file = e.currentTarget.files?.item(0);
      if (!file) return;
      const ab = await file.arrayBuffer();
      const workbook = read(ab);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // 1) 解析整体范围并安全兜底
      const range = utils.decode_range(
        sheet["!ref"] ?? "A1",
      );
      // 2) 取第1行表头，空表头用列名 A/B/C… 代替
      const headers: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = utils.encode_cell({ r: range.s.r, c });
        const cell = sheet[addr];
        const text = cell
          ? (utils.format_cell(cell) ?? cell.v ?? "")
          : "";
        headers.push(text || utils.encode_col(c)); // 空则用列名
      }

      // 3) 从第2行开始读数据，并用上面生成的 headers 作为键名
      const data = utils.sheet_to_json<
        Record<string, string>
      >(sheet, {
        header: headers, // 自定义键名
        range: {
          s: { r: range.s.r + 1, c: range.s.c }, // 从第2行开始
          e: { r: range.e.r, c: range.e.c },
        },
        raw: false,
        defval: "",
        blankrows: false,
      });

      console.debug(
        "xlsx headers:",
        JSON.stringify(headers, null, 2),
      );
      console.debug(
        "first row of data:",
        JSON.stringify(data[0], null, 2),
      );

      setAppData("xlsxData", {
        file,
        headers,
        data,
      });
    },
  );

  const availableExportNames = createMemo(() => {
    return [
      { name: "默认（索引）", value: "default" },
      ...(appData.xlsxData?.headers?.map((h) => ({
        name: h,
        value: h,
      })) ?? []),
    ];
  });

  return (
    <LoggerProvider timestamp>
      <Resizable class="h-full w-full rounded-lg border">
        <ResizablePanel
          initialSize={0.4}
          minSize={0.2}
          class="relative overflow-y-auto"
        >
          <div class="absolute inset-2 flex flex-col gap-4">
            <h3 class="h3">数据</h3>
            <div class="grid gap-1.5">
              <label class="grid w-full max-w-xs gap-1.5">
                <p class="disabled-next text-sm font-medium">
                  上传Excel文件
                </p>
                <Input
                  id="xlsx-upload"
                  type="file"
                  accept=".xlsx"
                  disabled={info.loading}
                  onChange={onXlsxUpload}
                />
              </label>
              <Show when={appData.xlsxData}>
                {(_) => (
                  <div class="flex items-start gap-2 rounded-md border p-1 text-sm font-medium shadow-sm">
                    <div class="flex w-full flex-col gap-1">
                      <div class="flex flex-wrap gap-2">
                        <p>
                          {`总列数: ${appData.xlsxData?.headers?.length}`}
                        </p>
                        <p>{`总行数: ${appData.xlsxData?.data?.length}`}</p>
                      </div>
                      <div class="flex flex-wrap gap-1">
                        <For
                          each={appData.xlsxData?.headers}
                        >
                          {(header) => (
                            <Badge variant="secondary">
                              {header}
                            </Badge>
                          )}
                        </For>
                      </div>
                      <Button
                        class="self-end"
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          const input =
                            document.getElementById(
                              "xlsx-upload",
                            ) as HTMLInputElement;
                          if (input) {
                            input.value = "";
                          }
                          setAppData("xlsxData", null);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                )}
              </Show>
            </div>
            <div class="grid w-full gap-1.5">
              <label class="flex w-full max-w-xs flex-col gap-1.5">
                <p class="disabled-next text-sm font-medium">
                  上传PDF模板
                </p>
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  disabled={info.loading}
                  onChange={loadingWrapper(async (e) => {
                    const file =
                      e.currentTarget.files?.item(0);
                    if (!file) return;

                    const pdfDoc = await PDFDocument.load(
                      await file.arrayBuffer(),
                    );

                    setAppData("pdfData", {
                      file,
                      doc: pdfDoc,
                    });
                  })}
                />
              </label>
              <Show when={appData.pdfData}>
                {(pdfData) => (
                  <div class="flex flex-col gap-1 rounded-md border p-1 text-sm font-medium shadow-sm">
                    <div class="flex flex-1 flex-wrap gap-2">
                      <span>{`PDF 模板: "${pdfData().file.name}"`}</span>
                      <span>{`总页数: ${pdfData().doc.getPageCount()}`}</span>
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <For
                        each={pdfData()
                          .doc.getForm()
                          .getFields()
                          .map((f) => f.getName())}
                      >
                        {(label) => (
                          <Badge variant="secondary">
                            {label}
                          </Badge>
                        )}
                      </For>
                    </div>

                    <Button
                      variant="destructive"
                      size="icon"
                      class="self-end"
                      onClick={() => {
                        const input =
                          document.getElementById(
                            "pdf-upload",
                          ) as HTMLInputElement;
                        if (input) {
                          input.value = "";
                        }
                        setAppData("pdfData", null);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </Show>
            </div>
            <div class="flex w-full max-w-xs flex-col gap-1.5">
              <p class="text-sm font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                工作目录
              </p>
              <Button
                draggable="true"
                disabled={info.loading}
                onClick={loadingWrapper(async () => {
                  try {
                    const handle =
                      await window.showDirectoryPicker({
                        startIn: "documents",
                        mode: "readwrite",
                      });
                    console.log(
                      "select work directory: ",
                      handle.name,
                    );
                    setAppData("workDir", handle);
                  } catch (err) {
                    console.warn((err as Error).message);
                  }
                })}
                onDragOver={(ev) => {
                  ev.preventDefault();
                }}
                onDrop={loadingWrapper(async (ev) => {
                  ev.preventDefault();
                  if (!ev.dataTransfer) return;
                  for (const item of ev.dataTransfer
                    .items) {
                    if (item.kind !== "file") continue;
                    const handle =
                      await item.getAsFileSystemHandle();
                    if (handle?.kind !== "directory")
                      continue;
                    const dirHandle =
                      handle as FileSystemDirectoryHandle;
                    if (
                      await verifyPermission(
                        dirHandle,
                        true,
                      )
                    ) {
                      console.log(
                        "drop work directory: ",
                        handle.name,
                      );
                      setAppData("workDir", dirHandle);
                      break;
                    }
                  }
                })}
              >
                {appData.workDir ? `切换` : `打开选择器`}
              </Button>
              <Show when={appData.workDir}>
                {(handle) => (
                  <div class="flex items-center rounded-md border p-1 text-sm font-medium shadow-sm">
                    <span class="w-full flex-1">{`Current work directory: "${handle().name}"`}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        setAppData("workDir", null)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </Show>
            </div>

            <div class="flex w-full max-w-xs flex-col gap-1.5">
              <p class="text-sm font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                图片目录
              </p>
              <Button
                draggable="true"
                disabled={info.loading}
                onClick={loadingWrapper(async (ev) => {
                  try {
                    const handle =
                      await window.showDirectoryPicker({
                        startIn: "pictures",
                        mode: "read",
                      });
                    console.log(
                      "select img directory: ",
                      handle.name,
                    );
                    setAppData("imgDir", handle);
                  } catch (err) {
                    console.warn((err as Error).message);
                  }
                })}
                onDragOver={(ev) => {
                  ev.preventDefault();
                }}
                onDrop={loadingWrapper(async (ev) => {
                  ev.preventDefault();
                  if (!ev.dataTransfer) return;
                  for (const item of ev.dataTransfer
                    .items) {
                    if (item.kind !== "file") continue;
                    const handle =
                      await item.getAsFileSystemHandle();
                    if (handle?.kind !== "directory")
                      continue;
                    const dirHandle =
                      handle as FileSystemDirectoryHandle;
                    if (
                      await verifyPermission(
                        dirHandle,
                        false,
                      )
                    ) {
                      console.log(
                        "drop image directory: ",
                        handle.name,
                      );
                      setAppData("imgDir", dirHandle);
                      break;
                    }
                  }
                })}
              >
                {appData.imgDir ? "切换" : "打开选择器"}
              </Button>
              <Show when={appData.imgDir}>
                {(handle) => (
                  <div class="flex items-center rounded-md border p-1 text-sm font-medium shadow-sm">
                    <span class="w-full flex-1">{`Current image directory: "${handle().name}"`}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        setAppData("imgDir", null)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </Show>
            </div>

            <div class="w-full max-w-xs">
              <p class="text-sm font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                开始生成
              </p>
              <div class="flex gap-1.5">
                <Button
                  disabled={!info.generateEnable}
                  onClick={loadingWrapper(() =>
                    handleGenerate(0, 1),
                  )}
                >
                  生成一份
                </Button>
                <Button
                  disabled={!info.generateEnable}
                  onClick={loadingWrapper(() =>
                    handleGenerate(
                      option?.start,
                      option?.end,
                    ),
                  )}
                >
                  批量生成
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          initialSize={0.6}
          minSize={0.2}
          class="relative overflow-y-auto"
        >
          <div class="absolute inset-2 flex flex-col gap-4">
            <h3 class="h3">生成设置</h3>

            <div class="flex flex-col items-start gap-1.5">
              <label class="grid w-full max-w-xs gap-1.5">
                <p class="disabled-next text-sm font-medium">
                  自定义字体
                </p>
                <Input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  disabled={info.loading}
                  onChange={loadingWrapper(async (e) => {
                    const file =
                      e.currentTarget.files?.item(0);
                    if (!file) {
                      return;
                    }

                    setCustomFontFile(file);
                  })}
                />
              </label>

              <Show when={customFontFile()}>
                {(font) => (
                  <div class="flex items-center gap-1.5 rounded-md border border-input p-1 shadow-sm">
                    <p class="text-sm">{`使用自定义字体: "${font().name}"`}</p>
                    <Button
                      disabled={info.loading}
                      onClick={(e) => {
                        e.preventDefault();
                        setCustomFontFile(null);
                      }}
                      variant="destructive"
                      size="icon"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </Show>
            </div>
            <DualRangeSlider
              disabled={!info.rangeEnable}
              minValue={0}
              maxValue={appData.xlsxData?.data.length ?? 0}
              value={[
                option.start ?? 0,
                option.end ??
                  appData.xlsxData?.data.length ??
                  0,
              ]}
              initialValue={[
                0,
                appData.xlsxData?.data.length ?? 0,
              ]}
              onValueChange={(value) => {
                setOption(
                  "start",
                  optional(value[0]) ?? undefined,
                );
                setOption(
                  "end",
                  optional(value[1]) ?? undefined,
                );
              }}
              ariaLabel="索引范围"
            />
            <ButtonGroup>
              <Button
                variant="outline"
                disabled={!info.rangeEnable}
                onClick={() => setOption("start", 0)}
              >
                首项
              </Button>
              <Button
                variant="outline"
                disabled={!info.rangeEnable}
                onClick={() =>
                  setOption(
                    "end",
                    appData.xlsxData?.data.length,
                  )
                }
              >
                尾项
              </Button>
            </ButtonGroup>
            <Switch
              disabled={info.loading}
              class="flex items-center gap-2"
              checked={option.skipError}
              onChange={(isChecked) =>
                setOption("skipError", isChecked)
              }
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
              <SwitchLabel class="text-sm leading-none font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                跳过错误
              </SwitchLabel>
            </Switch>
            <Switch
              disabled={info.loading}
              class="flex items-center gap-2"
              checked={option.flattern}
              onChange={(isChecked) =>
                setOption("flattern", isChecked)
              }
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
              <SwitchLabel class="text-sm leading-none font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                扁平化表单（生成后不可编辑）
              </SwitchLabel>
            </Switch>
            <label class="grid w-full max-w-xs gap-1.5">
              <p class="disabled-next text-sm font-medium">
                导出文件名称
              </p>
              <Select
                fitViewport
                disabled={!info.selectColumnEnable}
                optionValue="value"
                optionTextValue="name"
                placeholder="选择列作为文件名"
                defaultValue={availableExportNames()[0]}
                value={
                  availableExportNames().find(
                    (n) =>
                      n.value === option.exportFileName,
                  ) ?? availableExportNames()[0]
                }
                onChange={(v) => {
                  setOption(
                    "exportFileName",
                    reconcile(
                      optional(v.value) ?? undefined,
                    ),
                  );
                }}
                options={availableExportNames()}
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {props.item.rawValue.name}
                  </SelectItem>
                )}
              >
                <SelectTrigger class="w-full max-w-xs">
                  <SelectValue<FieldItem>>
                    {(state) =>
                      state.selectedOption()?.name
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  class="overflow-y-auto"
                  style={{
                    "max-height":
                      "var(--kb-popper-content-available-height)",
                    "max-width":
                      "var(--kb-popper-content-available-width)",
                  }}
                />
              </Select>
            </label>

            <LoggerDrawer
              logging={info.loading}
              open={open()}
              setOpen={setOpen}
            />
            <Show when={info.loading}>
              <h1 class="h3">Loading</h1>
            </Show>
            <div class="mt-auto">
              <Show when={BUILD_DATE}>
                {(bd) => (
                  <p class="muted">{`Build Date: ${bd()}`}</p>
                )}
              </Show>
              <p class="small muted">
                This app only available in Chrome or Edge
                after version 86, Opera after version 72.
              </p>
            </div>
          </div>
        </ResizablePanel>
      </Resizable>
    </LoggerProvider>
  );
};

function LoggerDrawer(props: {
  logging: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { clear } = useLogger();
  return (
    <Drawer open={props.open} onOpenChange={props.setOpen}>
      <DrawerTrigger
        as={Button}
        variant="outline"
        class="max-w-xs"
      >
        日志
      </DrawerTrigger>
      <DrawerContent class="container mx-auto flex h-2/3 flex-col">
        <DrawerHeader>
          <div class="flex w-full items-center justify-between">
            <h3 class="h3">日志</h3>
            <Button
              variant="destructive"
              size="icon"
              onClick={clear}
            >
              <Trash2 />
            </Button>
          </div>
        </DrawerHeader>
        <Separator />
        <div class="relative w-full flex-1">
          <Logger
            data-corvu-no-drag
            class="absolute inset-0 overflow-y-auto font-mono text-xs whitespace-pre-wrap select-text"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default App;
