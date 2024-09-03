import {
  batch,
  createEffect,
  createSignal,
  For,
  onMount,
  Show,
  type Component,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import "./App.css";
import {
  asPDFName,
  degrees,
  drawImage,
  drawText,
  PDFButton,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFFont,
  PDFImage,
  PDFOperator,
  PDFOperatorNames,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { read, utils } from "xlsx";
import { optional } from "./helper";

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
import { Input } from "./components/extends/input";
import {
  Logger,
  LoggerProvider,
} from "./components/Logger";
import { ChevronsUpDown, Trash } from "lucide-solid";
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
  DrawerLabel,
  DrawerTrigger,
} from "./components/ui/drawer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./components/ui/collapsible";
import { CollapsibleTriggerProps } from "@kobalte/core/collapsible";
import { makePersisted } from "@solid-primitives/storage";

type Item = {
  value: string;
  name?: string;
};

type AppOptions = {
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

type AppData = {
  font: File | null;
  pdf: File | null;
  fillData: Record<string, string>[] | null;
  headers: string[] | null;
  workDir: FileSystemDirectoryHandle | null;
  imgDir: FileSystemDirectoryHandle | null;
};

type AppInfo = {
  loading: boolean;
  uploadEnable: boolean;
  rangeEnable: boolean;
  selectColumnEnable: boolean;
  generateEnable: boolean;
};

async function verifyPermission(
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

function getFieldTypeName(field: PDFField) {
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

const App: Component = () => {
  const [appData, setAppData] = createStore<AppData>({
    font: null,
    pdf: null,
    fillData: null,
    headers: null,
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
    const data = appData.fillData;
    setInfo("rangeEnable", !!data && !info.loading);
    setInfo("selectColumnEnable", !!data && !info.loading);
  });

  createEffect(() => {
    const handle = appData.workDir;
    setInfo(
      "generateEnable",
      !info.loading &&
        !!handle &&
        !!appData.fillData &&
        !!appData.pdf,
    );
  });

  async function generateFile(
    data: Record<string, string>,
    pdfBuf: ArrayBuffer,
  ) {
    const pdfDoc = await PDFDocument.load(pdfBuf);
    const font = customFontFile();
    const form = pdfDoc.getForm();
    let customFont: PDFFont;

    pdfDoc.registerFontkit(fontkit);
    if (font) {
      customFont = await pdfDoc.embedFont(
        await font.arrayBuffer(),
      );
    } else {
      customFont = await pdfDoc.embedFont(
        StandardFonts.TimesRoman,
      );
    }

    const rawUpdateFieldAppearances =
      form.updateFieldAppearances.bind(form);
    form.updateFieldAppearances = function () {
      return rawUpdateFieldAppearances(customFont);
    };

    for (const field of form.getFields()) {
      try {
        switch (getFieldTypeName(field)) {
          case "PDFTextField": {
            const f = field as PDFTextField;
            const text = data[field.getName()];
            if (text) {
              if (text.startsWith("file://")) {
                const filename = text.replace(
                  /^file:\/\//,
                  "",
                );
                console.log(`get file ${filename}`);
              } else {
                f.setText(text);
                console.log(
                  "field",
                  `"${f.getName()}"`,
                  "filling with text",
                  `"${f.getText()}"`,
                );
              }
            }
            break;
          }
          case "PDFSignature": {
            const sig = field as PDFSignature;

            const text = data[field.getName()];

            if (text && text.startsWith("file://")) {
              const filename = text.replace(
                /^file:\/\//,
                "",
              );
              console.log(`trying to get file ${filename}`);
              if (!appData.imgDir) {
                throw Error(`imgDir is required`);
              }
              const imgHandle =
                await appData.imgDir?.getFileHandle(
                  filename,
                );
              if (!imgHandle) {
                throw Error(
                  `${filename} not found in ${appData.imgDir.name}`,
                );
              }

              const file = await imgHandle.getFile();
              let pdfLibSigImg: PDFImage | undefined;
              if (file.type === "image/jpeg") {
                pdfLibSigImg = await pdfDoc.embedJpg(
                  await file.arrayBuffer(),
                );
              } else if (file.type === "image/png") {
                pdfLibSigImg = await pdfDoc.embedPng(
                  await file.arrayBuffer(),
                );
              }

              if (!pdfLibSigImg) {
                throw Error(`${file.type} is not support`);
              }

              sig.acroField
                .getWidgets()
                .forEach((widget) => {
                  console.log(
                    `drawing ${file.name} to field ${field.getName()}`,
                    `Rect: ${JSON.stringify(widget.getRectangle())}`,
                  );
                  const { context } = widget.dict;
                  const { width, height } =
                    widget.getRectangle();

                  const appearance = [
                    ...drawImage(filename, {
                      x: 0,
                      y: 0,
                      width: width,
                      height: height,
                      rotate: degrees(0),
                      xSkew: degrees(0),
                      ySkew: degrees(0),
                    }),
                  ];

                  const stream = context.formXObject(
                    appearance,
                    {
                      Resources: {
                        XObject: {
                          [filename]: pdfLibSigImg.ref,
                        },
                      },
                      BBox: context.obj([
                        0,
                        0,
                        width,
                        height,
                      ]),
                      Matrix: context.obj([
                        1, 0, 0, 1, 0, 0,
                      ]),
                    },
                  );
                  const streamRef =
                    context.register(stream);

                  widget.setNormalAppearance(streamRef);
                });
            } else {
              sig.acroField
                .getWidgets()
                .forEach((widget) => {
                  const { context } = widget.dict;
                  const { width, height } =
                    widget.getRectangle();
                  console.log(
                    `drawing text "${text}" to field ${field.getName()}`,
                    `Rect: ${JSON.stringify(widget.getRectangle())}`,
                  );
                  const fontSize =
                    customFont.sizeAtHeight(height);
                  const calcWidth =
                    customFont.widthOfTextAtSize(
                      text,
                      fontSize,
                    );
                  const ratio = width / calcWidth;
                  const calcSize = Math.min(
                    fontSize,
                    fontSize * ratio,
                  );
                  const fixedWidth =
                    customFont.widthOfTextAtSize(
                      text,
                      calcSize,
                    );

                  const appearance = [
                    PDFOperator.of(
                      PDFOperatorNames.BeginMarkedContent,
                      [asPDFName("Tx")],
                    ),
                    pushGraphicsState(),
                    ...drawText(
                      customFont.encodeText(text),
                      {
                        x: (width - fixedWidth) / 2,
                        y: (height - calcSize) / 2,
                        color: rgb(0, 0, 0),
                        font: customFont.name,
                        size: calcSize,
                        rotate: degrees(0),
                        xSkew: degrees(0),
                        ySkew: degrees(0),
                      },
                    ),
                    popGraphicsState(),
                    PDFOperator.of(
                      PDFOperatorNames.EndMarkedContent,
                    ),
                  ];
                  const stream = context.contentStream(
                    appearance,
                    {
                      BBox: context.obj([
                        0,
                        0,
                        width,
                        height,
                      ]),
                      Resources: {
                        Font: {
                          [customFont.name]: customFont.ref,
                        },
                      },
                      Matrix: context.obj([
                        1, 0, 0, 1, 0, 0,
                      ]),
                    },
                  );

                  const streamRef =
                    context.register(stream);

                  widget.setNormalAppearance(streamRef);

                  // console.warn(
                  //   `sign ${field.getName()} with text is not supported yet`,
                  // );
                });
            }
            break;
          }
        }
      } catch (err) {
        throw err;
      }
    }

    if (option.flattern) form.flatten();

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  }

  async function* generateFiles(
    data: Record<string, string>[],
    pdfBuf: ArrayBuffer,
  ): AsyncGenerator<[string, Uint8Array]> {
    for (const index in data) {
      const d = data[index];
      let name = `${Date.now()}.pdf`;
      if (option.exportFileName) {
        name = `${d[option.exportFileName]}.pdf`;
      }
      console.log(`start generating file: "${name}"`);
      try {
        const pdfBytes = await generateFile(d, pdfBuf);
        yield [name, pdfBytes];
      } catch (err: any) {
        console.error(
          `An error occured when generating file: "${name}`,
          (err as Error).message,
        );
        if (!option.skipError) {
          console.warn(
            "stop generating files due to an error occured.",
          );
          return;
        }
      }
    }
  }

  async function handleGenerate() {
    setOpen(true);
    const buf = await appData.pdf?.arrayBuffer();
    const handle = appData.workDir;
    let json = appData.fillData;
    if (!buf || !json || !handle) return;

    if (option.start || option.end) {
      json = json.slice(option.start, option.end);
    }
    console.info(`start generating ${json.length} files`);

    for await (const [name, bytes] of generateFiles(
      json,
      buf,
    )) {
      try {
        const fileHandle = await handle.getFileHandle(
          name,
          { create: true },
        );
        const writableStream =
          await fileHandle.createWritable();
        await writableStream.write(bytes);
        await writableStream.close();
        console.log(
          `file "${name}" saved to dir "${handle.name}"`,
        );
      } catch (err) {
        if (err instanceof Error)
          console.log(
            `An error occured when generating file: "${name}"`,
            err.message,
          );
      }
    }
    console.info("generate task done");
  }

  async function handleGenerateFirst() {
    setOpen(true);
    const buf = await appData.pdf?.arrayBuffer();
    const handle = appData.workDir;
    let json = appData.fillData;
    if (!buf || !json || !handle) return;
    const index = option.start ?? 0;
    const data = json.at(index);
    if (!data) {
      console.warn(`json[${index}] data not found`, json);
      return;
    }
    console.info("start generating one file");
    let name = `${Date.now()}.pdf`;
    try {
      const pdfBytes = await generateFile(data, buf);
      if (option.exportFileName) {
        name = `${data[option.exportFileName]}.pdf`;
      }

      const fileHandle = await handle.getFileHandle(name, {
        create: true,
      });
      const writableStream =
        await fileHandle.createWritable();
      await writableStream.write(pdfBytes);
      await writableStream.close();
      console.log(
        `file "${name}" saved to dir "${handle.name}"`,
      );
    } catch (err) {
      if (err instanceof Error)
        console.error(
          `An error occured when generating file: "${name}"`,
          err.message,
        );
    }
    console.info("generate task done");
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

  return (
    <LoggerProvider timestamp>
      <Resizable class="h-full w-full rounded-lg border">
        <ResizablePanel
          initialSize={0.4}
          minSize={0.2}
          class="relative overflow-y-auto"
        >
          <div class="absolute inset-2 flex flex-col gap-2">
            <h2 class="h2">Data</h2>
            <div class="grid gap-1.5">
              <label class="grid w-full max-w-xs gap-1.5">
                <p class="disabled-next text-sm font-medium">
                  Upload Xlsx
                </p>
                <Input
                  type="file"
                  accept=".xlsx"
                  disabled={info.loading}
                  onChange={loadingWrapper(async (e) => {
                    const file =
                      e.currentTarget.files?.item(0);
                    if (!file) return;

                    const ab = await file.arrayBuffer();
                    const workbook = read(ab);
                    const sheetName =
                      workbook.SheetNames[0];
                    const sheet =
                      workbook.Sheets[sheetName];

                    const json = utils.sheet_to_json(
                      sheet,
                      {
                        raw: false,
                        defval: "",
                        blankrows: false,
                      },
                    );
                    console.log(
                      "first row of data:",
                      JSON.stringify(json[0], null, 2),
                    );
                    setAppData(
                      "fillData",
                      json as Record<string, string>[],
                    );

                    const headers = [];
                    const columnCount =
                      utils.decode_range(sheet["!ref"]!).e
                        .c + 1;
                    for (let i = 0; i < columnCount; ++i) {
                      headers[i] =
                        sheet[`${utils.encode_col(i)}1`].v;
                    }
                    console.log(
                      "xlsx headers:",
                      JSON.stringify(headers, null, 2),
                    );

                    setAppData("headers", headers);
                  })}
                />
              </label>
              <Show when={appData.fillData}>
                {(handle) => (
                  <div
                    class="flex items-start gap-2 rounded-md border p-1 text-sm
                      font-medium shadow-sm"
                  >
                    <div class="flex w-full flex-1 flex-col">
                      <p>{`Length: ${handle().length}`}</p>
                      <Collapsible as="label">
                        <div class="flex items-center justify-between gap-4">
                          <p>
                            Headers{" "}
                            {appData.headers?.length}
                          </p>
                          <CollapsibleTrigger
                            as={(
                              props: CollapsibleTriggerProps,
                            ) => (
                              <Button
                                variant="ghost"
                                size="sm"
                                class="w-9 p-0"
                                onClick={props.onClick}
                              >
                                <ChevronsUpDown />
                                <span class="sr-only">
                                  Toggle
                                </span>
                              </Button>
                            )}
                          />
                        </div>
                        <CollapsibleContent class="space-y-2">
                          <ul class="list font-mono text-sm">
                            <For each={appData.headers}>
                              {(header) => (
                                <li>{header}</li>
                              )}
                            </For>
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        batch(() => {
                          setAppData("fillData", null);
                          setAppData("headers", null);
                        });
                      }}
                    >
                      <Trash class="size-4" />
                    </Button>
                  </div>
                )}
              </Show>
            </div>
            <div class="grid w-full gap-1.5">
              <label class="flex w-full max-w-xs flex-col gap-1.5">
                <p class="disabled-next text-sm font-medium">
                  Upload PDF
                </p>
                <Input
                  type="file"
                  id="pdf-template"
                  accept=".pdf"
                  disabled={info.loading}
                  onChange={loadingWrapper(async (e) => {
                    const file =
                      e.currentTarget.files?.item(0);
                    if (!file) return;

                    setAppData("pdf", file);

                    const pdfDoc = await PDFDocument.load(
                      await file.arrayBuffer(),
                    );
                    console.log(
                      "pdf fields",
                      pdfDoc
                        .getForm()
                        .getFields()
                        .map(
                          (f) =>
                            `Type: ${getFieldTypeName(f)} Name: ${f.getName()}`,
                        ),
                    );
                  })}
                />
              </label>
              <Show when={appData.pdf}>
                {(handle) => (
                  <div
                    class="flex items-center rounded-md border p-1 text-sm font-medium
                      shadow-sm"
                  >
                    <span class="flex-1">{`PDF file: "${handle().name}"`}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        setAppData("pdf", null)
                      }
                    >
                      <Trash class="size-4" />
                    </Button>
                  </div>
                )}
              </Show>
            </div>
            <div class="flex w-full max-w-xs flex-col gap-1.5">
              <p
                class="text-sm font-medium data-[disabled]:cursor-not-allowed
                  data-[disabled]:opacity-70"
              >
                Work Directory
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
                {appData.workDir ? `Change` : `Open`}
              </Button>
              <Show when={appData.workDir}>
                {(handle) => (
                  <div
                    class="flex items-center rounded-md border p-1 text-sm font-medium
                      shadow-sm"
                  >
                    <span class="w-full flex-1">{`Current work directory: "${handle().name}"`}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        setAppData("workDir", null)
                      }
                    >
                      <Trash class="size-4" />
                    </Button>
                  </div>
                )}
              </Show>
            </div>

            <div class="flex w-full max-w-xs flex-col gap-1.5">
              <p
                class="text-sm font-medium data-[disabled]:cursor-not-allowed
                  data-[disabled]:opacity-70"
              >
                Image Directory
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
                {appData.imgDir ? "Change" : "Open"}
              </Button>
              <Show when={appData.imgDir}>
                {(handle) => (
                  <div
                    class="flex items-center rounded-md border p-1 text-sm font-medium
                      shadow-sm"
                  >
                    <span class="w-full flex-1">{`Current image directory: "${handle().name}"`}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        setAppData("imgDir", null)
                      }
                    >
                      <Trash class="size-4" />
                    </Button>
                  </div>
                )}
              </Show>
            </div>

            <div class="w-full max-w-xs">
              <p
                class="text-sm font-medium data-[disabled]:cursor-not-allowed
                  data-[disabled]:opacity-70"
              >
                Generate
              </p>
              <div class="flex gap-1.5">
                <Button
                  disabled={!info.generateEnable}
                  onClick={loadingWrapper(
                    handleGenerateFirst,
                  )}
                >
                  Generate One
                </Button>
                <Button
                  disabled={!info.generateEnable}
                  onClick={loadingWrapper(handleGenerate)}
                >
                  Generate
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
          <div class="absolute inset-2 flex flex-col gap-2">
            <h2 class="h2">Options</h2>

            <div class="flex flex-col items-start gap-1.5">
              <label class="grid w-full max-w-xs gap-1.5">
                <p class="disabled-next text-sm font-medium">
                  Custom Font
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
                  <div
                    class="flex items-center gap-1.5 rounded-md border border-input p-1
                      shadow-sm"
                  >
                    <p class="text-sm">{`Use custom font: "${
                      font().name
                    }"`}</p>
                    <Button
                      disabled={info.loading}
                      onClick={(e) => {
                        e.preventDefault();
                        setCustomFontFile(null);
                      }}
                      variant="destructive"
                      size="icon"
                    >
                      <Trash class="size-4" />
                    </Button>
                  </div>
                )}
              </Show>
            </div>

            <NumberField
              class="w-full max-w-xs"
              value={option.start}
              minValue={0}
              maxValue={
                option.end ? option.end - 1 : undefined
              }
              onChange={(value) =>
                setOption(
                  "start",
                  optional(parseInt(value)) ?? undefined,
                )
              }
              disabled={!info.rangeEnable}
            >
              <NumberFieldLabel>
                Start Index
              </NumberFieldLabel>
              <div class="flex w-full gap-1">
                <NumberFieldGroup class="flex-1">
                  <NumberFieldDecrementTrigger aria-label="Decrement" />
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger aria-label="Increment" />
                </NumberFieldGroup>
                <Button
                  disabled={!info.rangeEnable}
                  onClick={() => setOption("start", 0)}
                >
                  First
                </Button>
              </div>
            </NumberField>

            <NumberField
              class="w-full max-w-xs"
              value={option.end}
              minValue={
                option.start ? option.start + 1 : undefined
              }
              maxValue={appData.fillData?.length}
              onChange={(value) =>
                setOption(
                  "end",
                  optional(parseInt(value)) ?? undefined,
                )
              }
              disabled={!info.rangeEnable}
            >
              <NumberFieldLabel>End Index</NumberFieldLabel>
              <div class="flex w-full gap-1">
                <NumberFieldGroup class="flex-1">
                  <NumberFieldDecrementTrigger aria-label="Decrement" />
                  <NumberFieldInput />
                  <NumberFieldIncrementTrigger aria-label="Increment" />
                </NumberFieldGroup>
                <Button
                  disabled={!info.rangeEnable}
                  onClick={() =>
                    setOption(
                      "end",
                      appData.fillData?.length,
                    )
                  }
                >
                  Last
                </Button>
              </div>
            </NumberField>
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
              <SwitchLabel
                class="text-sm font-medium leading-none
                  data-[disabled]:cursor-not-allowed
                  data-[disabled]:opacity-70"
              >
                Skip Error
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
              <SwitchLabel
                class="text-sm font-medium leading-none
                  data-[disabled]:cursor-not-allowed
                  data-[disabled]:opacity-70"
              >
                Flattern
              </SwitchLabel>
            </Switch>
            <label class="grid w-full max-w-xs gap-1.5">
              <p class="disabled-next text-sm font-medium">
                Export Name
              </p>
              <Select
                fitViewport
                placeholder="None"
                disabled={!info.selectColumnEnable}
                optionValue="value"
                optionTextValue="name"
                defaultValue={{
                  name: "None",
                  value: "",
                }}
                onChange={(v) => {
                  setOption(
                    "exportFileName",
                    reconcile(
                      optional(v.value) ?? undefined,
                    ),
                  );
                }}
                options={[
                  { name: "None", value: "" },
                  ...(appData.headers?.map((h) => ({
                    name: h,
                    value: h,
                  })) ?? []),
                ]}
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {props.item.rawValue.name}
                  </SelectItem>
                )}
              >
                <SelectTrigger class="w-full max-w-xs">
                  <SelectValue<Item>>
                    {(state) => state.selectedOption().name}
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

            <Drawer open={open()} onOpenChange={setOpen}>
              <DrawerTrigger
                as={Button}
                variant="outline"
                class="max-w-xs"
              >
                Open Logger
              </DrawerTrigger>
              <DrawerContent class="container flex h-2/3 flex-col">
                <DrawerHeader>
                  <DrawerLabel>
                    <Show
                      when={info.loading}
                      fallback={<>Logs</>}
                    >
                      Logging
                    </Show>
                  </DrawerLabel>
                </DrawerHeader>
                <div class="relative w-full flex-1">
                  <Logger
                    data-corvu-no-drag
                    class="absolute inset-0 select-text overflow-y-auto
                      whitespace-pre-wrap font-mono text-xs"
                  />
                </div>
              </DrawerContent>
            </Drawer>
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

export default App;
