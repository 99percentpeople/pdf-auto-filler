// PDFEditor.tsx
import { PdfData } from "@/config";
import { TreeDataItem, TreeView } from "./ui/tree-view";
import { PdfPreview } from "./viewers/PdfPreview";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import { SheetIcon } from "lucide-solid";
import {
  PdfFormInfo,
  PdfLayoutInfo,
  PdfPageInfo,
} from "@/libs/PDFViewerApp";
import { Dynamic } from "solid-js/web";

const AnnotationMap: Record<
  string,
  (ctx: {
    form: PdfFormInfo;
    value: any;
    setValue: (updater: (prev: any) => any) => void;
  }) => any
> = {
  tx: (props) => (
    <input
      placeholder={props.form.name || ""}
      type="text"
      value={props.value || ""}
      onInput={(e) =>
        props.setValue(() => e.currentTarget.value || "")
      }
      class="block size-full bg-transparent p-0 outline-none"
    />
  ),
  sig: (props) => (
    <input
      placeholder={props.form.name || ""}
      type="text"
      value={props.value || ""}
      onInput={(e) =>
        props.setValue(() => e.currentTarget.value || "")
      }
      class="block size-full bg-transparent p-0 outline-none"
    />
  ),
  btn: (props) => (
    <input
      type="checkbox"
      checked={props.value}
      onChange={(e) =>
        props.setValue(() => e.currentTarget.checked)
      }
      class="size-full"
    />
  ),
  ch: (props) => (
    <select
      multiple={props.form.value.length > 1}
      value={props.value || ""}
      onInput={(e) =>
        props.setValue(() => e.currentTarget.value || "")
      }
      class="block size-full bg-transparent p-0 outline-none"
    >
      {props.form.options?.map((option) => (
        <option
          value={option.value}
          selected={props.value.includes(option.value)}
          class="text-base"
        >
          {option.label}
        </option>
      ))}
    </select>
  ),
  // 其他类型的表单字段，默认渲染为红色警告框
  __default: (props) => (
    <div class="size-full bg-red-100/50 text-red-500">
      {props.form.name}
    </div>
  ),
};

export default function PDFEditor(props: {
  pdf: PdfData;
  onUpdate?: (pdf: File) => void;
}) {
  const [log, setLog] = createSignal("");
  const [pdfInfo, setPdfInfo] =
    createSignal<PdfLayoutInfo | null>(null);

  const data = createMemo<TreeDataItem[]>(
    () =>
      pdfInfo()?.pages.map((page) => ({
        id: `page-${page.pageNumber}`,
        name: `Page ${page.pageNumber}`,
        icon: SheetIcon,
        draggable: false,
        droppable: false,
        children: page.forms.map((form, index) => ({
          id: `page-${page.pageNumber}-field-${index + 1}`,
          name: `${form.name}`,
          icon: SheetIcon,
          draggable: false,
          droppable: false,
        })),
      })) || [],
  );

  return (
    <div class="flex size-full">
      <div class="relative w-xs border-r border-r-border">
        <Show when={data()}>
          {(d) => (
            <TreeView
              data={d()}
              class="absolute inset-0 overflow-auto"
              draggable={false}
              expandAll={true}
              onSelectChange={(item) =>
                setLog(`Selected: ${item?.name}`)
              }
              onDocumentDrag={(src, target) =>
                setLog(
                  `Dragged ${src.name} → ${target.name}`,
                )
              }
            />
          )}
        </Show>
      </div>
      <PdfPreview
        class="flex-1"
        pdf={props.pdf}
        onLoaded={(info) => {
          // console.debug("onLoaded", info);
          setPdfInfo(info);
        }}
        renderOverlay={ResultOverlay}
      />
    </div>
  );
}

const ResultOverlay = (props: { info: PdfLayoutInfo }) => {
  const [values, setValues] = createSignal<
    Record<string, any>
  >({});
  createEffect(() => {
    const valueFromPages = (pages: PdfPageInfo[]) =>
      pages.reduce<Record<string, any>>((acc, page) => {
        page.forms.forEach((form) => {
          // console.debug("form", form);
          const name = form.name || "";
          const ft = (form.type || "").toLowerCase();
          const dv = form.value || "";
          const v =
            ft === "btn" ? /^(yes)$/i.test(String(dv)) : dv;
          acc[name] = v;
        });
        return acc;
      }, {});

    setValues((prev) => ({
      ...valueFromPages(props.info.pages),
      ...prev,
    }));
  });
  return (
    <For each={props.info.pages}>
      {(page) => (
        <div
          id={`page-${page.pageNumber}`}
          style={{
            position: "absolute",
            left: `${page.containerRect.x}px`,
            top: `${page.containerRect.y}px`,
            width: `${page.containerRect.width}px`,
            height: `${page.containerRect.height}px`,
            "pointer-events": "none",
          }}
        >
          <For each={page.forms}>
            {(form) => (
              <div
                style={{
                  position: "absolute",
                  left: `${form.pageRect.x}px`,
                  top: `${form.pageRect.y}px`,
                  width: `${form.pageRect.width}px`,
                  height: `${form.pageRect.height}px`,
                  "pointer-events": "auto",
                  "font-size": `${(form.appearanceData?.fontSize || 12) * page.scale}px`,
                }}
                class="overflow-hidden border border-primary/60 bg-background/70"
              >
                <Dynamic
                  component={
                    AnnotationMap[
                      (form.type || "").toLowerCase()
                    ] ?? AnnotationMap["__default"]
                  }
                  form={form}
                  value={values()[form.name || ""] || ""}
                  setValue={(v) =>
                    setValues((prev) => ({
                      ...prev,
                      [form.name || ""]: v(prev),
                    }))
                  }
                />
              </div>
            )}
          </For>
        </div>
      )}
    </For>
  );
};
