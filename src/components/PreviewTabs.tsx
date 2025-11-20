import { Show } from "solid-js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import { FileTextIcon, SheetIcon } from "lucide-solid";
import { XlsxPreview } from "./viewers/XlsxPreview";
import { PdfData, XlsxData } from "@/config";
import PDFEditor from "./PDFEditor";
import { DraggableUploadZone } from "./DraggableUploadZone";

export default function PreviewTabs(props: {
  xlsx?: XlsxData | null;
  pdf?: PdfData | null;
  onUpdatePdf?: (pdf: File) => void;
  onUpdateXlsx?: (xlsx: File) => void;
}) {
  // 业务逻辑：校验 PDF
  const handlePdfUpload = (file: File) => {
    if (file.type === "application/pdf") {
      props.onUpdatePdf?.(file);
    } else {
      // 这里可以换成你的 Toast 组件
      console.warn("文件格式错误：请上传 PDF 文件");
    }
  };

  // 业务逻辑：校验 Excel
  const handleXlsxUpload = (file: File) => {
    if (
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls")
    ) {
      props.onUpdateXlsx?.(file);
    } else {
      console.warn("文件格式错误：请上传 Excel 文件");
    }
  };

  return (
    <Tabs
      defaultValue="pdf"
      class="flex size-full flex-col"
    >
      <TabsList class="flex h-auto w-full justify-start gap-0.5 bg-transparent p-0 px-1 pt-1 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border">
        <TabsTrigger
          class="flex-initial overflow-hidden rounded-b-none border-x-border border-t-border bg-muted py-2 data-selected:z-10 data-selected:shadow-none"
          value="xlsx"
        >
          <SheetIcon class="size-4" />
          Excel
        </TabsTrigger>
        <TabsTrigger
          class="flex-initial overflow-hidden rounded-b-none border-x-border border-t-border bg-muted py-2 data-selected:z-10 data-selected:shadow-none"
          value="pdf"
        >
          <FileTextIcon class="size-4" />
          PDF
        </TabsTrigger>
      </TabsList>

      {/* Excel 内容区域 */}
      <TabsContent
        value="xlsx"
        class="relative flex flex-1 flex-col overflow-auto"
      >
        <Show
          when={props.xlsx}
          fallback={
            <DraggableUploadZone
              accept=".xlsx, .xls"
              text="点击或拖拽上传 Excel 文件"
              subText="支持 .xlsx, .xls 格式"
              onUpload={handleXlsxUpload}
            />
          }
        >
          {(xlsx) => <XlsxPreview xlsx={xlsx()} />}
        </Show>
      </TabsContent>

      {/* PDF 内容区域 */}
      <TabsContent
        value="pdf"
        class="relative flex flex-1 flex-col overflow-auto"
      >
        <Show
          when={props.pdf}
          fallback={
            <DraggableUploadZone
              accept=".pdf"
              text="点击或拖拽上传 PDF 文件"
              subText="支持 .pdf 格式"
              onUpload={handlePdfUpload}
            />
          }
        >
          {(pdf) => (
            <PDFEditor
              pdf={pdf()}
              onUpdate={props.onUpdatePdf}
            />
          )}
        </Show>
      </TabsContent>
    </Tabs>
  );
}
