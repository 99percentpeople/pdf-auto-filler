import { Drawer, DrawerContent, DrawerHeader, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Logger, useLogger } from "@/components/Logger";
import { Trash2 } from "lucide-solid";
import { createEffect, createSignal, onCleanup } from "solid-js";

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export interface GenStats {
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

export default function LoggerDrawer(props: {
  logging: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  stats: GenStats;
}) {
  const { clear } = useLogger();
  const [now, setNow] = createSignal<number>(Date.now());
  let timer: number | undefined;

  createEffect(() => {
    const running = props.logging && !props.stats.endAt && !!props.stats.startAt;
    if (running && timer === undefined) {
      timer = window.setInterval(() => setNow(Date.now()), 1000);
    } else if (!running && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  });

  onCleanup(() => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  });

  const elapsedText = () =>
    formatDuration(Math.max((props.stats.endAt ?? now()) - props.stats.startAt, 0));
  return (
    <Drawer open={props.open} onOpenChange={props.setOpen}>
      <DrawerContent class="container mx-auto flex h-2/3 flex-col">
        <DrawerHeader>
          <div class="flex w-full items-center justify-between">
            <h3 class="h3">日志</h3>
            <Button variant="destructive" size="icon" onClick={clear}>
              <Trash2 />
            </Button>
          </div>
          <div class="flex justify-between gap-2 text-xs">
            <div class="flex flex-wrap gap-1">
              <Badge variant="secondary">总计: {props.stats.total}</Badge>
              <Badge variant="secondary">生成成功: {props.stats.generatedOk}</Badge>
              <Badge variant="secondary">生成失败: {props.stats.generatedErr}</Badge>
              <Badge variant="secondary">写入成功: {props.stats.writtenOk}</Badge>
              <Badge variant="secondary">写入失败: {props.stats.writtenErr}</Badge>
              <Badge variant="secondary">
                跳过: {props.stats.skippedGen + props.stats.skippedWrite}
              </Badge>
            </div>
            <div class="flex items-center justify-end gap-2">
              {props.logging || props.stats.endAt ? (
                <span class="muted">用时: {elapsedText()}</span>
              ) : (
                <></>
              )}
              <span class="muted">
                状态: {props.logging ? "运行中" : props.stats.endAt ? "已完成" : "待开始"}
              </span>
            </div>
          </div>
        </DrawerHeader>
        <Separator />
        <div class="relative w-full flex-1">
          <Logger data-corvu-no-drag class="absolute inset-0 overflow-y-auto font-mono text-xs whitespace-pre-wrap select-text" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
