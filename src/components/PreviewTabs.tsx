import { createMemo, For, Show } from "solid-js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { FileTextIcon, SheetIcon } from "lucide-solid";

export interface XlsxData {
  file: File;
  headers: string[];
  data: Record<string, string>[];
}

export interface PdfData {
  file: File;
}

export default function PreviewTabs(props: {
  xlsx?: XlsxData | null;
  pdf?: PdfData | null;
}) {
  const pdfUrl = createMemo(() => {
    const f = props.pdf?.file;
    if (!f) return undefined;
    return URL.createObjectURL(f);
  });

  const hasXlsx = () => !!props.xlsx;
  const hasPdf = () => !!props.pdf;

  return (
    <Tabs class="flex size-full flex-col">
      <TabsList class="flex h-auto w-full justify-start gap-0.5 bg-transparent p-0 px-1 pt-1 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border">
        <TabsTrigger
          class="flex-initial overflow-hidden rounded-b-none border-x border-t border-border bg-muted py-2 data-selected:z-10 data-selected:shadow-none"
          value="xlsx"
        >
          <SheetIcon class="size-4" />
          Excel
        </TabsTrigger>
        <TabsTrigger
          class="flex-initial overflow-hidden rounded-b-none border-x border-t border-border bg-muted py-2 data-selected:z-10 data-selected:shadow-none"
          value="pdf"
        >
          <FileTextIcon class="size-4" />
          PDF
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="xlsx"
        class="relative flex-1 overflow-auto"
      >
        <div class="absolute inset-0">
          <Show
            when={props.xlsx}
            fallback={
              <p class="muted">请先上传 Excel 文件</p>
            }
          >
            {(xlsx) => <XlsxPreview xlsx={xlsx()} />}
          </Show>
        </div>
      </TabsContent>
      <TabsContent
        value="pdf"
        class="relative flex-1 overflow-auto"
      >
        <PdfPreview url={pdfUrl()} />
      </TabsContent>
    </Tabs>
  );
}

function PdfPreview(props: { url?: string }) {
  return (
    <Show
      when={props.url}
      fallback={<p class="muted">请先上传 PDF 文件</p>}
    >
      {(u) => (
        <iframe
          src={u()}
          class="size-full rounded-md border"
        />
      )}
    </Show>
  );
}

function XlsxPreview(props: { xlsx: XlsxData }) {
  const headers = () => props.xlsx.headers;
  const rows = () =>
    props.xlsx.data.slice(
      0,
      Math.min(props.xlsx.data.length, 100),
    );
  return (
    <div class="relative size-full overflow-auto">
      <Table class="absolute inset-0 w-full text-xs text-nowrap">
        <TableHeader>
          <TableRow class="sticky top-0 bg-background">
            <For each={headers()}>
              {(h) => <TableHead>{h}</TableHead>}
            </For>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={rows()}>
            {(row) => (
              <TableRow>
                <For each={headers()}>
                  {(h) => (
                    <TableCell>{row[h] ?? ""}</TableCell>
                  )}
                </For>
              </TableRow>
            )}
          </For>
        </TableBody>
      </Table>
    </div>
  );
}
