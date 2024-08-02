import {
  createEffect,
  createMemo,
  createSignal,
  onMount,
  Show,
  type Component,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import "./App.css";
import { PDFDocument, PDFFont, PDFTextField } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { read, utils, WorkSheet } from "xlsx";
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
import { Logger } from "./components/Logger";

type Item = {
  value: string;
  name?: string;
};

type AppOptions = {
  start?: number;
  end?: number;
  fileWithColumnName?: string;
};

type AppInfo = {
  uploadEnable: boolean;
  rangeEnable: boolean;
  selectColumnEnable: boolean;
  generateEnable: boolean;
};

async function verifyPermission(
  fileHandle: FileSystemFileHandle | FileSystemDirectoryHandle,
  withWrite: boolean
): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = {};
  if (withWrite) {
    opts.mode = "readwrite";
  }

  // 检查是否已经拥有相应权限，如果是，返回 true。
  if ((await fileHandle.queryPermission(opts)) === "granted") {
    return true;
  }

  // 为文件请求权限，如果用户授予了权限，返回 true。
  if ((await fileHandle.requestPermission(opts)) === "granted") {
    return true;
  }

  // 用户没有授权，返回 false。
  return false;
}

const App: Component = () => {
  const [loading, setIsloading] = createSignal<boolean>(false);
  const [sheet, setSheet] = createSignal<WorkSheet | null>(null);
  const [pdfBuf, setPdfBuf] = createSignal<ArrayBuffer | null>(null);
  const [customFontFile, setCustomFontFile] = createSignal<File | null>(null);
  const [info, setInfo] = createStore<AppInfo>({
    uploadEnable: true,
    rangeEnable: false,
    selectColumnEnable: false,
    generateEnable: false,
  });
  const [option, setOption] = createStore<AppOptions>({ start: 0 });

  const [dirHandle, setDirHandle] = createSignal<FileSystemDirectoryHandle>();

  onMount(async () => {
    const handle = await get<FileSystemDirectoryHandle>("dir");
    if (handle) {
      if (await verifyPermission(handle, true)) {
        console.log(`Directory is loaded, current permission state is granted`);
      } else {
        console.error(`verifyPermission failed`);
      }

      setDirHandle(handle);
    }
    createEffect(async () => {
      await set("dir", dirHandle());
    });
    const font = await get<File>("font");
    if (font) {
      setCustomFontFile(font);
    }
    createEffect(async () => {
      const font = customFontFile();
      await set("font", font);
      if (font) console.log(`use custom font file: ${font.name}`);
    });
  });

  const jsonData = createMemo<Record<string, string>[] | null>(() => {
    const s = sheet();
    if (s) {
      const json = utils.sheet_to_json(s, {
        raw: false,
        defval: "",
        blankrows: false,
      });
      console.log("first row of data:", JSON.stringify(json[0], null, 2));
      return json as Record<string, string>[];
    } else {
      return null;
    }
  });

  createEffect(() => {
    const data = jsonData();
    setInfo("rangeEnable", !!data && !loading());
    setInfo("selectColumnEnable", !!data && !loading());
  });

  createEffect(() => {
    const handle = dirHandle();
    setInfo(
      "generateEnable",
      !!handle && !loading() && !!jsonData() && !!pdfBuf()
    );
  });

  const headers = createMemo<string[] | null>(() => {
    const s = sheet();
    if (s) {
      const header = [];
      const columnCount = utils.decode_range(s["!ref"]!).e.c + 1;
      for (let i = 0; i < columnCount; ++i) {
        header[i] = s[`${utils.encode_col(i)}1`].v;
      }
      console.log("xlsx headers:", JSON.stringify(header, null, 2));

      return header;
    } else {
      return null;
    }
  });

  async function selectWorkDir() {
    try {
      const handle = await window.showDirectoryPicker({
        startIn: "documents",
        mode: "readwrite",
      });
      console.log("user select dir name: ", handle.name);

      setDirHandle(handle);
    } catch (err) {
      console.warn(err);
    }
  }

  async function* generateFile(
    data: Record<string, string>[],
    pdfBuf: ArrayBuffer
  ): AsyncGenerator<[string, Uint8Array]> {
    for (const index in data) {
      const d = data[index];
      let name = `${index}.pdf`;
      if (option.fileWithColumnName) {
        name = `${d[option.fileWithColumnName]}.pdf`;
      }
      console.log(`start generating file: "${name}"`);
      try {
        const pdfDoc = await PDFDocument.load(pdfBuf);
        const font = customFontFile();
        const form = pdfDoc.getForm();
        let customFont: PDFFont | undefined;
        if (font) {
          pdfDoc.registerFontkit(fontkit);
          customFont = await pdfDoc.embedFont(await font.arrayBuffer(), {});
          const rawUpdateFieldAppearances =
            form.updateFieldAppearances.bind(form);
          form.updateFieldAppearances = function () {
            return rawUpdateFieldAppearances(customFont);
          };
        }
        form.getFields().forEach((field) => {
          if (field instanceof PDFTextField) {
            const text = d[field.getName()];
            if (text) {
              field.setText(text);
              console.log(
                "field",
                `"${field.getName()}"`,
                "filling with text",
                `"${field.getText()}"`
              );
            }
          }
        });

        const pdfBytes = await pdfDoc.save();

        yield [name, pdfBytes];
      } catch (err: any) {
        console.error(
          `An error occured when generating file: "${name}`,
          (err as Error).message
        );
        return;
      }
    }
  }

  async function generate() {
    const buf = pdfBuf();
    const handle = dirHandle();
    let data = jsonData();
    if (!buf || !data || !handle) return;
    setIsloading(true);
    // const zip = new JSZip();
    // const pdfs = zip.folder("pdfs");
    // if (!pdfs) throw Error("pdfs is null");

    if (option.start || option.end) {
      data = data.slice(option.start, option.end);
    }

    for await (const [name, bytes] of generateFile(data, buf)) {
      try {
        const fileHandle = await handle.getFileHandle(name, { create: true });
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(bytes);
        await writableStream.close();
        console.log(`file "${name}" saved to dir "${handle.name}"`);
      } catch (err) {
        console.log(`An error occured when saving file: "${name}"`);
      }
    }

    setIsloading(false);
  }

  return (
    <Resizable class="w-full rounded-lg border">
      <ResizablePanel
        initialSize={0.4}
        minSize={0.2}
        class="p-2 flex-col flex gap-2"
      >
        {/* <Button onClick={() => ref.open()}>Open</Button>
        <FileManage ref={ref} /> */}
        <label class="w-full max-w-xs grid gap-1.5">
          <p class="text-sm font-medium disabled-next">Step 1 Upload Xlsx</p>
          <Input
            type="file"
            accept=".xlsx"
            disabled={loading()}
            onChange={async (e) => {
              setIsloading(true);
              const file = e.currentTarget.files?.item(0);
              if (!file) {
                setIsloading(false);
                return;
              }

              const ab = await file.arrayBuffer();
              const workbook = read(ab);
              const sheetName = workbook.SheetNames[0];
              const sheet = workbook.Sheets[sheetName];

              setSheet(sheet);
              setIsloading(false);
            }}
          />
        </label>

        <label class="w-full max-w-xs grid gap-1.5">
          <p class="text-sm font-medium disabled-next">Step 2 Upload PDF</p>
          <Input
            type="file"
            id="pdf-template"
            accept=".pdf"
            disabled={loading()}
            onChange={async (e) => {
              setIsloading(true);
              const file = e.currentTarget.files?.item(0);
              if (!file) {
                setIsloading(false);
                return;
              }

              const pdfData = await file.arrayBuffer();
              setPdfBuf(pdfData);
              const pdfDoc = await PDFDocument.load(pdfData);
              console.log(
                "pdf text fields",
                pdfDoc
                  .getForm()
                  .getFields()
                  .filter((field) => {
                    return field instanceof PDFTextField;
                  })
                  .map((tf) => tf.getName())
              );

              setIsloading(false);
            }}
          />
        </label>
        <div class="w-full max-w-xs">
          <p class="text-sm data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70 font-medium">
            Step 3 Open Directory
          </p>
          <Button disabled={loading()} onClick={selectWorkDir}>
            {dirHandle() ? `Change` : `Open`}
          </Button>
          <Show when={dirHandle()}>
            {(handle) => (
              <p class="text-sm  font-medium">{`Current work directory is ${
                handle().name
              }`}</p>
            )}
          </Show>
        </div>

        <div class="w-full max-w-xs">
          <p class="text-sm data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70 font-medium">
            Step 4 Generate
          </p>
          <Button disabled={!info.generateEnable} onClick={() => generate()}>
            Generate
          </Button>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel initialSize={0.6} minSize={0.2}>
        <Resizable orientation="vertical">
          <ResizablePanel
            initialSize={0.4}
            minSize={0.2}
            class="flex flex-col p-2 gap-2"
          >
            <p class="text-lg font-bold">Options</p>

            <div class="flex flex-col gap-2 w-full">
              <div class="flex flex-col items-start">
                <div class="flex gap-1 items-end">
                  <label class="w-full max-w-xs grid gap-1.5">
                    <p class="text-sm font-medium disabled-next">Custom Font</p>
                    <Input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      disabled={loading()}
                      onChange={async (e) => {
                        setIsloading(true);
                        const file = e.currentTarget.files?.item(0);
                        if (!file) {
                          setIsloading(false);
                          return;
                        }

                        setCustomFontFile(file);
                        setIsloading(false);
                      }}
                    />
                  </label>
                  <Button
                    disabled={!customFontFile()}
                    onClick={() => setCustomFontFile(null)}
                  >
                    Remove
                  </Button>
                </div>
                <Show when={customFontFile()}>
                  {(font) => (
                    <p class="text-sm">{`use custom font: "${font().name}"`}</p>
                  )}
                </Show>
              </div>

              <NumberField
                class="w-full max-w-xs"
                value={option.start}
                minValue={0}
                maxValue={option.end ? option.end - 1 : undefined}
                onChange={(value) =>
                  setOption("start", optional(parseInt(value)) ?? undefined)
                }
                disabled={!info.rangeEnable}
              >
                <NumberFieldLabel>Start Index</NumberFieldLabel>
                <div class="flex gap-1">
                  <NumberFieldGroup>
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
                minValue={option.start ? option.start + 1 : undefined}
                maxValue={jsonData()?.length}
                onChange={(value) =>
                  setOption("end", optional(parseInt(value)) ?? undefined)
                }
                disabled={!info.rangeEnable}
              >
                <NumberFieldLabel>End Index</NumberFieldLabel>
                <div class="flex gap-1">
                  <NumberFieldGroup>
                    <NumberFieldDecrementTrigger aria-label="Decrement" />
                    <NumberFieldInput />
                    <NumberFieldIncrementTrigger aria-label="Increment" />
                  </NumberFieldGroup>
                  <Button
                    disabled={!info.rangeEnable}
                    onClick={() => setOption("end", jsonData()?.length)}
                  >
                    Last
                  </Button>
                </div>
              </NumberField>
              <label class="grid gap-1.5 w-full max-w-xs">
                <p class="text-sm disabled-next font-medium">
                  fllow the column name
                </p>
                <Select
                  placeholder="None"
                  disabled={!info.selectColumnEnable}
                  optionValue="value"
                  optionTextValue="name"
                  defaultValue={{ name: "None", value: "" }}
                  onChange={(v) => {
                    setOption(
                      "fileWithColumnName",
                      reconcile(optional(v.value) ?? undefined)
                    );
                  }}
                  options={[
                    { name: "None", value: "" },
                    ...(headers()?.map((h) => ({ name: h, value: h })) ?? []),
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
                  <SelectContent />
                </Select>
              </label>
            </div>
            {/* <pre>{JSON.stringify(option, null, 2)}</pre> */}
            <Show when={loading()}>
              <h1 class="text-2xl font-bold">Loading</h1>
            </Show>
            <Show when={BUILD_DATE}>
              {(bd) => <p>{`Build Date: ${bd()}`}</p>}
            </Show>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel initialSize={0.6} minSize={0} class="relative">
            <Logger
              timestamp
              class="h-full w-full text-xs  whitespace-pre-wrap overflow-y-auto absolute inset-0"
            />
          </ResizablePanel>
        </Resizable>
      </ResizablePanel>
    </Resizable>
  );
};

export default App;
