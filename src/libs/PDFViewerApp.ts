import "./viewer.css";
import * as pdfjsLib from "pdfjs-dist";
import * as pdfjsViewer from "pdfjs-dist/web/pdf_viewer.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

// ... (类型定义保持不变)
export type PdfFormInfo = {
  id: string;
  name?: string;
  type?: string;
  value?: any;
  annotationType?: typeof pdfjsLib.AnnotationType;
  options?: {
    value: string;
    label: string;
  }[];
  /**
   * 表单在 PDF 文档中的矩形区域
   */
  pdfRect: [number, number, number, number];
  /**
   * 表单在页面中的矩形区域
   */
  pageRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /**
   * 表单在容器中的矩形区域
   */
  containerRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  appearanceData?: { fontName?: string; fontSize?: number };
};

export type PdfPageInfo = {
  pageNumber: number;
  /**
   * 页面在容器中的矩形区域
   */
  containerRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  forms: PdfFormInfo[];
  scale: number;
};

export type PdfLayoutInfo = {
  container: {
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
  };
  pages: PdfPageInfo[];
  scale: number;
};

// ... (库检查代码保持不变)

const MAX_CANVAS_PIXELS = -1;
const MAX_CANVAS_DIM = -1;
const TEXT_LAYER_MODE = 1;
const CMAP_URL = "/cmaps/";
const CMAP_PACKED = true;
const MAX_IMAGE_SIZE = 1024 * 1024;
const DEFAULT_SCALE_DELTA = 1.1;
const MIN_SCALE = 0.25;
const MAX_SCALE = 5.0;
const DEFAULT_SCALE_VALUE = "auto";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export class PDFViewerApp {
  pdfLoadingTask: pdfjsLib.PDFDocumentLoadingTask | null =
    null;
  pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
  pdfViewer: pdfjsViewer.PDFViewer | null = null;
  pdfHistory: pdfjsViewer.PDFHistory | null = null;
  pdfLinkService: pdfjsViewer.PDFLinkService | null = null;
  eventBus: pdfjsViewer.EventBus | null = null;
  resizeObserver: ResizeObserver | null = null;

  // --- 新增：缓存 ---
  private pageCache = new Map<
    number,
    pdfjsLib.PDFPageProxy
  >();
  private annotationCache = new Map<number, any[]>();

  private layoutUpdateTimer: number | undefined;

  constructor(container: HTMLDivElement) {
    const eventBus = new pdfjsViewer.EventBus();
    this.eventBus = eventBus;

    const viewer = container.querySelector(
      "#viewer",
    ) as HTMLDivElement | null;
    if (!viewer)
      throw new Error("Viewer element not found");

    const linkService = new pdfjsViewer.PDFLinkService({
      eventBus,
    });
    this.pdfLinkService = linkService;

    const pdfViewer = new pdfjsViewer.PDFViewer({
      container,
      viewer,
      eventBus,
      linkService,
      // maxCanvasPixels: MAX_CANVAS_PIXELS,
      maxCanvasDim: MAX_CANVAS_DIM,
      enableDetailCanvas: true,
      textLayerMode: TEXT_LAYER_MODE,
      annotationMode: pdfjsLib.AnnotationMode.DISABLE,
      supportsPinchToZoom: true,
    });
    linkService.setViewer(pdfViewer);
    this.pdfViewer = pdfViewer;

    const pdfHistory = new pdfjsViewer.PDFHistory({
      eventBus,
      linkService,
    });
    this.pdfHistory = pdfHistory;

    eventBus.on("pagesinit", () => {
      pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE;
    });

    eventBus.on("scalechanging", this.scheduleLayoutUpdate);
    eventBus.on("pagesloaded", this.scheduleLayoutUpdate);

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleLayoutUpdate();
    });
    this.resizeObserver.observe(container);
  }

  // --- 新增：公共事件监听方法 ---
  on(eventName: string, listener: (event: any) => void) {
    this.eventBus?.on(eventName, listener);
  }

  off(eventName: string, listener: (event: any) => void) {
    this.eventBus?.off(eventName, listener);
  }

  // 调度布局更新
  private scheduleLayoutUpdate = () => {
    if (this.layoutUpdateTimer)
      clearTimeout(this.layoutUpdateTimer);
    this.layoutUpdateTimer = window.setTimeout(async () => {
      const info = await this.calculateLayoutInfo();
      if (info && this.eventBus) {
        this.eventBus.dispatch("layoutinfo", info);
      }
    }, 100);
  };

  // 计算布局信息（使用缓存）
  async calculateLayoutInfo(): Promise<PdfLayoutInfo | null> {
    if (!this.pdfViewer || !this.pdfDocument) return null;

    const pdfDoc = this.pdfDocument;
    const pdfViewer = this.pdfViewer;
    const containerEl = pdfViewer.container;

    const container = {
      clientWidth: containerEl.clientWidth,
      clientHeight: containerEl.clientHeight,
      scrollWidth: containerEl.scrollWidth,
      scrollHeight: containerEl.scrollHeight,
    };

    const pages = await Promise.all(
      Array.from({ length: pdfDoc.numPages }).map(
        async (_, index) => {
          const pageNumber = index + 1;

          // --- 使用缓存获取 Page ---
          let page: pdfjsLib.PDFPageProxy;
          if (this.pageCache.has(pageNumber)) {
            page = this.pageCache.get(pageNumber)!;
          } else {
            page = await pdfDoc.getPage(pageNumber);
            this.pageCache.set(pageNumber, page);
          }

          const pageView = pdfViewer.getPageView(index);
          console.debug("pageView:", pageView);
          if (!pageView || !pageView.div) {
            return {
              pageNumber,
              containerRect: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
              },
              forms: [],
              scale: pdfViewer.currentScale,
            } satisfies PdfPageInfo;
          }

          const viewport = pageView.viewport;
          // 计算page相对container左上角的矩形位置
          const el: HTMLElement = pageView.div;
          const style = getComputedStyle(el);
          const borderLeft =
            parseFloat(style.borderLeftWidth) || 0;
          const borderTop =
            parseFloat(style.borderTopWidth) || 0;
          const marginLeft =
            parseFloat(style.marginLeft) || 0;
          const marginTop =
            parseFloat(style.marginTop) || 0;
          console.debug(
            "borderLeft:",
            borderLeft,
            "borderTop:",
            borderTop,
            "marginLeft:",
            marginLeft,
            "marginTop:",
            marginTop,
            "offsetLeft:",
            el.offsetLeft,
            "offsetTop:",
            el.offsetTop,
          );
          const x =
            Math.max(el.offsetLeft, marginLeft) +
            borderLeft;
          const y =
            Math.max(el.offsetTop, marginTop) + borderTop;
          const width = el.clientWidth;
          const height = el.clientHeight;

          // --- 使用缓存获取 Annotation ---
          let rawAnnotations: any[];
          if (this.annotationCache.has(pageNumber)) {
            rawAnnotations =
              this.annotationCache.get(pageNumber)!;
          } else {
            rawAnnotations = await page.getAnnotations({
              intent: "display",
            });
            this.annotationCache.set(
              pageNumber,
              rawAnnotations,
            );
          }

          const forms: PdfFormInfo[] = rawAnnotations
            .filter((a: any) => a.subtype === "Widget")
            .map((a: any, index: number) => {
              // console.debug("raw form:", a);
              if (index === 0) {
              }
              const [vx1, vy2, vx2, vy1] =
                viewport.convertToViewportRectangle(a.rect);
              const w = vx2 - vx1;
              const h = vy2 - vy1;
              return {
                id: a.id,
                name: a.fieldName,
                type: a.fieldType,
                value: a.fieldValue,
                annotationType: a.annotationType,
                options: a.options?.map((o: any) => ({
                  value: o.exportValue,
                  label: o.displayValue,
                })),
                pdfRect: a.rect as [
                  number,
                  number,
                  number,
                  number,
                ],
                pageRect: {
                  x: vx1,
                  y: vy1,
                  width: w,
                  height: h,
                },
                containerRect: {
                  x: x + vx1,
                  y: y + vy1,
                  width: w,
                  height: h,
                },
                appearanceData: a.defaultAppearanceData,
              } satisfies PdfFormInfo;
            });

          return {
            pageNumber,
            containerRect: {
              x,
              y,
              width,
              height,
            },
            forms,
            scale: pageView.scale,
          } satisfies PdfPageInfo;
        },
      ),
    );

    return {
      container,
      pages,
      scale: pdfViewer.currentScale,
    } satisfies PdfLayoutInfo;
  }

  async open(url: string): Promise<void> {
    if (!this.pdfViewer)
      throw new Error("PDFViewer not initialized");
    if (this.pdfLoadingTask) {
      await this.close();
      return await this.open(url);
    }

    // 确保每次打开新文件时清空缓存
    this.pageCache.clear();
    this.annotationCache.clear();

    const loadingTask = pdfjsLib.getDocument({
      url,
      maxImageSize: MAX_IMAGE_SIZE,
      cMapUrl: CMAP_URL,
      cMapPacked: CMAP_PACKED,
    });
    this.pdfLoadingTask = loadingTask;

    return loadingTask.promise.then(
      (pdfDocument) => {
        this.pdfDocument = pdfDocument;
        this.pdfViewer!.setDocument(pdfDocument);
        this.pdfLinkService!.setDocument(pdfDocument);
        this.pdfHistory!.initialize({
          fingerprint: pdfDocument.fingerprints[0]!,
        });
      },
      (reason) =>
        console.error("Error loading PDF", reason),
    );
  }

  close() {
    if (this.resizeObserver)
      this.resizeObserver.disconnect();
    if (this.layoutUpdateTimer)
      clearTimeout(this.layoutUpdateTimer);

    // --- 清理缓存 ---
    this.pageCache.clear();
    this.annotationCache.clear();

    if (!this.pdfViewer)
      return Promise.reject(new Error("Not initialized"));
    if (!this.pdfLoadingTask) return Promise.resolve();

    const promise = this.pdfLoadingTask.destroy();
    this.pdfLoadingTask = null;

    if (this.pdfDocument) {
      this.pdfDocument = null;
      this.pdfViewer.setDocument(null!);
      this.pdfLinkService?.setDocument(null, null);
      this.pdfHistory?.reset();
    }

    return promise;
  }

  zoomToFit() {
    if (!this.pdfViewer) return;
    // 'page-fit' 是 PDF.js 的内置模式，会自动计算缩放比例使整页可见
    this.pdfViewer.currentScaleValue = "auto";
  }

  // (可选补充) 如果你也想要“适应宽度”功能
  zoomToWidth() {
    if (!this.pdfViewer) return;
    this.pdfViewer.currentScaleValue = "page-width";
  }

  /**
   * 放大
   * @param ticks 缩放级数
   * @param origin 缩放中心点 [x, y] (Client Coordinates)
   */
  zoomIn(ticks: number, origin?: [number, number]) {
    if (!this.pdfViewer) return;

    // 检查是否超过最大比例
    if (this.pdfViewer.currentScale >= MAX_SCALE) {
      this.pdfViewer.currentScale = MAX_SCALE;
      return;
    }

    this.pdfViewer.increaseScale({
      steps: ticks,
      scaleFactor: DEFAULT_SCALE_DELTA, // 这里通常传正数 (1.1)，increaseScale 会做乘法
      origin: origin || [
        this.pdfViewer.container.clientWidth / 2,
        this.pdfViewer.container.clientHeight / 2,
      ],
    });
  }

  /**
   * 缩小
   * @param ticks 缩放级数
   * @param origin 缩放中心点 [x, y] (Client Coordinates)
   */
  zoomOut(ticks: number, origin?: [number, number]) {
    if (!this.pdfViewer) return;

    // 检查是否低于最小比例
    if (this.pdfViewer.currentScale <= MIN_SCALE) {
      this.pdfViewer.currentScale = MIN_SCALE;
      return;
    }

    this.pdfViewer.decreaseScale({
      steps: ticks,
      scaleFactor: -DEFAULT_SCALE_DELTA,
      origin: origin || [
        this.pdfViewer.container.clientWidth / 2,
        this.pdfViewer.container.clientHeight / 2,
      ],
    });
  }

  // 获取当前缩放比例
  get currentScale() {
    return this.pdfViewer?.currentScale || 1;
  }
}
