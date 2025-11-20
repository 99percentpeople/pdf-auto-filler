import { PdfData } from "@/config";
import {
  PDFViewerApp,
  PdfLayoutInfo,
} from "@/libs/PDFViewerApp";
import {
  Component,
  ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Button } from "../ui/button";
import {
  MaximizeIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-solid";
import { cn } from "@/libs/cn";

export function PdfPreview(props: {
  pdf: PdfData;
  class?: string;
  onLoaded?: (info: PdfLayoutInfo) => void;
  renderOverlay?: Component<{ info: PdfLayoutInfo }>;
}) {
  let outerRef: HTMLDivElement | undefined;
  let pdfContainer: HTMLDivElement | undefined;
  let pdfViewerApp: PDFViewerApp | undefined;

  // 状态管理
  const [layoutInfo, setLayoutInfo] =
    createSignal<PdfLayoutInfo | null>(null, {
      equals: false,
    });
  const [scale, setScale] = createSignal<number>(1); // 默认缩放比例 100%

  const pdfUrl = createMemo(() => {
    const f = props.pdf?.file;
    if (!f) return undefined;
    return URL.createObjectURL(f);
  });

  const handleWheel = (e: WheelEvent) => {
    // 检查是否按下了 Ctrl 键 (Windows) 或 Meta 键 (Mac)
    if (e.ctrlKey || e.metaKey) {
      // 阻止浏览器默认的页面缩放行为
      e.preventDefault();

      // 1. 获取容器在视口中的绝对位置
      const rect = pdfContainer!.getBoundingClientRect();

      const [scrollLeft, scrollTop] = [
        pdfContainer!.scrollLeft,
        pdfContainer!.scrollTop,
      ];

      // 2. 计算鼠标相对于容器可视区域左上角的坐标
      const originX = e.clientX - rect.left + scrollLeft;
      const originY = e.clientY - rect.top + scrollTop;
      const origin: [number, number] = [originX, originY];

      // deltaY < 0 表示滚轮向上滚（放大），deltaY > 0 表示向下滚（缩小）
      if (e.deltaY < 0) {
        pdfViewerApp?.zoomIn(1, origin);
      } else {
        pdfViewerApp?.zoomOut(1, origin);
      }
    }
  };

  onMount(() => {
    if (!pdfContainer) return;
    if (!pdfViewerApp)
      pdfViewerApp = new PDFViewerApp(pdfContainer);

    // 1. 监听布局变化 (自定义事件)
    const onLayoutInfoUpdated = (event: any) => {
      // 注意：eventBus.dispatch 传出的参数通常作为第一个参数
      // 如果 dispatch 直接传的是 info 对象，则如下处理；如果被包了一层 event，需解包
      const info = event;
      // setLayoutInfo(null);
      setLayoutInfo(info);
      props.onLoaded?.(info);

      // 在布局更新时同步一次缩放比例 (防止初始化时漏掉)
      if (pdfViewerApp) setScale(pdfViewerApp.currentScale);
    };

    // 2. 监听缩放变化 (PDF.js 原生事件)
    const onScaleChanging = (evt: any) => {
      // evt.scale 是新的数值缩放比例
      setScale(evt.scale);
    };

    // 注册监听
    pdfViewerApp.on("layoutinfo", onLayoutInfoUpdated);
    pdfViewerApp.on("scalechanging", onScaleChanging);

    onCleanup(() => {
      if (pdfViewerApp) {
        pdfViewerApp.off("layoutinfo", onLayoutInfoUpdated);
        pdfViewerApp.off("scalechanging", onScaleChanging);
        pdfViewerApp.close();
      }
    });
  });

  createEffect(() => {
    const url = pdfUrl();
    if (!pdfViewerApp || !url) return;
    pdfViewerApp.open(url);
  });

  return (
    <>
      <div
        class={cn("relative", props.class)}
        ref={outerRef}
      >
        <div
          style={{
            "--page-bg-color": "white",
          }}
          class="absolute inset-0 overflow-auto bg-muted-foreground"
          id="viewerContainer"
          ref={pdfContainer}
          onWheel={handleWheel}
        >
          <div id="viewer" class="pdfViewer relative"></div>
          {layoutInfo() &&
            props.renderOverlay?.({ info: layoutInfo()! })}
        </div>

        {/* 顶部占位 */}
        <div class="absolute top-2 right-2 z-50">{}</div>

        {/* 底部控制栏 */}
        <div class="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/90 px-3 py-2 shadow-lg backdrop-blur-sm">
          {/* 适应页面按钮 */}
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-full"
            onClick={() => pdfViewerApp?.zoomToFit()}
            title="适应页面"
          >
            <MaximizeIcon class="size-4" />
          </Button>

          {/* 分割线 (可选) */}
          <div class="mx-1 h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-full"
            onClick={() => pdfViewerApp?.zoomOut(1)}
            title="缩小"
          >
            <ZoomOutIcon class="size-4" />
          </Button>

          {/* 缩放比例显示 */}
          <span class="min-w-12 text-center text-sm font-medium tabular-nums select-none">
            {Math.round(scale() * 100)}%
          </span>

          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-full"
            onClick={() => pdfViewerApp?.zoomIn(1)}
            title="放大"
          >
            <ZoomInIcon class="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
