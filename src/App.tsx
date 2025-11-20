import "@/App.css";
import { For, Show, type Component } from "solid-js";
import { reconcile } from "solid-js/store";
import { optional } from "@/utils/helper";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LoggerProvider } from "@/components/Logger";
import { LogsIcon, Trash2 } from "lucide-solid";
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "@/components/ui/switch";
import { FieldItem } from "@/config";
import { Badge } from "@/components/ui/badge";
import DualRangeSlider from "@/components/extends/range-slider";
import { ButtonGroup } from "@/components/ui/button-group";
import useAppViewModel from "@/hooks/useAppViewModel";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import PreviewTabs from "@/components/PreviewTabs";
import LoggerDrawer from "@/components/LoggerDrawer";
import { Toaster } from "@/components/ui/sonner";

const App: Component = () => {
  return (
    <LoggerProvider timestamp>
      <AppContent />
      <Toaster position="top-center" />
    </LoggerProvider>
  );
};

const AppContent = () => {
  const vm = useAppViewModel();
  return (
    <div class="flex h-full">
      <div class="flex-1">
        <PreviewTabs
          pdf={vm.appData.pdfData}
          xlsx={vm.appData.xlsxData}
          onUpdatePdf={vm.processPdf}
          onUpdateXlsx={vm.processXlsx}
        />
      </div>
      <Tabs class="flex max-w-xs flex-col gap-2 border-l p-2">
        <TabsList class="flex w-full">
          <TabsTrigger value="data">数据</TabsTrigger>
          <TabsTrigger value="gen-setting">
            生成设置
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="data"
          class="relative h-full flex-1 overflow-auto"
        >
          <div class="absolute inset-0 flex flex-col gap-4">
            <div class="grid gap-1.5">
              {vm.appData.xlsxData ? (
                <div class="flex items-start gap-2 rounded-md border p-1 text-sm font-medium shadow-sm">
                  <div class="flex w-full flex-col gap-1">
                    <div class="flex flex-wrap gap-2">
                      <p>
                        {`总列数: ${vm.appData.xlsxData?.headers?.length}`}
                      </p>
                      <p>{`总行数: ${vm.appData.xlsxData?.data?.length}`}</p>
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <For
                        each={vm.appData.xlsxData?.headers}
                      >
                        {(header) => (
                          <Badge variant="secondary">
                            {header}
                          </Badge>
                        )}
                      </For>
                    </div>
                    <Button
                      class="self-end"
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        const input =
                          document.getElementById(
                            "xlsx-upload",
                          ) as HTMLInputElement;
                        if (input) input.value = "";
                        vm.setAppData("xlsxData", null);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ) : (
                <label class="grid w-full max-w-xs gap-1.5">
                  <p class="disabled-next text-sm font-medium">
                    上传Excel文件
                  </p>
                  <Input
                    id="xlsx-upload"
                    type="file"
                    accept=".xlsx"
                    disabled={vm.info.loading}
                    onChange={vm.onXlsxUpload}
                  />
                </label>
              )}
            </div>
            <div class="grid w-full gap-1.5">
              {vm.appData.pdfData ? (
                <div class="flex flex-col gap-1 rounded-md border p-1 text-sm font-medium shadow-sm">
                  <div class="flex flex-1 flex-wrap gap-2">
                    {vm.appData.pdfData.file instanceof
                      File && (
                      <span>{`PDF 模板: "${vm.appData.pdfData.file.name}"`}</span>
                    )}
                    <span>{`总页数: ${vm.appData.pdfData.doc.getPageCount()}`}</span>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <For
                      each={vm.appData.pdfData?.doc
                        .getForm()
                        .getFields()
                        .map((f) => f.getName())}
                    >
                      {(label) => (
                        <Badge variant="secondary">
                          {label}
                        </Badge>
                      )}
                    </For>
                  </div>

                  <Button
                    variant="destructive"
                    size="icon"
                    class="self-end"
                    onClick={() => {
                      const input = document.getElementById(
                        "pdf-upload",
                      ) as HTMLInputElement;
                      if (input) {
                        input.value = "";
                      }
                      vm.setAppData("pdfData", null);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : (
                <label class="flex w-full max-w-xs flex-col gap-1.5">
                  <p class="disabled-next text-sm font-medium">
                    上传PDF模板
                  </p>
                  <Input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    disabled={vm.info.loading}
                    onChange={vm.onPdfUpload}
                  />
                </label>
              )}
            </div>
            <div class="flex w-full max-w-xs flex-col gap-1.5">
              <p class="text-sm font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                工作目录
              </p>
              <Button
                draggable="true"
                disabled={vm.info.loading}
                onClick={vm.onSelectWorkDir}
                onDragOver={(ev) => {
                  ev.preventDefault();
                }}
                onDrop={vm.onDropWorkDir}
              >
                {vm.appData.workDir ? `切换` : `打开选择器`}
              </Button>
              <Show when={vm.appData.workDir}>
                {(handle) => (
                  <div class="flex items-center rounded-md border p-1 text-sm font-medium shadow-sm">
                    <span class="w-full flex-1">{`Current work directory: "${handle().name}"`}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        vm.setAppData("workDir", null)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </Show>
            </div>

            <div class="flex w-full max-w-xs flex-col gap-1.5">
              <p class="text-sm font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                图片目录
              </p>
              <Button
                draggable="true"
                disabled={vm.info.loading}
                onClick={vm.onSelectImgDir}
                onDragOver={(ev) => {
                  ev.preventDefault();
                }}
                onDrop={vm.onDropImgDir}
              >
                {vm.appData.imgDir ? "切换" : "打开选择器"}
              </Button>
              <Show when={vm.appData.imgDir}>
                {(handle) => (
                  <div class="flex items-center rounded-md border p-1 text-sm font-medium shadow-sm">
                    <span class="w-full flex-1">{`Current image directory: "${handle().name}"`}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        vm.setAppData("imgDir", null)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </Show>
            </div>

            <div class="sticky bottom-0 mt-auto flex justify-center bg-background p-2">
              <ButtonGroup>
                <Button
                  disabled={!vm.info.generateEnable}
                  onClick={() =>
                    vm.handleGenerate(
                      vm.option.start,
                      vm.option.end,
                    )
                  }
                >
                  批量生成
                </Button>
                <Button
                  variant="secondary"
                  disabled={!vm.info.generateEnable}
                  onClick={() => vm.handleGenerate(0, 1)}
                >
                  生成一份
                </Button>
              </ButtonGroup>
            </div>
          </div>
        </TabsContent>
        <TabsContent
          value="gen-setting"
          class="relative flex-1 overflow-auto"
        >
          <div class="absolute inset-0 flex flex-col gap-4">
            <div class="flex flex-col items-start gap-1.5">
              <label class="grid w-full max-w-xs gap-1.5">
                <p class="disabled-next text-sm font-medium">
                  自定义字体
                </p>
                <Input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  disabled={vm.info.loading}
                  onChange={(e) => {
                    const file =
                      e.currentTarget.files?.item(0);
                    if (!file) {
                      return;
                    }

                    vm.setCustomFontFile(file);
                  }}
                />
              </label>

              <Show when={vm.customFontFile()}>
                {(font) => (
                  <div class="flex items-center gap-1.5 rounded-md border border-input p-1 shadow-sm">
                    <p class="text-sm">{`使用自定义字体: "${font().name}"`}</p>
                    <Button
                      disabled={vm.info.loading}
                      onClick={(e) => {
                        e.preventDefault();
                        vm.setCustomFontFile(null);
                      }}
                      variant="destructive"
                      size="icon"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </Show>
            </div>
            <DualRangeSlider
              minStepsBetweenThumbs={1}
              disabled={!vm.info.rangeEnable}
              minValue={0}
              maxValue={
                vm.appData.xlsxData?.data.length ?? 0
              }
              value={[
                vm.option.start ?? 0,
                vm.option.end ??
                  vm.appData.xlsxData?.data.length ??
                  0,
              ]}
              initialValue={[
                0,
                vm.appData.xlsxData?.data.length ?? 0,
              ]}
              onValueChange={(value) => {
                vm.setOption(
                  "start",
                  value[0] ?? undefined,
                );
                vm.setOption("end", value[1] ?? undefined);
              }}
              ariaLabel="索引范围"
            />
            <ButtonGroup>
              <Button
                variant="outline"
                disabled={!vm.info.rangeEnable}
                onClick={() => vm.setOption("start", 0)}
              >
                首项
              </Button>
              <Button
                variant="outline"
                disabled={!vm.info.rangeEnable}
                onClick={() =>
                  vm.setOption(
                    "end",
                    vm.appData.xlsxData?.data.length,
                  )
                }
              >
                尾项
              </Button>
            </ButtonGroup>
            <Switch
              disabled={vm.info.loading}
              class="flex items-center gap-2"
              checked={vm.option.skipError}
              onChange={(isChecked) =>
                vm.setOption("skipError", isChecked)
              }
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
              <SwitchLabel class="text-sm leading-none font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                跳过错误
              </SwitchLabel>
            </Switch>
            <Switch
              disabled={vm.info.loading}
              class="flex items-center gap-2"
              checked={vm.option.flattern}
              onChange={(isChecked) =>
                vm.setOption("flattern", isChecked)
              }
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
              <SwitchLabel class="text-sm leading-none font-medium data-disabled:cursor-not-allowed data-disabled:opacity-70">
                扁平化表单（生成后不可编辑）
              </SwitchLabel>
            </Switch>
            <label class="grid w-full max-w-xs gap-1.5">
              <p class="disabled-next text-sm font-medium">
                导出文件名称
              </p>
              <Select
                fitViewport
                disabled={!vm.info.selectColumnEnable}
                optionValue="value"
                optionTextValue="name"
                placeholder="选择列作为文件名"
                defaultValue={vm.availableExportNames()[0]}
                value={
                  vm
                    .availableExportNames()
                    .find(
                      (n) =>
                        n.value ===
                        vm.option.exportFileName,
                    ) ?? vm.availableExportNames()[0]
                }
                onChange={(v) => {
                  vm.setOption(
                    "exportFileName",
                    reconcile(
                      optional(v.value) ?? undefined,
                    ),
                  );
                }}
                options={vm.availableExportNames()}
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {props.item.rawValue.name}
                  </SelectItem>
                )}
              >
                <SelectTrigger class="w-full max-w-xs">
                  <SelectValue<FieldItem>>
                    {(state) =>
                      state.selectedOption()?.name
                    }
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

            <Button
              variant="outline"
              disabled={vm.openLogger()}
              onClick={() => vm.setOpenLogger(true)}
              class="w-full max-w-xs"
            >
              <LogsIcon class="size-4" />
              日志
            </Button>

            <Show when={vm.info.loading}>
              <h1 class="h3">Loading</h1>
            </Show>

            <div class="flex flex-col gap-2">
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
        </TabsContent>
      </Tabs>
      <LoggerDrawer
        logging={vm.info.loading}
        open={vm.openLogger()}
        setOpen={vm.setOpenLogger}
        stats={vm.genStats}
      />
    </div>
  );
};

export default App;
