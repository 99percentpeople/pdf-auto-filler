import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  Show,
  type Component,
} from "solid-js";
import { createStore } from "solid-js/store";
import "./App.css";
import logo from "./logo.svg";
import { PDFDocument, PDFTextField, StandardFonts, rgb } from "pdf-lib";
import { read, utils, WorkSheet } from "xlsx";
import JSZip from "jszip";
import { optional } from "./helper";

const App: Component = () => {
  const [zipFile, setZipFile] = createSignal<File | null>(null);
  const [loading, setIsloading] = createSignal<boolean>(false);
  const [sheet, setSheet] = createSignal<WorkSheet | null>(null);
  const [pdfBuf, setPdfBuf] = createSignal<ArrayBuffer | null>(null);

  const [option, setOption] = createStore<{
    start?: number;
    end?: number;
    fileWithColumnName?: string;
  }>({ start: 0, end: 10 });
  const jsonData = createMemo<any[] | null>(() => {
    const s = sheet();
    if (s) {
      return utils.sheet_to_json(s, { raw: false });
    } else {
      return null;
    }
  });

  const headers = createMemo<string[] | null>(() => {
    const s = sheet();
    if (s) {
      const header = [];
      const columnCount = utils.decode_range(s["!ref"]!).e.c + 1;
      for (let i = 0; i < columnCount; ++i) {
        header[i] = s[`${utils.encode_col(i)}1`].v;
      }
      return header;
    } else {
      return null;
    }
  });

  async function generate() {
    const buf = pdfBuf();
    let data = jsonData();
    if (!buf || !data) return;
    setIsloading(true);
    const zip = new JSZip();
    // const pdfs = zip.folder("pdfs");
    // if (!pdfs) throw Error("pdfs is null");
    if (option.start || option.end) {
      data = data.slice(option.start, option.end);
    }
    let fileTitle = "gen";

    const promises = data.map(async (data, index) => {
      const pdfDoc = await PDFDocument.load(buf);
      const form = pdfDoc.getForm();
      console.log(form);

      fileTitle = pdfDoc.getTitle() ?? fileTitle;

      const pr = headers()?.map(async (header) => {
        try {
          const field = form.getFieldMaybe(header);

          if (field instanceof PDFTextField) {
            field.setText(data[header]);
            console.log("set text:", field.getName(), field.getText());
          }
        } catch (err) {
          console.warn(err);
        }
        return;
      });
      if (pr) await Promise.all(pr);
      const pdfBytes = await pdfDoc.save();
      if (option.fileWithColumnName) {
        zip.file(`${data[option.fileWithColumnName]}.pdf`, pdfBytes, {
          binary: true,
        });
      } else {
        zip.file(`${index}.pdf`, pdfBytes, { binary: true });
      }
      return;
    });

    if (promises) await Promise.all(promises);

    const content = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
    });
    console.log(content);

    setZipFile(
      new File([content], `${fileTitle}.${Date.now()}.zip`, {
        type: "application/zip",
      })
    );
    setIsloading(false);
  }

  return (
    <div>
      <Show when={BUILD_DATE}>
        {(bd) => <h1 class="text-xl font-bold">{`Build Date: ${bd()}`}</h1>}
      </Show>
      <Show when={loading()}>
        <h1 class="text-2xl font-bold">Loading</h1>
      </Show>
      <div>
        <p>Options</p>
        <div class="flex flex-col w-full">
          <label class="w-full max-w-xs">
            <p>start</p>
            <input
              class="border w-full"
              type="number"
              min={0}
              max={option.end ? option.end - 1 : undefined}
              value={option.start}
              onInput={(e) => setOption("start", e.currentTarget.valueAsNumber)}
              disabled={loading()}
            ></input>
          </label>
          <label class="w-full max-w-xs">
            <p>end</p>
            <input
              class="border w-full"
              type="number"
              min={option.start ? option.start + 1 : undefined}
              value={option.end}
              onInput={(e) => setOption("end", e.currentTarget.valueAsNumber)}
              disabled={loading()}
            ></input>
          </label>
          <Show when={headers()}>
            {(headers) => (
              <label class="w-full max-w-xs">
                <p>Set file With Column Name</p>
                <select
                  class="border w-full"
                  onChange={(e) =>
                    setOption(
                      "fileWithColumnName",
                      optional(
                        e.currentTarget.selectedOptions.item(0)?.value
                      ) ?? undefined
                    )
                  }
                  disabled={loading()}
                >
                  <option value="" selected={!option.fileWithColumnName}>
                    None
                  </option>
                  <For each={headers()}>
                    {(header) => (
                      <option
                        value={header}
                        selected={option.fileWithColumnName === header}
                      >
                        {header}
                      </option>
                    )}
                  </For>
                </select>
              </label>
            )}
          </Show>
        </div>
        <pre>{JSON.stringify(option, null, 2)}</pre>
      </div>
      <div>
        <p>Step 1 Upload Xlsx</p>
        <input
          type="file"
          id="excel-file"
          accept=".xlsx"
          disabled={loading()}
          onChange={async (e) => {
            setIsloading(true);
            const file = e.currentTarget.files?.item(0);
            if (!file) return;

            const ab = await file.arrayBuffer();
            const workbook = read(ab);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            setSheet(sheet);
            setIsloading(false);
          }}
        />
      </div>
      <div>
        <p>Step 2 Upload PDF</p>
        <input
          type="file"
          id="pdf-template"
          accept=".pdf"
          disabled={loading()}
          onChange={async (e) => {
            setIsloading(true);
            const file = e.currentTarget.files?.item(0);
            if (!file) return;

            const pdfData = await file.arrayBuffer();
            setPdfBuf(pdfData);
            const pdfDoc = await PDFDocument.load(pdfData);
            console.log(
              "text fields",
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
      </div>
      <Show when={pdfBuf() && jsonData()}>
        <div>
          <p>Step 3 Generate</p>
          <button
            disabled={loading()}
            class="border enabled:hover:bg-zinc-50 disabled:cursor-not-allowed bg-zinc-100 p-1"
            onClick={() => generate()}
          >
            Generate
          </button>
        </div>
      </Show>
      <Show when={zipFile()}>
        {(c) => (
          <div>
            <p>Step 4 Download</p>
            <a
              class="text-blue-500 hover:underline"
              href={URL.createObjectURL(c())}
              download={c().name}
            >
              Download
            </a>
          </div>
        )}
      </Show>
      <Show when={jsonData()}>
        <details>
          <summary class="text-2xl font-bold">XLSX Info</summary>
          <pre>
            <p>Headers</p>
            {JSON.stringify(headers())}
          </pre>
          <pre>
            <p>Data</p>
            {JSON.stringify(jsonData(), null, 2)}
          </pre>
        </details>
      </Show>

      <Show when={pdfBuf()}>
        {(pdf) => {
          const [pdfDoc, setPdfDoc] = createSignal<PDFDocument | undefined>();
          createEffect(async () => {
            setPdfDoc(await PDFDocument.load(pdf()));
          });
          return (
            <details>
              <summary class="text-2xl fontt-bold">PDF Info</summary>
              <pre>
                <p>Text fields</p>
                {JSON.stringify(
                  pdfDoc()
                    ?.getForm()
                    .getFields()
                    .filter((field) => {
                      return field instanceof PDFTextField;
                    })
                    .map((tf) => tf.getName()),
                  null,
                  2
                )}
              </pre>
            </details>
          );
        }}
      </Show>
    </div>
  );
};

export default App;
