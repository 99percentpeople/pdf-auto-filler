import { For } from "solid-js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { XlsxData } from "@/config";

export function XlsxPreview(props: { xlsx: XlsxData }) {
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
